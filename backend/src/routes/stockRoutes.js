const express = require('express');
const { StockController } = require('../controllers/StockController');
const authenticate = require('../middlewares/authMiddleware');
const authorize = require('../middlewares/authorize');

const router = express.Router();

router.use(authenticate, authorize('Owner'));

router.get('/overview', StockController.getOverview); // GET /api/stocks/overview?branch=B001&search=
router.get('/batches', StockController.getBatches);   // GET /api/stocks/batches?branch=B001

module.exports = router;
