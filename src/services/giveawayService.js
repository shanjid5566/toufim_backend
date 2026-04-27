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

    // Create giveaway with packages
    const giveaway = await prisma.giveaway.create({
      data: {
        title: giveawayData.title,
        description: giveawayData.description,
        totalTickets: giveawayData.totalTickets,
        drawDate: drawDateTime,
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
  getAllGiveaways,
  getGiveawayById,
  deleteGiveaway,
};
