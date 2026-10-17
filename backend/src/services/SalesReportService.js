const pool = require('../config/db');
const { ApiError, num, toDataBranchId, nextId, nowStamp, isoToThaiDate } = require('../utils/apiHelpers');

const DATE_SQL = (col) => `STR_TO_DATE(${col}, '%e/%c/%Y')`;
const isDate = (s) => /^\d{4}-\d{2}-\d{2}$/.test(String(s || ''));

// orders.created_at / sales_reports.period_* are text ("17/10/2026 14:05") - compare only the date part
const ORDER_DAY = `STR_TO_DATE(SUBSTRING_INDEX(o.created_at, ' ', 1), '%e/%c/%Y')`;
const money2 = (n) => Math.round(n * 100) / 100;
const todayIso = () => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

class SalesReportService {
    // Q16.1: รายงานสรุปยอดขายตามสาขาและช่วงเวลา
    async list({ branch, from, to } = {}) {
        if ((from && !isDate(from)) || (to && !isDate(to)) || (from && to && from > to)) {
            throw new ApiError(400, 'ช่วงเวลาที่เลือกไม่ถูกต้อง กรุณาตรวจสอบวันที่เริ่มต้นและสิ้นสุด');
        }

        const where = [];
        const params = [];
        const dataBranch = toDataBranchId(branch);
        if (dataBranch) { where.push('r.branch_id = ?'); params.push(dataBranch); }
        if (from) { where.push(`${DATE_SQL('r.period_start')} >= ?`); params.push(from); }
        if (to) { where.push(`${DATE_SQL('r.period_end')} <= ?`); params.push(to); }

        const [rows] = await pool.query(
            `SELECT r.report_id, r.branch_id, r.period_start, r.period_end, r.total_sales,
                    r.total_transactions, u.username AS generated_by, r.generated_at
             FROM sales_reports r
             LEFT JOIN users u ON u.user_id = r.generated_by
             ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
             ORDER BY ${DATE_SQL('r.period_start')} DESC, r.report_id DESC`,
            params
        );

        const items = rows.map(r => ({ ...r, total_sales: num(r.total_sales), total_transactions: num(r.total_transactions) }));
        const totalSales = items.reduce((sum, i) => sum + i.total_sales, 0);
        const totalTransactions = items.reduce((sum, i) => sum + i.total_transactions, 0);

        return {
            summary: {
                reports: items.length,
                total_sales: Math.round(totalSales * 100) / 100,
                total_transactions: totalTransactions,
                average_ticket: totalTransactions ? Math.round((totalSales / totalTransactions) * 100) / 100 : 0
            },
            items
        };
    }
    // ---- UC-17 summarize daily sales -------------------------------------------
    // Q17.1 reads the day's orders; nothing is written until saveDaily() (Q17.2).
    async daily({ branch, date } = {}) {
        const dataBranch = toDataBranchId(branch);
        if (!dataBranch) throw new ApiError(400, 'โปรดเลือกสาขาที่ต้องการสรุปยอดขาย');
        const iso = date || todayIso();
        if (!isDate(iso)) throw new ApiError(400, 'วันที่ที่เลือกไม่ถูกต้อง');
        if (iso > todayIso()) throw new ApiError(400, 'ไม่สามารถสรุปยอดขายของวันที่ยังมาไม่ถึงได้');

        const [branchRows] = await pool.query('SELECT branch_id FROM branches WHERE branch_id = ?', [dataBranch]);
        if (!branchRows.length) throw new ApiError(404, `ไม่พบสาขา ${dataBranch}`);

        // Q17.1
        const [orders] = await pool.query(
            `SELECT o.order_id, o.total_amount, o.payment_method, o.created_at
             FROM orders o
             WHERE o.branch_id = ? AND ${ORDER_DAY} = ?
             ORDER BY STR_TO_DATE(o.created_at, '%e/%c/%Y %H:%i') ASC, o.order_id ASC`,
            [dataBranch, iso]
        );

        const totalSales = money2(orders.reduce((sum, o) => sum + num(o.total_amount), 0));
        const totalTransactions = orders.length;

        const byMethod = new Map();
        orders.forEach((o) => {
            const key = o.payment_method || 'Unknown';
            const entry = byMethod.get(key) || { payment_method: key, transactions: 0, total: 0 };
            entry.transactions += 1;
            entry.total += num(o.total_amount);
            byMethod.set(key, entry);
        });
        const payments = [...byMethod.values()]
            .map((p) => ({ ...p, total: money2(p.total), share: totalSales ? Math.round((p.total / totalSales) * 1000) / 10 : 0 }))
            .sort((a, b) => b.total - a.total);

        const [bestRows] = await pool.query(
            `SELECT i.product_id, p.product_name, p.unit,
                    SUM(CAST(i.quantity AS DECIMAL(12,2))) AS units,
                    SUM(CAST(i.quantity AS DECIMAL(12,2)) * CAST(i.unit_price AS DECIMAL(12,2))) AS revenue
             FROM order_items i
             JOIN orders o ON o.order_id = i.order_id
             JOIN products p ON p.product_id = i.product_id
             WHERE o.branch_id = ? AND ${ORDER_DAY} = ?
             GROUP BY i.product_id, p.product_name, p.unit
             ORDER BY units DESC, revenue DESC, i.product_id ASC
             LIMIT 5`,
            [dataBranch, iso]
        );

        const existing = await this.findDailyReport(pool, dataBranch, iso);
        let state = 'new';
        if (existing) {
            const grew = totalSales > num(existing.total_sales) || totalTransactions > num(existing.total_transactions);
            state = grew ? 'outdated' : 'saved';
        }

        return {
            branch_id: dataBranch,
            date: iso,
            has_orders: totalTransactions > 0,
            summary: {
                total_sales: totalSales,
                total_transactions: totalTransactions,
                average_ticket: totalTransactions ? money2(totalSales / totalTransactions) : 0
            },
            payments,
            best_sellers: bestRows.map((r) => ({ ...r, units: num(r.units), revenue: money2(num(r.revenue)) })),
            orders: orders.map((o) => ({
                order_id: o.order_id,
                time: String(o.created_at).split(' ')[1] || '',
                payment_method: o.payment_method,
                total_amount: num(o.total_amount)
            })),
            report: existing ? { ...existing, total_sales: num(existing.total_sales), total_transactions: num(existing.total_transactions) } : null,
            report_state: state
        };
    }

