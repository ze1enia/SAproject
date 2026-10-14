const { SalesReportService } = require('../services/SalesReportService');
const { BudgetService } = require('../services/BudgetService');
const { handle } = require('../utils/apiHelpers');

const sales = new SalesReportService();
const budgets = new BudgetService();

const ReportController = {
    getSalesReports: handle((req) => sales.list(req.query)),
    getBudgets: handle((req) => budgets.list(req.query)),
    getBudgetById: handle((req) => budgets.detail(req.params.id))
};

module.exports = { ReportController };
