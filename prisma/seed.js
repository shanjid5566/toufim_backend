require("dotenv").config();

const { PrismaClient } = require("@prisma/client");
const { PrismaPg } = require("@prisma/adapter-pg");
const { Pool } = require("pg");
const bcrypt = require("bcryptjs");

// Create PostgreSQL connection pool
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);

// Initialize Prisma Client with adapter
const prisma = new PrismaClient({
  adapter,
  log: ["error"],
});

async function main() {
  try {
    // Hash password for admin
    const hashedPassword = await bcrypt.hash("admin123", 10);

    // Check if admin already exists
    const existingAdmin = await prisma.admin.findUnique({
      where: { email: "admin@toufim.com" },
    });

    if (existingAdmin) {
      console.log("✓ Admin already exists:", existingAdmin.email);
      return;
    }

    // Create admin
    const admin = await prisma.admin.create({
      data: {
        email: "admin@toufim.com",
        password: hashedPassword,
        name: "Admin User",
      },
    });

    console.log("✓ Admin created successfully");
    console.log("  Email:", admin.email);
    console.log("  Name:", admin.name);
    console.log("  ID:", admin.id);
  } catch (error) {
    console.error("✗ Error seeding database:");
    console.error(error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
    await pool.end();
  }
}

main();

