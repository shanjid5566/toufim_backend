const express = require("express");
const router = express.Router();
const serviceController = require("../controllers/serviceController");

/**
 * Public Service Routes
 * No authentication required
 */

// GET /api/services - Get all active services
router.get("/", serviceController.getPublicServices);

// GET /api/services/:id - Get individual service by ID
router.get("/:id", serviceController.getPublicServiceById);

module.exports = router;
