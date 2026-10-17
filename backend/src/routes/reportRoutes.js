const express = require('express');
const { ReportController } = require('../controllers/ReportController');
const authenticate = require('../middlewares/authMiddleware');
const authorize = require('../middlewares/authorize');

const router = express.Router();

// ข้อมูลการเงินดูได้เฉพาะ Owner
router.use(authenticate, authorize('Owner'));

router.get('/sales', ReportController.getSalesReports);   // ?branch=&from=YYYY-MM-DD&to=YYYY-MM-DD
router.get('/sales/daily', ReportController.getDailySales);    // UC-17 ?branch=&date=YYYY-MM-DD (default today)
router.post('/sales/daily', ReportController.saveDailySales);  // UC-17 { branch, date } -> Q17.2
router.get('/budgets', ReportController.getBudgets);      // ?branch=
router.get('/budgets/:id', ReportController.getBudgetById);

module.exports = router;
