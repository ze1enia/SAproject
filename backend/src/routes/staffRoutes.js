const express = require('express');
const { StaffController: c } = require('../controllers/StaffController');
const authenticate = require('../middlewares/authMiddleware');
const authorize = require('../middlewares/authorize');

const router = express.Router();

// Staff pages: logged in with role Staff. Every handler also checks the branch against user_branch_access.
router.use(authenticate, authorize('Staff'));

router.get('/branches', c.getBranches);                              // branches this user can work in

// Manage Stock
router.get('/stocks', c.getStock);                                   // ?branch=B003&search=
router.post('/stocks/adjust', c.adjustStock);
router.get('/stocks/adjustments', c.getAdjustments);

// Product Info / Product Status
router.get('/products', c.getProducts);
router.put('/products/status', c.setProductStatus);                  // { product_ids: [...], status }
router.get('/products/:id', c.getProductDetail);                     // ?branch=

// Category
router.get('/categories', c.getCategories);
router.post('/categories', c.createCategory);
router.put('/categories/:id', c.updateCategory);
router.delete('/categories/:id', c.deleteCategory);

// Stock Request Review (UC-05..07) + FIFO (UC-08)
router.get('/requests', c.getRequests);                              // ?branch=&status=
router.post('/requests/:id/approve', c.approveRequest);
router.post('/requests/:id/cancel', c.cancelRequest);                // { reason }
router.get('/requests/:id/fifo-plan', c.getFifoPlan);
router.post('/requests/:id/fifo-confirm', c.confirmFifo);

// Purchase Orders (UC-09)
router.get('/purchase-orders/form-data', c.getPurchaseOrderForm);
router.get('/purchase-orders', c.getPurchaseOrders);
router.post('/purchase-orders', c.createPurchaseOrder);
router.get('/purchase-orders/:id', c.getPurchaseOrder);
router.put('/purchase-orders/:id/status', c.setPurchaseOrderStatus); // { status }

// Stock Arrival (UC-10)
router.get('/arrivals', c.getPendingArrivals);
router.post('/arrivals', c.receiveArrival);

// Quality Check (UC-12)
router.get('/quality', c.getQuality);
router.post('/quality', c.inspectArrival);

// Expiry Check (UC-11)
router.get('/expiry', c.searchExpiry);                               // ?branch=&days=7|15|30|expired|all&category=
router.post('/expiry', c.recordExpiry);

module.exports = router;
