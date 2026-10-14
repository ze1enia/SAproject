const pool = require('../config/db');
const { ApiError, num, toDataBranchId } = require('../utils/apiHelpers');

const withTotals = (b) => {
    const allocated = num(b.allocated_amount);
    const expense = num(b.expense_total);
    const income = num(b.income_total);
    return {
        budget_id: b.budget_id,
        branch_id: b.branch_id,
        period_start: b.period_start,
        period_end: b.period_end,
        budget_status: b.budget_status,
        allocated_amount: allocated,
        expense_total: expense,
        income_total: income,
        // งบจัดสรร - ค่าใช้จ่าย + รายรับ = เงินทุนหมุนเวียนคงเหลือ
        remaining: Math.round((allocated - expense + income) * 100) / 100,
        used_percent: allocated ? Math.round((expense / allocated) * 1000) / 10 : 0,
        transaction_count: num(b.transaction_count)
    };
};

class BudgetService {
    // Q18.1: งบประมาณของสาขา + ยอดรายรับ/รายจ่ายรวม
    async list({ branch } = {}) {
        const dataBranch = toDataBranchId(branch);
        const [rows] = await pool.query(
            `SELECT b.budget_id, b.branch_id, b.period_start, b.period_end, b.allocated_amount, b.budget_status,
                    COALESCE(SUM(CASE WHEN t.transaction_type = 'Expense' THEN CAST(t.amount AS DECIMAL(12,2)) END), 0) AS expense_total,
                    COALESCE(SUM(CASE WHEN t.transaction_type = 'Income' THEN CAST(t.amount AS DECIMAL(12,2)) END), 0) AS income_total,
                    COUNT(t.transaction_id) AS transaction_count
             FROM budgets b
             LEFT JOIN budget_transactions t ON t.budget_id = b.budget_id
             ${dataBranch ? 'WHERE b.branch_id = ?' : ''}
             GROUP BY b.budget_id, b.branch_id, b.period_start, b.period_end, b.allocated_amount, b.budget_status
             ORDER BY STR_TO_DATE(b.period_start, '%e/%c/%Y') DESC, b.budget_id`,
            dataBranch ? [dataBranch] : []
        );
        return rows.map(withTotals);
    }

    // Q18.2: รายการเคลื่อนไหวทางการเงินของงบที่เลือก
    async detail(budgetId) {
        const [budgets] = await pool.query(
            `SELECT b.budget_id, b.branch_id, b.period_start, b.period_end, b.allocated_amount, b.budget_status,
                    COALESCE(SUM(CASE WHEN t.transaction_type = 'Expense' THEN CAST(t.amount AS DECIMAL(12,2)) END), 0) AS expense_total,
                    COALESCE(SUM(CASE WHEN t.transaction_type = 'Income' THEN CAST(t.amount AS DECIMAL(12,2)) END), 0) AS income_total,
                    COUNT(t.transaction_id) AS transaction_count
             FROM budgets b
             LEFT JOIN budget_transactions t ON t.budget_id = b.budget_id
             WHERE b.budget_id = ?
             GROUP BY b.budget_id, b.branch_id, b.period_start, b.period_end, b.allocated_amount, b.budget_status`,
            [budgetId]
        );
        if (!budgets[0]) throw new ApiError(404, `ไม่พบงบประมาณรหัส ${budgetId}`);

        const [transactions] = await pool.query(
            `SELECT t.transaction_id, t.transaction_type, t.amount, t.description, t.transaction_date,
                    u.username AS recorded_by
             FROM budget_transactions t
             LEFT JOIN users u ON u.user_id = t.recorded_by
             WHERE t.budget_id = ?
             ORDER BY STR_TO_DATE(t.transaction_date, '%e/%c/%Y %H:%i') DESC`,
            [budgetId]
        );

        return {
            ...withTotals(budgets[0]),
            transactions: transactions.map(t => ({ ...t, amount: num(t.amount) }))
        };
    }
}

module.exports = { BudgetService };
