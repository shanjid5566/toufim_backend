const { PrismaClient } = require("../generated/prisma");
const prisma = new PrismaClient();

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
 * Create a new giveaway with ticket packages
 * @param {object} giveawayData - Giveaway details
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

    // Create giveaway with packages
    const giveaway = await prisma.giveaway.create({
      data: {
        title: giveawayData.title,
        description: giveawayData.description,
        totalTickets: giveawayData.totalTickets,
        drawDate: new Date(giveawayData.drawDate),
        bannerImage: giveawayData.bannerImage,
        status: giveawayData.status || "ACTIVE",
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
 * @param {object} updateData - Data to update
 * @returns {object} Updated giveaway
 */
const updateGiveaway = async (giveawayId, updateData) => {
  try {
    const giveaway = await prisma.giveaway.update({
      where: { id: giveawayId },
      data: {
        title: updateData.title,
        description: updateData.description,
        totalTickets: updateData.totalTickets,
        drawDate: updateData.drawDate ? new Date(updateData.drawDate) : undefined,
        bannerImage: updateData.bannerImage,
        status: updateData.status,
      },
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
 * Add ticket packages to a giveaway
 * @param {string} giveawayId - ID of the giveaway
 * @param {array} packages - Array of ticket packages (only couponCount and price)
 * @returns {array} Created packages
 */
const addTicketPackages = async (giveawayId, packages) => {
  try {
    // Get existing packages to determine base price
    const existingPackages = await prisma.ticketPackage.findMany({
      where: { giveawayId },
    });

    // Get base price from existing packages or use first existing package
    let basePrice;
    if (existingPackages.length > 0) {
      basePrice = parseFloat(existingPackages[0].basePrice);
    } else {
      // If no existing packages, use the first new package to calculate base price
      basePrice = getBasePricePerTicket(packages);
    }

    const allPackages = [...existingPackages, ...packages];
    const createdPackages = await Promise.all(
      packages.map(async (pkg) => {
        const savePercentage = calculateSavePercentage(
          pkg.couponCount,
          basePrice,
          pkg.price
        );

        return prisma.ticketPackage.create({
          data: {
            title: generatePackageTitle(pkg.couponCount),
            couponCount: pkg.couponCount,
            price: pkg.price,
            basePrice: basePrice,
            savePercentage,
            badgeText: generateBadgeText(savePercentage),
            giveawayId,
          },
        });
      })
    );

    return createdPackages;
  } catch (error) {
    throw new Error(`Failed to add ticket packages: ${error.message}`);
  }
};

/**
 * Get all giveaways with pagination
 * @param {number} page - Page number
 * @param {number} limit - Items per page
 * @returns {object} Giveaways and pagination info
 */
const getAllGiveaways = async (page = 1, limit = 10) => {
  try {
    const skip = (page - 1) * limit;

    const [giveaways, total] = await Promise.all([
      prisma.giveaway.findMany({
        skip,
        take: limit,
        include: {
          packages: {
            orderBy: { couponCount: "asc" },
          },
        },
        orderBy: { createdAt: "desc" },
      }),
      prisma.giveaway.count(),
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
    // First delete all packages
    await prisma.ticketPackage.deleteMany({
      where: { giveawayId },
    });

    // Then delete the giveaway
    const giveaway = await prisma.giveaway.delete({
      where: { id: giveawayId },
    });

    return giveaway;
  } catch (error) {
    throw new Error(`Failed to delete giveaway: ${error.message}`);
  }
};

module.exports = {
  getBasePricePerTicket,
  calculateSavePercentage,
  generateBadgeText,
  generatePackageTitle,
  createGiveaway,
  updateGiveaway,
  addTicketPackages,
  getAllGiveaways,
  getGiveawayById,
  deleteGiveaway,
};
