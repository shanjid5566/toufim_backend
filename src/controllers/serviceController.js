const serviceService = require("../services/serviceService");
const {
  dutchToEnum,
  getAllDutchCategories,
  isValidDutchCategory,
  serviceWithDutchCategory,
  servicesWithDutchCategories,
} = require("../utils/serviceCategoryMapping");

/**
 * Valid service categories (Dutch names)
 */
const VALID_CATEGORIES = getAllDutchCategories();

/**
 * Valid service statuses
 */
const VALID_STATUSES = ["ACTIVE", "COMPLETED", "DRAFT"];

/**
 * Create a new service
 * POST /api/admin/services
 * Form-data fields:
 * - name (text) - Service name
 * - description (text) - Service description
 * - basePrice (text) - Base price in EUR
 * - category (text) - Service category
 * - status (text) - LIVE or MAINTENANCE (optional, default: LIVE)
 * - bannerImage (file) - Banner image (optional)
 * - galleryImages (files) - Multiple gallery images (optional)
 */
const createService = async (req, res) => {
  try {
    const { name, description, basePrice, category, status } = req.body;

    // Validation
    if (!name || !description || !basePrice || !category) {
      return res.status(400).json({
        error: "Validation Error",
        message: "Missing required fields: name, description, basePrice, category",
      });
    }

    // Validate category (Dutch input)
    if (!isValidDutchCategory(category)) {
      return res.status(400).json({
        error: "Validation Error",
        message: `Ongeldige categorie. Moet een van de volgende zijn: ${VALID_CATEGORIES.join(", ")}`,
      });
    }

    // Convert Dutch category to English enum for database
    const categoryEnum = dutchToEnum(category);

    // Validate base price
    const basePriceNum = parseFloat(basePrice);
    if (isNaN(basePriceNum) || basePriceNum < 0) {
      return res.status(400).json({
        error: "Validation Error",
        message: "basePrice must be a positive number",
      });
    }

    // Validate status if provided
    if (status && !VALID_STATUSES.includes(status)) {
      return res.status(400).json({
        error: "Validation Error",
        message: `Invalid status. Must be one of: ${VALID_STATUSES.join(", ")}`,
      });
    }

    // Get uploaded files
    const files = {
      bannerImage: req.files?.bannerImage?.[0],
      galleryImages: req.files?.galleryImages || [],
    };

    const service = await serviceService.createService(
      {
        name,
        description,
        basePrice: basePriceNum,
        category: categoryEnum,
        status: status || "ACTIVE",
      },
      files
    );

    // Convert category back to Dutch for response
    const serviceWithDutch = serviceWithDutchCategory(service);

    res.status(201).json({
      message: "Service succesvol aangemaakt",
      data: serviceWithDutch,
    });
  } catch (error) {
    console.error("Error creating service:", error);

    res.status(500).json({
      error: "Internal Server Error",
      message: "Failed to create service. Please try again.",
    });
  }
};

/**
 * Get all services
 * GET /api/admin/services
 * Query params:
 * - page (number) - Page number (default: 1)
 * - limit (number) - Items per page (default: 10)
 * - category (string) - Filter by category (optional)
 * - status (string) - Filter by status (optional)
 */
const getAllServices = async (req, res) => {
  try {
    const { page = 1, limit = 10, category, status } = req.query;

    // Convert Dutch category filter to English enum if provided
    const categoryEnum = category ? dutchToEnum(category) : undefined;

    const result = await serviceService.getAllServices(page, limit, categoryEnum, status);

    // Convert categories back to Dutch for response
    const servicesWithDutch = servicesWithDutchCategories(result.services);

    res.status(200).json({
      message: "Services succesvol opgehaald",
      services: servicesWithDutch,
      pagination: result.pagination,
    });
  } catch (error) {
    console.error("Error fetching services:", error);

    res.status(500).json({
      error: "Internal Server Error",
      message: "Failed to fetch services. Please try again.",
    });
  }
};

/**
 * Get service by ID
 * GET /api/admin/services/:serviceId
 */
