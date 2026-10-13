import { BranchModel } from '../models/BranchModel.js';

export class BranchService {
    constructor() {
        // mockdata จำลองจาก database
        this.mockData = [
            {
                branch_id: 1,
                branch_name: 'สาขา สยามพารากอน',
                address: 'ชั้น G สยามพารากอน ปทุมวัน กรุงเทพฯ',
                branch_status: 'OPEN'
            },
            {
                branch_id: 2,
                branch_name: 'สาขา เซ็นทรัลเวิลด์',
                address: 'ชั้น 3 เซ็นทรัลเวิลด์ ราชประสงค์ กรุงเทพฯ',
                branch_status: 'OPEN'
            },
            {
                branch_id: 3,
                branch_name: 'สาขา เมกาบางนา',
                address: 'ชั้น 1 เมกาบางนา บางพลี สมุทรปราการ',
                branch_status: 'CLOSED'
            }
        ];
    }

    // ดึงข้อมูลสาขาทั้งหมด
    async getAllBranches() {
        // ถ้าเชื่อมต่อกับ API / Database หลังบ้าน ให้ใช้โค้ดนี้:
        // const response = await fetch('/api/branches');
        // const data = await response.json();
        // return data.map(item => new BranchModel(item));

        await new Promise(resolve => setTimeout(resolve, 200));
        return this.mockData.map(data => new BranchModel(data));
    }

    // ค้นหาสาขาด้วยชื่อสาขา หรือที่อยู่
    async searchBranches(keyword) {
        const branches = await this.getAllBranches();
        if (!keyword) return branches;

        const term = keyword.toLowerCase().trim();
        return branches.filter(branch => 
            branch.branch_name.toLowerCase().includes(term) || 
            branch.address.toLowerCase().includes(term)
        );
    }
}