const pool = require('../config/db');
const { ApiError, nextId, num } = require('../utils/apiHelpers');

// product_status is stored exactly as the document names it: 'Active' / 'Inactive'
const STATUSES = ['Active', 'Inactive'];
const toStatus = (value) => STATUSES.find((s) => s.toLowerCase() === String(value || '').trim().toLowerCase()) || null;

const toProduct = (row) => ({
    product_id: row.product_id,
    category_id: row.category_id,
    category_name: row.category_name,
    product_name: row.product_name,
    barcode: row.barcode,
    unit: row.unit,
    cost_price: num(row.cost_price),
    selling_price: num(row.selling_price),
    product_status: toStatus(row.product_status) || String(row.product_status || '')
});

// "ราคาต้องเป็นตัวเลขมากกว่า 0"
const positive = (value, label) => {
    const n = Number(value);
    if (value === '' || value === null || value === undefined || !Number.isFinite(n) || n <= 0) {
        throw new ApiError(400, `${label}ต้องเป็นตัวเลขที่มากกว่า 0`);
    }
    return Math.round(n * 100) / 100;
};

function validateProduct(body) {
    const name = String(body.product_name || '').trim();
    if (!name) throw new ApiError(400, 'กรุณาระบุชื่อสินค้า');
    if (!body.category_id) throw new ApiError(400, 'กรุณาเลือกหมวดหมู่');
    if (!String(body.unit || '').trim()) throw new ApiError(400, 'กรุณาระบุหน่วยนับ');

    return {
        product_name: name,
        category_id: body.category_id,
        barcode: String(body.barcode || '').trim(),
        unit: String(body.unit).trim(),
        cost_price: positive(body.cost_price, 'ราคาต้นทุน'),
        selling_price: positive(body.selling_price, 'ราคาขาย')
    };
}

class ProductService {
    // ---- categories ----------------------------------------------------
    async listCategories() {
        const [rows] = await pool.query(
            `SELECT c.category_id, c.category_name, c.description,
                    COUNT(p.product_id) AS product_count,
                    SUM(CASE WHEN p.product_status = 'Active' THEN 1 ELSE 0 END) AS active_count
             FROM categories c
             LEFT JOIN products p ON p.category_id = c.category_id
             GROUP BY c.category_id, c.category_name, c.description
             ORDER BY c.category_id`
        );
        return rows.map(r => ({ ...r, product_count: num(r.product_count), active_count: num(r.active_count) }));
    }

    // ---- products (Q14.1) ----------------------------------------------
    async listProducts({ search, category, status } = {}) {
        const where = [];
        const params = [];

        if (search) {
            where.push('(p.product_name LIKE ? OR p.product_id LIKE ? OR p.barcode LIKE ?)');
            params.push(`%${search}%`, `%${search}%`, `%${search}%`);
        }
        if (category) { where.push('p.category_id = ?'); params.push(category); }
        if (status) { where.push('p.product_status = ?'); params.push(toStatus(status) || String(status)); }

        const [rows] = await pool.query(
            `SELECT p.product_id, p.category_id, c.category_name, p.product_name, p.barcode,
                    p.unit, p.cost_price, p.selling_price, p.product_status
             FROM products p
             LEFT JOIN categories c ON c.category_id = p.category_id
             ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
             ORDER BY p.product_id`,
            params
        );
        return rows.map(toProduct);
    }

    async getProduct(id) {
        const [rows] = await pool.query(
            `SELECT p.*, c.category_name FROM products p
             LEFT JOIN categories c ON c.category_id = p.category_id
             WHERE p.product_id = ? LIMIT 1`, [id]
        );
        return rows[0] ? toProduct(rows[0]) : null;
    }

    // ---- create / update / soft delete (Q14.2 - Q14.4) -------------------
    async createProduct(body) {
        const data = validateProduct(body);
        await this.assertCategory(data.category_id);

        const id = await nextId(pool, 'products', 'product_id', 'PRD', 3);
        await pool.query(
            `INSERT INTO products (product_id, category_id, product_name, barcode, unit, cost_price, selling_price, product_status)
             VALUES (?, ?, ?, ?, ?, ?, ?, 'Active')`,
            [id, data.category_id, data.product_name, data.barcode, data.unit, data.cost_price, data.selling_price]
        );
        return this.getProduct(id);
    }

    async updateProduct(id, body) {
        const existing = await this.getProduct(id);
        if (!existing) throw new ApiError(404, `ไม่พบสินค้ารหัส ${id}`);

        const data = validateProduct(body);
        await this.assertCategory(data.category_id);
        const status = body.product_status ? toStatus(body.product_status) : existing.product_status;
        if (!STATUSES.includes(status)) throw new ApiError(400, 'สถานะสินค้าไม่ถูกต้อง');

        await pool.query(
            `UPDATE products SET category_id = ?, product_name = ?, barcode = ?, unit = ?,
                    cost_price = ?, selling_price = ?, product_status = ?
             WHERE product_id = ?`,
            [data.category_id, data.product_name, data.barcode, data.unit, data.cost_price, data.selling_price, status, id]
        );
        if (existing.selling_price !== data.selling_price) {
            await this.logPriceChange(pool, id, existing.selling_price, data.selling_price, body.__userId);
        }
        return this.getProduct(id);
    }

