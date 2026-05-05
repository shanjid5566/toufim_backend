const giveawayService = require("../services/giveawayService");
const prisma = require("../lib/prisma");

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
    const { title, description, totalTickets, drawDate, drawTime, status, packages: packagesJson } =
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

    // Validate status if provided
    if (status && !["DRAFT", "ACTIVE", "COMPLETED"].includes(status)) {
      return res.status(400).json({
        error: "Validation Error",
        message: "status must be DRAFT, ACTIVE, or COMPLETED",
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
        status: status || "ACTIVE", // Default to ACTIVE
      },
      packages
    );

    res.status(201).json({
      message: "Giveaway created successfully",
      data: giveaway,
    });
  } catch (error) {
    console.error("Error creating giveaway:", error);
    
    // Handle active giveaway conflict
    if (error.message.includes("active giveaway already exists")) {
      return res.status(409).json({
        error: "Conflict",
        message: error.message.replace("Failed to create giveaway: ", ""),
      });
    }

    res.status(500).json({
      error: "Internal Server Error",
      message: error.message,
    });
  }
};

/**
 * Get all giveaways (admin view)
 * GET /api/admin/giveaways?page=1&limit=10&status=ACTIVE
 * When status=ACTIVE, includes stats and recent purchasers
 * When status=COMPLETED, includes winner details
 */
