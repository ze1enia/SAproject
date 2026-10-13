import express from 'express';
import { BranchController } from '../controllers/BranchController.js';

const router = express.Router();

// ดึงสาขาทั้งหมด & ค้นหา
router.get('/', BranchController.getBranches);

// ดึงข้อมูลเฉพาะสาขา (เมื่อกด VIEW)
router.get('/:id', BranchController.getBranchById);

// สร้างสาขาใหม่
router.post('/', BranchController.createBranch);

// แก้ไขข้อมูลสาขา (เมนู ...)
router.put('/:id', BranchController.updateBranch);

// ลบสาขา (เมนู ...)
router.delete('/:id', BranchController.deleteBranch);

export default router;