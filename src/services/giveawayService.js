const prisma = require("../lib/prisma");

/**
 * Determine base price per ticket from packages
 * Uses the single ticket package as reference, or calculates from first package
 * @param {array} packages - Array of packages with couponCount and price
 * @returns {number} Base price per ticket
 */
const getBasePricePerTicket = (packages) => {
  // Look for single ticket package
  const singleTicket = packages.find((pkg) => pkg.couponCount === 1);
  if (singleTicket) {
    return parseFloat(singleTicket.price);
  }

  // If no single ticket, use the first package to calculate base price
  if (packages.length > 0) {
    return parseFloat(packages[0].price) / packages[0].couponCount;
  }

  return 0;
};

/**
 * Calculate save percentage for a ticket package
 * Formula: ((basePrice * quantity - price) / (basePrice * quantity)) * 100
 * @param {number} couponCount - Number of tickets in the package
 * @param {number} basePrice - Individual ticket price
 * @param {number} price - Total price for the package
 * @returns {number} Save percentage
 */
const calculateSavePercentage = (couponCount, basePrice, price) => {
  if (!couponCount || !basePrice) return 0;

  const totalBasePrice = couponCount * basePrice;
  const savings = totalBasePrice - price;
  const savePercentage = (savings / totalBasePrice) * 100;

  // Return rounded to 2 decimal places
  return Math.round(savePercentage * 100) / 100;
};

/**
 * Generate badge text based on save percentage
 * @param {number} savePercentage - Calculated save percentage
 * @returns {string|null} Badge text like "SAVE 10%" or null if no savings
 */
const generateBadgeText = (savePercentage) => {
  if (savePercentage <= 0) return null;
  const roundedPercentage = Math.round(savePercentage);
  return `SAVE ${roundedPercentage}%`;
};

/**
 * Generate package title from coupon count
 * @param {number} couponCount - Number of tickets
 * @returns {string} Generated title like "1 Ticket" or "5 Tickets"
 */
const generatePackageTitle = (couponCount) => {
  const pluralText = couponCount === 1 ? "Ticket" : "Tickets";
  return `${couponCount} ${pluralText}`;
};

/**
 * Combine date and time into ISO DateTime string
 * @param {string} date - Date in YYYY-MM-DD format
 * @param {string} time - Time in HH:mm format (24-hour)
 * @returns {Date} Combined DateTime object
 */
const combineDateAndTime = (date, time) => {
  // Combine date and time into ISO format
  const dateTimeString = `${date}T${time}:00.000Z`;
  return new Date(dateTimeString);
};

/**
 * Create a new giveaway with ticket packages
 * @param {object} giveawayData - Giveaway details (includes drawDate and drawTime)
 * @param {array} packages - Array of ticket packages (only couponCount and price)
 * @returns {object} Created giveaway with packages
 */
const createGiveaway = async (giveawayData, packages) => {
  try {
    // Validate ticket packages
    if (!packages || packages.length === 0) {
      throw new Error("At least one ticket package is required");
    }

    // Determine base price per ticket from packages
    const basePrice = getBasePricePerTicket(packages);

    // Combine drawDate and drawTime into DateTime
    const drawDateTime = combineDateAndTime(giveawayData.drawDate, giveawayData.drawTime);

    // If publishing as ACTIVE, check if another active giveaway exists
    const status = giveawayData.status || "ACTIVE";
    if (status === "ACTIVE") {
      const existingActive = await prisma.giveaway.findFirst({
        where: {
          status: "ACTIVE",
        },
      });

      if (existingActive) {
        throw new Error(
          "An active giveaway already exists. Please complete or draft the current active giveaway before creating a new one."
        );
      }
    }

    // Create giveaway with packages
    const giveaway = await prisma.giveaway.create({
      data: {
        title: giveawayData.title,
        description: giveawayData.description,
        totalTickets: giveawayData.totalTickets,
        drawDate: drawDateTime,
        bannerImage: giveawayData.bannerImage,
        status: status,
        packages: {
          create: packages
            .sort((a, b) => a.couponCount - b.couponCount)
            .map((pkg) => {
              const savePercentage = calculateSavePercentage(
                pkg.couponCount,
                basePrice,
                pkg.price
              );

              return {
                title: generatePackageTitle(pkg.couponCount),
                couponCount: pkg.couponCount,
                price: pkg.price,
                basePrice: basePrice,
                savePercentage,
                badgeText: generateBadgeText(savePercentage),
              };
            }),
        },
      },
      include: {
        packages: true,
      },
    });

    return giveaway;
  } catch (error) {
    throw new Error(`Failed to create giveaway: ${error.message}`);
  }
};

