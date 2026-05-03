const voucherService = require("../services/voucherService");

/**
 * Create a new voucher
 * POST /api/admin/vouchers
 * Body: {
 *   code: string (unique),
 *   discountType: "PERCENTAGE" | "FLAT",
 *   discountValue: number,
 *   usageLimit: number,
 *   expirationDate: string (YYYY-MM-DD),
 *   status?: "DRAFT" | "ACTIVE" | "EXPIRED"
 * }
 */
const createVoucher = async (req, res) => {
  try {
    const { code, discountType, discountValue, usageLimit, expirationDate, status } = req.body;

    // Validation
    if (!code || !discountType || !discountValue || !usageLimit || !expirationDate) {
      return res.status(400).json({
        error: "Validation Error",
        message:
          "Missing required fields: code, discountType, discountValue, usageLimit, expirationDate",
      });
    }

    // Validate discount type
    if (!["PERCENTAGE", "FLAT"].includes(discountType)) {
      return res.status(400).json({
        error: "Validation Error",
        message: "discountType must be PERCENTAGE or FLAT",
      });
    }

    // Validate discount value
    const discountValueNum = parseFloat(discountValue);
    if (isNaN(discountValueNum) || discountValueNum <= 0) {
      return res.status(400).json({
        error: "Validation Error",
        message: "discountValue must be a positive number",
      });
    }

    // Validate percentage range
    if (discountType === "PERCENTAGE" && discountValueNum > 100) {
      return res.status(400).json({
        error: "Validation Error",
        message: "discountValue for PERCENTAGE type cannot exceed 100",
      });
    }

    // Validate usage limit
    const usageLimitNum = parseInt(usageLimit, 10);
    if (isNaN(usageLimitNum) || usageLimitNum <= 0) {
      return res.status(400).json({
        error: "Validation Error",
        message: "usageLimit must be a positive number",
      });
    }

    // Validate status if provided
    if (status && !["DRAFT", "ACTIVE", "EXPIRED"].includes(status)) {
      return res.status(400).json({
        error: "Validation Error",
        message: "status must be DRAFT, ACTIVE, or EXPIRED",
      });
    }

    // Validate expiration date
    const expDate = new Date(expirationDate);
    if (isNaN(expDate.getTime())) {
      return res.status(400).json({
        error: "Validation Error",
        message: "expirationDate must be a valid date (YYYY-MM-DD)",
      });
    }

    const voucher = await voucherService.createVoucher({
      code: code.toUpperCase().trim(), // Normalize code to uppercase
      discountType,
      discountValue: discountValueNum,
      usageLimit: usageLimitNum,
      expirationDate,
      status: status || "ACTIVE", // Default to ACTIVE
    });

    res.status(201).json({
      message: "Voucher created successfully",
      data: voucher,
    });
  } catch (error) {
    console.error("Error creating voucher:", error);

    if (error.message.includes("already exists")) {
      return res.status(409).json({
        error: "Conflict",
        message: error.message,
      });
    }

    res.status(500).json({
      error: "Internal Server Error",
      message: "Failed to create voucher. Please try again.",
    });
  }
};

/**
 * Get all vouchers (admin view)
 * GET /api/admin/vouchers?page=1&limit=10&status=ACTIVE
 */
const getAllVouchers = async (req, res) => {
  try {
    const { page = 1, limit = 10, status } = req.query;

    // Validate status if provided
    if (status && !["DRAFT", "ACTIVE", "EXPIRED"].includes(status)) {
      return res.status(400).json({
        error: "Validation Error",
        message: "status must be DRAFT, ACTIVE, or EXPIRED",
      });
    }

    const result = await voucherService.getAllVouchers(
      parseInt(page),
      parseInt(limit),
      status
    );

    res.status(200).json({
      message: "Vouchers retrieved successfully",
      data: result.data,
      pagination: result.pagination,
    });
  } catch (error) {
    console.error("Error fetching vouchers:", error);
    res.status(500).json({
      error: "Internal Server Error",
      message: error.message,
    });
  }
};

/**
 * Get a specific voucher by ID (admin view)
 * GET /api/admin/vouchers/:voucherId
 */
