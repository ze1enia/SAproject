const { readCSV } = require('../utils/csv');

const LOW_STOCK_THRESHOLD = 15;

// branches.csv ใช้รหัส B001 แต่ไฟล์ stock/request/order ใช้ BR001
// -> เทียบกันด้วยเลขท้ายรหัส (B001 == BR001)
const branchNumber = (id) => {
    const match = String(id || '').match(/(\d+)\s*$/);
    return match ? Number(match[1]) : null;
};
const sameBranch = (a, b) => branchNumber(a) !== null && branchNumber(a) === branchNumber(b);

// "6/6/2027" หรือ "4/10/2026 09:00" (วัน/เดือน/ปี) -> Date
const parseDate = (text) => {
    const m = String(text || '').match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
    return m ? new Date(Number(m[3]), Number(m[2]) - 1, Number(m[1])) : null;
};

const toNumber = (value) => Number(value) || 0;

class BranchSummaryService {
    getSummary(branchId) {
        const products = new Map(readCSV('products.csv').map(p => [p.product_id, p.product_name]));
        const productName = (id) => products.get(id) || id;

        // 1. สินค้าใกล้หมด: quantity_on_hand <= 15
        const lowStockItems = readCSV('branch_stocks.csv')
            .filter(s => sameBranch(s.branch_id, branchId) && toNumber(s.quantity_on_hand) <= LOW_STOCK_THRESHOLD)
            .map(s => ({
                product_id: s.product_id,
                product_name: productName(s.product_id),
                quantity: toNumber(s.quantity_on_hand)
            }))
            .sort((a, b) => a.quantity - b.quantity);

        // 2. ล็อตที่ยังเหลือของ (ต้องขายตามลำดับวันหมดอายุ - FIFO) จัดกลุ่มตามเดือนที่หมดอายุ
        const batches = readCSV('stock_batches.csv')
            .filter(b => sameBranch(b.branch_id, branchId) && toNumber(b.quantity_remaining) > 0)
            .map(b => ({ ...b, expiry: parseDate(b.expiry_date) }))
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
        const requests = readCSV('stock_requests.csv').filter(r => sameBranch(r.branch_id, branchId));
        const requestStatus = {};
        requests.forEach(r => { requestStatus[r.status] = (requestStatus[r.status] || 0) + 1; });

        // 4-5. รอบจัดส่ง: หาสาขาจาก purchase_orders
        const orderBranch = new Map(readCSV('purchase_orders.csv').map(po => [po.purchase_order_id, po.branch_id]));
        const arrivals = readCSV('stock_arrivals.csv')
            .filter(a => sameBranch(orderBranch.get(a.purchase_order_id), branchId));
        const inspected = new Set(readCSV('quality_inspections.csv').map(q => q.arrival_id));

        const pendingArrivals = arrivals.filter(a => a.delivery_status === 'Partial');
        const pendingInspections = arrivals.filter(a => !inspected.has(a.arrival_id));
        const arrivalInfo = (a) => ({
            arrival_id: a.arrival_id,
            purchase_order_id: a.purchase_order_id,
            arrival_date: a.arrival_date,
            delivery_status: a.delivery_status
        });

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
                total: requests.length,
                byStatus: requestStatus
            },
            pendingArrivals: {
                count: pendingArrivals.length,
                items: pendingArrivals.map(arrivalInfo)
            },
            pendingInspections: {
                count: pendingInspections.length,
                items: pendingInspections.map(arrivalInfo)
            }
        };
    }
}

module.exports = { BranchSummaryService, sameBranch };
