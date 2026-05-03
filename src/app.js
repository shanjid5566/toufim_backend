const express = require("express");
const path = require("path");
const cors = require("cors");

// Import routes
const adminAuthRoutes = require("./routes/adminAuthRoutes");
const adminDashboardRoutes = require("./routes/adminDashboardRoutes");
const adminGiveawayRoutes = require("./routes/adminGiveawayRoutes");
const adminVoucherRoutes = require("./routes/adminVoucherRoutes");
const adminServiceRoutes = require("./routes/adminServiceRoutes");
const adminLeadRoutes = require("./routes/adminLeadRoutes");
const adminCouponRoutes = require("./routes/adminCouponRoutes");
const publicVoucherRoutes = require("./routes/publicVoucherRoutes");
const publicGiveawayRoutes = require("./routes/publicGiveawayRoutes");
const publicOrderRoutes = require("./routes/publicOrderRoutes");
const publicLeadRoutes = require("./routes/publicLeadRoutes");
const publicServiceRoutes = require("./routes/publicServiceRoutes");

// Initialize Express app
const app = express();

// CORS middleware configuration
const corsOptions = {
  origin: function (origin, callback) {
    const allowedOrigins = [
      "http://localhost:5173",
      "http://localhost:3000",
      "http://localhost:5174",
      "http://localhost",
    ];
    
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error("Not allowed by CORS"));
    }
  },
  credentials: true,
  methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
  optionsSuccessStatus: 200,
  maxAge: 86400
};

app.use(cors(corsOptions));

// Middleware to parse JSON request bodies
app.use(express.json());

// Middleware to parse URL-encoded request bodies
app.use(express.urlencoded({ extended: true }));

// Serve static files from uploads directory
app.use("/uploads", express.static(path.join(__dirname, "..", "uploads")));

// Routes
app.get("/", (req, res) => {
  res.status(200).json({
    message: "Welcome to the Toufim API",
    timestamp: new Date().toISOString(),
  });
});

// Health check route
app.get("/health", (req, res) => {
  res.status(200).json({
    status: "OK",
    message: "Server is running",
    timestamp: new Date().toISOString(),
  });
});

// Admin Authentication routes (public: login, register)
app.use("/api/admin/auth", adminAuthRoutes);

// Admin Dashboard routes (protected: requires JWT token)
app.use("/api/admin/dashboard", adminDashboardRoutes);

// Public Voucher routes (no authentication required)
app.use("/api/vouchers", publicVoucherRoutes);

// Public Giveaway route (no authentication required, returns current ACTIVE giveaway)
app.use("/api/active-giveaway", publicGiveawayRoutes);

// Public Order routes (no authentication required, Stripe payment)
app.use("/api/orders", publicOrderRoutes);

// Public Lead/Contact routes (no authentication required, lead submission)
app.use("/api/leads", publicLeadRoutes);

// Public Service routes (no authentication required, get all services)
app.use("/api/services", publicServiceRoutes);

// Admin Giveaway routes (protected: requires JWT token)
app.use("/api/admin/giveaways", adminGiveawayRoutes);

// Admin Voucher routes (protected: requires JWT token)
app.use("/api/admin/vouchers", adminVoucherRoutes);

// Admin Service routes (protected: requires JWT token)
app.use("/api/admin/services", adminServiceRoutes);

// Admin Lead routes (protected: requires JWT token)
app.use("/api/admin/leads", adminLeadRoutes);

// Admin Coupon routes (protected: requires JWT token)
app.use("/api/admin/coupons", adminCouponRoutes);

// 404 handler - catch all undefined routes
app.use((req, res) => {
  res.status(404).json({
    error: "Not Found",
    message: "The requested resource does not exist",
  });
});

// Global error handler
app.use((err, req, res, next) => {
  console.error("Error:", err);

  res.status(err.status || 500).json({
    error: err.message || "Internal Server Error",
    ...(process.env.NODE_ENV === "development" && { stack: err.stack }),
  });
});

module.exports = app;
