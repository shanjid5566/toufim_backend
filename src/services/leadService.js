const prisma = require("../lib/prisma");
const { dutchToEnum, enumToDutch } = require("../utils/serviceCategoryMapping");

/**
 * Create a new lead from contact form
 * @param {Object} leadData - Lead data with Dutch serviceType
 * @param {string[]} referenceImages - Array of uploaded image paths
 * @returns {Promise<Object>} Created lead with Dutch serviceType
 */
const createLead = async (leadData, referenceImages = []) => {
  const { fullName, email, phone, serviceType, address, projectDetails } = leadData;

  // Validate required fields
  if (!fullName || !email || !phone || !serviceType || !address) {
    throw new Error("Volledige naam, e-mailadres, telefoonnummer, type dienst en projectadres zijn verplicht");
  }

  // Convert Dutch service type to English enum
  const englishServiceType = dutchToEnum(serviceType);

  if (!englishServiceType) {
    throw new Error(`Ongeldige diensttype: ${serviceType}`);
  }

  // Create lead in database with English service type
  const lead = await prisma.lead.create({
    data: {
      fullName,
      email,
      phone,
      serviceType: englishServiceType,
      address,
      projectDetails: projectDetails || "",
      referenceImages,
      status: "PENDING",
    },
  });

  // Return lead with Dutch service type for frontend
  return {
    ...lead,
    serviceType: enumToDutch(lead.serviceType) || lead.serviceType,
  };
};

/**
 * Get all leads (Admin only)
 * @param {Object} filters - Optional filters (status, etc.)
 * @returns {Promise<Object[]>} Array of leads with Dutch serviceType
 */
const getAllLeads = async (filters = {}) => {
  const { status } = filters;

  const leads = await prisma.lead.findMany({
    where: {
      ...(status && { status }),
    },
    orderBy: {
      createdAt: "desc",
    },
  });

  // Convert service types to Dutch
  return leads.map((lead) => ({
    ...lead,
    serviceType: enumToDutch(lead.serviceType) || lead.serviceType,
  }));
};

/**
 * Get lead by ID (Admin only)
 * @param {string} leadId - Lead ID
 * @returns {Promise<Object>} Lead with Dutch serviceType
 */
const getLeadById = async (leadId) => {
  const lead = await prisma.lead.findUnique({
    where: { id: leadId },
  });

  if (!lead) {
    throw new Error("Lead niet gevonden");
  }

  // Convert service type to Dutch
  return {
    ...lead,
    serviceType: enumToDutch(lead.serviceType) || lead.serviceType,
  };
};

/**
 * Update lead status (Admin only)
 * @param {string} leadId - Lead ID
 * @param {string} status - New status (PENDING/CONTACTED/COMPLETED/QUOTED/CLOSED)
 * @returns {Promise<Object>} Updated lead with Dutch serviceType
 */
const updateLeadStatus = async (leadId, status) => {
  const validStatuses = ["PENDING", "CONTACTED", "COMPLETED", "QUOTED", "CLOSED"];

  if (!validStatuses.includes(status)) {
    throw new Error(`Ongeldige status: ${status}`);
  }

  const lead = await prisma.lead.update({
    where: { id: leadId },
    data: { status },
  });

  // Convert service type to Dutch
  return {
    ...lead,
    serviceType: enumToDutch(lead.serviceType) || lead.serviceType,
  };
};

/**
 * Delete lead (Admin only)
 * @param {string} leadId - Lead ID
 * @returns {Promise<void>}
 */
const deleteLead = async (leadId) => {
  await prisma.lead.delete({
    where: { id: leadId },
  });
};

/**
 * Normalize XLSX data to handle Excel-specific formats
 * @param {Object} row - Raw row from XLSX/CSV
 * @returns {Object} Normalized row with strings
 */
