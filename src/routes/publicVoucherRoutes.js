const express = require("express");
const router = express.Router();

const voucherController = require("../controllers/voucherController");

/**
 * Public Voucher Routes
 * No authentication required - accessible to all users
 */

/**
 * POST /api/vouchers/validate
 * Validate a voucher code and get discount preview
 * Body: { code, orderAmount }
 * 
 * Returns discount calculation for preview only.
 * Does NOT consume the voucher (usedCount stays the same).
 * 
 * When creating order, send the voucher CODE (not ID).
 * Backend will automatically validate and consume the voucher
 * after successful payment.
 * 
 * Public access - no authentication required
 */
router.post("/validate", voucherController.validateVoucher);

module.exports = router;