    // soft delete: purchase / stock history still points at the product
    async deactivateProduct(id) {
        const existing = await this.getProduct(id);
        if (!existing) throw new ApiError(404, `ไม่พบสินค้ารหัส ${id}`);
        await pool.query(`UPDATE products SET product_status = 'Inactive' WHERE product_id = ?`, [id]);
        return this.getProduct(id);
    }

    // ---- price tag (Q15.1 / Q15.2) ----------------------------------------
    async updatePrice(id, newPrice, userId) {
        const price = positive(newPrice, 'ราคาขาย');
        const existing = await this.getProduct(id);
        if (!existing) throw new ApiError(404, `ไม่พบสินค้ารหัส ${id}`);
        if (existing.product_status !== 'Active') throw new ApiError(400, 'ไม่สามารถปรับราคาสินค้าที่ปิดใช้งานอยู่');

        const connection = await pool.getConnection();
        try {
            await connection.beginTransaction();
            await connection.query('UPDATE products SET selling_price = ? WHERE product_id = ?', [price, id]);
            if (existing.selling_price !== price) {
                await this.logPriceChange(connection, id, existing.selling_price, price, userId);
            }
            await connection.commit();
        } catch (error) {
            await connection.rollback();
            throw error;
        } finally {
            connection.release();
        }
        return this.getProduct(id);
    }

    async logPriceChange(db, productId, oldPrice, newPrice, userId) {
        const historyId = await nextId(db, 'product_price_history', 'price_history_id', 'PH', 4);
        const d = new Date();
        const stamp = `${d.getDate()}/${d.getMonth() + 1}/${d.getFullYear()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
        await db.query(
            `INSERT INTO product_price_history (price_history_id, product_id, old_price, new_price, changed_by, changed_at)
             VALUES (?, ?, ?, ?, ?, ?)`,
            [historyId, productId, oldPrice, newPrice, userId || null, stamp]
        );
    }

    async priceHistory({ productId, limit = 10 } = {}) {
        const [rows] = await pool.query(
            `SELECT h.price_history_id, h.product_id, p.product_name, h.old_price, h.new_price,
                    u.username AS changed_by, h.changed_at
             FROM product_price_history h
             LEFT JOIN products p ON p.product_id = h.product_id
             LEFT JOIN users u ON u.user_id = h.changed_by
             ${productId ? 'WHERE h.product_id = ?' : ''}
             ORDER BY CAST(SUBSTRING(h.price_history_id, 3) AS UNSIGNED) DESC
             LIMIT ?`,
            productId ? [productId, Number(limit)] : [Number(limit)]
        );
        return rows.map(r => ({ ...r, old_price: num(r.old_price), new_price: num(r.new_price) }));
    }

    // ---- Staff: product status + read-only detail ---------------------------------
    async setStatus(ids, status) {
        const value = toStatus(status);
        if (!value) throw new ApiError(400, 'โปรดเลือกสถานะสินค้าที่ต้องการอัปเดต');
        if (!Array.isArray(ids) || !ids.length) throw new ApiError(400, 'โปรดเลือกสินค้าอย่างน้อย 1 รายการ');
        const unique = [...new Set(ids.map(String))];
        const [found] = await pool.query('SELECT product_id FROM products WHERE product_id IN (?)', [unique]);
        if (found.length !== unique.length) throw new ApiError(404, 'พบรหัสสินค้าที่ไม่มีอยู่ในระบบ');
        await pool.query('UPDATE products SET product_status = ? WHERE product_id IN (?)', [value, unique]);
        return { updated: unique.length, status: value };
    }

    // product + stock and batches of one branch + price history (Product Info drawer)
    async detail(id, dataBranch) {
        const product = await this.getProduct(id);
        if (!product) throw new ApiError(404, `ไม่พบสินค้ารหัส ${id}`);
        const [stock] = await pool.query('SELECT quantity_on_hand, quantity_reserved, updated_at FROM branch_stocks WHERE branch_id = ? AND product_id = ?', [dataBranch, id]);
        const [batches] = await pool.query(
            `SELECT batch_id, received_at, expiry_date, quantity_received, quantity_remaining FROM stock_batches
             WHERE branch_id = ? AND product_id = ? ORDER BY CAST(SUBSTRING(batch_id, 4) AS UNSIGNED)`, [dataBranch, id]
        );
        return {
            product,
            stock: stock[0] ? { on_hand: num(stock[0].quantity_on_hand), reserved: num(stock[0].quantity_reserved), updated_at: stock[0].updated_at } : null,
            batches: batches.map((b) => ({ ...b, quantity_received: num(b.quantity_received), quantity_remaining: num(b.quantity_remaining) })),
            price_history: await this.priceHistory({ productId: id, limit: 5 })
        };
    }

    async assertCategory(categoryId) {
        const [rows] = await pool.query('SELECT 1 FROM categories WHERE category_id = ? LIMIT 1', [categoryId]);
        if (!rows.length) throw new ApiError(400, 'ไม่พบหมวดหมู่ที่เลือก');
    }
}

module.exports = { ProductService };
