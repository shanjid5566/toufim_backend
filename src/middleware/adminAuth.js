const jwt = require("jsonwebtoken");
const prisma = require("../lib/prisma");

/**
 * Admin JWT authentication middleware
 * Verifies JWT token from Authorization header
 * Bearer token format: Authorization: Bearer <token>
 */
const adminAuthMiddleware = async (req, res, next) => {
  try {
    // Get token from Authorization header
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({
        error: "Unauthorized",
        message: "Missing or invalid Authorization header. Use: Bearer <token>",
      });
    }

    const token = authHeader.substring(7); // Remove "Bearer " prefix

    // Verify JWT token
    const decoded = jwt.verify(token, process.env.JWT_SECRET || "your-secret-key");

    // Verify admin still exists in database
    const admin = await prisma.admin.findUnique({
      where: { id: decoded.id },
    });

    if (!admin) {
      return res.status(401).json({
        error: "Unauthorized",
        message: "Admin not found or has been deleted.",
      });
    }

    // Attach admin to request for use in route handlers
    req.admin = admin;
    next();
  } catch (error) {
    // Handle JWT verification errors
    if (error.name === "TokenExpiredError") {
      return res.status(401).json({
        error: "Unauthorized",
        message: "Token has expired. Please login again.",
      });
    }

    if (error.name === "JsonWebTokenError") {
      return res.status(401).json({
        error: "Unauthorized",
        message: "Invalid token.",
      });
    }

    console.error("Admin auth middleware error:", error);
    res.status(500).json({
      error: "Internal Server Error",
      message: "Error during admin authentication.",
    });
  }
};

module.exports = adminAuthMiddleware;
