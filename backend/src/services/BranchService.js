const pool = require('../config/db');
const { BranchModel } = require('../models/BranchModel');

// ข้อมูลสาขาอยู่ในตาราง branches ของ MySQL (เดิมอ่าน/เขียนไฟล์ branches.csv)
class BranchService {
    // ---------------- READ OPERATIONS ----------------

    // ดึงข้อมูลสาขาทั้งหมด
    async getAllBranches() {
        const [rows] = await pool.query(
            'SELECT branch_id, branch_name, address FROM branches ORDER BY branch_id'
        );
        return rows.map(row => new BranchModel(row));
    }

    // ค้นหาสาขาด้วย ID, ชื่อสาขา หรือ ที่อยู่ (ไม่สนตัวพิมพ์เล็ก/ใหญ่)
    async searchBranches(keyword) {
        const term = String(keyword || '').trim();
        if (!term) return this.getAllBranches();

        // % และ _ ที่ผู้ใช้พิมพ์ต้องเป็นตัวอักษรธรรมดา ไม่ใช่ตัวแทนของ LIKE
        const like = `%${term.replace(/[\\%_]/g, '\\$&')}%`;
        const [rows] = await pool.query(
            `SELECT branch_id, branch_name, address FROM branches
             WHERE branch_id LIKE ? OR branch_name LIKE ? OR address LIKE ?
             ORDER BY branch_id`,
            [like, like, like]
        );
        return rows.map(row => new BranchModel(row));
    }

    // ดึงข้อมูลเฉพาะ 1 สาขาตาม ID (สำหรับปุ่ม VIEW) - ไม่พบจะคืน undefined
    async getBranchById(id) {
        const [rows] = await pool.query(
            'SELECT branch_id, branch_name, address FROM branches WHERE branch_id = ? LIMIT 1',
            [String(id)]
        );
        return rows[0] ? new BranchModel(rows[0]) : undefined;
    }

    // ---------------- WRITE OPERATIONS (เพิ่ม/แก้ไข/ลบ) ----------------

    // เพิ่มสาขาใหม่
    async createBranch({ branch_id, branch_name, address }) {
        if (await this.getBranchById(branch_id)) {
            throw new Error(`มีรหัสสาขา ${branch_id} อยู่แล้ว`);
        }
        await pool.query(
            'INSERT INTO branches (branch_id, branch_name, address) VALUES (?, ?, ?)',
            [branch_id, branch_name, address || '']
        );
        return new BranchModel({ branch_id, branch_name, address: address || '' });
    }

    // แก้ไขข้อมูลสาขาเดิม - ไม่พบสาขาจะคืน null
    async updateBranch(id, { branch_name, address }) {
        const existing = await this.getBranchById(id);
        if (!existing) return null;

        if (branch_name !== undefined) existing.branch_name = branch_name;
        if (address !== undefined) existing.address = address;

        await pool.query(
            'UPDATE branches SET branch_name = ?, address = ? WHERE branch_id = ?',
            [existing.branch_name, existing.address, String(id)]
        );
        return existing;
    }

    // ลบสาขา - ไม่พบ ID ที่ต้องการลบจะคืน false
    async deleteBranch(id) {
        const [result] = await pool.query('DELETE FROM branches WHERE branch_id = ?', [String(id)]);
        return result.affectedRows > 0;
    }
}

module.exports = { BranchService };
