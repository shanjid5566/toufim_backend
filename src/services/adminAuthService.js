const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const { PrismaClient } = require("../generated/prisma");
const prisma = new PrismaClient();

/**
 * Register a new admin
 * @param {string} email - Admin email
 * @param {string} password - Admin password (min 6 chars)
 * @param {string} name - Admin name
 * @returns {Object} - Created admin object (without password)
 * @throws {Error} - If validation fails or admin already exists
 */
const registerAdmin = async (email, password, name) => {
  // Validation
  if (!email || !password || !name) {
    throw new Error("Missing required fields: email, password, name");
  }

  if (password.length < 6) {
    throw new Error("Password must be at least 6 characters long");
  }

  // Check if admin already exists
  const existingAdmin = await prisma.admin.findUnique({
    where: { email },
  });

  if (existingAdmin) {
    throw new Error("Admin with this email already exists");
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

  // Return without password
  return {
    id: admin.id,
    email: admin.email,
    name: admin.name,
  };
};

/**
 * Login admin with email and password
 * @param {string} email - Admin email
 * @param {string} password - Admin password
 * @returns {Object} - Admin data and JWT token
 * @throws {Error} - If credentials are invalid
 */
const loginAdmin = async (email, password) => {
  // Validation
  if (!email || !password) {
    throw new Error("Missing required fields: email, password");
  }

  // Find admin by email
  const admin = await prisma.admin.findUnique({
    where: { email },
  });

  if (!admin) {
    throw new Error("Invalid email or password");
  }

  // Verify password
  const passwordMatch = await bcrypt.compare(password, admin.password);

  if (!passwordMatch) {
    throw new Error("Invalid email or password");
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

  return {
    admin: {
      id: admin.id,
      email: admin.email,
      name: admin.name,
    },
    token,
  };
};

/**
 * Change admin password
 * @param {string} adminId - Admin ID
 * @param {string} currentPassword - Current password
 * @param {string} newPassword - New password (min 6 chars)
 * @returns {Object} - Updated admin object (without password)
 * @throws {Error} - If validation fails or current password is incorrect
 */
const changeAdminPassword = async (adminId, currentPassword, newPassword) => {
  // Validation
  if (!currentPassword || !newPassword) {
    throw new Error("Missing required fields: currentPassword, newPassword");
  }

  if (newPassword.length < 6) {
    throw new Error("New password must be at least 6 characters long");
  }

  // Get admin from database
  const admin = await prisma.admin.findUnique({
    where: { id: adminId },
  });

  if (!admin) {
    throw new Error("Admin not found");
  }

  // Verify current password
  const passwordMatch = await bcrypt.compare(currentPassword, admin.password);

  if (!passwordMatch) {
    throw new Error("Current password is incorrect");
  }

  // Hash new password
  const hashedPassword = await bcrypt.hash(newPassword, 10);

  // Update password
  const updatedAdmin = await prisma.admin.update({
    where: { id: adminId },
    data: { password: hashedPassword },
  });

  // Return without password
  return {
    id: updatedAdmin.id,
    email: updatedAdmin.email,
    name: updatedAdmin.name,
  };
};

module.exports = {
  registerAdmin,
  loginAdmin,
  changeAdminPassword,
};
