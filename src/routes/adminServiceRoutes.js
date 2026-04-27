const express = require("express");
const router = express.Router();

const adminAuthMiddleware = require("../middleware/adminAuth");
const serviceController = require("../controllers/serviceController");
const upload = require("../config/multer");

/**
 * Admin Service Routes
 * All routes require admin authentication via middleware
 */

// Apply admin auth middleware to all routes in this router
router.use(adminAuthMiddleware);

/**
 * POST /api/admin/services
 * Create a new service
 * Required admin authentication
 * Accepts:
 * - bannerImage: single image file
 * - galleryImages: multiple image files (up to 10)
 * - form-data text fields: name, description, basePrice, category, status
 */
router.post(
  "/",
  upload.fields([
    { name: "bannerImage", maxCount: 1 },
    { name: "galleryImages", maxCount: 10 },
  ]),
  serviceController.createService
);

/**
 * GET /api/admin/services
 * Get all services (paginated)
 * Query params: page, limit, category, status
 * Required admin authentication
 */
router.get("/", serviceController.getAllServices);

/**
 * GET /api/admin/services/:serviceId
 * Get a specific service
 * Required admin authentication
 */
router.get("/:serviceId", serviceController.getServiceById);

/**
 * PUT /api/admin/services/:serviceId
 * Update an existing service
 * Required admin authentication
 * Accepts:
 * - bannerImage: single image file (replaces existing)
 * - galleryImages: multiple image files (appends to existing)
 * - form-data text fields: name, description, basePrice, category, status (all optional)
 */
router.put(
  "/:serviceId",
  upload.fields([
    { name: "bannerImage", maxCount: 1 },
    { name: "galleryImages", maxCount: 10 },
  ]),
  serviceController.updateService
);

/**
 * DELETE /api/admin/services/:serviceId
 * Delete a service
 * Required admin authentication
 */
router.delete("/:serviceId", serviceController.deleteService);

/**
 * DELETE /api/admin/services/:serviceId/gallery
 * Remove specific gallery images from a service
 * Required admin authentication
 * Body: { imageUrls: ["url1", "url2"] }
 */
router.delete("/:serviceId/gallery", serviceController.removeGalleryImages);

module.exports = router;
