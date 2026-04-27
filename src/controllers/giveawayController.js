const giveawayService = require("../services/giveawayService");

/**
 * Create a new giveaway with ticket pricing tiers
 * Only accessible by admins
 * POST /api/admin/giveaways
 * Body: {
 *   title: string,
 *   description: string,
 *   totalTickets: number,
 *   drawDate: datetime,
 *   bannerImage: string (optional),
 *   packages: [
 *     {
 *       couponCount: number (e.g., 1, 5, 10),
 *       price: decimal (total price for package)
 *     }
 *   ]
 * }
 */
const createGiveaway = async (req, res) => {
  try {
    const { title, description, totalTickets, drawDate, bannerImage, packages } =
      req.body;

    // Validation
    if (!title || !description || !totalTickets || !drawDate || !packages) {
      return res.status(400).json({
        error: "Validation Error",
        message:
          "Missing required fields: title, description, totalTickets, drawDate, packages",
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

    const giveaway = await giveawayService.createGiveaway(
      {
        title,
        description,
        totalTickets,
        drawDate,
        bannerImage,
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
 * Body: {
 *   title?: string,
 *   description?: string,
 *   totalTickets?: number,
 *   drawDate?: datetime,
 *   bannerImage?: string,
 *   status?: "ACTIVE" | "COMPLETED"
 * }
 */
const updateGiveaway = async (req, res) => {
  try {
    const { giveawayId } = req.params;
    const { title, description, totalTickets, drawDate, bannerImage, status } =
      req.body;

    const giveaway = await giveawayService.updateGiveaway(giveawayId, {
      title,
      description,
      totalTickets,
      drawDate,
      bannerImage,
      status,
    });

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
 * Add new ticket packages to a giveaway
 * POST /api/admin/giveaways/:giveawayId/packages
 * Body: {
 *   packages: [
 *     {
 *       couponCount: number,
 *       price: decimal
 *     }
 *   ]
 * }
 */
const addTicketPackages = async (req, res) => {
  try {
    const { giveawayId } = req.params;
    const { packages } = req.body;

    // Validation
    if (!packages || !Array.isArray(packages) || packages.length === 0) {
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

    const createdPackages = await giveawayService.addTicketPackages(
      giveawayId,
      packages
    );

    res.status(201).json({
      message: "Ticket packages added successfully",
      data: createdPackages,
    });
  } catch (error) {
    console.error("Error adding ticket packages:", error);
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
  addTicketPackages,
  deleteGiveaway,
};
