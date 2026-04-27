const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const { PrismaClient } = require("../generated/prisma");
const prisma = new PrismaClient();

/**
 * Admin registration (optional - create new admin)
 * POST /api/admin/auth/register
 * Note: In production, this should be protected or disabled
 */
const register = async (req, res) => {
  try {
    const { email, password, name } = req.body;

    // Validation
    if (!email || !password || !name) {
      return res.status(400).json({
        error: "Validation Error",
        message: "Missing required fields: email, password, name",
      });
    }

    if (password.length < 6) {
      return res.status(400).json({
        error: "Validation Error",
        message: "Password must be at least 6 characters long",
      });
    }

    // Check if admin already exists
    const existingAdmin = await prisma.admin.findUnique({
      where: { email },
    });

    if (existingAdmin) {
      return res.status(400).json({
        error: "Conflict",
        message: "Admin with this email already exists",
      });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create admin
    const admin = await prisma.admin.create({
      data: {
        email,
        password: hashedPassword,
        name,
      },
    });

    res.status(201).json({
      message: "Admin registered successfully",
      data: {
        id: admin.id,
        email: admin.email,
        name: admin.name,
      },
    });
  } catch (error) {
    console.error("Error registering admin:", error);
    res.status(500).json({
      error: "Internal Server Error",
      message: error.message,
    });
  }
};

/**
 * Admin login
 * POST /api/admin/auth/login
 * Returns JWT token valid for 24 hours
 */
const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    // Validation
    if (!email || !password) {
      return res.status(400).json({
        error: "Validation Error",
        message: "Missing required fields: email, password",
      });
    }

    // Find admin by email
    const admin = await prisma.admin.findUnique({
      where: { email },
    });

    if (!admin) {
      return res.status(401).json({
        error: "Unauthorized",
        message: "Invalid email or password",
      });
    }

    // Verify password
    const passwordMatch = await bcrypt.compare(password, admin.password);

    if (!passwordMatch) {
      return res.status(401).json({
        error: "Unauthorized",
        message: "Invalid email or password",
      });
    }

    // Generate JWT token
    const token = jwt.sign(
      {
        id: admin.id,
        email: admin.email,
        name: admin.name,
      },
      process.env.JWT_SECRET || "your-secret-key",
      {
        expiresIn: "24h", // Token valid for 24 hours
      }
    );

    res.status(200).json({
      message: "Login successful",
      data: {
        id: admin.id,
        email: admin.email,
        name: admin.name,
      },
      token,
    });
  } catch (error) {
    console.error("Error logging in:", error);
    res.status(500).json({
      error: "Internal Server Error",
      message: error.message,
    });
  }
};

/**
 * Get current admin profile (requires authentication)
 * GET /api/admin/auth/me
 */
const getProfile = async (req, res) => {
  try {
    res.status(200).json({
      message: "Admin profile retrieved successfully",
      data: {
        id: req.admin.id,
        email: req.admin.email,
        name: req.admin.name,
        createdAt: req.admin.createdAt,
      },
    });
  } catch (error) {
    console.error("Error fetching profile:", error);
    res.status(500).json({
      error: "Internal Server Error",
      message: error.message,
    });
  }
};

/**
 * Change admin password
 * PUT /api/admin/auth/change-password
 * Requires authentication
 */
const changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const adminId = req.admin.id;

    // Validation
    if (!currentPassword || !newPassword) {
      return res.status(400).json({
        error: "Validation Error",
        message: "Missing required fields: currentPassword, newPassword",
      });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({
        error: "Validation Error",
        message: "New password must be at least 6 characters long",
      });
    }

    // Get admin from database
    const admin = await prisma.admin.findUnique({
      where: { id: adminId },
    });

    // Verify current password
    const passwordMatch = await bcrypt.compare(currentPassword, admin.password);

    if (!passwordMatch) {
      return res.status(401).json({
        error: "Unauthorized",
        message: "Current password is incorrect",
      });
    }

    // Hash new password
    const hashedPassword = await bcrypt.hash(newPassword, 10);

    // Update password
    const updatedAdmin = await prisma.admin.update({
      where: { id: adminId },
      data: { password: hashedPassword },
    });

    res.status(200).json({
      message: "Password changed successfully",
      data: {
        id: updatedAdmin.id,
        email: updatedAdmin.email,
        name: updatedAdmin.name,
      },
    });
  } catch (error) {
    console.error("Error changing password:", error);
    res.status(500).json({
      error: "Internal Server Error",
      message: error.message,
    });
  }
};

module.exports = {
  register,
  login,
  getProfile,
  changePassword,
};