const getAllGiveaways = async (req, res) => {
  try {
    const { page = 1, limit = 10, status } = req.query;

    // Validate status if provided
    if (status && !["DRAFT", "ACTIVE", "COMPLETED"].includes(status)) {
      return res.status(400).json({
        error: "Validation Error",
        message: "status must be DRAFT, ACTIVE, or COMPLETED",
      });
    }

    const result = await giveawayService.getAllGiveaways(
      parseInt(page),
      parseInt(limit),
      status
    );

    // For ACTIVE giveaways, enrich with stats and recent purchasers
    let enrichedData = result.data;
    if (status === "ACTIVE") {
      enrichedData = await Promise.all(
        result.data.map(async (giveaway) => {
          const detailed = await giveawayService.getGiveawayDetailsWithStats(giveaway.id);
          return detailed;
        })
      );
    } else if (status === "COMPLETED") {
      // For COMPLETED giveaways, include winner details
      enrichedData = await Promise.all(
        result.data.map(async (giveaway) => {
          // Fetch full giveaway with winner coupon details
          const fullGiveaway = await giveawayService.getGiveawayById(giveaway.id);
          
          let winner = null;
          if (fullGiveaway.winnerCouponId) {
            const winnerCoupon = await prisma.coupon.findUnique({
              where: { id: fullGiveaway.winnerCouponId },
              include: {
                order: {
                  include: {
                    user: {
                      select: {
                        fullName: true,
                        email: true,
                        instagramUsername: true,
                      },
                    },
                  },
                },
              },
            });

            if (winnerCoupon) {
              winner = {
                couponCode: winnerCoupon.couponCode,
                fullName: winnerCoupon.order.user.fullName,
                email: winnerCoupon.order.user.email,
                instagram: winnerCoupon.order.user.instagramUsername,
              };
            }
          }

          return {
            ...giveaway,
            winner,
            drawDate: fullGiveaway.drawDate,
            totalTickets: fullGiveaway.totalTickets,
            ticketsSold: fullGiveaway.ticketsSold,
          };
        })
      );
    }

    res.status(200).json({
      message: "Giveaways retrieved successfully",
      data: enrichedData,
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
 * Returns giveaway with stats and recent purchasers if ACTIVE
 */
const getGiveawayById = async (req, res) => {
  try {
    const { giveawayId } = req.params;

    const giveaway = await giveawayService.getGiveawayDetailsWithStats(giveawayId);

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

    // Handle active giveaway conflict
    if (error.message.includes("active giveaway already exists")) {
      return res.status(409).json({
        error: "Conflict",
        message: error.message.replace("Failed to update giveaway: ", ""),
      });
    }

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

/**
 * Draw random winner
 * GET /api/admin/giveaways/:giveawayId/draw-winner
 * Randomly selects a winner from valid coupons
 */
const drawWinner = async (req, res) => {
  try {
    const { giveawayId } = req.params;

    const result = await giveawayService.drawRandomWinner(giveawayId);

    res.status(200).json({
      success: true,
      message: "Winner drawn successfully",
      data: {
        giveaway: result.giveaway,
        winner: result.winner,
      },
    });
  } catch (error) {
    console.error("Error drawing winner:", error);

    if (error.message.includes("not found")) {
      return res.status(404).json({
        success: false,
        error: error.message,
      });
    }

    if (error.message.includes("No valid coupons")) {
      return res.status(400).json({
        success: false,
        error: error.message,
      });
    }

    res.status(500).json({
      success: false,
      error: "Failed to draw winner",
    });
  }
};

/**
 * Manually select winner by coupon code
 * POST /api/admin/giveaways/:giveawayId/select-winner
 * Body: { couponCode: string }
 * Manually selects winner by coupon code
 */
const selectWinner = async (req, res) => {
  try {
    const { giveawayId } = req.params;
    const { couponCode } = req.body;

    if (!couponCode) {
      return res.status(400).json({
        success: false,
        error: "Coupon code is required",
      });
    }

    const result = await giveawayService.selectWinnerManually(giveawayId, couponCode);

    res.status(200).json({
      success: true,
      message: "Winner selected successfully",
      data: {
        giveaway: result.giveaway,
        winner: result.winner,
      },
    });
  } catch (error) {
    console.error("Error selecting winner:", error);

    if (error.message.includes("Coupon not found")) {
      return res.status(404).json({
        success: false,
        error: "Coupon not found",
      });
    }

    if (error.message.includes("does not belong to this giveaway")) {
      return res.status(400).json({
        success: false,
        error: error.message,
      });
    }

    if (error.message.includes("not valid")) {
      return res.status(400).json({
        success: false,
        error: error.message,
      });
    }

    res.status(500).json({
      success: false,
      error: "Failed to select winner",
    });
  }
};

/**
 * Get giveaways overview stats (dashboard summary)
 * GET /api/admin/giveaways/stats/overview
 * Returns: total revenue, tickets sold, active giveaways, and upcoming draws
 */
const getOverviewStats = async (req, res) => {
  try {
    const stats = await giveawayService.getGiveawaysOverviewStats();

    res.status(200).json({
      message: "Giveaways overview stats retrieved successfully",
      data: stats,
    });
  } catch (error) {
    console.error("Error fetching giveaways overview stats:", error);
    res.status(500).json({
      error: "Internal Server Error",
      message: error.message,
    });
  }
};

/**
 * Send winner notification email
 * POST /api/admin/giveaways/:giveawayId/notify-winner
 */
const sendWinnerNotification = async (req, res) => {
  try {
    const { giveawayId } = req.params;

    const result = await giveawayService.sendWinnerEmail(giveawayId);

    res.status(200).json({
      success: true,
      message: "Winner notification email sent successfully",
      data: result,
    });
  } catch (error) {
    console.error("Error sending winner notification:", error);

    // Handle specific errors
    if (
      error.message.includes("not found") ||
      error.message.includes("No winner")
    ) {
      return res.status(400).json({
        success: false,
        error: "Bad Request",
        message: error.message,
      });
    }

    res.status(500).json({
      success: false,
      error: "Internal Server Error",
      message: "Failed to send winner notification email",
    });
  }
};

module.exports = {
  createGiveaway,
  getAllGiveaways,
  getGiveawayById,
  updateGiveaway,
  deleteGiveaway,
  drawWinner,
  selectWinner,
  getOverviewStats,
  sendWinnerNotification,
};
