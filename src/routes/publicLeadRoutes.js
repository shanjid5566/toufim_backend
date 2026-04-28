const express = require("express");
const multer = require("multer");
const path = require("path");
const leadController = require("../controllers/leadController");

const router = express.Router();

// Configure multer for reference image uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, "uploads/");
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, "lead-" + uniqueSuffix + path.extname(file.originalname));
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB per file
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|gif|webp/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);

    if (extname && mimetype) {
      cb(null, true);
    } else {
      cb(new Error("Alleen afbeeldingen zijn toegestaan (JPEG, PNG, GIF, WEBP)"));
    }
  },
});

/**
 * PUBLIC ROUTES
 */

// Submit contact form
router.post("/", upload.array("referenceImages", 5), leadController.submitContactForm);

module.exports = router;
