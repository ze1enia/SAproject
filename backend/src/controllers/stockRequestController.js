
const pool = require("../config/db");
// ปรับให้ใช้กับ schema ปัจจุบัน: รหัสเป็นข้อความ (PRD001 / REQ0001) และ branch_id เป็น B001 ทุกตาราง
const { toDataBranchId, nextId } = require("../utils/apiHelpers");

// GET: แสดงรายการสินค้าที่สามารถส่งคำขอ Stock ได้
// GET /api/stock-requests/products?branch_id=B001
exports.getProductsForStockRequest = async (req, res) => {
  try {
    const { branch_id } = req.query;
    const dataBranchId = toDataBranchId(branch_id);

    if (!dataBranchId) {
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
          c.category_name,
          p.unit,
          CAST(bs.quantity_on_hand AS UNSIGNED) AS current_stock
       FROM products p
       LEFT JOIN categories c ON c.category_id = p.category_id
       LEFT JOIN branch_stocks bs
          ON p.product_id = bs.product_id
          AND bs.branch_id = ?
       WHERE LOWER(p.product_status) = 'active'
       ORDER BY p.product_name`,
      [dataBranchId]
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
// Body: { branch_id: "B001", items: [{ product_id: "PRD001", requested_quantity: 10 }] }
exports.createStockRequest = async (req, res) => {
  let connection;

  try {
    const { branch_id, items } = req.body;

    // ต้อง Login แล้ว และมีข้อมูลผู้ใช้จาก Authentication Middleware
    const requested_by = req.user?.userId;

    // 1. ตรวจสอบข้อมูลเบื้องต้น
    if (!requested_by) {
      return res.status(401).json({
        success: false,
        message: "กรุณาเข้าสู่ระบบก่อนส่งคำขอ",
      });
    }

    const dataBranchId = toDataBranchId(branch_id);

    if (!dataBranchId) {
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
      const productId = String(item.product_id || "").trim();
      const quantity = item.requested_quantity;

      if (
        !productId ||
        !Number.isInteger(quantity) ||
        quantity <= 0
      ) {
        return res.status(400).json({
          success: false,
          message:
            "กรุณาระบุรหัสสินค้า และจำนวนที่ขอต้องเป็นจำนวนเต็มบวก",
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
    const productIds = items.map((item) => String(item.product_id).trim());
    const placeholders = productIds.map(() => "?").join(", ");

    const [products] = await connection.execute(
      `SELECT product_id
       FROM products
       WHERE LOWER(product_status) = 'active'
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

    // 5. Q4.3: สร้างหัวคำขอ Stock (รหัสคำขอเป็น REQ#### สร้างเองเพราะไม่มี AUTO_INCREMENT)
    const requestId = await nextId(connection, "stock_requests", "request_id", "REQ", 4);
    const now = new Date();
    const requestDate = `${now.getDate()}/${now.getMonth() + 1}/${now.getFullYear()} ` +
      `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;

    await connection.execute(
      `INSERT INTO stock_requests
        (request_id, branch_id, requested_by, request_date, status)
       VALUES (?, ?, ?, ?, 'Pending')`,
      [requestId, dataBranchId, requested_by, requestDate]
    );

    // 6. Q4.4: บันทึกรายการสินค้าในคำขอ
    let nextItemNumber = Number((await nextId(connection, "stock_request_items", "request_item_id", "RQI", 4)).slice(3));
    for (const item of items) {
      await connection.execute(
        `INSERT INTO stock_request_items
          (request_item_id, request_id, product_id, requested_quantity)
         VALUES (?, ?, ?, ?)`,
        [
          "RQI" + String(nextItemNumber++).padStart(4, "0"),
          requestId,
          String(item.product_id).trim(),
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
        branch_id: dataBranchId,
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


// GET: ประวัติคำขอ Stock พร้อมรายการสินค้าและ Feedback จาก Staff
// GET /api/stock-requests?branch_id=B001&status=Pending
exports.getStockRequests = async (req, res) => {
  try {
    const { branch_id, status } = req.query;
    const where = [];
    const params = [];

    if (branch_id) {
      const dataBranchId = toDataBranchId(branch_id);
      if (!dataBranchId) {
        return res.status(400).json({
          success: false,
          message: "กรุณาเลือกสาขาให้ถูกต้อง",
        });
      }
      where.push("sr.branch_id = ?");
      params.push(dataBranchId);
    }

    if (status) {
      where.push("sr.status = ?");
      params.push(status);
    }

    const [requests] = await pool.execute(
      `SELECT sr.request_id, sr.branch_id, sr.request_date, sr.status, sr.feedback, sr.reviewed_at,
              ru.username AS requested_by, vu.username AS reviewed_by
       FROM stock_requests sr
       LEFT JOIN users ru ON ru.user_id = sr.requested_by
       LEFT JOIN users vu ON vu.user_id = sr.reviewed_by
       ${where.length ? "WHERE " + where.join(" AND ") : ""}
       ORDER BY CAST(SUBSTRING(sr.request_id, 4) AS UNSIGNED) DESC`,
      params
    );

    const [items] = await pool.execute(
      `SELECT i.request_id, i.product_id, p.product_name, p.unit,
              CAST(i.requested_quantity AS UNSIGNED) AS requested_quantity
       FROM stock_request_items i
       LEFT JOIN products p ON p.product_id = i.product_id
       ORDER BY i.request_item_id`
    );

    const byRequest = new Map();
    items.forEach((item) => {
      if (!byRequest.has(item.request_id)) byRequest.set(item.request_id, []);
      byRequest.get(item.request_id).push(item);
    });

    return res.status(200).json({
      success: true,
      data: requests.map((r) => ({ ...r, items: byRequest.get(r.request_id) || [] })),
    });
  } catch (error) {
    console.error("getStockRequests:", error);

    return res.status(500).json({
      success: false,
      message: "ไม่สามารถดึงประวัติคำขอ Stock ได้",
    });
  }
};
