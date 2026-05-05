const prisma = require("../lib/prisma");
const stripe = require("../config/stripe");
const { sendOrderConfirmation } = require("../config/email");

/**
 * Generate unique coupon code
 * Format: GW-XXXXXX-NNN (e.g., GW-A1B2C3-001)
 * @param {number} index - Index of coupon in the batch
 * @returns {string} Unique coupon code
 */
const generateCouponCode = (index) => {
  const randomPart = Math.random().toString(36).substring(2, 8).toUpperCase();
  const indexPart = String(index).padStart(3, "0");
  return `GW-${randomPart}-${indexPart}`;
};

/**
 * Validate and calculate discount from voucher
 * @param {string} voucherCode - Voucher code
 * @param {number} orderAmount - Order amount before discount
 * @returns {object} { voucherId, discountAmount, finalAmount }
 */
const validateAndApplyVoucher = async (voucherCode, orderAmount) => {
  if (!voucherCode) {
    return {
      voucherId: null,
      discountAmount: 0,
      finalAmount: orderAmount,
    };
  }

  const voucher = await prisma.voucher.findUnique({
    where: { code: voucherCode },
  });

  // Validate voucher
  if (!voucher) {
    throw new Error("Invalid voucher code");
  }

  if (voucher.status !== "ACTIVE") {
    throw new Error("Voucher is not active");
  }

  if (new Date(voucher.expirationDate) < new Date()) {
    throw new Error("Voucher has expired");
  }

  if (voucher.usedCount >= voucher.usageLimit) {
    throw new Error("Voucher usage limit reached");
  }

  // Calculate discount
  let discountAmount = 0;

  if (voucher.discountType === "PERCENTAGE") {
    discountAmount = (parseFloat(orderAmount) * parseFloat(voucher.discountValue)) / 100;
  } else {
    // FLAT discount
    discountAmount = parseFloat(voucher.discountValue);
  }

  const finalAmount = parseFloat(orderAmount) - discountAmount;

  return {
    voucherId: voucher.id,
    discountAmount: parseFloat(discountAmount.toFixed(2)),
    finalAmount: parseFloat(finalAmount.toFixed(2)),
  };
};

/**
 * Create order and Stripe payment intent
 * @param {object} orderData - Order details
 * @returns {object} Order with clientSecret for Stripe
 */
const createOrder = async (orderData) => {
  const { packageId, voucherCode, fullName, email, phone, instagramUsername } = orderData;

  // 1. Get package details with giveaway
  const ticketPackage = await prisma.ticketPackage.findUnique({
    where: { id: packageId },
    include: {
      giveaway: true,
    },
  });

  if (!ticketPackage) {
    throw new Error("Ticket package not found");
  }

  if (ticketPackage.giveaway.status !== "ACTIVE") {
    throw new Error("Giveaway is not active");
  }

  // Check if enough tickets available
  const remainingTickets = ticketPackage.giveaway.totalTickets - ticketPackage.giveaway.ticketsSold;
  if (ticketPackage.couponCount > remainingTickets) {
    throw new Error("Not enough tickets available");
  }

  const originalAmount = parseFloat(ticketPackage.price);

  // 2. Validate and apply voucher (if provided)
  const { voucherId, discountAmount, finalAmount } = await validateAndApplyVoucher(
    voucherCode,
    originalAmount
  );

  // 3. Create or get user
  let user = await prisma.user.findUnique({
    where: { email },
  });

  if (!user) {
    user = await prisma.user.create({
      data: {
        fullName,
        email,
        password: "", // No password for coupon purchase users
        phone,
        instagramUsername,
      },
    });
  }

  // 4. Create order first (before Stripe session)
  const order = await prisma.order.create({
    data: {
      userId: user.id,
      giveawayId: ticketPackage.giveaway.id,
      packageId: packageId,
      voucherId: voucherId,
      totalAmount: finalAmount,
      status: "PENDING",
    },
    include: {
      package: true,
      giveaway: true,
      voucher: true,
    },
  });

  // 5. Create Stripe Checkout Session
  const session = await stripe.checkout.sessions.create({
    payment_method_types: ["card"],
    customer_email: email, // ← Pre-fill email so user doesn't have to enter again
    line_items: [
      {
        price_data: {
          currency: "eur",
          product_data: {
            name: ticketPackage.giveaway.title,
            description: `${ticketPackage.title} - ${ticketPackage.couponCount} coupon(s)`,
          },
          unit_amount: Math.round(finalAmount * 100), // Convert to cents
        },
        quantity: 1,
      },
    ],
    mode: "payment",
    success_url: `${process.env.FRONTEND_URL}/order/success?session_id={CHECKOUT_SESSION_ID}&order_id=${order.id}`,
    cancel_url: `${process.env.FRONTEND_URL}/order/cancel?order_id=${order.id}`,
    metadata: {
      orderId: order.id,
      packageId: packageId,
      giveawayId: ticketPackage.giveaway.id,
      voucherId: voucherId || "none",
      userId: user.id,
      couponCount: ticketPackage.couponCount.toString(),
    },
  });

  // 6. Update order with session ID
  await prisma.order.update({
    where: { id: order.id },
    data: { paymentIntentId: session.id },
  });

  return {
    orderId: order.id,
    sessionId: session.id,
    paymentUrl: session.url, // ← Stripe redirect URL
    totalAmount: finalAmount,
    originalAmount: originalAmount,
    discountAmount: discountAmount,
    packageDetails: {
      title: ticketPackage.title,
      couponCount: ticketPackage.couponCount,
    },
    giveawayTitle: ticketPackage.giveaway.title,
  };
};

