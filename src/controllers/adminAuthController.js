const adminAuthService = require("../services/adminAuthService");

/**
 * Admin registration (optional - create new admin)
 * POST /api/admin/auth/register
 * Note: In production, this should be protected or disabled
 */
const register = async (req, res) => {
  try {
    const { email, password, name } = req.body;
    const admin = await adminAuthService.registerAdmin(email, password, name);

    res.status(201).json({
      message: "Admin registered successfully",
      data: admin,
    });
  } catch (error) {
    console.error("Error registering admin:", error);
    const statusCode = error.message.includes("already exists") ? 400 : 500;
    res.status(statusCode).json({
      error: statusCode === 400 ? "Validation Error" : "Internal Server Error",
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
    const result = await adminAuthService.loginAdmin(email, password);

    res.status(200).json({
      message: "Login successful",
      data: result.admin,
      token: result.token,
    });
  } catch (error) {
    console.error("Error logging in:", error);
    const statusCode = error.message.includes("Invalid") ? 401 : 500;
    res.status(statusCode).json({
      error: statusCode === 401 ? "Unauthorized" : "Internal Server Error",
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
    const updatedAdmin = await adminAuthService.changeAdminPassword(
      adminId,
      currentPassword,
      newPassword
    );

    res.status(200).json({
      message: "Password changed successfully",
      data: updatedAdmin,
    });
  } catch (error) {
    console.error("Error changing password:", error);
    const statusCode = error.message.includes("Validation") || error.message.includes("incorrect") ? 400 : 500;
    if (error.message.includes("incorrect")) {
      res.status(401).json({
        error: "Unauthorized",
        message: error.message,
      });
    } else {
      res.status(statusCode).json({
        error: statusCode === 400 ? "Validation Error" : "Internal Server Error",
        message: error.message,
      });
    }
  }
};

module.exports = {
  register,
  login,
  getProfile,
  changePassword,
};
