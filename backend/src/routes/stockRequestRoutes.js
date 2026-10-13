
const express = require("express");
const router = express.Router();

const stockRequestController = require("../controllers/stockRequestController");

const authenticate = require("../middlewares/authMiddleware");
const authorize = require("../middlewares/authorize");

// ต้อง Login และมีสิทธิ์เป็น Shop Owner
router.get(
  "/products",
  authenticate,
  authorize("Shop Owner"),
  stockRequestController.getProductsForStockRequest
);

router.post(
  "/",
  authenticate,
  authorize("Shop Owner"),
  stockRequestController.createStockRequest
);

module.exports = router;