/**
 * Confirm payment and complete order
 * Generates individual coupons for the buyer
 * @param {string} sessionId - Stripe Checkout Session ID
 * @returns {object} Completed order with coupons
 */
const confirmOrder = async (sessionId) => {
  // 1. Verify session with Stripe
  const session = await stripe.checkout.sessions.retrieve(sessionId);

  if (session.payment_status !== "paid") {
    throw new Error("Payment not successful");
  }

  const orderId = session.metadata.orderId;

  // 2. Get order details
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: {
      package: true,
      giveaway: true,
      voucher: true,
      user: true,
    },
  });

  if (!order) {
    throw new Error("Order not found");
  }

  if (order.status === "COMPLETED") {
    throw new Error("Order already completed");
  }

  // 3. Generate individual coupons (one per ticket)
  const couponCount = order.package.couponCount;
  const couponsToCreate = [];

  for (let i = 1; i <= couponCount; i++) {
    let couponCode;
    let isUnique = false;

    // Generate unique coupon code
    while (!isUnique) {
      couponCode = generateCouponCode(i);
      const existing = await prisma.coupon.findUnique({
        where: { couponCode },
      });
      if (!existing) {
        isUnique = true;
      }
    }

    couponsToCreate.push({
      couponCode,
      orderId: order.id,
      userId: order.userId,
      giveawayId: order.giveawayId,
      status: "VALID",
    });
  }

  // 4. Complete order in transaction
  const result = await prisma.$transaction(async (tx) => {
    // Update order status
    const updatedOrder = await tx.order.update({
      where: { id: orderId },
      data: { status: "COMPLETED" },
    });

    // Create all coupons
    await tx.coupon.createMany({
      data: couponsToCreate,
    });

    // Increment voucher usage if voucher was used
    if (order.voucherId) {
      await tx.voucher.update({
        where: { id: order.voucherId },
        data: {
          usedCount: { increment: 1 },
        },
      });
    }

    // Increment tickets sold
    await tx.giveaway.update({
      where: { id: order.giveawayId },
      data: {
        ticketsSold: { increment: couponCount },
      },
    });

    // Update user total spent
    await tx.user.update({
      where: { id: order.userId },
      data: {
        totalSpent: { increment: order.totalAmount },
      },
    });

    return updatedOrder;
  });

  // 5. Get complete order with coupons
  const completedOrder = await prisma.order.findUnique({
    where: { id: orderId },
    include: {
      package: true,
      giveaway: true,
      voucher: true,
      user: true,
      coupons: {
        orderBy: { createdAt: "asc" },
      },
    },
  });

  // 6. Send order confirmation email with coupon codes
  try {
    await sendOrderConfirmation({
      email: completedOrder.user.email,
      fullName: completedOrder.user.fullName,
      giveawayTitle: completedOrder.giveaway.title,
      packageTitle: completedOrder.package.title,
      totalAmount: parseFloat(completedOrder.totalAmount),
      coupons: completedOrder.coupons,
      orderId: completedOrder.id,
    });
    console.log("✅ Order confirmation email sent to:", completedOrder.user.email);
  } catch (emailError) {
    // Log error but don't fail the order
    console.error("❌ Failed to send order confirmation email:", emailError.message);
    // Order is still successful even if email fails
  }

  return completedOrder;
};

/**
 * Get order by ID
 * @param {string} orderId - Order ID
 * @returns {object} Order details with coupons
 */
const getOrderById = async (orderId) => {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: {
      user: {
        select: {
          id: true,
          fullName: true,
          email: true,
          phone: true,
          instagramUsername: true,
        },
      },
    },
  });

  if (!order) {
    throw new Error("Order not found");
  }

  // Add email, fullName, and amount at top level for easier access
  return {
    ...order,
    email: order.user.email,
    fullName: order.user.fullName,
    amount: order.totalAmount,
  };
};

module.exports = {
  createOrder,
  confirmOrder,
  getOrderById,
};
