const orderService = require("../services/orderService");

/**
 * Create order and get Stripe payment intent
 * POST /api/orders
 * Body: {
 *   packageId: string (required)
 *   voucherCode: string (optional)
 *   fullName: string (required)
 *   email: string (required)
 *   phone: string (required)
 *   instagramUsername: string (optional)
 * }
 */
const createOrder = async (req, res) => {
  try {
    const { packageId, voucherCode, fullName, email, phone, instagramUsername } = req.body;

    // Validate required fields
    if (!packageId || !fullName || !email || !phone) {
      return res.status(400).json({
        error: "Validation Error",
        message: "packageId, fullName, email, and phone are required",
      });
    }

    const result = await orderService.createOrder({
      packageId,
      voucherCode,
      fullName,
      email,
      phone,
      instagramUsername,
    });

    res.status(201).json({
      message: "Order created successfully. Complete payment to finalize.",
      data: result,
    });
  } catch (error) {
    console.error("Error creating order:", error);

    // Handle specific errors
    if (
      error.message.includes("not found") ||
      error.message.includes("not active") ||
      error.message.includes("not enough tickets") ||
      error.message.includes("voucher")
    ) {
      return res.status(400).json({
        error: "Bad Request",
        message: error.message,
      });
    }

    res.status(500).json({
      error: "Internal Server Error",
      message: "Failed to create order. Please try again.",
    });
  }
};

/**
 * Confirm payment and complete order
 * POST /api/orders/confirm
 * Body: {
 *   sessionId: string (required)
 * }
 */
const confirmOrder = async (req, res) => {
  try {
    const { sessionId } = req.body;

    if (!sessionId) {
      return res.status(400).json({
        error: "Validation Error",
        message: "sessionId is required",
      });
    }

    const order = await orderService.confirmOrder(sessionId);

    res.status(200).json({
      message: "Payment confirmed! Your coupons have been generated.",
      data: order,
    });
  } catch (error) {
    console.error("Error confirming order:", error);

    // Handle specific errors
    if (
      error.message.includes("not found") ||
      error.message.includes("already completed") ||
      error.message.includes("mismatch") ||
      error.message.includes("not successful")
    ) {
      return res.status(400).json({
        error: "Bad Request",
        message: error.message,
      });
    }

    res.status(500).json({
      error: "Internal Server Error",
      message: "Failed to confirm payment. Please try again.",
    });
  }
};

/**
 * Get order by ID
 * GET /api/orders/:orderId
 */
const getOrderById = async (req, res) => {
  try {
    const { orderId } = req.params;

    const order = await orderService.getOrderById(orderId);

    res.status(200).json({
      message: "Order retrieved successfully",
      data: order,
    });
  } catch (error) {
    console.error("Error fetching order:", error);

    if (error.message === "Order not found") {
      return res.status(404).json({
        error: "Not Found",
        message: error.message,
      });
    }

    res.status(500).json({
      error: "Internal Server Error",
      message: "Failed to fetch order. Please try again.",
    });
  }
};

module.exports = {
  createOrder,
  confirmOrder,
  getOrderById,
};
