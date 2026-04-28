const express = require("express");
const multer = require("multer");
const path = require("path");
const leadController = require("../controllers/leadController");
const adminAuthMiddleware = require("../middleware/adminAuth");

const router = express.Router();

// Configure multer for CSV upload
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, "uploads/");
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, "leads-csv-" + uniqueSuffix + path.extname(file.originalname));
  },
});

const uploadCSV = multer({
  storage,
  limits: { fileSize: 25 * 1024 * 1024 }, // 25MB max
  fileFilter: (req, file, cb) => {
    const allowedTypes = /csv|xlsx/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = 
      file.mimetype === "text/csv" || 
      file.mimetype === "application/vnd.ms-excel" ||
      file.mimetype === "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

    if (extname && mimetype) {
      cb(null, true);
    } else {
      cb(new Error("Only CSV and XLSX files are allowed"));
    }
  },
});

/**
 * ADMIN ROUTES (Protected)
 */

// Upload leads from CSV
router.post("/upload-csv", adminAuthMiddleware, uploadCSV.single("file"), leadController.uploadLeadsCSV);

// Get all leads (with optional status filter)
router.get("/", adminAuthMiddleware, leadController.getAllLeads);

// Get lead by ID
router.get("/:id", adminAuthMiddleware, leadController.getLeadById);

// Update lead status
router.patch("/:id/status", adminAuthMiddleware, leadController.updateLeadStatus);

// Delete lead
router.delete("/:id", adminAuthMiddleware, leadController.deleteLead);

module.exports = router;
