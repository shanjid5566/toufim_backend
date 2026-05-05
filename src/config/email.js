const nodemailer = require("nodemailer");

/**
 * Email configuration using nodemailer
 * Configure SMTP settings in .env file
 */

// Create transporter using environment variables
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || "smtp.gmail.com",
  port: process.env.SMTP_PORT || 587,
  secure: process.env.SMTP_SECURE === "true", // true for 465, false for other ports
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

/**
 * Send email using nodemailer
 * @param {object} options - Email options
 * @param {string} options.to - Recipient email address
 * @param {string} options.subject - Email subject
 * @param {string} options.html - HTML content
 * @param {string} options.text - Plain text content (optional)
 * @returns {Promise<object>} Send result
 */
const sendEmail = async ({ to, subject, html, text }) => {
  try {
    const mailOptions = {
      from: `${process.env.EMAIL_FROM_NAME || "Toufim"} <${process.env.SMTP_USER}>`,
      to,
      subject,
      html,
      text: text || "", // Plain text fallback
    };

    const info = await transporter.sendMail(mailOptions);
    
    console.log("✅ Email sent successfully:", info.messageId);
    return {
      success: true,
      messageId: info.messageId,
    };
  } catch (error) {
    console.error("❌ Email sending failed:", error.message);
    throw new Error(`Failed to send email: ${error.message}`);
  }
};

/**
 * Send winner notification email
 * @param {object} winnerData - Winner information
 * @param {string} winnerData.email - Winner's email
 * @param {string} winnerData.fullName - Winner's full name
 * @param {string} winnerData.couponCode - Winning coupon code
 * @param {string} winnerData.giveawayTitle - Giveaway title
 * @returns {Promise<object>} Send result
 */
