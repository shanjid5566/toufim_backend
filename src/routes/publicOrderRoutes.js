const express = require("express");
const router = express.Router();

const orderController = require("../controllers/orderController");

/**
 * Public Order Routes
 * No authentication required for creating orders
 * Anyone can purchase giveaway tickets
 */

/**
 * POST /api/orders
 * Create order and get Stripe payment intent
 * Returns clientSecret for Stripe payment
 */
router.post("/", orderController.createOrder);

/**
 * POST /api/orders/confirm
 * Confirm payment and complete order
 * Generates individual coupons
 */
router.post("/confirm", orderController.confirmOrder);

/**
 * GET /api/orders/:orderId
 * Get order details with coupons
 */
router.get("/:orderId", orderController.getOrderById);

module.exports = router;
