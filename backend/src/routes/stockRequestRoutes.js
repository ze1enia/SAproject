
const express = require("express");
const router = express.Router();

const stockRequestController = require("../controllers/stockRequestController");

const authenticate = require("../middlewares/authMiddleware");
const authorize = require("../middlewares/authorize");

// ต้อง Login และมีสิทธิ์เป็น Owner (role_id ในตาราง users คือ "Owner")
router.get(
  "/products",
  authenticate,
  authorize("Owner"),
  stockRequestController.getProductsForStockRequest
);

router.get(
  "/",
  authenticate,
  authorize("Owner"),
  stockRequestController.getStockRequests
);

router.post(
  "/",
  authenticate,
  authorize("Owner"),
  stockRequestController.createStockRequest
);

module.exports = router;