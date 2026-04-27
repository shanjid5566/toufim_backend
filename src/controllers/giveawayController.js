const giveawayService = require("../services/giveawayService");

/**
 * Create a new giveaway with ticket pricing tiers
 * Only accessible by admins
 * POST /api/admin/giveaways
 * Body: {
 *   title: string,
 *   description: string,
 *   totalTickets: number,
 *   drawDate: string (YYYY-MM-DD),
 *   drawTime: string (HH:mm in 24-hour format),
 *   bannerImage: file (optional - multipart/form-data),
 *   packages: JSON string of array
 * }
 */
const createGiveaway = async (req, res) => {
  try {
    const { title, description, totalTickets, drawDate, drawTime, packages: packagesJson } =
      req.body;

    // Parse packages from JSON string (when using multipart/form-data)
    let packages;
    try {
      packages = JSON.parse(packagesJson);
    } catch (err) {
      return res.status(400).json({
        error: "Validation Error",
        message: "Invalid packages format. Must be valid JSON array.",
      });
    }

    // Parse totalTickets to integer (comes as string from form-data)
    const totalTicketsNum = parseInt(totalTickets, 10);

    // Validation
    if (!title || !description || !totalTickets || !drawDate || !drawTime || !packages) {
      return res.status(400).json({
        error: "Validation Error",
        message:
          "Missing required fields: title, description, totalTickets, drawDate, drawTime, packages",
      });
    }

    if (isNaN(totalTicketsNum) || totalTicketsNum <= 0) {
      return res.status(400).json({
        error: "Validation Error",
        message: "totalTickets must be a positive number",
      });
    }

    if (!Array.isArray(packages) || packages.length === 0) {
      return res.status(400).json({
        error: "Validation Error",
        message: "Packages must be a non-empty array",
      });
    }

    // Validate each package - only couponCount and price required
    for (const pkg of packages) {
      if (!pkg.couponCount || !pkg.price) {
        return res.status(400).json({
          error: "Validation Error",
          message: "Each package must have: couponCount, price",
        });
      }

      if (isNaN(pkg.couponCount) || pkg.couponCount <= 0) {
        return res.status(400).json({
          error: "Validation Error",
          message: "couponCount must be a positive number",
        });
      }

      if (isNaN(pkg.price) || pkg.price <= 0) {
        return res.status(400).json({
          error: "Validation Error",
          message: "price must be a positive number",
        });
      }
    }

    // Get uploaded file path if exists
    let bannerImageUrl = null;
    if (req.file) {
      // Generate full URL: http://localhost:3000/uploads/filename.jpg
      const baseUrl = `${req.protocol}://${req.get("host")}`;
      bannerImageUrl = `${baseUrl}/uploads/${req.file.filename}`;
    }

    const giveaway = await giveawayService.createGiveaway(
      {
        title,
        description,
        totalTickets: totalTicketsNum,
        drawDate,
        drawTime,
        bannerImage: bannerImageUrl,
      },
      packages
    );

    res.status(201).json({
      message: "Giveaway created successfully",
      data: giveaway,
    });
  } catch (error) {
    console.error("Error creating giveaway:", error);
    res.status(500).json({
      error: "Internal Server Error",
      message: error.message,
    });
  }
};

/**
 * Get all giveaways (admin view)
 * GET /api/admin/giveaways?page=1&limit=10
 */
const getAllGiveaways = async (req, res) => {
  try {
    const { page = 1, limit = 10 } = req.query;

    const result = await giveawayService.getAllGiveaways(
      parseInt(page),
      parseInt(limit)
    );

    res.status(200).json({
      message: "Giveaways retrieved successfully",
      data: result.data,
      pagination: result.pagination,
    });
  } catch (error) {
    console.error("Error fetching giveaways:", error);
    res.status(500).json({
      error: "Internal Server Error",
      message: error.message,
    });
  }
};

/**
 * Get a specific giveaway by ID (admin view)
 * GET /api/admin/giveaways/:giveawayId
 */
const getGiveawayById = async (req, res) => {
  try {
    const { giveawayId } = req.params;

    const giveaway = await giveawayService.getGiveawayById(giveawayId);

    res.status(200).json({
      message: "Giveaway retrieved successfully",
      data: giveaway,
    });
  } catch (error) {
    console.error("Error fetching giveaway:", error);

    if (error.message.includes("not found")) {
      return res.status(404).json({
        error: "Not Found",
        message: error.message,
      });
    }

    res.status(500).json({
      error: "Internal Server Error",
      message: error.message,
    });
  }
};