const normalizeRow = (row) => {
  const normalized = {};

  for (const [key, value] of Object.entries(row)) {
    // Handle null/undefined
    if (value == null) {
      normalized[key] = "";
      continue;
    }

    // Handle Excel date serial numbers (e.g., 46132 = April 20, 2026)
    if (key === "dateReceived" && typeof value === "number") {
      // Excel date: days since 1900-01-01 (with 1900 leap year bug)
      const excelEpoch = new Date(1899, 11, 30); // Dec 30, 1899
      const date = new Date(excelEpoch.getTime() + value * 24 * 60 * 60 * 1000);
      
      // Format as YYYY-MM-DD
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      normalized[key] = `${year}-${month}-${day}`;
      continue;
    }

    // Convert numbers to strings (phone, etc.)
    if (typeof value === "number") {
      // Check if phone number (starts with country code)
      if (key === "phone" && value > 1000000) {
        normalized[key] = `+${value}`;
      } else {
        normalized[key] = String(value);
      }
      continue;
    }

    // Keep strings as-is
    normalized[key] = value;
  }

  return normalized;
};

/**
 * Bulk create leads from CSV/XLSX data
 * @param {Array} csvData - Array of lead data from CSV/XLSX
 * @returns {Promise<Object>} Results with success and error counts
 */
const bulkCreateLeads = async (csvData) => {
  const results = {
    successful: [],
    failed: [],
    totalProcessed: csvData.length,
  };

  for (let i = 0; i < csvData.length; i++) {
    const rawRow = csvData[i];
    const rowNumber = i + 2; // +2 because: index starts at 0, and row 1 is header

    try {
      // Normalize row data (handle XLSX number formats)
      const row = normalizeRow(rawRow);

      // Validate required fields
      const { fullName, email, phone, serviceType, address } = row;

      if (!fullName || !email || !phone || !serviceType || !address) {
        throw new Error(
          `Missing required fields. Required: Full Name, Email, Phone, Service Type, Address`
        );
      }

      // Convert Dutch service type to English enum
      const englishServiceType = dutchToEnum(serviceType.trim());

      if (!englishServiceType) {
        throw new Error(
          `Invalid service type: "${serviceType}". Must be one of: Loodgietersdiensten, Dakdekkersdiensten, Stukadoorsdienst, Elektrische diensten, Tegelservices, Complete vloeroplossingen op één plek, Schoonmaakdiensten, Algemene service`
        );
      }

      // Parse dateReceived if provided (optional)
      let createdAt = new Date(); // Default to current date
      if (row.dateReceived && row.dateReceived.trim()) {
        const parsedDate = new Date(row.dateReceived.trim());
        
        // Check if valid date
        if (!isNaN(parsedDate.getTime())) {
          createdAt = parsedDate;
        }
        // If invalid date, throw error so admin knows
        else {
          throw new Error(
            `Invalid date format: "${row.dateReceived}". Use format: YYYY-MM-DD (e.g., 2026-04-20)`
          );
        }
      }

      // Parse and validate status if provided (optional)
      let status = "PENDING"; // Default status
      const validStatuses = ["PENDING", "CONTACTED", "QUOTED", "COMPLETED", "CLOSED"];
      
      if (row.status && row.status.trim()) {
        const upperStatus = row.status.trim().toUpperCase();
        
        if (!validStatuses.includes(upperStatus)) {
          throw new Error(
            `Invalid status: "${row.status}". Must be one of: PENDING, CONTACTED, QUOTED, COMPLETED, CLOSED`
          );
        }
        
        status = upperStatus;
      }

      // Create lead
      const lead = await prisma.lead.create({
        data: {
          fullName: fullName.trim(),
          email: email.trim(),
          phone: phone.trim(),
          serviceType: englishServiceType,
          address: address.trim(),
          projectDetails: row.projectDetails?.trim() || "",
          referenceImages: [],
          status: status,  // ← Custom status or PENDING
          createdAt: createdAt,  // ← Custom date or current date
        },
      });

      results.successful.push({
        row: rowNumber,
        leadId: lead.id,
        fullName: lead.fullName,
        email: lead.email,
      });
    } catch (error) {
      results.failed.push({
        row: rowNumber,
        data: rawRow,  // Show original data for debugging
        error: error.message,
      });
    }
  }

  return results;
};

module.exports = {
  createLead,
  getAllLeads,
  getLeadById,
  updateLeadStatus,
  deleteLead,
  bulkCreateLeads,
};
