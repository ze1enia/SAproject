const pool = require('../config/db');
const { num, toDataBranchId } = require('../utils/apiHelpers');

const LOW_STOCK_THRESHOLD = 15;
const EXPIRING_SOON_DAYS = 30;

// "6/6/2027" / "4/10/2026 09:00" (วัน/เดือน/ปี) -> Date
const parseDate = (text) => {
    const m = String(text || '').match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
    return m ? new Date(Number(m[3]), Number(m[2]) - 1, Number(m[1])) : null;
};

class StockService {
    // Q3.3: จำนวนคงเหลือของสินค้าในสาขา
    async overview(branchId, { search } = {}) {
        const dataBranch = toDataBranchId(branchId);
        const params = [dataBranch];
        let searchSql = '';
        if (search) {
            searchSql = 'AND (p.product_name LIKE ? OR p.product_id LIKE ?)';
            params.push(`%${search}%`, `%${search}%`);
        }

        const [rows] = await pool.query(
            `SELECT bs.product_id, p.product_name, p.category_id, c.category_name, p.unit,
                    bs.quantity_on_hand, bs.quantity_reserved, bs.updated_at
             FROM branch_stocks bs
             JOIN products p ON p.product_id = bs.product_id
             LEFT JOIN categories c ON c.category_id = p.category_id
             WHERE bs.branch_id = ? ${searchSql}
             ORDER BY CAST(bs.quantity_on_hand AS UNSIGNED), p.product_name`,
            params
        );

        // earliest expiry among the batches that still have stock
        const [batches] = await pool.query(
            `SELECT product_id, expiry_date FROM stock_batches
             WHERE branch_id = ? AND CAST(quantity_remaining AS UNSIGNED) > 0`, [dataBranch]
        );
        const nextExpiry = new Map();
        batches.forEach(b => {
            const d = parseDate(b.expiry_date);
            if (!d) return;
            const current = nextExpiry.get(b.product_id);
            if (!current || d < current.date) nextExpiry.set(b.product_id, { date: d, text: b.expiry_date });
        });

        const items = rows.map(r => {
            const onHand = num(r.quantity_on_hand);
            const reserved = num(r.quantity_reserved);
            return {
                product_id: r.product_id,
                product_name: r.product_name,
                category_id: r.category_id,
                category_name: r.category_name,
                unit: r.unit,
                quantity_on_hand: onHand,
                quantity_reserved: reserved,
                available: onHand - reserved,
                status: onHand === 0 ? 'out' : onHand <= LOW_STOCK_THRESHOLD ? 'low' : 'ok',
                next_expiry: nextExpiry.has(r.product_id) ? nextExpiry.get(r.product_id).text : null,
                updated_at: r.updated_at
            };
        });

        return {
            threshold: LOW_STOCK_THRESHOLD,
            summary: {
                products: items.length,
                units: items.reduce((sum, i) => sum + i.quantity_on_hand, 0),
                reserved: items.reduce((sum, i) => sum + i.quantity_reserved, 0),
                low: items.filter(i => i.status === 'low').length,
                out: items.filter(i => i.status === 'out').length
            },
            items
        };
    }

    // FIFO: ล็อตที่ยังเหลือของ เรียงตามวันหมดอายุ (ไม่มีวันหมดอายุไว้ท้าย)
    async batches(branchId) {
        const [rows] = await pool.query(
            `SELECT b.batch_id, b.product_id, p.product_name, p.unit, b.received_at, b.expiry_date,
                    b.quantity_received, b.quantity_remaining
             FROM stock_batches b
             LEFT JOIN products p ON p.product_id = b.product_id
             WHERE b.branch_id = ? AND CAST(b.quantity_remaining AS UNSIGNED) > 0`,
            [toDataBranchId(branchId)]
        );

        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const items = rows.map(r => {
            const expiry = parseDate(r.expiry_date);
            const days = expiry ? Math.round((expiry - today) / 86400000) : null;
            return {
                batch_id: r.batch_id,
                product_id: r.product_id,
                product_name: r.product_name,
                unit: r.unit,
                received_at: r.received_at,
                expiry_date: r.expiry_date || null,
                days_to_expiry: days,
                expiry_status: days === null ? 'none' : days < 0 ? 'expired' : days <= EXPIRING_SOON_DAYS ? 'soon' : 'ok',
                quantity_received: num(r.quantity_received),
                quantity_remaining: num(r.quantity_remaining),
                _sort: expiry ? expiry.getTime() : Infinity,
                _received: (parseDate(r.received_at) || 0).valueOf()
            };
        }).sort((a, b) => a._sort - b._sort || a._received - b._received)
          .map(({ _sort, _received, ...item }) => item);

        return {
            soonDays: EXPIRING_SOON_DAYS,
            summary: {
                batches: items.length,
                expired: items.filter(i => i.expiry_status === 'expired').length,
                soon: items.filter(i => i.expiry_status === 'soon').length
            },
            items
        };
    }
}

module.exports = { StockService };
