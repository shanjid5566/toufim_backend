const prisma = require("../lib/prisma");

/**
 * Get all coupons grouped by participant (email)
 * Returns unique participants with their coupon summary
 * @param {Object} filters - Optional filters (startDate, endDate, status)
 * @returns {Promise<Array>} Array of participants with coupon data
 */
const getAllCouponsGroupedByParticipant = async (filters = {}) => {
  const { startDate, endDate, status } = filters;

  // Build where clause
  const whereClause = {
    status: {
      in: status ? [status] : ["COMPLETED", "REFUNDED"],
    },
  };

  // Add date range filter if provided
  if (startDate || endDate) {
    whereClause.createdAt = {};
    if (startDate) {
      whereClause.createdAt.gte = new Date(startDate);
    }
    if (endDate) {
      // Include the entire end date (until 23:59:59)
      const endDateTime = new Date(endDate);
      endDateTime.setHours(23, 59, 59, 999);
      whereClause.createdAt.lte = endDateTime;
    }
  }

  // Get all orders with coupons
  const orders = await prisma.order.findMany({
    where: whereClause,
    include: {
      user: true,
      giveaway: true,
      package: true,
      coupons: true,
    },
    orderBy: {
      createdAt: "desc",
    },
  });

  // Group orders by user email
  const participantMap = new Map();

  orders.forEach((order) => {
    const email = order.user.email;

    if (!participantMap.has(email)) {
      participantMap.set(email, {
        email: order.user.email,
        fullName: order.user.fullName,
        phone: order.user.phone,
        instagram: order.user.instagramUsername || "",
        initials: order.user.fullName
          .split(" ")
          .map((n) => n[0])
          .join("")
          .toUpperCase()
          .slice(0, 2),
        orders: [],
      });
    }

    // Add order to participant
    participantMap.get(email).orders.push({
      orderId: order.id,
      giveawayName: order.giveaway.title,
      purchaseDate: order.createdAt,
      quantity: order.coupons.length,
      totalPrice: parseFloat(order.totalAmount),
      status: order.status,
      couponCodes: order.coupons.map((c) => c.couponCode),
    });
  });

  // Convert map to array and calculate totals for each participant
  const participants = Array.from(participantMap.values()).map((participant) => {
    const totalOrders = participant.orders.length;
    const totalCoupons = participant.orders.reduce((sum, order) => sum + order.quantity, 0);
    const totalSpent = participant.orders.reduce((sum, order) => sum + order.totalPrice, 0);

    return {
      email: participant.email,
      fullName: participant.fullName,
      phone: participant.phone,
      instagram: participant.instagram,
      initials: participant.initials,
      totalOrders,
      totalCoupons,
      totalSpent: parseFloat(totalSpent.toFixed(2)),
      orders: participant.orders,
    };
  });

  return participants;
};

/**
 * Get all coupons for a specific participant by email
 * @param {string} email - Participant email address
 * @returns {Promise<Object>} Participant details with all coupons
 */
const getCouponsByParticipantEmail = async (email) => {
  // Get user by email
  const user = await prisma.user.findUnique({
    where: { email },
    include: {
      orders: {
        where: {
          status: {
            in: ["COMPLETED", "REFUNDED"],
          },
        },
        include: {
          giveaway: true,
          package: true,
          coupons: true,
        },
        orderBy: {
          createdAt: "desc",
        },
      },
    },
  });

  if (!user) {
    throw new Error("Participant not found");
  }

  // Format participant data
  const participant = {
    email: user.email,
    fullName: user.fullName,
    phone: user.phone,
    instagram: user.instagramUsername || "",
    initials: user.fullName
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2),
    totalSpent: parseFloat(user.totalSpent),
    orders: user.orders.map((order) => ({
      orderId: order.id,
      giveawayName: order.giveaway.title,
      purchaseDate: order.createdAt,
      quantity: order.coupons.length,
      totalPrice: parseFloat(order.totalAmount),
      status: order.status,
      coupons: order.coupons.map((coupon) => ({
        id: coupon.id,
        couponCode: coupon.couponCode,
        status: coupon.status,
        createdAt: coupon.createdAt,
      })),
    })),
  };

  return participant;
};

/**
 * Get coupon overview/statistics for admin dashboard
 * @returns {Promise<Object>} Overview stats including total coupons, participants, revenue, etc.
 */
const getCouponOverview = async () => {
  try {
    const [
      totalCoupons,
      validCoupons,
      voidCoupons,
      uniqueParticipants,
      completedOrders,
      recentCoupons,
    ] = await Promise.all([
      // Total coupons count
      prisma.coupon.count(),
      // Valid coupons count
      prisma.coupon.count({
        where: { status: "VALID" },
      }),
      // Void coupons count
      prisma.coupon.count({
        where: { status: "VOID" },
      }),
      // Count unique participants (users with coupons)
      prisma.user.count({
        where: {
          coupons: {
            some: {},
          },
        },
      }),
      // Get all completed orders for revenue calculation
      prisma.order.findMany({
        where: { status: "COMPLETED" },
        select: { totalAmount: true },
      }),
      
    ]);

    // Calculate total revenue
    const totalRevenue = completedOrders.reduce(
      (sum, order) => sum + Number(order.totalAmount),
      0
    );

    // Calculate average revenue per order
    const averageRevenuePerOrder =
      completedOrders.length > 0 ? totalRevenue / completedOrders.length : 0;

    // Calculate usage rate
    const usageRate =
      totalCoupons > 0 ? ((totalCoupons - voidCoupons) / totalCoupons) * 100 : 0;

    return {
      totalCoupons,
      validCoupons,
      voidCoupons,
      usageRate: Math.round(usageRate * 100) / 100,
      totalParticipants: uniqueParticipants,
      totalRevenue: Math.round(totalRevenue * 100) / 100,
      averageRevenuePerOrder: Math.round(averageRevenuePerOrder * 100) / 100,
      completedOrders: completedOrders.length,
      recentCoupons,
    };
  } catch (error) {
    throw new Error(`Failed to get coupon overview: ${error.message}`);
  }
};

module.exports = {
  getAllCouponsGroupedByParticipant,
  getCouponsByParticipantEmail,
  getCouponOverview,
};
