const express = require("express");
const router = express.Router();

const adminAuthMiddleware = require("../middleware/adminAuth");
const giveawayController = require("../controllers/giveawayController");
const upload = require("../config/multer");

/**
 * Admin Giveaway Routes
 * All routes require admin authentication via middleware
 */

// Apply admin auth middleware to all routes in this router
router.use(adminAuthMiddleware);

/**
 * POST /api/admin/giveaways
 * Create a new giveaway with ticket pricing tiers
 * Required admin authentication
 * Accepts multipart/form-data with optional bannerImage file
 */
router.post("/", upload.single("bannerImage"), giveawayController.createGiveaway);

/**
 * GET /api/admin/giveaways
 * Get all giveaways (paginated)
 * Query params: page, limit
 * Required admin authentication
 */
router.get("/", giveawayController.getAllGiveaways);

/**
 * GET /api/admin/giveaways/stats/overview
 * Get overview stats for dashboard (total revenue, tickets, active giveaways, upcoming draws)
 * Required admin authentication
 */
router.get("/stats/overview", giveawayController.getOverviewStats);

/**
 * GET /api/admin/giveaways/:giveawayId
 * Get a specific giveaway with all its packages
 * Required admin authentication
 */
router.get("/:giveawayId", giveawayController.getGiveawayById);

/**
 * PUT /api/admin/giveaways/:giveawayId
 * Update an existing giveaway (can include packages to replace all existing packages)
 * Required admin authentication
 * Accepts multipart/form-data with optional bannerImage file
 */
router.put("/:giveawayId", upload.single("bannerImage"), giveawayController.updateGiveaway);

/**
 * POST /api/admin/giveaways/:giveawayId/draw-winner
 * Draw a random winner from valid coupons
 * Sets giveaway status to COMPLETED and selects winner
 * Required admin authentication
 */
router.post("/:giveawayId/draw-winner", giveawayController.drawWinner);

/**
 * POST /api/admin/giveaways/:giveawayId/select-winner
 * Manually select winner by coupon code
 * Body: { couponCode: string }
 * Sets giveaway status to COMPLETED
 * Required admin authentication
 */
router.post("/:giveawayId/select-winner", giveawayController.selectWinner);

/**
 * POST /api/admin/giveaways/:giveawayId/notify-winner
 * Send winner notification email
 * Sends email to the winner informing them they won
 * Required admin authentication
 */
router.post("/:giveawayId/notify-winner", giveawayController.sendWinnerNotification);

/**
 * DELETE /api/admin/giveaways/:giveawayId
 * Delete a giveaway and all its packages
 * Required admin authentication
 */
router.delete("/:giveawayId", giveawayController.deleteGiveaway);

module.exports = router;