const getServiceById = async (req, res) => {
  try {
    const { serviceId } = req.params;

    const service = await serviceService.getServiceById(serviceId);

    // Convert category to Dutch for response
    const serviceWithDutch = serviceWithDutchCategory(service);

    res.status(200).json({
      message: "Service succesvol opgehaald",
      data: serviceWithDutch,
    });
  } catch (error) {
    console.error("Error fetching service:", error);

    if (error.message === "Service not found") {
      return res.status(404).json({
        error: "Not Found",
        message: error.message,
      });
    }

    res.status(500).json({
      error: "Internal Server Error",
      message: "Failed to fetch service. Please try again.",
    });
  }
};

/**
 * Update service
 * PUT /api/admin/services/:serviceId
 * Form-data fields (all optional):
 * - name (text)
 * - description (text)
 * - basePrice (text)
 * - category (text)
 * - status (text)
 * - bannerImage (file) - Replaces existing banner image
 * - galleryImages (files) - Adds to existing gallery images
 */
const updateService = async (req, res) => {
  try {
    const { serviceId } = req.params;
    const { name, description, basePrice, category, status } = req.body;

    // Validate category if provided (Dutch input)
    if (category && !isValidDutchCategory(category)) {
      return res.status(400).json({
        error: "Validation Error",
        message: `Ongeldige categorie. Moet een van de volgende zijn: ${VALID_CATEGORIES.join(", ")}`,
      });
    }

    // Convert Dutch category to English enum if provided
    const categoryEnum = category ? dutchToEnum(category) : undefined;

    // Validate base price if provided
    if (basePrice !== undefined) {
      const basePriceNum = parseFloat(basePrice);
      if (isNaN(basePriceNum) || basePriceNum < 0) {
        return res.status(400).json({
          error: "Validation Error",
          message: "basePrice must be a positive number",
        });
      }
    }

    // Validate status if provided
    if (status && !VALID_STATUSES.includes(status)) {
      return res.status(400).json({
        error: "Validation Error",
        message: `Invalid status. Must be one of: ${VALID_STATUSES.join(", ")}`,
      });
    }

    // Get uploaded files
    const files = {
      bannerImage: req.files?.bannerImage?.[0],
      galleryImages: req.files?.galleryImages || [],
    };

    const service = await serviceService.updateService(
      serviceId,
      { name, description, basePrice, category: categoryEnum, status },
      files
    );

    // Convert category back to Dutch for response
    const serviceWithDutch = serviceWithDutchCategory(service);

    res.status(200).json({
      message: "Service succesvol bijgewerkt",
      data: serviceWithDutch,
    });
  } catch (error) {
    console.error("Error updating service:", error);

    if (error.message === "Service not found") {
      return res.status(404).json({
        error: "Not Found",
        message: error.message,
      });
    }

    res.status(500).json({
      error: "Internal Server Error",
      message: "Failed to update service. Please try again.",
    });
  }
};

/**
 * Delete service
 * DELETE /api/admin/services/:serviceId
 */
const deleteService = async (req, res) => {
  try {
    const { serviceId } = req.params;

    await serviceService.deleteService(serviceId);

    res.status(200).json({
      message: "Service deleted successfully",
    });
  } catch (error) {
    console.error("Error deleting service:", error);

    if (error.code === "P2025") {
      return res.status(404).json({
        error: "Not Found",
        message: "Service not found",
      });
    }

    res.status(500).json({
      error: "Internal Server Error",
      message: "Failed to delete service. Please try again.",
    });
  }
};

/**
 * Remove specific gallery images
 * DELETE /api/admin/services/:serviceId/gallery
 * Body: { imageUrls: ["url1", "url2"] }
 */
const removeGalleryImages = async (req, res) => {
  try {
    const { serviceId } = req.params;
    const { imageUrls } = req.body;

    if (!imageUrls || !Array.isArray(imageUrls) || imageUrls.length === 0) {
      return res.status(400).json({
        error: "Validation Error",
        message: "imageUrls must be a non-empty array",
      });
    }

    const service = await serviceService.removeGalleryImages(serviceId, imageUrls);

    res.status(200).json({
      message: "Gallery images removed successfully",
      data: service,
    });
  } catch (error) {
    console.error("Error removing gallery images:", error);

    if (error.message === "Service not found") {
      return res.status(404).json({
        error: "Not Found",
        message: error.message,
      });
    }

    res.status(500).json({
      error: "Internal Server Error",
      message: "Failed to remove gallery images. Please try again.",
    });
  }
};

module.exports = {
  createService,
  getAllServices,
  getServiceById,
  updateService,
  deleteService,
  removeGalleryImages,
};
