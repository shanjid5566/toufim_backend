const publicGiveawayService = require("../services/publicGiveawayService");

/**
 * Helper function to convert relative image paths to absolute URLs
 * @param {object} giveaway - Giveaway object
 * @param {object} req - Express request object
 * @returns {object} Giveaway with absolute image URLs
 */
const convertGiveawayImagesToAbsoluteUrls = (giveaway, req) => {
  if (!giveaway) return giveaway;

  const baseUrl = `${req.protocol}://${req.get("host")}`;

  return {
    ...giveaway,
    bannerImage: giveaway.bannerImage ? `${baseUrl}${giveaway.bannerImage}` : null,
  };
};

/**
 * Get active giveaway with full details and packages (public)
 * GET /api/active-giveaway
 * Returns the current active giveaway with all packages
 */
const getActiveGiveaway = async (req, res) => {
  try {
    const giveaway = await publicGiveawayService.getActiveGiveaway();

    res.status(200).json({
      message: "Active giveaway retrieved successfully",
      data: convertGiveawayImagesToAbsoluteUrls(giveaway, req),
    });
  } catch (error) {
    console.error("Error fetching active giveaway:", error);

    if (error.message === "No active giveaway found") {
      return res.status(404).json({
        error: "Not Found",
        message: error.message,
      });
    }

    res.status(500).json({
      error: "Internal Server Error",
      message: "Failed to fetch active giveaway. Please try again.",
    });
  }
};

module.exports = {
  getActiveGiveaway,
};
