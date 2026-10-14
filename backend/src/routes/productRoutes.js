const express = require('express');
const { ProductController } = require('../controllers/ProductController');
const authenticate = require('../middlewares/authMiddleware');
const authorize = require('../middlewares/authorize');

const router = express.Router();

// หน้า Product & Category / Price Tag ใช้ได้เฉพาะ Owner
router.use(authenticate, authorize('Owner'));

router.get('/categories', ProductController.getCategories);        // GET /api/products/categories
router.get('/price-history', ProductController.getPriceHistory);   // GET /api/products/price-history?product_id=

router.get('/', ProductController.getProducts);                    // ?search=&category=&status=
router.get('/:id', ProductController.getProductById);
router.post('/', ProductController.createProduct);
router.put('/:id', ProductController.updateProduct);
router.delete('/:id', ProductController.deleteProduct);            // soft delete
router.put('/:id/price', ProductController.updatePrice);           // Price Tag

module.exports = router;
