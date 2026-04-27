const express = require("express");
const router = express.Router();

const adminAuthMiddleware = require("../middleware/adminAuth");
const giveawayController = require("../controllers/giveawayController");

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
 */
router.post("/", giveawayController.createGiveaway);

/**
 * GET /api/admin/giveaways
 * Get all giveaways (paginated)
 * Query params: page, limit
 * Required admin authentication
 */
router.get("/", giveawayController.getAllGiveaways);

/**
 * GET /api/admin/giveaways/:giveawayId
 * Get a specific giveaway with all its packages
 * Required admin authentication
 */
router.get("/:giveawayId", giveawayController.getGiveawayById);

/**
 * PUT /api/admin/giveaways/:giveawayId
 * Update an existing giveaway
 * Required admin authentication
 */
router.put("/:giveawayId", giveawayController.updateGiveaway);

/**
 * POST /api/admin/giveaways/:giveawayId/packages
 * Add new ticket packages to a giveaway
 * Required admin authentication
 */
router.post("/:giveawayId/packages", giveawayController.addTicketPackages);

/**
 * DELETE /api/admin/giveaways/:giveawayId
 * Delete a giveaway and all its packages
 * Required admin authentication
 */
router.delete("/:giveawayId", giveawayController.deleteGiveaway);

module.exports = router;
