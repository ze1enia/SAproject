import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { BranchModel } from '../models/BranchModel.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export class BranchService {
    constructor() {
        // กำหนด Path ชี้ไปยังไฟล์ branches.csv ในโฟลเดอร์ database
        this.csvPath = path.join(__dirname, '../database/branches.csv');
    }

    // 1. ฟังก์ชันช่วยอ่านและแปลงข้อมูลใน CSV เป็น Array
    readCSV() {
        try {
            if (!fs.existsSync(this.csvPath)) {
                console.error('ไม่พบไฟล์ branches.csv');
                return [];
            }

            const fileContent = fs.readFileSync(this.csvPath, 'utf8');
            const lines = fileContent.trim().split(/\r?\n/);

            if (lines.length < 2) return []; // ไม่มีข้อมูล (มีแค่ header หรือไฟล์ว่าง)

            // อ่านชื่อคอลัมน์จากแถวแรก (branch_id, branch_name, address)
            const headers = lines[0].split(',').map(h => h.trim());

            return lines.slice(1)
                .filter(line => line.trim() !== '')
                .map(line => {
                    const values = line.split(',').map(v => v.trim());
                    const row = {};
                    headers.forEach((header, index) => {
                        row[header] = values[index];
                    });
                    return new BranchModel(row);
                });
        } catch (error) {
            console.error('เกิดข้อผิดพลาดในการอ่านไฟล์ branches.csv:', error);
            return [];
        }
    }

    // 2. ฟังก์ชันช่วยบันทึก Array ของ BranchModel กลับลงไฟล์ CSV
    writeCSV(branches) {
        try {
            const header = 'branch_id,branch_name,address\n';
            const rows = branches.map(b => `${b.branch_id},${b.branch_name},${b.address}`).join('\n');
            fs.writeFileSync(this.csvPath, header + rows, 'utf8');
            return true;
        } catch (error) {
            console.error('เกิดข้อผิดพลาดในการเขียนไฟล์ branches.csv:', error);
            return false;
        }
    }

    // ---------------- READ OPERATIONS ----------------

    // ดึงข้อมูลสาขาทั้งหมดจาก CSV
    async getAllBranches() {
        return this.readCSV();
    }

    // ค้นหาสาขาด้วย ID, ชื่อสาขา หรือ ที่อยู่
    async searchBranches(keyword) {
        const branches = await this.getAllBranches();
        if (!keyword) return branches;

        const term = keyword.toLowerCase().trim();
        return branches.filter(branch => 
            (branch.branch_id && String(branch.branch_id).toLowerCase().includes(term)) ||
            (branch.branch_name && branch.branch_name.toLowerCase().includes(term)) || 
            (branch.address && branch.address.toLowerCase().includes(term))
        );
    }

    // ดึงข้อมูลเฉพาะ 1 สาขาตาม ID (สำหรับปุ่ม VIEW)
    async getBranchById(id) {
        const branches = await this.getAllBranches();
        return branches.find(b => String(b.branch_id) === String(id));
    }

    // ---------------- WRITE OPERATIONS (เพิ่ม/แก้ไข/ลบ) ----------------

    // เพิ่มสาขาใหม่ลงไฟล์ CSV
    async createBranch({ branch_id, branch_name, address }) {
        const branches = await this.getAllBranches();
        const newBranch = new BranchModel({ branch_id, branch_name, address: address || '' });
        
        branches.push(newBranch);
        this.writeCSV(branches);
        return newBranch;
    }

    // แก้ไขข้อมูลสาขาเดิมใน CSV
    async updateBranch(id, { branch_name, address }) {
        const branches = await this.getAllBranches();
        const index = branches.findIndex(b => String(b.branch_id) === String(id));
        
        if (index === -1) return null;

        if (branch_name !== undefined) branches[index].branch_name = branch_name;
        if (address !== undefined) branches[index].address = address;

        this.writeCSV(branches);
        return branches[index];
    }

    // ลบสาขาออกจาก CSV
    async deleteBranch(id) {
        const branches = await this.getAllBranches();
        const filtered = branches.filter(b => String(b.branch_id) !== String(id));

        if (filtered.length === branches.length) return false; // ไม่พบ ID ที่ต้องการลบ

        this.writeCSV(filtered);
        return true;
    }
}