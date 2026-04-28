const express = require("express");
const router = express.Router();
const couponController = require("../controllers/couponController");
const adminAuthMiddleware = require("../middleware/adminAuth");

// All routes are protected with admin authentication

// Get all coupons grouped by participant
router.get("/", adminAuthMiddleware, couponController.getAllCoupons);

// Get all coupons for a specific participant by email
router.get("/:email", adminAuthMiddleware, couponController.getCouponsByEmail);

module.exports = router;
