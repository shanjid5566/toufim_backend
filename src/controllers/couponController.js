const couponService = require("../services/couponService");

/**
 * ADMIN: Get all coupons grouped by participant
 * GET /api/admin/coupons?startDate=2023-10-01&endDate=2023-10-31&status=COMPLETED
 */
const getAllCoupons = async (req, res) => {
  try {
    const { startDate, endDate, status } = req.query;

    // Build filters object
    const filters = {};
    if (startDate) filters.startDate = startDate;
    if (endDate) filters.endDate = endDate;
    if (status) filters.status = status;

    const participants = await couponService.getAllCouponsGroupedByParticipant(filters);

    res.status(200).json({
      success: true,
      message: "Coupons retrieved successfully",
      data: {
        totalParticipants: participants.length,
        participants,
        filters: {
          startDate: startDate || null,
          endDate: endDate || null,
          status: status || "All",
        },
      },
    });
  } catch (error) {
    console.error("Error fetching coupons:", error);
    res.status(500).json({
      success: false,
      error: "Failed to retrieve coupons",
    });
  }
};

/**
 * ADMIN: Get all coupons for a specific participant by email
 * GET /api/admin/coupons/:email
 */
const getCouponsByEmail = async (req, res) => {
  try {
    const { email } = req.params;

    if (!email) {
      return res.status(400).json({
        success: false,
        error: "Email parameter is required",
      });
    }

    const participant = await couponService.getCouponsByParticipantEmail(email);

    res.status(200).json({
      success: true,
      message: "Participant coupons retrieved successfully",
      data: participant,
    });
  } catch (error) {
    console.error("Error fetching participant coupons:", error);

    if (error.message === "Participant not found") {
      return res.status(404).json({
        success: false,
        error: "Participant not found",
      });
    }

    res.status(500).json({
      success: false,
      error: "Failed to retrieve participant coupons",
    });
  }
};

module.exports = {
  getAllCoupons,
  getCouponsByEmail,
};
