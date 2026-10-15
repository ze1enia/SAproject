const pool = require('../config/db');
const { num, toDataBranchId, parseThaiDate } = require('../utils/apiHelpers');

const LOW_STOCK_THRESHOLD = 15;

// ตัวเลขสรุปของหน้า Branch dashboard - อ่านจาก MySQL เสมอ จึงเห็นผลของการอนุมัติคำขอ /
// รับสินค้า / ปรับสต็อกที่ทำผ่านหน้าอื่นทันที
// (ทุกตารางใช้รหัสสาขารูปแบบเดียวกัน คือ B001 - toDataBranchId แค่ปรับรูปแบบของค่าที่รับเข้ามา)
class BranchSummaryService {
    async getSummary(branchId) {
        const dataBranch = toDataBranchId(branchId);

        // 1. สินค้าใกล้หมด: quantity_on_hand <= 15 (น้อยสุดก่อน)
        const [lowRows] = await pool.query(
            `SELECT bs.product_id, p.product_name, CAST(bs.quantity_on_hand AS SIGNED) AS quantity
             FROM branch_stocks bs
             LEFT JOIN products p ON p.product_id = bs.product_id
             WHERE bs.branch_id = ? AND CAST(bs.quantity_on_hand AS SIGNED) <= ?
             ORDER BY quantity, p.product_name`,
            [dataBranch, LOW_STOCK_THRESHOLD]
        );
        const lowStockItems = lowRows.map(r => ({
            product_id: r.product_id,
            product_name: r.product_name || r.product_id,
            quantity: num(r.quantity)
        }));

        // 2. ล็อตที่ยังเหลือของ (ต้องขายตามลำดับวันหมดอายุ - FIFO) จัดกลุ่มตามเดือนที่หมดอายุ
        const [batchRows] = await pool.query(
            `SELECT expiry_date FROM stock_batches
             WHERE branch_id = ? AND CAST(quantity_remaining AS SIGNED) > 0`,
            [dataBranch]
        );
        const batches = batchRows
            .map(b => ({ expiry_date: b.expiry_date, expiry: parseThaiDate(b.expiry_date) }))
            // ล็อตที่ไม่มีวันหมดอายุไว้ท้ายสุด
            .sort((a, b) => (a.expiry ? a.expiry.getTime() : Infinity) - (b.expiry ? b.expiry.getTime() : Infinity));

        const byMonth = new Map();
        batches.forEach(b => {
            const key = b.expiry
                ? `${b.expiry.getFullYear()}-${String(b.expiry.getMonth() + 1).padStart(2, '0')}`
                : 'none';
            byMonth.set(key, (byMonth.get(key) || 0) + 1);
        });

        // 3. คำขอเบิก แยกตามสถานะ (สนใจ Pending)
        const [statusRows] = await pool.query(
            'SELECT status, COUNT(*) AS n FROM stock_requests WHERE branch_id = ? GROUP BY status',
            [dataBranch]
        );
        const requestStatus = {};
        let requestTotal = 0;
        statusRows.forEach(r => { requestStatus[r.status] = num(r.n); requestTotal += num(r.n); });

        // 4-5. รอบจัดส่งของสาขา (หาสาขาจาก purchase_orders)
        const arrivalSql = (extra) =>
            `SELECT sa.arrival_id, sa.purchase_order_id, sa.arrival_date, sa.delivery_status
             FROM stock_arrivals sa
             JOIN purchase_orders po ON po.purchase_order_id = sa.purchase_order_id
             WHERE po.branch_id = ? ${extra}
             ORDER BY CAST(SUBSTRING(sa.arrival_id, 4) AS UNSIGNED)`;

        const [pendingArrivals] = await pool.query(arrivalSql(`AND sa.delivery_status = 'Partial'`), [dataBranch]);
        const [pendingInspections] = await pool.query(
            arrivalSql('AND NOT EXISTS (SELECT 1 FROM quality_inspections q WHERE q.arrival_id = sa.arrival_id)'),
            [dataBranch]
        );

        return {
            lowStock: {
                threshold: LOW_STOCK_THRESHOLD,
                count: lowStockItems.length,
                items: lowStockItems
            },
            fifoBatches: {
                count: batches.length,
                nextExpiry: batches[0] && batches[0].expiry ? batches[0].expiry_date : null,
                byExpiryMonth: [...byMonth].map(([month, count]) => ({ month, count }))
            },
            pendingRequests: {
                count: requestStatus.Pending || 0,
                total: requestTotal,
                byStatus: requestStatus
            },
            pendingArrivals: {
                count: pendingArrivals.length,
                items: pendingArrivals.map(a => ({ ...a }))
            },
            pendingInspections: {
                count: pendingInspections.length,
                items: pendingInspections.map(a => ({ ...a }))
            }
        };
    }
}

module.exports = { BranchSummaryService };
