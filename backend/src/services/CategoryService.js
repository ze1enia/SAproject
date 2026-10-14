const pool = require('../config/db');
const { ApiError, nextId, num } = require('../utils/apiHelpers');

const clean = (body) => {
    const name = String(body.category_name || '').trim();
    if (!name) throw new ApiError(400, 'กรุณาระบุชื่อหมวดหมู่');
    if (name.length > 100) throw new ApiError(400, 'ชื่อหมวดหมู่ยาวเกินไป (ไม่เกิน 100 ตัวอักษร)');
    return { name, description: String(body.description || '').trim() };
};

class CategoryService {
    async get(id) {
        const [rows] = await pool.query(
            `SELECT c.category_id, c.category_name, c.description, COUNT(p.product_id) AS product_count
             FROM categories c LEFT JOIN products p ON p.category_id = c.category_id
             WHERE c.category_id = ? GROUP BY c.category_id, c.category_name, c.description`, [id]
        );
        return rows[0] ? { ...rows[0], product_count: num(rows[0].product_count) } : null;
    }

    async assertUnique(name, exceptId) {
        const [rows] = await pool.query('SELECT category_id FROM categories WHERE LOWER(category_name) = LOWER(?) AND category_id <> ?', [name, exceptId || '']);
        if (rows.length) throw new ApiError(409, `มีหมวดหมู่ชื่อ "${name}" อยู่แล้ว`);
    }

    async create(body) {
        const { name, description } = clean(body);
        await this.assertUnique(name);
        const id = await nextId(pool, 'categories', 'category_id', 'CAT', 3);
        await pool.query('INSERT INTO categories (category_id, category_name, description) VALUES (?, ?, ?)', [id, name, description]);
        return this.get(id);
    }

    async update(id, body) {
        if (!(await this.get(id))) throw new ApiError(404, `ไม่พบหมวดหมู่รหัส ${id}`);
        const { name, description } = clean(body);
        await this.assertUnique(name, id);
        await pool.query('UPDATE categories SET category_name = ?, description = ? WHERE category_id = ?', [name, description, id]);
        return this.get(id);
    }

    // a category that still has products cannot be removed - move or retire the products first
    async remove(id) {
        const category = await this.get(id);
        if (!category) throw new ApiError(404, `ไม่พบหมวดหมู่รหัส ${id}`);
        if (category.product_count > 0) {
            throw new ApiError(409, `ลบไม่ได้ เพราะยังมีสินค้า ${category.product_count} รายการในหมวดหมู่นี้`);
        }
        await pool.query('DELETE FROM categories WHERE category_id = ?', [id]);
        return { category_id: id };
    }
}

module.exports = { CategoryService };