/**
 * Update an existing giveaway
 * @param {string} giveawayId - ID of the giveaway to update
 * @param {object} updateData - Data to update (can include drawDate, drawTime, and packages)
 * @param {array} packages - Optional array of new packages to replace existing ones
 * @returns {object} Updated giveaway
 */
const updateGiveaway = async (giveawayId, updateData, packages = null) => {
  try {
    // Prepare update data (only include fields that are defined)
    const data = {};
    
    if (updateData.title !== undefined) data.title = updateData.title;
    if (updateData.description !== undefined) data.description = updateData.description;
    if (updateData.totalTickets !== undefined) data.totalTickets = updateData.totalTickets;
    if (updateData.bannerImage !== undefined) data.bannerImage = updateData.bannerImage;
    if (updateData.status !== undefined) data.status = updateData.status;

    // If both drawDate and drawTime are provided, combine them
    if (updateData.drawDate && updateData.drawTime) {
      data.drawDate = combineDateAndTime(updateData.drawDate, updateData.drawTime);
    }

    // If updating to ACTIVE status, check if another active giveaway exists
    if (updateData.status === "ACTIVE") {
      const existingActive = await prisma.giveaway.findFirst({
        where: {
          status: "ACTIVE",
          id: { not: giveawayId },
        },
      });

      if (existingActive) {
        throw new Error(
          "An active giveaway already exists. Please complete or draft the current active giveaway before activating this one."
        );
      }
    }

    // If packages are provided, delete old ones and create new ones
    if (packages && Array.isArray(packages) && packages.length > 0) {
      // Delete existing packages
      await prisma.ticketPackage.deleteMany({
        where: { giveawayId },
      });

      // Calculate base price from new packages
      const basePrice = getBasePricePerTicket(packages);

      // Prepare new packages with auto-generated fields
      const packagesData = packages.map((pkg) => {
        const savePercentage = calculateSavePercentage(
          pkg.couponCount,
          basePrice,
          pkg.price
        );

        return {
          title: generatePackageTitle(pkg.couponCount),
          couponCount: pkg.couponCount,
          price: pkg.price,
          basePrice: basePrice,
          savePercentage,
          badgeText: generateBadgeText(savePercentage),
        };
      });

      // Add packages to update data
      data.packages = {
        create: packagesData,
      };
    }

    const giveaway = await prisma.giveaway.update({
      where: { id: giveawayId },
      data,
      include: {
        packages: true,
      },
    });

    return giveaway;
  } catch (error) {
    throw new Error(`Failed to update giveaway: ${error.message}`);
  }
};

/**
 * Get all giveaways with pagination (minimal data for list view)
 * @param {number} page - Page number
 * @param {number} limit - Items per page
 * @param {string} status - Optional status filter (DRAFT, ACTIVE, COMPLETED)
 * @returns {object} Giveaways and pagination info
 */
