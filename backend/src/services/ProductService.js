const pool = require('../config/db');
const { ApiError, nextId, num } = require('../utils/apiHelpers');

const toProduct = (row) => ({
    product_id: row.product_id,
    category_id: row.category_id,
    category_name: row.category_name,
    product_name: row.product_name,
    barcode: row.barcode,
    unit: row.unit,
    cost_price: num(row.cost_price),
    selling_price: num(row.selling_price),
    product_status: String(row.product_status || '').toLowerCase()
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
                    SUM(CASE WHEN LOWER(p.product_status) = 'active' THEN 1 ELSE 0 END) AS active_count
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
        if (status) { where.push('LOWER(p.product_status) = ?'); params.push(String(status).toLowerCase()); }

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
             VALUES (?, ?, ?, ?, ?, ?, ?, 'active')`,
            [id, data.category_id, data.product_name, data.barcode, data.unit, data.cost_price, data.selling_price]
        );
        return this.getProduct(id);
    }

    async updateProduct(id, body) {
        const existing = await this.getProduct(id);
        if (!existing) throw new ApiError(404, `ไม่พบสินค้ารหัส ${id}`);

        const data = validateProduct(body);
        await this.assertCategory(data.category_id);
        const status = body.product_status ? String(body.product_status).toLowerCase() : existing.product_status;
        if (!['active', 'inactive'].includes(status)) throw new ApiError(400, 'สถานะสินค้าไม่ถูกต้อง');

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
        await pool.query(`UPDATE products SET product_status = 'inactive' WHERE product_id = ?`, [id]);
        return this.getProduct(id);
    }

    // ---- price tag (Q15.1 / Q15.2) ----------------------------------------
    async updatePrice(id, newPrice, userId) {
        const price = positive(newPrice, 'ราคาขาย');
        const existing = await this.getProduct(id);
        if (!existing) throw new ApiError(404, `ไม่พบสินค้ารหัส ${id}`);
        if (existing.product_status !== 'active') throw new ApiError(400, 'ไม่สามารถปรับราคาสินค้าที่ปิดใช้งานอยู่');

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

    async assertCategory(categoryId) {
        const [rows] = await pool.query('SELECT 1 FROM categories WHERE category_id = ? LIMIT 1', [categoryId]);
        if (!rows.length) throw new ApiError(400, 'ไม่พบหมวดหมู่ที่เลือก');
    }
}

module.exports = { ProductService };