/**
 * Update an existing giveaway
 * PUT /api/admin/giveaways/:giveawayId
 * Body (multipart/form-data): {
 *   title?: string,
 *   description?: string,
 *   totalTickets?: number,
 *   drawDate?: string (YYYY-MM-DD),
 *   drawTime?: string (HH:mm),
 *   bannerImage?: file (optional - multipart/form-data),
 *   status?: "ACTIVE" | "COMPLETED",
 *   packages?: JSON string of array [{couponCount, price}]
 * }
 */
const updateGiveaway = async (req, res) => {
  try {
    const { giveawayId } = req.params;
    const { title, description, totalTickets, drawDate, drawTime, status, packages: packagesJson } =
      req.body;

    // Parse packages from JSON string if provided (when using multipart/form-data)
    let packages = null;
    if (packagesJson) {
      try {
        packages = JSON.parse(packagesJson);
      } catch (err) {
        return res.status(400).json({
          error: "Validation Error",
          message: "Invalid packages format. Must be valid JSON array.",
        });
      }
    }

    // Parse totalTickets to integer if provided (comes as string from form-data)
    const totalTicketsNum = totalTickets ? parseInt(totalTickets, 10) : undefined;

    // Validate totalTickets if provided
    if (totalTickets && (isNaN(totalTicketsNum) || totalTicketsNum <= 0)) {
      return res.status(400).json({
        error: "Validation Error",
        message: "totalTickets must be a positive number",
      });
    }

    // Validate packages if provided
    if (packages) {
      if (!Array.isArray(packages) || packages.length === 0) {
        return res.status(400).json({
          error: "Validation Error",
          message: "Packages must be a non-empty array",
        });
      }

      // Validate each package
      for (const pkg of packages) {
        if (!pkg.couponCount || !pkg.price) {
          return res.status(400).json({
            error: "Validation Error",
            message: "Each package must have: couponCount, price",
          });
        }

        if (isNaN(pkg.couponCount) || pkg.couponCount <= 0) {
          return res.status(400).json({
            error: "Validation Error",
            message: "couponCount must be a positive number",
          });
        }

        if (isNaN(pkg.price) || pkg.price <= 0) {
          return res.status(400).json({
            error: "Validation Error",
            message: "price must be a positive number",
          });
        }
      }
    }

    // Get uploaded file URL if exists
    let bannerImageUrl = undefined; // undefined means don't update this field
    if (req.file) {
      // Generate full URL: http://localhost:3000/uploads/filename.jpg
      const baseUrl = `${req.protocol}://${req.get("host")}`;
      bannerImageUrl = `${baseUrl}/uploads/${req.file.filename}`;
    }

    const giveaway = await giveawayService.updateGiveaway(
      giveawayId,
      {
        title,
        description,
        totalTickets: totalTicketsNum,
        drawDate,
        drawTime,
        bannerImage: bannerImageUrl,
        status,
      },
      packages
    );

    res.status(200).json({
      message: "Giveaway updated successfully",
      data: giveaway,
    });
  } catch (error) {
    console.error("Error updating giveaway:", error);

    if (error.message.includes("not found")) {
      return res.status(404).json({
        error: "Not Found",
        message: error.message,
      });
    }

    res.status(500).json({
      error: "Internal Server Error",
      message: error.message,
    });
  }
};

/**
 * Delete a giveaway
 * DELETE /api/admin/giveaways/:giveawayId
 */
const deleteGiveaway = async (req, res) => {
  try {
    const { giveawayId } = req.params;

    const deletedGiveaway = await giveawayService.deleteGiveaway(giveawayId);

    res.status(200).json({
      message: "Giveaway deleted successfully",
      data: deletedGiveaway,
    });
  } catch (error) {
    console.error("Error deleting giveaway:", error);

    if (error.message.includes("not found")) {
      return res.status(404).json({
        error: "Not Found",
        message: error.message,
      });
    }

    res.status(500).json({
      error: "Internal Server Error",
      message: error.message,
    });
  }
};

module.exports = {
  createGiveaway,
  getAllGiveaways,
  getGiveawayById,
  updateGiveaway,
  deleteGiveaway,
};
