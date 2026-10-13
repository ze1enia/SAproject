
const express = require("express");
const router = express.Router();

const stockRequestController = require("../controllers/stockRequestController");

// เปลี่ยนชื่อ Middleware ให้ตรงกับโปรเจกต์ของคุณ
const { authenticate, authorize } = require("../middleware/auth");

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