const prisma = require("../lib/prisma");

/**
 * Get active giveaway with full details and packages
 * Returns the current active giveaway for public display
 * @returns {object} Active giveaway with packages
 */
const getActiveGiveaway = async () => {
  const giveaway = await prisma.giveaway.findFirst({
    where: {
      status: "ACTIVE",
    },
    include: {
      packages: {
        orderBy: { couponCount: "asc" },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  if (!giveaway) {
    throw new Error("No active giveaway found");
  }

  return giveaway;
};

module.exports = {
  getActiveGiveaway,
};