const getAllGiveaways = async (page = 1, limit = 10, status = null) => {
  try {
    const skip = (page - 1) * limit;

    // Build where clause
    const where = {};
    if (status) {
      where.status = status;
    }

    const [giveaways, total] = await Promise.all([
      prisma.giveaway.findMany({
        where,
        skip,
        take: limit,
        select: {
          id: true,
          title: true,
          bannerImage: true,
          status: true,
          createdAt: true,
        },
        orderBy: { createdAt: "desc" },
      }),
      prisma.giveaway.count({ where }),
    ]);

    return {
      data: giveaways,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    };
  } catch (error) {
    throw new Error(`Failed to fetch giveaways: ${error.message}`);
  }
};

/**
 * Get a single giveaway by ID
 * @param {string} giveawayId - ID of the giveaway
 * @returns {object} Giveaway details with packages
 */
const getGiveawayById = async (giveawayId) => {
  try {
    const giveaway = await prisma.giveaway.findUnique({
      where: { id: giveawayId },
      include: {
        packages: {
          orderBy: { couponCount: "asc" },
        },
      },
    });

    if (!giveaway) {
      throw new Error("Giveaway not found");
    }

    return giveaway;
  } catch (error) {
    throw new Error(`Failed to fetch giveaway: ${error.message}`);
  }
};

/**
 * Delete a giveaway
 * @param {string} giveawayId - ID of the giveaway to delete
 * @returns {object} Deleted giveaway
 */
const deleteGiveaway = async (giveawayId) => {
  try {
    // First, check if giveaway exists and is not ACTIVE
    const giveaway = await prisma.giveaway.findUnique({
      where: { id: giveawayId },
    });

    if (!giveaway) {
      throw new Error("Giveaway not found");
    }

    if (giveaway.status === "ACTIVE") {
      throw new Error("Cannot delete an active giveaway. Please change its status to DRAFT or COMPLETED first.");
    }

    // Step 1: Delete all coupons associated with this giveaway
    await prisma.coupon.deleteMany({
      where: { giveawayId },
    });

    // Step 2: Delete all orders associated with this giveaway
    await prisma.order.deleteMany({
      where: { giveawayId },
    });

    // Step 3: Delete all packages
    await prisma.ticketPackage.deleteMany({
      where: { giveawayId },
    });

    // Step 4: Delete the giveaway
    const deletedGiveaway = await prisma.giveaway.delete({
      where: { id: giveawayId },
    });

    return deletedGiveaway;
  } catch (error) {
    throw new Error(`Failed to delete giveaway: ${error.message}`);
  }
};

/**
 * Get giveaway details with stats and recent purchasers
 * @param {string} giveawayId - ID of the giveaway
 * @returns {object} Giveaway with revenue, stats, and recent purchasers
 */
