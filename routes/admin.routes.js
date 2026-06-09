const express = require("express");
const router = express.Router();
const adminController = require('../controllers/admin.controller');

// FIX: Use curly braces to get the specific function from the middleware file
const { authenticateToken } = require("../middleware/auth");

// FIX: Use 'authenticateToken' instead of 'authMiddleware'
router.get("/seats", authenticateToken, adminController.getAdminStats);

module.exports = router;