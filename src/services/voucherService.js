const prisma = require("../lib/prisma");

/**
 * VOUCHER USAGE WORKFLOW (CODE-BASED):
 * 
 * 1. CART PREVIEW (Frontend → Public API):
 *    POST /api/vouchers/validate
 *    Body: { code: "AMBER-FALL-24", orderAmount: 500 }
 *    Returns: { voucherCode, discountAmount, finalAmount }
 *    Frontend saves the CODE (not ID)
 * 
 * 2. ORDER CREATION (Frontend → Backend):
 *    POST /api/orders
 *    Body: { items: [...], voucherCode: "AMBER-FALL-24", paymentMethod: "CARD" }
 *    Frontend sends voucher CODE directly
 * 
 * 3. AUTOMATIC PROCESSING (Backend):
 *    a) Backend receives voucherCode
 *    b) Looks up voucher: await prisma.voucher.findUnique({ where: { code } })
 *    c) Validates: await validateVoucherCode(code, orderAmount)
 *    d) Processes payment
 *    e) Creates order with voucherId
 *    f) Consumes voucher: await incrementVoucherUsage(voucherId)
 * 
 * 4. REFUND/CANCELLATION (Backend):
 *    await decrementVoucherUsage(voucherId)
 *    Restores voucher usage count
 * 
 * 5. AUTO-EXPIRATION (Cron Job):
 *    await autoExpireVouchers()
 *    Marks expired vouchers as EXPIRED
 * 
 * EXAMPLE ORDER SERVICE:
 * 
 * async function createOrder({ items, voucherCode, paymentMethod }) {
 *   const orderTotal = calculateTotal(items);
 *   let finalAmount = orderTotal;
 *   let voucherId = null;
 *   
 *   if (voucherCode) {
 *     const result = await voucherService.validateVoucherCode(voucherCode, orderTotal);
 *     finalAmount = result.finalAmount;
 *     voucherId = result.voucher.id;
 *   }
 *   
 *   const payment = await processPayment({ amount: finalAmount });
 *   if (!payment.success) throw new Error("Payment failed");
 *   
 *   const order = await prisma.order.create({
 *     data: { voucherId, totalAmount: finalAmount, ... }
 *   });
 *   
 *   if (voucherId) {
 *     await voucherService.incrementVoucherUsage(voucherId);
 *   }
 *   
 *   return order;
 * }
 */

/**
 * Create a new voucher
 * @param {object} voucherData - Voucher details
 * @returns {object} Created voucher
 */
const createVoucher = async (voucherData) => {
  const { code, discountType, discountValue, usageLimit, expirationDate, status } =
    voucherData;

  try {
    // If publishing as ACTIVE, check if another active voucher with same code exists
    if (status === "ACTIVE") {
      const existingActiveVoucher = await prisma.voucher.findFirst({
        where: {
          code: code,
          status: "ACTIVE",
        },
      });

      if (existingActiveVoucher) {
        throw new Error(
          `An active voucher with code "${code}" already exists. Please use a different code or deactivate the existing voucher.`
        );
      }
    }

    const voucher = await prisma.voucher.create({
      data: {
        code,
        discountType,
        discountValue,
        usageLimit,
        expirationDate: new Date(expirationDate),
        status: status || "ACTIVE",
      },
    });

    return voucher;
  } catch (error) {
    if (error.code === "P2002") {
      throw new Error(`A voucher with code "${code}" already exists. Please use a different code.`);
    }
    throw error;
  }
};

/**
 * Get all vouchers with pagination and optional status filter
 * @param {number} page - Page number
 * @param {number} limit - Items per page
 * @param {string} status - Optional status filter (DRAFT, ACTIVE, EXPIRED)
 * @returns {object} Vouchers and pagination info
 */
const getAllVouchers = async (page = 1, limit = 10, status = null) => {
  try {
    const skip = (page - 1) * limit;

    // Build where clause
    const where = {};
    if (status) {
      where.status = status;
    }

    const [vouchers, total] = await Promise.all([
      prisma.voucher.findMany({
        where,
        skip,
        take: limit,
        select: {
          id: true,
          code: true,
          discountType: true,
          discountValue: true,
          usageLimit: true,
          usedCount: true,
          expirationDate: true,
          status: true,
          createdAt: true,
        },
        orderBy: { createdAt: "desc" },
      }),
      prisma.voucher.count({ where }),
    ]);

    return {
      data: vouchers,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    };
  } catch (error) {
    throw new Error(`Failed to fetch vouchers: ${error.message}`);
  }
};

/**
 * Get a single voucher by ID
 * @param {string} voucherId - ID of the voucher
 * @returns {object} Voucher details
 */
