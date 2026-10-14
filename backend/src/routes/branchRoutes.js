const express = require('express');
const { BranchController } = require('../controllers/BranchController');
const authenticate = require('../middlewares/authMiddleware');
const authorize = require('../middlewares/authorize');

const router = express.Router();

// ดึงสาขาทั้งหมด & ค้นหา
router.get('/', authenticate, BranchController.getBranches);

// ดึงข้อมูลเฉพาะสาขา (เมื่อกด VIEW)
router.get('/:id', authenticate, BranchController.getBranchById);

// สร้างสาขาใหม่
router.post('/', authenticate, authorize('Owner'), BranchController.createBranch);

// แก้ไขข้อมูลสาขา (เมนู ...)
router.put('/:id', authenticate, authorize('Owner'), BranchController.updateBranch);

// ลบสาขา (เมนู ...)
router.delete('/:id', authenticate, authorize('Owner'), BranchController.deleteBranch);

module.exports = router;
