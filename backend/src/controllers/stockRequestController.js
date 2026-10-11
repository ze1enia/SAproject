
const pool = require("../config/db");

// GET: แสดงรายการสินค้าที่สามารถส่งคำขอ Stock ได้
// GET /api/stock-requests/products?branch_id=1
exports.getProductsForStockRequest = async (req, res) => {
  try {
    const { branch_id } = req.query;

    if (!branch_id || !Number.isInteger(Number(branch_id)) ||
        Number(branch_id) <= 0) {
      return res.status(400).json({
        success: false,
        message: "กรุณาเลือกสาขาให้ถูกต้อง",
      });
    }

    // Q4.1 + Q4.2: ดึงสินค้าและจำนวน Stock ของสาขาที่เลือก
    const [products] = await pool.execute(
      `SELECT
          p.product_id,
          p.product_name,
          p.category_id,
          bs.quantity AS current_stock
       FROM products p
       LEFT JOIN branch_stocks bs
          ON p.product_id = bs.product_id
          AND bs.branch_id = ?
       WHERE p.is_active = TRUE
       ORDER BY p.product_name`,
      [Number(branch_id)]
    );

    return res.status(200).json({
      success: true,
      message: "ดึงรายการสินค้าสำเร็จ",
      data: products,
    });
  } catch (error) {
    console.error("getProductsForStockRequest:", error);

    return res.status(500).json({
      success: false,
      message: "ไม่สามารถดึงรายการสินค้าได้",
    });
  }
};


// POST: สร้างคำขอ Stock
// POST /api/stock-requests
// Body: { branch_id: 1, items: [{ product_id: 1, requested_quantity: 10 }] }
exports.createStockRequest = async (req, res) => {
  let connection;

  try {
    const { branch_id, items } = req.body;

    // ต้อง Login แล้ว และมีข้อมูลผู้ใช้จาก Authentication Middleware
    const requested_by = req.user?.user_id;

    // 1. ตรวจสอบข้อมูลเบื้องต้น
    if (!requested_by) {
      return res.status(401).json({
        success: false,
        message: "กรุณาเข้าสู่ระบบก่อนส่งคำขอ",
      });
    }

    if (!branch_id || !Number.isInteger(Number(branch_id)) ||
        Number(branch_id) <= 0) {
      return res.status(400).json({
        success: false,
        message: "กรุณาเลือกสาขาให้ถูกต้อง",
      });
    }

    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({
        success: false,
        message: "กรุณาเลือกสินค้าอย่างน้อย 1 รายการ",
      });
    }

    // 2. ตรวจสอบจำนวนสินค้าและข้อมูลที่ส่งมา
    const seenProductIds = new Set();

    for (const item of items) {
      const productId = Number(item.product_id);
      const quantity = item.requested_quantity;

      if (
        !Number.isInteger(productId) ||
        productId <= 0 ||
        !Number.isInteger(quantity) ||
        quantity <= 0
      ) {
        return res.status(400).json({
          success: false,
          message:
            "รหัสสินค้าต้องเป็นจำนวนเต็มบวก และจำนวนที่ขอต้องเป็นจำนวนเต็มบวก",
        });
      }

      if (seenProductIds.has(productId)) {
        return res.status(400).json({
          success: false,
          message: "ไม่สามารถส่งสินค้ารหัสเดิมซ้ำในคำขอเดียวกันได้",
        });
      }

      seenProductIds.add(productId);
    }

    // 3. เริ่ม Transaction
    connection = await pool.getConnection();
    await connection.beginTransaction();

    // 4. ตรวจสอบว่าสินค้าทุกรายการมีอยู่และเปิดใช้งาน
    const productIds = items.map((item) => Number(item.product_id));
    const placeholders = productIds.map(() => "?").join(", ");

    const [products] = await connection.execute(
      `SELECT product_id
       FROM products
       WHERE is_active = TRUE
         AND product_id IN (${placeholders})`,
      productIds
    );

    if (products.length !== productIds.length) {
      await connection.rollback();

      return res.status(400).json({
        success: false,
        message: "พบสินค้าที่ไม่มีอยู่ในระบบหรือปิดใช้งานแล้ว",
      });
    }

    // 5. Q4.3: สร้างหัวคำขอ Stock
    const [requestResult] = await connection.execute(
      `INSERT INTO stock_requests
        (branch_id, requested_by, request_date, status)
       VALUES (?, ?, CURRENT_TIMESTAMP, 'Pending')`,
      [Number(branch_id), requested_by]
    );

    const requestId = requestResult.insertId;

    // 6. Q4.4: บันทึกรายการสินค้าในคำขอ
    for (const item of items) {
      await connection.execute(
        `INSERT INTO stock_request_items
          (request_id, product_id, requested_quantity)
         VALUES (?, ?, ?)`,
        [
          requestId,
          Number(item.product_id),
          item.requested_quantity,
        ]
      );
    }

    // 7. บันทึกทั้งหมดให้สำเร็จพร้อมกัน
    await connection.commit();

    return res.status(201).json({
      success: true,
      message: "Submit Completed",
      data: {
        request_id: requestId,
        branch_id: Number(branch_id),
        requested_by,
        status: "Pending",
        items,
      },
    });
  } catch (error) {
    // หากผิดพลาด ต้องยกเลิกทั้งหัวคำขอและรายการสินค้า
    if (connection) {
      await connection.rollback();
    }

    console.error("createStockRequest:", error);

    return res.status(500).json({
      success: false,
      message: "ไม่สามารถส่งคำขอ Stock ได้ กรุณาลองใหม่อีกครั้ง",
    });
  } finally {
    if (connection) {
      connection.release();
    }
  }
};