const getVoucherById = async (voucherId) => {
  try {
    const voucher = await prisma.voucher.findUnique({
      where: { id: voucherId },
      include: {
        orders: {
          select: {
            id: true,
            totalAmount: true,
            createdAt: true,
            user: {
              select: {
                fullName: true,
                email: true,
              },
            },
          },
          orderBy: { createdAt: "desc" },
        },
      },
    });

    if (!voucher) {
      throw new Error("Voucher not found");
    }

    return voucher;
  } catch (error) {
    throw new Error(`Failed to fetch voucher: ${error.message}`);
  }
};

/**
 * Update an existing voucher
 * @param {string} voucherId - ID of the voucher to update
 * @param {object} updateData - Data to update
 * @returns {object} Updated voucher
 */
const updateVoucher = async (voucherId, updateData) => {
  try {
    // Prepare update data (only include fields that are defined)
    const data = {};

    if (updateData.code !== undefined) data.code = updateData.code;
    if (updateData.discountType !== undefined) data.discountType = updateData.discountType;
    if (updateData.discountValue !== undefined)
      data.discountValue = parseFloat(updateData.discountValue);
    if (updateData.usageLimit !== undefined) data.usageLimit = parseInt(updateData.usageLimit);
    if (updateData.expirationDate !== undefined)
      data.expirationDate = new Date(updateData.expirationDate);
    if (updateData.status !== undefined) data.status = updateData.status;

    // If updating to ACTIVE status with a code change, check for conflicts
    if (updateData.status === "ACTIVE" && updateData.code) {
      const existingActiveVoucher = await prisma.voucher.findFirst({
        where: {
          code: updateData.code,
          status: "ACTIVE",
          id: { not: voucherId },
        },
      });

      if (existingActiveVoucher) {
        throw new Error(
          `An active voucher with code "${updateData.code}" already exists. Please use a different code or deactivate the existing voucher.`
        );
      }
    }

    const voucher = await prisma.voucher.update({
      where: { id: voucherId },
      data,
    });

    return voucher;
  } catch (error) {
    if (error.code === "P2002") {
      const codeValue = updateData.code || "this code";
      throw new Error(`A voucher with ${codeValue !== "this code" ? `code "${codeValue}"` : codeValue} already exists. Please use a different code.`);
    }
    if (error.code === "P2025") {
      throw new Error("Voucher not found");
    }
    throw error;
  }
};

/**
 * Delete a voucher
 * @param {string} voucherId - ID of the voucher to delete
 * @returns {object} Deleted voucher
 */
const deleteVoucher = async (voucherId) => {
  try {
    // Check if voucher has been used in any orders
    const voucherWithOrders = await prisma.voucher.findUnique({
      where: { id: voucherId },
      include: {
        orders: {
          select: { id: true },
        },
      },
    });

    if (!voucherWithOrders) {
      throw new Error("Voucher not found");
    }

    if (voucherWithOrders.orders.length > 0) {
      throw new Error(
        "Cannot delete voucher that has been used in orders. Consider marking it as EXPIRED instead."
      );
    }

    const voucher = await prisma.voucher.delete({
      where: { id: voucherId },
    });

    return voucher;
  } catch (error) {
    if (error.code === "P2025") {
      throw new Error("Voucher not found");
    }
    throw error;
  }
};

/**
 * Validate a voucher code for use
 * @param {string} code - Voucher code to validate
 * @param {number} orderAmount - Order amount to calculate discount
 * @returns {object} Validated voucher with calculated discount
 */
const validateVoucherCode = async (code, orderAmount) => {
  try {
    // Find voucher by code
    const voucher = await prisma.voucher.findUnique({
      where: { code: code.toUpperCase().trim() },
    });

    if (!voucher) {
      throw new Error("Invalid voucher code");
    }

    // Check if voucher is active
    if (voucher.status !== "ACTIVE") {
      throw new Error(`This voucher is ${voucher.status.toLowerCase()} and cannot be used`);
    }

    // Check if voucher has expired
    const now = new Date();
    const expirationDate = new Date(voucher.expirationDate);
    // Set expiration to end of day (23:59:59.999) to allow usage on expiration day
    expirationDate.setHours(23, 59, 59, 999);
    if (expirationDate < now) {
      throw new Error("This voucher has expired");
    }

    // Check if voucher has usage remaining
    if (voucher.usedCount >= voucher.usageLimit) {
      throw new Error("This voucher has reached its usage limit");
    }

    // Calculate discount amount
    let discountAmount = 0;
    if (voucher.discountType === "PERCENTAGE") {
      discountAmount = (orderAmount * parseFloat(voucher.discountValue)) / 100;
    } else if (voucher.discountType === "FLAT") {
      discountAmount = parseFloat(voucher.discountValue);
    }

    // Discount cannot exceed order amount
    if (discountAmount > orderAmount) {
      discountAmount = orderAmount;
    }

    return {
      voucher,
      discountAmount: Math.round(discountAmount * 100) / 100, // Round to 2 decimal places
      finalAmount: Math.round((orderAmount - discountAmount) * 100) / 100,
    };
  } catch (error) {
    throw new Error(`Voucher validation failed: ${error.message}`);
  }
};

