const express = require("express");
const dashboardController = require("../controllers/dashboardController");
const adminAuthMiddleware = require("../middleware/adminAuth");

const router = express.Router();

/**
 * ADMIN ROUTES (Protected)
 */

// Get dashboard overview data
router.get("/", adminAuthMiddleware, dashboardController.getDashboard);

// Get only active giveaways
router.get("/giveaways/active", adminAuthMiddleware, dashboardController.getActiveGiveaways);

// Export quote requests to CSV/Excel
router.get("/leads/export", adminAuthMiddleware, dashboardController.exportQuoteRequests);

module.exports = router;
