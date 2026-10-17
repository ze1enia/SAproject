const pool = require('../config/db');
const { ApiError, num, toDataBranchId } = require('../utils/apiHelpers');

const DATE_SQL = (col) => `STR_TO_DATE(${col}, '%e/%c/%Y')`;
const isDate = (s) => /^\d{4}-\d{2}-\d{2}$/.test(String(s || ''));

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
}

module.exports = { SalesReportService };
