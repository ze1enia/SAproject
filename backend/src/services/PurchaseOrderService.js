const pool = require('../config/db');
const { ApiError, nextId, num, nowStamp, assertBranchAccess } = require('../utils/apiHelpers');

// Draft -> Sent -> (PartiallyReceived -> Received happens through Stock Arrival); Cancelled only before goods arrive
const TRANSITIONS = { Draft: ['Sent', 'Cancelled'], Sent: ['Cancelled'] };

class PurchaseOrderService {
    // everything the "new purchase order" form needs
    async formData(dataBranch) {
        const [products] = await pool.query(
            `SELECT product_id, product_name, unit, cost_price FROM products WHERE LOWER(product_status) = 'active' ORDER BY product_name`
        );
        const [suppliers] = await pool.query('SELECT supplier_id, supplier_name, contact_person, phone FROM suppliers ORDER BY supplier_id');
        const [requests] = await pool.query(
            `SELECT sr.request_id, sr.request_date FROM stock_requests sr
             WHERE sr.branch_id = ? AND sr.status = 'Approved'
               AND NOT EXISTS (SELECT 1 FROM purchase_orders po WHERE po.request_id = sr.request_id AND po.status <> 'Cancelled')
             ORDER BY CAST(SUBSTRING(sr.request_id, 4) AS UNSIGNED) DESC`, [dataBranch]
        );
        const [items] = requests.length
            ? await pool.query('SELECT request_id, product_id, CAST(requested_quantity AS UNSIGNED) AS qty FROM stock_request_items WHERE request_id IN (?)', [requests.map((r) => r.request_id)])
            : [[]];
        return {
            products: products.map((p) => ({ ...p, cost_price: num(p.cost_price) })),
            suppliers,
            approved_requests: requests.map((r) => ({ ...r, items: items.filter((i) => i.request_id === r.request_id).map((i) => ({ product_id: i.product_id, quantity: num(i.qty) })) }))
        };
    }

    async create(dataBranch, body, userId) {
        const [suppliers] = await pool.query('SELECT supplier_id FROM suppliers WHERE supplier_id = ?', [body.supplier_id || '']);
        if (!suppliers[0]) throw new ApiError(400, 'กรุณาเลือก Supplier');

        const items = Array.isArray(body.items) ? body.items : [];
        if (!items.length) throw new ApiError(400, 'กรุณาเพิ่มสินค้าอย่างน้อย 1 รายการ');

        const seen = new Set();
        const lines = items.map((item) => {
            const qty = Number(item.ordered_quantity);
            const cost = Number(item.unit_cost);
            if (!item.product_id || seen.has(item.product_id)) throw new ApiError(400, 'ไม่สามารถเลือกสินค้ารหัสเดิมซ้ำในใบสั่งซื้อเดียวกันได้');
            if (!Number.isInteger(qty) || qty <= 0) throw new ApiError(400, 'จำนวนที่สั่งต้องเป็นจำนวนเต็มที่มากกว่า 0');
            if (!Number.isFinite(cost) || cost <= 0) throw new ApiError(400, 'ราคาต่อหน่วยต้องเป็นตัวเลขที่มากกว่า 0');
            seen.add(item.product_id);
            return { product_id: item.product_id, qty, cost: Math.round(cost * 100) / 100 };
        });

        const connection = await pool.getConnection();
        try {
            await connection.beginTransaction();

            const [found] = await connection.query(`SELECT product_id FROM products WHERE LOWER(product_status) = 'active' AND product_id IN (?)`, [lines.map((l) => l.product_id)]);
            if (found.length !== lines.length) throw new ApiError(400, 'พบสินค้าที่ไม่มีอยู่ในระบบหรือปิดใช้งานแล้ว');

            let requestId = null;
            if (body.request_id) {
                const [reqs] = await connection.query(`SELECT request_id FROM stock_requests WHERE request_id = ? AND branch_id = ? AND status = 'Approved'`, [body.request_id, dataBranch]);
                if (!reqs[0]) throw new ApiError(400, 'คำขอ Stock ที่เลือกต้องเป็นคำขอที่อนุมัติแล้วของสาขานี้');
                requestId = body.request_id;
            }

            const poId = await nextId(connection, 'purchase_orders', 'purchase_order_id', 'PO', 4);
            const total = Math.round(lines.reduce((sum, l) => sum + l.qty * l.cost, 0) * 100) / 100;
            await connection.query(
                `INSERT INTO purchase_orders (purchase_order_id, branch_id, supplier_id, request_id, created_by, order_date, status, total_amount)
                 VALUES (?, ?, ?, ?, ?, ?, 'Draft', ?)`, [poId, dataBranch, body.supplier_id, requestId, userId, nowStamp(), total]
            );
            let n = Number((await nextId(connection, 'purchase_order_items', 'purchase_order_item_id', 'POI', 4)).slice(3));
            for (const l of lines) {
                await connection.query(
                    'INSERT INTO purchase_order_items (purchase_order_item_id, purchase_order_id, product_id, ordered_quantity, unit_cost) VALUES (?, ?, ?, ?, ?)',
                    ['POI' + String(n++).padStart(4, '0'), poId, l.product_id, l.qty, l.cost]
                );
            }
            await connection.commit();
            return { purchase_order_id: poId, status: 'Draft', total_amount: total };
        } catch (error) {
            await connection.rollback();
            throw error;
        } finally {
            connection.release();
        }
    }

    // UC-09: update the purchase status
    async setStatus(poId, status, userId) {
        if (!status) throw new ApiError(400, 'โปรดเลือกสถานะการจัดซื้อที่ต้องการอัปเดต');
        const [rows] = await pool.query('SELECT purchase_order_id, branch_id, status FROM purchase_orders WHERE purchase_order_id = ?', [poId]);
        const po = rows[0];
        if (!po) throw new ApiError(404, 'ไม่พบรหัสใบสั่งซื้อที่ระบุ');
        await assertBranchAccess(pool, userId, po.branch_id);

        if (!(TRANSITIONS[po.status] || []).includes(status)) {
            throw new ApiError(409, `เปลี่ยนสถานะจาก ${po.status} เป็น ${status} ไม่ได้`);
        }
        const [result] = await pool.query('UPDATE purchase_orders SET status = ? WHERE purchase_order_id = ? AND status = ?', [status, poId, po.status]);
        if (!result.affectedRows) throw new ApiError(409, 'สถานะใบสั่งซื้อมีการเปลี่ยนแปลงแล้ว กรุณารีเฟรชหน้า');
        return { purchase_order_id: poId, status, previous: po.status, updated_at: nowStamp() };
    }

    async branchOf(poId) {
        const [rows] = await pool.query('SELECT branch_id FROM purchase_orders WHERE purchase_order_id = ?', [poId]);
        if (!rows[0]) throw new ApiError(404, 'ไม่พบรหัสใบสั่งซื้อที่ระบุ');
        return rows[0].branch_id;
    }
}

module.exports = { PurchaseOrderService, TRANSITIONS };
