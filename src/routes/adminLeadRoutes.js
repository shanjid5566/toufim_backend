const express = require("express");
const leadController = require("../controllers/leadController");
const adminAuthMiddleware = require("../middleware/adminAuth");

const router = express.Router();

/**
 * ADMIN ROUTES (Protected)
 */

// Get all leads (with optional status filter)
router.get("/", adminAuthMiddleware, leadController.getAllLeads);

// Get lead by ID
router.get("/:id", adminAuthMiddleware, leadController.getLeadById);

// Update lead status
router.patch("/:id/status", adminAuthMiddleware, leadController.updateLeadStatus);

// Delete lead
router.delete("/:id", adminAuthMiddleware, leadController.deleteLead);

module.exports = router;
