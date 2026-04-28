const prisma = require("../lib/prisma");

/**
 * Get all coupons grouped by participant (email)
 * Returns unique participants with their coupon summary
 * @returns {Promise<Array>} Array of participants with coupon data
 */
const getAllCouponsGroupedByParticipant = async () => {
  // Get all orders with coupons
  const orders = await prisma.order.findMany({
    where: {
      status: {
        in: ["COMPLETED", "REFUNDED"],
      },
    },
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

module.exports = {
  getAllCouponsGroupedByParticipant,
  getCouponsByParticipantEmail,
};
