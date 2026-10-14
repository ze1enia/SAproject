const pool = require('../config/db');
const { ApiError, nextId, num, nowStamp, parseThaiDate } = require('../utils/apiHelpers');

let tableReady = false;

// UC-11 records the result of every expiry check. stock_batches has no status column,
// so results go in expiry_checks (created on first use); the newest row is the batch's status.
async function ensureTable() {
    if (tableReady) return;
    await pool.query(
        `CREATE TABLE IF NOT EXISTS expiry_checks (
            check_id TEXT, batch_id TEXT, branch_id TEXT, product_id TEXT, status TEXT, note TEXT, checked_by TEXT, checked_at TEXT
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`
    );
    tableReady = true;
}

const STATUSES = ['Normal', 'Near Expiry', 'Expired'];

class ExpiryCheckService {
    // criteria: 'expired' | '7' | '15' | '30' | 'all' (batches that have an expiry date)
    async search(dataBranch, { days = '30', category } = {}) {
        await ensureTable();
        const [rows] = await pool.query(
            `SELECT b.batch_id, b.product_id, p.product_name, p.unit, p.category_id, c.category_name,
                    b.received_at, b.expiry_date, b.quantity_remaining,
                    (SELECT k.status FROM expiry_checks k WHERE k.batch_id = b.batch_id ORDER BY CAST(SUBSTRING(k.check_id, 4) AS UNSIGNED) DESC LIMIT 1) AS last_status,
                    (SELECT k.checked_at FROM expiry_checks k WHERE k.batch_id = b.batch_id ORDER BY CAST(SUBSTRING(k.check_id, 4) AS UNSIGNED) DESC LIMIT 1) AS last_checked_at
             FROM stock_batches b
             LEFT JOIN products p ON p.product_id = b.product_id
             LEFT JOIN categories c ON c.category_id = p.category_id
             WHERE b.branch_id = ? AND CAST(b.quantity_remaining AS SIGNED) > 0 AND b.expiry_date <> '' ${category ? 'AND p.category_id = ?' : ''}`,
            category ? [dataBranch, category] : [dataBranch]
        );

        const today = new Date(); today.setHours(0, 0, 0, 0);
        const window = days === 'expired' ? -1 : days === 'all' ? Infinity : Number(days);
        const items = rows.map((r) => {
            const d = parseThaiDate(r.expiry_date);
            const left = d ? Math.round((d - today) / 86400000) : null;
            return { ...r, quantity_remaining: num(r.quantity_remaining), days_left: left, state: left === null ? 'none' : left < 0 ? 'expired' : left <= 30 ? 'soon' : 'ok', _t: d ? d.getTime() : Infinity };
        }).filter((r) => r.days_left !== null && (window === Infinity || (window === -1 ? r.days_left < 0 : r.days_left <= window)))
          .sort((a, b) => a._t - b._t).map(({ _t, ...r }) => r);

        return { statuses: STATUSES, items };
    }

    async record(dataBranch, checks, note, userId) {
        await ensureTable();
        if (!Array.isArray(checks) || !checks.length) throw new ApiError(400, 'โปรดเลือกรายการสินค้าที่ต้องการบันทึก');
        for (const c of checks) if (!STATUSES.includes(c.status)) throw new ApiError(400, 'สถานะที่เลือกไม่ถูกต้อง');

        const connection = await pool.getConnection();
        try {
            await connection.beginTransaction();
            const ids = [...new Set(checks.map((c) => c.batch_id))];
            const [batches] = await connection.query('SELECT batch_id, product_id FROM stock_batches WHERE branch_id = ? AND batch_id IN (?)', [dataBranch, ids]);
            if (batches.length !== ids.length) throw new ApiError(400, 'พบล็อตสินค้าที่ไม่ใช่ของสาขาที่เลือก');
            const product = new Map(batches.map((b) => [b.batch_id, b.product_id]));

            let n = Number((await nextId(connection, 'expiry_checks', 'check_id', 'CHK', 4)).slice(3));
            for (const c of checks) {
                await connection.query(
                    `INSERT INTO expiry_checks (check_id, batch_id, branch_id, product_id, status, note, checked_by, checked_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
                    ['CHK' + String(n++).padStart(4, '0'), c.batch_id, dataBranch, product.get(c.batch_id), c.status, String(note || '').trim(), userId, nowStamp()]
                );
            }
            await connection.commit();
            return { recorded: checks.length };
        } catch (error) {
            await connection.rollback();
            throw error;
        } finally {
            connection.release();
        }
    }
}

module.exports = { ExpiryCheckService };
