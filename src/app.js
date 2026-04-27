const express = require("express");
const path = require("path");

// Import routes
const adminAuthRoutes = require("./routes/adminAuthRoutes");
const adminGiveawayRoutes = require("./routes/adminGiveawayRoutes");
const adminVoucherRoutes = require("./routes/adminVoucherRoutes");
const publicVoucherRoutes = require("./routes/publicVoucherRoutes");

// Initialize Express app
const app = express();

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

// Public Voucher routes (no authentication required)
app.use("/api/vouchers", publicVoucherRoutes);

// Admin Giveaway routes (protected: requires JWT token)
app.use("/api/admin/giveaways", adminGiveawayRoutes);

// Admin Voucher routes (protected: requires JWT token)
app.use("/api/admin/vouchers", adminVoucherRoutes);

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
