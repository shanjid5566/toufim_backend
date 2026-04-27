const express = require("express");
const router = express.Router();

const publicGiveawayController = require("../controllers/publicGiveawayController");

/**
 * Public Giveaway Routes
 * No authentication required
 * Returns the current ACTIVE giveaway with full details
 */

/**
 * GET /api/active-giveaway
 * Get the current active giveaway with packages
 * Returns full giveaway details with all ticket packages
 */
router.get("/", publicGiveawayController.getActiveGiveaway);

module.exports = router;