const sendWinnerNotification = async ({ email, fullName, couponCode, giveawayTitle }) => {
  const subject = `🎉 Congratulations! You Won: ${giveawayTitle}`;
  
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body {
          font-family: Arial, sans-serif;
          line-height: 1.6;
          color: #333;
          max-width: 600px;
          margin: 0 auto;
          padding: 20px;
        }
        .header {
          background: linear-gradient(135deg, #FF8C42 0%, #FF6B35 100%);
          color: white;
          padding: 30px;
          text-align: center;
          border-radius: 10px 10px 0 0;
        }
        .header h1 {
          margin: 0;
          font-size: 28px;
        }
        .content {
          background: #f9f9f9;
          padding: 30px;
          border-radius: 0 0 10px 10px;
        }
        .winner-info {
          background: white;
          padding: 20px;
          border-radius: 8px;
          margin: 20px 0;
          border-left: 4px solid #FF8C42;
        }
        .coupon-code {
          background: #FF8C42;
          color: white;
          padding: 15px;
          text-align: center;
          font-size: 24px;
          font-weight: bold;
          border-radius: 8px;
          letter-spacing: 2px;
          margin: 20px 0;
        }
        .footer {
          text-align: center;
          padding: 20px;
          color: #666;
          font-size: 14px;
        }
        .btn {
          display: inline-block;
          padding: 12px 30px;
          background: #FF8C42;
          color: white;
          text-decoration: none;
          border-radius: 5px;
          margin: 20px 0;
        }
      </style>
    </head>
    <body>
      <div class="header">
        <h1>🎉 CONGRATULATIONS! 🎉</h1>
      </div>
      <div class="content">
        <p>Dear ${fullName},</p>
        
        <p><strong>Amazing news!</strong> You are the lucky winner of our giveaway:</p>
        
        <div class="winner-info">
          <h2 style="margin-top: 0; color: #FF8C42;">${giveawayTitle}</h2>
        </div>
        
        <p>Your winning coupon code is:</p>
        
        <div class="coupon-code">
          ${couponCode}
        </div>
        
        <p>We will contact you shortly with more details about claiming your prize. Please keep this email for your records.</p>
        
        <p>If you have any questions, feel free to reply to this email or contact our support team.</p>
        
        <p>Thank you for participating!</p>
        
        <p style="margin-top: 30px;">
          Best regards,<br>
          <strong>The Toufim Team</strong>
        </p>
      </div>
      <div class="footer">
        <p>This is an automated email. Please do not reply directly to this message.</p>
        <p>&copy; ${new Date().getFullYear()} Toufim. All rights reserved.</p>
      </div>
    </body>
    </html>
  `;

  const text = `
    Congratulations ${fullName}!
    
    You are the lucky winner of: ${giveawayTitle}
    
    Your winning coupon code: ${couponCode}
    
    We will contact you shortly with more details about claiming your prize.
    
    Best regards,
    The Toufim Team
  `;

  return await sendEmail({ to: email, subject, html, text });
};

/**
 * Send order confirmation email with coupon codes
 * @param {object} orderData - Order information
 * @param {string} orderData.email - Customer's email
 * @param {string} orderData.fullName - Customer's full name
 * @param {string} orderData.giveawayTitle - Giveaway title
 * @param {string} orderData.packageTitle - Package title (e.g., "5 Tickets")
 * @param {number} orderData.totalAmount - Total amount paid
 * @param {array} orderData.coupons - Array of coupon objects with couponCode
 * @param {string} orderData.orderId - Order ID
 * @returns {Promise<object>} Send result
 */
const sendOrderConfirmation = async ({ email, fullName, giveawayTitle, packageTitle, totalAmount, coupons, orderId }) => {
  const subject = `🎫 Order Confirmed - Your Tickets for ${giveawayTitle}`;
  
  // Generate coupon codes list HTML
  const couponCodesHtml = coupons.map((coupon, index) => `
    <div style="background: #f0f0f0; padding: 10px 15px; margin: 5px 0; border-radius: 5px; font-family: monospace; font-size: 16px; font-weight: bold;">
      ${index + 1}. ${coupon.couponCode}
    </div>
  `).join('');

  const couponCodesText = coupons.map((coupon, index) => 
    `${index + 1}. ${coupon.couponCode}`
  ).join('\n');

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body {
          font-family: Arial, sans-serif;
          line-height: 1.6;
          color: #333;
          max-width: 600px;
          margin: 0 auto;
          padding: 20px;
        }
        .header {
          background: linear-gradient(135deg, #FF8C42 0%, #FF6B35 100%);
          color: white;
          padding: 30px;
          text-align: center;
          border-radius: 10px 10px 0 0;
        }
        .header h1 {
          margin: 0;
          font-size: 28px;
        }
        .content {
          background: #f9f9f9;
          padding: 30px;
          border-radius: 0 0 10px 10px;
        }
        .order-info {
          background: white;
          padding: 20px;
          border-radius: 8px;
          margin: 20px 0;
          border-left: 4px solid #FF8C42;
        }
        .order-info h3 {
          margin-top: 0;
          color: #FF8C42;
        }
        .order-detail {
          display: flex;
          justify-content: space-between;
          padding: 8px 0;
          border-bottom: 1px solid #eee;
        }
        .order-detail:last-child {
          border-bottom: none;
          font-weight: bold;
          font-size: 18px;
          color: #FF8C42;
        }
        .coupons-section {
          background: white;
          padding: 20px;
          border-radius: 8px;
          margin: 20px 0;
        }
        .coupons-section h3 {
          margin-top: 0;
          color: #FF8C42;
        }
        .footer {
          text-align: center;
          padding: 20px;
          color: #666;
          font-size: 14px;
        }
        .btn {
          display: inline-block;
          padding: 12px 30px;
          background: #FF8C42;
          color: white;
          text-decoration: none;
          border-radius: 5px;
          margin: 20px 0;
        }
      </style>
    </head>
    <body>
      <div class="header">
        <h1>🎫 Order Confirmed!</h1>
      </div>
      <div class="content">
        <p>Dear ${fullName},</p>
        
        <p>Thank you for your purchase! Your payment has been confirmed and your tickets have been generated.</p>
        
        <div class="order-info">
          <h3>📋 Order Details</h3>
          <div class="order-detail">
            <span>Order ID:</span>
            <span>${orderId}</span>
          </div>
          <div class="order-detail">
            <span>Giveaway:</span>
            <span>${giveawayTitle}</span>
          </div>
          <div class="order-detail">
            <span>Package:</span>
            <span>${packageTitle}</span>
          </div>
          <div class="order-detail">
            <span>Total Paid:</span>
            <span>€${totalAmount}</span>
          </div>
        </div>
        
        <div class="coupons-section">
          <h3>🎟️ Your Ticket${coupons.length > 1 ? 's' : ''} (${coupons.length})</h3>
          <p>Here ${coupons.length > 1 ? 'are' : 'is'} your coupon code${coupons.length > 1 ? 's' : ''}. Keep this email safe!</p>
          ${couponCodesHtml}
        </div>
        
        <p style="background: #fff3cd; border-left: 4px solid #ffc107; padding: 15px; border-radius: 5px;">
          <strong>⚠️ Important:</strong> Save this email! You will need ${coupons.length > 1 ? 'these coupon codes' : 'this coupon code'} to claim your prize if you win.
        </p>
        
        <p>Good luck! The draw will take place on the scheduled date. We will announce the winner and notify them via email.</p>
        
        <p style="margin-top: 30px;">
          Best regards,<br>
          <strong>The Toufim Team</strong>
        </p>
      </div>
      <div class="footer">
        <p>This is an automated confirmation email.</p>
        <p>&copy; ${new Date().getFullYear()} Toufim. All rights reserved.</p>
      </div>
    </body>
    </html>
  `;

  const text = `
    Order Confirmed - Your Tickets for ${giveawayTitle}
    
    Dear ${fullName},
    
    Thank you for your purchase! Your payment has been confirmed and your tickets have been generated.
    
    ORDER DETAILS
    -------------
    Order ID: ${orderId}
    Giveaway: ${giveawayTitle}
    Package: ${packageTitle}
    Total Paid: €${totalAmount}
    
    YOUR TICKET${coupons.length > 1 ? 'S' : ''} (${coupons.length})
    ${'-'.repeat(50)}
    ${couponCodesText}
    
    IMPORTANT: Save this email! You will need ${coupons.length > 1 ? 'these coupon codes' : 'this coupon code'} to claim your prize if you win.
    
    Good luck! The draw will take place on the scheduled date. We will announce the winner and notify them via email.
    
    Best regards,
    The Toufim Team
  `;

  return await sendEmail({ to: email, subject, html, text });
};

module.exports = {
  sendEmail,
  sendWinnerNotification,
  sendOrderConfirmation,
};
