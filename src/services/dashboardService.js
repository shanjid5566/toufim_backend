const prisma = require("../lib/prisma");
const { statusEnumToDutch } = require("../utils/serviceCategoryMapping");

/**
 * Get dashboard data for admin
 * @returns {Promise<Object>} Dashboard statistics
 */
const getDashboardData = async () => {
  try {
    // Get current date info
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);

    // Parallel queries for performance
    const [
      totalLeads,
      leadsThisMonth,
      activeGiveaways,
      allGiveaways,
      recentLeads,
      thisMonthOrders,
    ] = await Promise.all([
      // Total leads count
      prisma.lead.count(),

      // Leads count this month
      prisma.lead.count({
        where: {
          createdAt: {
            gte: startOfMonth,
            lte: endOfMonth,
          },
        },
      }),

      // Count of active giveaways
      prisma.giveaway.count({
        where: {
          status: "ACTIVE",
        },
      }),

      // Get all giveaways to calculate total tickets sold
      prisma.giveaway.findMany({
        select: {
          ticketsSold: true,
        },
      }),

      // Get recent 5 leads (quote requests)
      prisma.lead.findMany({
        take: 5,
        orderBy: {
          createdAt: "desc",
        },
        select: {
          id: true,
          fullName: true,
          serviceType: true,
          createdAt: true,
          status: true,
        },
      }),

      // Get orders from this month for revenue
      prisma.order.findMany({
        where: {
          createdAt: {
            gte: startOfMonth,
            lte: endOfMonth,
          },
          status: "COMPLETED",
        },
        select: {
          totalAmount: true,
        },
      }),
    ]);

    // Calculate total tickets sold
    const totalTicketsSold = allGiveaways.reduce(
      (sum, giveaway) => sum + giveaway.ticketsSold,
      0
    );

    // Calculate revenue this month
    const revenueThisMonth = thisMonthOrders.reduce(
      (sum, order) => sum + parseFloat(order.totalAmount),
      0
    );

    // Convert recent leads status to Dutch
    const recentLeadsWithDutchStatus = recentLeads.map((lead) => ({
      ...lead,
      status: statusEnumToDutch(lead.status) || lead.status,
    }));

    return {
      totalLeads,
      leadsThisMonth,
      activeGiveaways,
      totalTicketsSold,
      revenueThisMonth: parseFloat(revenueThisMonth).toFixed(2),
      recentLeads: recentLeadsWithDutchStatus,
    };
  } catch (error) {
    console.error("Error fetching dashboard data:", error);
    throw new Error("Failed to fetch dashboard data");
  }
};

module.exports = {
  getDashboardData,
};