/**
 * Increment voucher usage count
 * Called when an order using the voucher is completed
 * @param {string} voucherId - ID of the voucher
 * @returns {object} Updated voucher
 */
const incrementVoucherUsage = async (voucherId) => {
  try {
    let voucher = await prisma.voucher.update({
      where: { id: voucherId },
      data: {
        usedCount: {
          increment: 1,
        },
      },
    });

    // Auto-expire voucher if usage limit reached
    if (voucher.usedCount >= voucher.usageLimit && voucher.status === "ACTIVE") {
      voucher = await prisma.voucher.update({
        where: { id: voucherId },
        data: {
          status: "EXPIRED",
        },
      });
    }

    return voucher;
  } catch (error) {
    throw new Error(`Failed to increment voucher usage: ${error.message}`);
  }
};

/**
 * Decrement voucher usage count
 * Called when an order using the voucher is cancelled or refunded
 * @param {string} voucherId - ID of the voucher
 * @returns {object} Updated voucher
 */
const decrementVoucherUsage = async (voucherId) => {
  try {
    const voucher = await prisma.voucher.findUnique({
      where: { id: voucherId },
    });

    if (!voucher) {
      throw new Error("Voucher not found");
    }

    // Only decrement if usedCount > 0
    if (voucher.usedCount > 0) {
      await prisma.voucher.update({
        where: { id: voucherId },
        data: {
          usedCount: {
            decrement: 1,
          },
        },
      });
    }

    return voucher;
  } catch (error) {
    throw new Error(`Failed to decrement voucher usage: ${error.message}`);
  }
};

/**
 * Auto-expire vouchers that have passed their expiration date
 * Should be called periodically (e.g., daily cron job)
 * @returns {object} Number of vouchers expired
 */
const autoExpireVouchers = async () => {
  try {
    const now = new Date();

    const result = await prisma.voucher.updateMany({
      where: {
        status: "ACTIVE",
        expirationDate: {
          lt: now,
        },
      },
      data: {
        status: "EXPIRED",
      },
    });

    return {
      expiredCount: result.count,
      timestamp: now,
    };
  } catch (error) {
    throw new Error(`Failed to auto-expire vouchers: ${error.message}`);
  }
};

/**
 * Get voucher overview statistics (dashboard metrics)
 * @returns {object} Overview stats including total discounts, active vouchers, etc.
 */
const getVoucherOverview = async () => {
  try {
    const [
      activeVouchersCount,
      totalVouchersCount,
      ordersWithVouchers,
      allVouchers,
    ] = await Promise.all([
      // Count active vouchers
      prisma.voucher.count({
        where: { status: "ACTIVE" },
      }),
      // Count total vouchers
      prisma.voucher.count(),
      // Get all orders with vouchers to calculate total discounts
      prisma.order.findMany({
        where: {
          voucherId: { not: null },
        },
        include: {
          package: {
            select: { price: true },
          },
          voucher: {
            select: { code: true },
          },
        },
      }),
      
    ]);

    // Calculate total discounts applied
    let totalDiscountsApplied = 0;
    ordersWithVouchers.forEach((order) => {
      const originalPrice = order.package.price;
      const discountAmount = originalPrice - order.totalAmount;
      if (discountAmount > 0) {
        totalDiscountsApplied += Number(discountAmount);
      }
    });

    // Calculate average discount per order
    const averageDiscountPerOrder =
      ordersWithVouchers.length > 0
        ? totalDiscountsApplied / ordersWithVouchers.length
        : 0;

    return {
      totalDiscountsApplied: Math.round(totalDiscountsApplied * 100) / 100,
      activeVouchers: activeVouchersCount,
      totalVouchers: totalVouchersCount,
      ordersUsingVouchers: ordersWithVouchers.length,
      averageDiscountPerOrder: Math.round(averageDiscountPerOrder * 100) / 100,
      topActiveVouchers: allVouchers,
    };
  } catch (error) {
    throw new Error(`Failed to get voucher overview: ${error.message}`);
  }
};

module.exports = {
  createVoucher,
  getAllVouchers,
  getVoucherById,
  updateVoucher,
  deleteVoucher,
  validateVoucherCode,
  incrementVoucherUsage,
  decrementVoucherUsage,
  autoExpireVouchers,
  getVoucherOverview,
};
