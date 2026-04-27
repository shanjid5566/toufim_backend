const express = require("express");
const router = express.Router();

const adminAuthController = require("../controllers/adminAuthController");
const adminAuthMiddleware = require("../middleware/adminAuth");

/**
 * Admin Authentication Routes
 * Public routes: register, login
 * Protected routes: me, change-password
 */

/**
 * POST /api/admin/auth/register
 * Register a new admin
 * Note: In production, add extra protection to prevent unauthorized registrations
 */
router.post("/register", adminAuthController.register);

/**
 * POST /api/admin/auth/login
 * Admin login - returns JWT token
 */
router.post("/login", adminAuthController.login);

/**
 * GET /api/admin/auth/me
 * Get current admin profile
 * Requires JWT authentication
 */
router.get("/me", adminAuthMiddleware, adminAuthController.getProfile);

/**
 * PUT /api/admin/auth/change-password
 * Change admin password
 * Requires JWT authentication
 */
router.put("/change-password", adminAuthMiddleware, adminAuthController.changePassword);

module.exports = router;
