const express = require('express');
const router = express.Router();
const authenticate = require('../middlewares/authMiddleware');
const { getMenuForRole } = require('../config/menuConfig');

// Sidebar items for the signed-in user's role
router.get('/', authenticate, (req, res) => {
    return res.status(200).json({
        success: true,
        data: getMenuForRole(req.user.role)
    });
});

module.exports = router;
