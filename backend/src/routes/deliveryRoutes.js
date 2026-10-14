const express = require('express');
const { DeliveryController } = require('../controllers/DeliveryController');
const authenticate = require('../middlewares/authMiddleware');
const authorize = require('../middlewares/authorize');

const router = express.Router();

router.use(authenticate, authorize('Owner'));

// Delivery Status
router.get('/deliveries', DeliveryController.getDeliveries);        // ?branch=&search=&status=
router.get('/deliveries/:id', DeliveryController.getDeliveryById);  // purchase order id

// Supplier / Claim
router.get('/suppliers', DeliveryController.getSuppliers);
router.get('/claims/issues', DeliveryController.getQcIssues);       // arrivals that failed / partly failed QC
router.get('/claims', DeliveryController.getClaims);
router.post('/claims', DeliveryController.createClaim);

module.exports = router;