const getVoucherById = async (req, res) => {
  try {
    const { voucherId } = req.params;

    const voucher = await voucherService.getVoucherById(voucherId);

    res.status(200).json({
      message: "Voucher retrieved successfully",
      data: voucher,
    });
  } catch (error) {
    console.error("Error fetching voucher:", error);

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
 * Update an existing voucher
 * PUT /api/admin/vouchers/:voucherId
 * Body: {
 *   code?: string,
 *   discountType?: "PERCENTAGE" | "FLAT",
 *   discountValue?: number,
 *   usageLimit?: number,
 *   expirationDate?: string,
 *   status?: "DRAFT" | "ACTIVE" | "EXPIRED"
 * }
 */
const updateVoucher = async (req, res) => {
  try {
    const { voucherId } = req.params;
    const { code, discountType, discountValue, usageLimit, expirationDate, status } = req.body;

    // Validate discount type if provided
    if (discountType && !["PERCENTAGE", "FLAT"].includes(discountType)) {
      return res.status(400).json({
        error: "Validation Error",
        message: "discountType must be PERCENTAGE or FLAT",
      });
    }

    // Validate discount value if provided
    if (discountValue !== undefined) {
      const discountValueNum = parseFloat(discountValue);
      if (isNaN(discountValueNum) || discountValueNum <= 0) {
        return res.status(400).json({
          error: "Validation Error",
          message: "discountValue must be a positive number",
        });
      }

      // Validate percentage range
      if (discountType === "PERCENTAGE" && discountValueNum > 100) {
        return res.status(400).json({
          error: "Validation Error",
          message: "discountValue for PERCENTAGE type cannot exceed 100",
        });
      }
    }

    // Validate usage limit if provided
    if (usageLimit !== undefined) {
      const usageLimitNum = parseInt(usageLimit, 10);
      if (isNaN(usageLimitNum) || usageLimitNum < 0) {
        return res.status(400).json({
          error: "Validation Error",
          message: "usageLimit must be a non-negative number",
        });
      }
    }

    // Validate status if provided
    if (status && !["DRAFT", "ACTIVE", "EXPIRED"].includes(status)) {
      return res.status(400).json({
        error: "Validation Error",
        message: "status must be DRAFT, ACTIVE, or EXPIRED",
      });
    }

    // Validate expiration date if provided
    if (expirationDate) {
      const expDate = new Date(expirationDate);
      if (isNaN(expDate.getTime())) {
        return res.status(400).json({
          error: "Validation Error",
          message: "expirationDate must be a valid date (YYYY-MM-DD)",
        });
      }
    }

    const updateData = {};
    if (code !== undefined) updateData.code = code.toUpperCase().trim();
    if (discountType !== undefined) updateData.discountType = discountType;
    if (discountValue !== undefined) updateData.discountValue = discountValue;
    if (usageLimit !== undefined) updateData.usageLimit = usageLimit;
    if (expirationDate !== undefined) updateData.expirationDate = expirationDate;
    if (status !== undefined) updateData.status = status;

    const voucher = await voucherService.updateVoucher(voucherId, updateData);

    res.status(200).json({
      message: "Voucher updated successfully",
      data: voucher,
    });
  } catch (error) {
    console.error("Error updating voucher:", error);

    if (error.message.includes("already exists")) {
      return res.status(409).json({
        error: "Conflict",
        message: error.message,
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
      message: "Failed to update voucher. Please try again.",
    });
  }
};

/**
 * Delete a voucher
 * DELETE /api/admin/vouchers/:voucherId
 */
const deleteVoucher = async (req, res) => {
  try {
    const { voucherId } = req.params;

    await voucherService.deleteVoucher(voucherId);

    res.status(200).json({
      message: "Voucher deleted successfully",
    });
  } catch (error) {
    console.error("Error deleting voucher:", error);

    if (error.message.includes("not found")) {
      return res.status(404).json({
        error: "Not Found",
        message: error.message,
      });
    }

    if (error.message.includes("Cannot delete voucher")) {
      return res.status(400).json({
        error: "Bad Request",
        message: error.message,
      });
    }

    res.status(500).json({
      error: "Internal Server Error",
      message: "Failed to delete voucher. Please try again.",
    });
  }
};

/**
 * Validate a voucher code (PREVIEW ONLY - does not consume)
 * POST /api/vouchers/validate
 * Body: {
 *   code: string,
 *   orderAmount: number
 * }
 * 
 * Returns discount preview without consuming the voucher.
 * Frontend should save the voucher CODE from response.
 * 
 * When creating order:
 * - Frontend sends: voucherCode (not ID)
 * - Backend validates and consumes automatically after payment
 */
const validateVoucher = async (req, res) => {
  try {
    const { code, orderAmount } = req.body;

    // Validation
    if (!code || !orderAmount) {
      return res.status(400).json({
        error: "Validation Error",
        message: "Missing required fields: code, orderAmount",
      });
    }

    const orderAmountNum = parseFloat(orderAmount);
    if (isNaN(orderAmountNum) || orderAmountNum <= 0) {
      return res.status(400).json({
        error: "Validation Error",
        message: "orderAmount must be a positive number",
      });
    }

    // Validate voucher (preview only - does not consume)
    const result = await voucherService.validateVoucherCode(code, orderAmountNum);

    res.status(200).json({
      message: "Voucher is valid",
      data: {
        voucherCode: result.voucher.code,
        discountType: result.voucher.discountType,
        discountValue: result.voucher.discountValue,
        discountAmount: result.discountAmount,
        originalAmount: orderAmountNum,
        finalAmount: result.finalAmount,
        remainingUses: result.voucher.usageLimit - result.voucher.usedCount,
        expirationDate: result.voucher.expirationDate,
      },
    });
  } catch (error) {
    console.error("Error validating voucher:", error);

    // Handle specific validation errors
    if (
      error.message.includes("Invalid voucher") ||
      error.message.includes("expired") ||
      error.message.includes("usage limit") ||
      error.message.includes("cannot be used")
    ) {
      return res.status(400).json({
        error: "Validation Error",
        message: error.message.replace("Voucher validation failed: ", ""),
      });
    }

    res.status(500).json({
      error: "Internal Server Error",
      message: error.message,
    });
  }
};

/**
 * Get voucher overview/statistics (Dashboard)
 * GET /api/admin/vouchers/overview
 * Returns: Total discounts applied, active vouchers count, and other metrics
 */
const getVoucherOverview = async (req, res) => {
  try {
    const overview = await voucherService.getVoucherOverview();

    res.status(200).json({
      message: "Voucher overview retrieved successfully",
      data: overview,
    });
  } catch (error) {
    console.error("Error fetching voucher overview:", error);
    res.status(500).json({
      error: "Internal Server Error",
      message: error.message,
    });
  }
};

module.exports = {
  createVoucher,
  getAllVouchers,
  getVoucherById,
  updateVoucher,
  deleteVoucher,
  validateVoucher,
  getVoucherOverview,
};