const getGiveawayDetailsWithStats = async (giveawayId) => {
  try {
    const giveaway = await prisma.giveaway.findUnique({
      where: { id: giveawayId },
      include: {
        packages: {
          orderBy: { couponCount: "asc" },
        },
      },
    });

    if (!giveaway) {
      throw new Error("Giveaway not found");
    }

    // Only show recent purchasers and stats for ACTIVE giveaways
    let recentPurchasers = [];
    let totalRevenue = 0;
    let totalSales = 0;
    let totalEmails = 0;
    let salesProgress = 0;

    if (giveaway.status === "ACTIVE") {
      // Get total revenue (sum of COMPLETED orders)
      const revenueData = await prisma.order.aggregate({
        where: {
          giveawayId,
          status: "COMPLETED",
        },
        _sum: {
          totalAmount: true,
        },
      });
      totalRevenue = parseFloat(revenueData._sum.totalAmount || 0);

      // Get total sales count (COMPLETED orders)
      totalSales = await prisma.order.count({
        where: {
          giveawayId,
          status: "COMPLETED",
        },
      });

      // Get unique email count from COMPLETED orders
      const emailEntries = await prisma.order.findMany({
        where: {
          giveawayId,
          status: "COMPLETED",
        },
        select: {
          user: {
            select: {
              email: true,
            },
          },
        },
      });
      const uniqueEmails = new Set(emailEntries.map((order) => order.user.email));
      totalEmails = uniqueEmails.size;

      // Get recent 3 purchasers (COMPLETED orders only)
      const recent = await prisma.order.findMany({
        where: {
          giveawayId,
          status: "COMPLETED",
        },
        include: {
          user: {
            select: {
              email: true,
              fullName: true,
              instagramUsername: true,
            },
          },
          coupons: {
            select: {
              couponCode: true,
            },
          },
        },
        orderBy: {
          createdAt: "desc",
        },
        take: 3,
      });

      recentPurchasers = recent.map((order) => ({
        fullName: order.user.fullName,
        email: order.user.email,
        instagram: order.user.instagramUsername,
        ticketRange: order.coupons.map((c) => c.couponCode),
        purchaseDate: order.createdAt,
      }));

      // Calculate sales progress percentage
      salesProgress = giveaway.totalTickets > 0 ? Math.round((totalSales / giveaway.totalTickets) * 100) : 0;
    }

    // Calculate daily average sales (days since giveaway created)
    const now = new Date();
    const createdDate = new Date(giveaway.createdAt);
    const daysSinceCreation = Math.max(1, Math.floor((now - createdDate) / (1000 * 60 * 60 * 24)));
    const dailyAverageSales = totalSales > 0 ? parseFloat((totalSales / daysSinceCreation).toFixed(2)) : 0;

    // Calculate conversion rate (percentage of tickets sold)
    const conversionRate = giveaway.totalTickets > 0 ? parseFloat(((totalSales / giveaway.totalTickets) * 100).toFixed(1)) : 0;

    return {
      ...giveaway,
      stats: {
        totalRevenue,
        totalSales,
        totalTickets: giveaway.totalTickets,
        salesProgress,
        totalEmails,
        dailyAverageSales,
        conversionRate,
      },
      recentPurchasers: giveaway.status === "ACTIVE" ? recentPurchasers : [],
    };
  } catch (error) {
    throw new Error(`Failed to fetch giveaway details: ${error.message}`);
  }
};

/**
 * Draw random winner from valid coupons
 * @param {string} giveawayId - ID of the giveaway
 * @returns {object} Updated giveaway with winner info
 */
const drawRandomWinner = async (giveawayId) => {
  try {
    // Get all valid coupons for this giveaway
    const validCoupons = await prisma.coupon.findMany({
      where: {
        giveawayId,
        status: "VALID",
      },
      include: {
        order: {
          include: {
            user: {
              select: {
                fullName: true,
                email: true,
              },
            },
          },
        },
      },
    });

    if (validCoupons.length === 0) {
      throw new Error("No valid coupons available for this giveaway");
    }

    // Randomly select a winner
    const randomIndex = Math.floor(Math.random() * validCoupons.length);
    const winnerCoupon = validCoupons[randomIndex];

    // Update giveaway with winner
    const updatedGiveaway = await prisma.giveaway.update({
      where: { id: giveawayId },
      data: {
        winnerCouponId: winnerCoupon.id,
        status: "COMPLETED",
      },
      include: {
        winnerCoupon: {
          include: {
            order: {
              include: {
                user: {
                  select: {
                    id: true,
                    fullName: true,
                    email: true,
                    instagramUsername: true,
                  },
                },
              },
            },
          },
        },
        packages: {
          orderBy: { couponCount: "asc" },
        },
      },
    });

    return {
      giveaway: updatedGiveaway,
      winner: {
        couponCode: winnerCoupon.couponCode,
        fullName: winnerCoupon.order.user.fullName,
        email: winnerCoupon.order.user.email,
        instagram: winnerCoupon.order.user.instagramUsername,
      },
    };
  } catch (error) {
    throw new Error(`Failed to draw winner: ${error.message}`);
  }
};

/**
 * Manually select winner by coupon code
 * @param {string} giveawayId - ID of the giveaway
 * @param {string} couponCode - Coupon code of the winner
 * @returns {object} Updated giveaway with winner info
 */
