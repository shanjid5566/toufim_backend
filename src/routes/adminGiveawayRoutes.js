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
 * DELETE /api/admin/giveaways/:giveawayId
 * Delete a giveaway and all its packages
 * Required admin authentication
 */
router.delete("/:giveawayId", giveawayController.deleteGiveaway);

module.exports = router;
