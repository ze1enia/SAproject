const { SalesReportService } = require('../services/SalesReportService');
const { BudgetService } = require('../services/BudgetService');
const { handle, ok } = require('../utils/apiHelpers');

const sales = new SalesReportService();
const budgets = new BudgetService();

const ReportController = {
    getSalesReports: handle((req) => sales.list(req.query)),
    getDailySales: handle((req) => sales.daily(req.query)),
    saveDailySales: handle(async (req) => {
        const data = await sales.saveDaily(req.body, req.user.userId);
        const message = {
            created: 'บันทึกสรุปยอดขายประจำวันเรียบร้อยแล้ว',
            updated: 'อัปเดตสรุปยอดขายประจำวันตามยอดขายที่เพิ่มขึ้นเรียบร้อยแล้ว',
            unchanged: 'สรุปยอดขายของวันนี้ถูกบันทึกไว้แล้ว ยอดขายไม่มีการเปลี่ยนแปลง'
        }[data.result];
        return ok(data, message);
    }),
    getBudgets: handle((req) => budgets.list(req.query)),
    getBudgetById: handle((req) => budgets.detail(req.params.id))
};

module.exports = { ReportController };