    // the one-day report of a branch, if the Owner already summarized that day
    async findDailyReport(db, dataBranch, iso) {
        const [rows] = await db.query(
            `SELECT r.report_id, r.total_sales, r.total_transactions, r.generated_by, r.generated_at
             FROM sales_reports r
             WHERE r.branch_id = ?
               AND STR_TO_DATE(r.period_start, '%e/%c/%Y') = ? AND STR_TO_DATE(r.period_end, '%e/%c/%Y') = ?
             ORDER BY r.report_id ASC LIMIT 1`,
            [dataBranch, iso, iso]
        );
        return rows[0] || null;
    }

    // Q17.2: save the day into sales_reports. Running it again the same day only
    // raises the totals when new orders came in; otherwise the saved report is kept.
    async saveDaily({ branch, date } = {}, userId) {
        const day = await this.daily({ branch, date });
        if (!day.has_orders) throw new ApiError(400, 'ไม่พบรายการสั่งซื้อสำหรับสรุปยอดขายในวันนี้');

        const sales = String(day.summary.total_sales);
        const transactions = String(day.summary.total_transactions);
        const stamp = nowStamp();
        let result = 'unchanged';

        if (day.report_state === 'new') {
            const id = await nextId(pool, 'sales_reports', 'report_id', 'RPT', 4);
            const thaiDate = isoToThaiDate(day.date);
            await pool.query(
                `INSERT INTO sales_reports (report_id, branch_id, period_start, period_end, total_sales, total_transactions, generated_by, generated_at)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
                [id, day.branch_id, thaiDate, thaiDate, sales, transactions, userId, stamp]
            );
            result = 'created';
        } else if (day.report_state === 'outdated') {
            await pool.query(
                `UPDATE sales_reports SET total_sales = ?, total_transactions = ?, generated_by = ?, generated_at = ? WHERE report_id = ?`,
                [sales, transactions, userId, stamp, day.report.report_id]
            );
            result = 'updated';
        }

        return { ...(await this.daily({ branch, date })), result };
    }
}

module.exports = { SalesReportService };
