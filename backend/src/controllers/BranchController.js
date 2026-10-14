const { BranchService } = require('../services/BranchService');
const { BranchSummaryService } = require('../services/BranchSummaryService');

const branchService = new BranchService();
const summaryService = new BranchSummaryService();

class BranchController {

    // 1. ดึงรายการสาขาทั้งหมด หรือค้นหาผ่าน Query ?search=
    static async getBranches(req, res) {
        try {
            const { search } = req.query;
            let branches;

            if (search) {
                branches = await branchService.searchBranches(search);
            } else {
                branches = await branchService.getAllBranches();
            }

            return res.status(200).json({
                success: true,
                count: branches.length,
                data: branches
            });
        } catch (error) {
            return res.status(500).json({
                success: false,
                message: 'ไม่สามารถดึงข้อมูลรายการสาขาได้',
                error: error.message
            });
        }
    }

    // 2. ดึงข้อมูลเฉพาะ 1 สาขาด้วย ID
    static async getBranchById(req, res) {
        try {
            const { id } = req.params;
            const branch = await branchService.getBranchById(id);

            if (!branch) {
                return res.status(404).json({
                    success: false,
                    message: `ไม่พบข้อมูลสาขารหัส ${id}`
                });
            }

            return res.status(200).json({
                success: true,
                data: branch
            });
        } catch (error) {
            return res.status(500).json({
                success: false,
                message: 'เกิดข้อผิดพลาดในการดึงข้อมูลสาขา',
                error: error.message
            });
        }
    }

    // 2.1 ตัวเลขสรุปของสาขา (หน้า Branch dashboard)
    static async getBranchSummary(req, res) {
        try {
            const { id } = req.params;
            const branch = await branchService.getBranchById(id);

            if (!branch) {
                return res.status(404).json({
                    success: false,
                    message: `ไม่พบข้อมูลสาขารหัส ${id}`
                });
            }

            return res.status(200).json({
                success: true,
                data: summaryService.getSummary(branch.branch_id)
            });
        } catch (error) {
            return res.status(500).json({
                success: false,
                message: 'ไม่สามารถดึงข้อมูลสรุปของสาขาได้',
                error: error.message
            });
        }
    }

    // 3. เพิ่มสาขาใหม่
    static async createBranch(req, res) {
        try {
            const { branch_id, branch_name, address } = req.body;

            if (!branch_id || !branch_name) {
                return res.status(400).json({
                    success: false,
                    message: 'กรุณากรอก branch_id และ branch_name ให้ครบถ้วน'
                });
            }

            const newBranch = await branchService.createBranch({
                branch_id,
                branch_name,
                address: address || ''
            });

            return res.status(201).json({
                success: true,
                message: 'เพิ่มสาขาเรียบร้อยแล้ว',
                data: newBranch
            });
        } catch (error) {
            return res.status(500).json({
                success: false,
                message: 'ไม่สามารถเพิ่มสาขาได้',
                error: error.message
            });
        }
    }

    // 4. แก้ไขข้อมูลสาขา
    static async updateBranch(req, res) {
        try {
            const { id } = req.params;
            const { branch_name, address } = req.body;

            const updatedBranch = await branchService.updateBranch(id, { branch_name, address });

            if (!updatedBranch) {
                return res.status(404).json({
                    success: false,
                    message: `ไม่พบสาขารหัส ${id} ที่ต้องการแก้ไข`
                });
            }

            return res.status(200).json({
                success: true,
                message: 'อัปเดตข้อมูลสาขาเรียบร้อยแล้ว',
                data: updatedBranch
            });
        } catch (error) {
            return res.status(500).json({
                success: false,
                message: 'ไม่สามารถแก้ไขข้อมูลสาขาได้',
                error: error.message
            });
        }
    }

    // 5. ลบสาขา
    static async deleteBranch(req, res) {
        try {
            const { id } = req.params;
            const isDeleted = await branchService.deleteBranch(id);

            if (!isDeleted) {
                return res.status(404).json({
                    success: false,
                    message: `ไม่พบสาขารหัส ${id} ที่ต้องการลบ`
                });
            }

            return res.status(200).json({
                success: true,
                message: `ลบสาขารหัส ${id} เรียบร้อยแล้ว`
            });
        } catch (error) {
            return res.status(500).json({
                success: false,
                message: 'ไม่สามารถลบสาขาได้',
                error: error.message
            });
        }
    }
}

module.exports = { BranchController };
