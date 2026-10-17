const pool = require('../config/db');
const { ApiError, nextId, num, toDataBranchId } = require('../utils/apiHelpers');

// suppliers was imported with utf8mb4_unicode_ci while every other table is utf8mb4_general_ci,
// so joins on supplier_id spell the collation out.
const ISSUE_TYPES = ['สินค้าชำรุด', 'สินค้าไม่ครบ', 'สินค้าไม่ตรงตามรายการ', 'สินค้าใกล้หมดอายุ/หมดอายุ', 'อื่นๆ'];

let claimsTableReady = false;

// supplier_claims is not in the original SQL dump yet (the doc still says "รอ Query"),
// so the table is created on first use with the same TEXT-column style as the others.
async function ensureClaimsTable() {
    if (claimsTableReady) return;
    await pool.query(
        `CREATE TABLE IF NOT EXISTS supplier_claims (
            claim_id TEXT, arrival_id TEXT, purchase_order_id TEXT, supplier_id TEXT,
            issue_type TEXT, details TEXT, claim_status TEXT, created_by TEXT, created_at TEXT
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`
    );
    claimsTableReady = true;
}

const stamp = () => {
    const d = new Date();
    return `${d.getDate()}/${d.getMonth() + 1}/${d.getFullYear()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
};

class DeliveryService {
    // Q19.1: PurchaseOrder + Supplier + StockArrival
    async list({ branch, search, status } = {}) {
        const where = [];
        const params = [];

        const dataBranch = toDataBranchId(branch);
        if (dataBranch) { where.push('po.branch_id = ?'); params.push(dataBranch); }
        if (search) { where.push('po.purchase_order_id LIKE ?'); params.push(`%${search}%`); }
        if (status) { where.push('po.status = ?'); params.push(status); }

        const [rows] = await pool.query(
            `SELECT po.purchase_order_id, po.branch_id, po.supplier_id, s.supplier_name, s.contact_person, s.phone,
                    po.order_date, po.status AS order_status, po.total_amount,
                    sa.arrival_id, sa.arrival_date, sa.delivery_status, qi.result AS inspection_result
             FROM purchase_orders po
             LEFT JOIN suppliers s ON s.supplier_id = po.supplier_id COLLATE utf8mb4_general_ci
             LEFT JOIN stock_arrivals sa ON sa.purchase_order_id = po.purchase_order_id
             LEFT JOIN quality_inspections qi ON qi.arrival_id = sa.arrival_id
             ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
             ORDER BY CAST(SUBSTRING(po.purchase_order_id, 3) AS UNSIGNED) DESC`,
            params
        );

        const items = rows.map(r => ({ ...r, total_amount: num(r.total_amount) }));
        const count = (fn) => items.filter(fn).length;
        return {
            summary: {
                orders: items.length,
                waiting: count(i => ['Sent', 'Draft'].includes(i.order_status) && !i.arrival_id),
                partial: count(i => i.delivery_status === 'Partial' || i.order_status === 'PartiallyReceived'),
                received: count(i => i.order_status === 'Received')
            },
            items
        };
    }

    async detail(purchaseOrderId) {
        const [orders] = await pool.query(
            `SELECT po.*, s.supplier_name, s.contact_person, s.phone, s.email, s.address AS supplier_address,
                    u.username AS created_by_name
             FROM purchase_orders po
             LEFT JOIN suppliers s ON s.supplier_id = po.supplier_id COLLATE utf8mb4_general_ci
             LEFT JOIN users u ON u.user_id = po.created_by
             WHERE po.purchase_order_id = ? LIMIT 1`, [purchaseOrderId]
        );
        if (!orders[0]) throw new ApiError(404, 'ไม่พบรหัสใบสั่งซื้อที่ระบุ');
        const po = orders[0];

        const [arrivals] = await pool.query(
            `SELECT sa.*, u.username AS received_by_name FROM stock_arrivals sa
             LEFT JOIN users u ON u.user_id = sa.received_by
             WHERE sa.purchase_order_id = ? LIMIT 1`, [purchaseOrderId]
        );
        const arrival = arrivals[0] || null;

        let inspection = null;
        if (arrival) {
            const [qi] = await pool.query(
                `SELECT q.*, u.username AS inspected_by_name FROM quality_inspections q
                 LEFT JOIN users u ON u.user_id = q.inspected_by
                 WHERE q.arrival_id = ? LIMIT 1`, [arrival.arrival_id]
            );
            inspection = qi[0] || null;
        }

        const [items] = await pool.query(
            `SELECT poi.purchase_order_item_id, poi.product_id, p.product_name, p.unit,
                    poi.ordered_quantity, poi.unit_cost,
                    ai.quantity_received, ai.quantity_rejected
             FROM purchase_order_items poi
             LEFT JOIN products p ON p.product_id = poi.product_id
             LEFT JOIN stock_arrival_items ai ON ai.purchase_order_item_id = poi.purchase_order_item_id
             WHERE poi.purchase_order_id = ?
             ORDER BY poi.purchase_order_item_id`, [purchaseOrderId]
        );

        return {
            purchase_order_id: po.purchase_order_id,
            branch_id: po.branch_id,
            order_date: po.order_date,
            order_status: po.status,
            total_amount: num(po.total_amount),
            created_by: po.created_by_name,
            supplier: {
                supplier_id: po.supplier_id,
                supplier_name: po.supplier_name,
                contact_person: po.contact_person,
                phone: po.phone,
                email: po.email,
                address: po.supplier_address
            },
            arrival: arrival && {
                arrival_id: arrival.arrival_id,
                arrival_date: arrival.arrival_date,
                delivery_status: arrival.delivery_status,
                received_by: arrival.received_by_name,
                notes: arrival.notes
            },
            inspection: inspection && {
                result: inspection.result,
                inspected_by: inspection.inspected_by_name,
                inspection_date: inspection.inspection_date,
                remarks: inspection.remarks
            },
            items: items.map(i => ({
                ...i,
                ordered_quantity: num(i.ordered_quantity),
                unit_cost: num(i.unit_cost),
                quantity_received: i.quantity_received === null ? null : num(i.quantity_received),
                quantity_rejected: i.quantity_rejected === null ? null : num(i.quantity_rejected)
            }))
        };
    }

    // ---- suppliers ------------------------------------------------------------
    async listSuppliers() {
        const [rows] = await pool.query(
            `SELECT s.supplier_id, s.supplier_name, s.contact_person, s.phone, s.email, s.address,
                    COUNT(po.purchase_order_id) AS order_count
             FROM suppliers s
             LEFT JOIN purchase_orders po ON po.supplier_id = s.supplier_id COLLATE utf8mb4_general_ci
             GROUP BY s.supplier_id, s.supplier_name, s.contact_person, s.phone, s.email, s.address
             ORDER BY s.supplier_id`
        );
        return rows.map(r => ({ ...r, order_count: num(r.order_count) }));
    }

    // ---- QC issues -> claims ----------------------------------------------------
    // arrivals with rejected units or an inspection that was not a clean "Pass"
    async qcIssues({ branch } = {}) {
        await ensureClaimsTable();
        const dataBranch = toDataBranchId(branch);

        const [rows] = await pool.query(
            `SELECT sa.arrival_id, sa.arrival_date, po.purchase_order_id, po.branch_id,
                    s.supplier_id, s.supplier_name, s.contact_person, s.phone, s.email,
                    qi.result AS inspection_result, qi.remarks AS inspection_remarks,
                    (SELECT COALESCE(SUM(CAST(ai.quantity_rejected AS UNSIGNED)), 0)
                       FROM stock_arrival_items ai WHERE ai.arrival_id = sa.arrival_id) AS rejected_units,
                    (SELECT COUNT(*) FROM supplier_claims c WHERE c.arrival_id = sa.arrival_id) AS claim_count
             FROM stock_arrivals sa
             JOIN purchase_orders po ON po.purchase_order_id = sa.purchase_order_id
             LEFT JOIN suppliers s ON s.supplier_id = po.supplier_id COLLATE utf8mb4_general_ci
             LEFT JOIN quality_inspections qi ON qi.arrival_id = sa.arrival_id
             ${dataBranch ? 'WHERE po.branch_id = ?' : ''}
             ORDER BY CAST(SUBSTRING(sa.arrival_id, 4) AS UNSIGNED) DESC`,
            dataBranch ? [dataBranch] : []
        );

        const issues = rows
            .map(r => ({ ...r, rejected_units: num(r.rejected_units), claim_count: num(r.claim_count) }))
            .filter(r => r.rejected_units > 0 || (r.inspection_result && r.inspection_result !== 'Pass'));

        // which products were rejected
        for (const issue of issues) {
            const [items] = await pool.query(
                `SELECT p.product_name, ai.quantity_rejected
                 FROM stock_arrival_items ai
                 JOIN purchase_order_items poi ON poi.purchase_order_item_id = ai.purchase_order_item_id
                 LEFT JOIN products p ON p.product_id = poi.product_id
                 WHERE ai.arrival_id = ? AND CAST(ai.quantity_rejected AS UNSIGNED) > 0`, [issue.arrival_id]
            );
            issue.rejected_items = items.map(i => ({ product_name: i.product_name, quantity_rejected: num(i.quantity_rejected) }));
        }
        return { issueTypes: ISSUE_TYPES, items: issues };
    }

    async listClaims({ branch } = {}) {
        await ensureClaimsTable();
        const dataBranch = toDataBranchId(branch);
        const [rows] = await pool.query(
            `SELECT c.claim_id, c.arrival_id, c.purchase_order_id, c.supplier_id, s.supplier_name,
                    c.issue_type, c.details, c.claim_status, u.username AS created_by, c.created_at
             FROM supplier_claims c
             LEFT JOIN suppliers s ON s.supplier_id = c.supplier_id COLLATE utf8mb4_general_ci
             LEFT JOIN users u ON u.user_id = c.created_by
             LEFT JOIN purchase_orders po ON po.purchase_order_id = c.purchase_order_id
             ${dataBranch ? 'WHERE po.branch_id = ?' : ''}
             ORDER BY CAST(SUBSTRING(c.claim_id, 4) AS UNSIGNED) DESC`,
            dataBranch ? [dataBranch] : []
        );
        return rows;
    }

    // UC-13: สร้าง Claim Ticket
    async createClaim({ arrival_id, issue_type, details }, userId) {
        await ensureClaimsTable();
        if (!arrival_id) throw new ApiError(400, 'กรุณาเลือกรายการที่ต้องการแจ้งปัญหา');
        if (!ISSUE_TYPES.includes(issue_type)) throw new ApiError(400, 'กรุณาเลือกหัวข้อปัญหา');
        if (!String(details || '').trim()) throw new ApiError(400, 'กรุณาระบุรายละเอียดปัญหาที่พบ');

        const [arrivals] = await pool.query(
            `SELECT sa.arrival_id, po.purchase_order_id, po.supplier_id
             FROM stock_arrivals sa JOIN purchase_orders po ON po.purchase_order_id = sa.purchase_order_id
             WHERE sa.arrival_id = ? LIMIT 1`, [arrival_id]
        );
        if (!arrivals[0]) throw new ApiError(404, 'ไม่พบรายการจัดส่งที่เลือก');

        const claimId = await nextId(pool, 'supplier_claims', 'claim_id', 'CLM', 4);
        await pool.query(
            `INSERT INTO supplier_claims
               (claim_id, arrival_id, purchase_order_id, supplier_id, issue_type, details, claim_status, created_by, created_at)
             VALUES (?, ?, ?, ?, ?, ?, 'Open', ?, ?)`,
            [claimId, arrival_id, arrivals[0].purchase_order_id, arrivals[0].supplier_id, issue_type,
             String(details).trim(), userId || null, stamp()]
        );
        return { claim_id: claimId, arrival_id, issue_type, claim_status: 'Open' };
    }
}

module.exports = { DeliveryService, ISSUE_TYPES };