const selectWinnerManually = async (giveawayId, couponCode) => {
  try {
    // Find the coupon
    const coupon = await prisma.coupon.findUnique({
      where: { couponCode },
      include: {
        order: {
          include: {
            user: {
              select: {
                id: true,
                fullName: true,
                email: true,
                instagramUsername: true,
              },
            },
          },
        },
      },
    });

    if (!coupon) {
      throw new Error("Coupon not found");
    }

    // Verify coupon belongs to this giveaway
    if (coupon.giveawayId !== giveawayId) {
      throw new Error("Coupon does not belong to this giveaway");
    }

    // Check if coupon is valid
    if (coupon.status !== "VALID") {
      throw new Error("Coupon is not valid");
    }

    // Update giveaway with winner
    const updatedGiveaway = await prisma.giveaway.update({
      where: { id: giveawayId },
      data: {
        winnerCouponId: coupon.id,
        status: "COMPLETED",
      },
      include: {
        winnerCoupon: {
          include: {
            order: {
              include: {
                user: {
                  select: {
                    id: true,
                    fullName: true,
                    email: true,
                    instagramUsername: true,
                  },
                },
              },
            },
          },
        },
        packages: {
          orderBy: { couponCount: "asc" },
        },
      },
    });

    return {
      giveaway: updatedGiveaway,
      winner: {
        couponCode: coupon.couponCode,
        fullName: coupon.order.user.fullName,
        email: coupon.order.user.email,
        instagram: coupon.order.user.instagramUsername,
      },
    };
  } catch (error) {
    throw new Error(`Failed to select winner: ${error.message}`);
  }
};

/**
 * Get overview stats for all giveaways (dashboard summary)
 * @returns {object} Summary stats: total revenue, tickets, active giveaways, upcoming draws
 */
const getGiveawaysOverviewStats = async () => {
  try {
    // Get all active giveaways with their orders
    const activeGiveaways = await prisma.giveaway.findMany({
      where: { status: "ACTIVE" },
      include: {
        orders: {
          where: { status: "COMPLETED" },
          select: {
            totalAmount: true,
          },
        },
      },
    });

    // Calculate totals
    let totalRevenue = 0;
    let totalTicketsSold = 0;
    let totalTicketsAvailable = 0;

    const upcomingDraws = activeGiveaways.map((giveaway) => {
      // Add to totals
      totalRevenue += giveaway.orders.reduce((sum, order) => sum + parseFloat(order.totalAmount || 0), 0);
      totalTicketsSold += giveaway.ticketsSold;
      totalTicketsAvailable += giveaway.totalTickets;

      // Calculate days remaining
      const now = new Date();
      const drawDate = new Date(giveaway.drawDate);
      const daysRemaining = Math.max(0, Math.ceil((drawDate - now) / (1000 * 60 * 60 * 24)));

      return {
        id: giveaway.id,
        title: giveaway.title,
        drawDate: giveaway.drawDate,
        daysRemaining,
        ticketsSold: giveaway.ticketsSold,
        totalTickets: giveaway.totalTickets,
      };
    });

    // Sort by days remaining (closest draw first)
    upcomingDraws.sort((a, b) => a.daysRemaining - b.daysRemaining);

    return {
      totalRevenue: parseFloat(totalRevenue.toFixed(2)),
      totalTicketsSold,
      totalTicketsAvailable,
      activeGiveawaysCount: activeGiveaways.length,
      upcomingDraws,
    };
  } catch (error) {
    throw new Error(`Failed to fetch giveaways overview stats: ${error.message}`);
  }
};

module.exports = {
  getBasePricePerTicket,
  calculateSavePercentage,
  generateBadgeText,
  generatePackageTitle,
  createGiveaway,
  updateGiveaway,
  getAllGiveaways,
  getGiveawayById,
  deleteGiveaway,
  getGiveawayDetailsWithStats,
  drawRandomWinner,
  selectWinnerManually,
  getGiveawaysOverviewStats,
};
