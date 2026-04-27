const express = require("express");
const router = express.Router();

const adminAuthMiddleware = require("../middleware/adminAuth");
const voucherController = require("../controllers/voucherController");
const upload = require("../config/multer");

/**
 * Admin Voucher Routes
 * All routes require admin authentication via middleware
 */

// Apply admin auth middleware to all routes in this router
router.use(adminAuthMiddleware);

/**
 * POST /api/admin/vouchers
 * Create a new voucher
 * Required admin authentication
 */
router.post("/", upload.none(), voucherController.createVoucher);

/**
 * GET /api/admin/vouchers
 * Get all vouchers (paginated)
 * Query params: page, limit, status
 * Required admin authentication
 */
router.get("/", voucherController.getAllVouchers);

/**
 * GET /api/admin/vouchers/:voucherId
 * Get a specific voucher with usage details
 * Required admin authentication
 */
router.get("/:voucherId", voucherController.getVoucherById);

/**
 * PUT /api/admin/vouchers/:voucherId
 * Update an existing voucher
 * Required admin authentication
 */
router.put("/:voucherId", upload.none(), voucherController.updateVoucher);

/**
 * DELETE /api/admin/vouchers/:voucherId
 * Delete a voucher (only if not used in any orders)
 * Required admin authentication
 */
router.delete("/:voucherId", voucherController.deleteVoucher);

module.exports = router;
