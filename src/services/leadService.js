const prisma = require("../lib/prisma");
const { dutchToEnum, enumToDutch, statusDutchToEnum, statusEnumToDutch } = require("../utils/serviceCategoryMapping");

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
    status: statusEnumToDutch(lead.status) || lead.status,
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
    status: statusEnumToDutch(lead.status) || lead.status,
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
    status: statusEnumToDutch(lead.status) || lead.status,
  };
};

/**
 * Update lead status (Admin only)
 * @param {string} leadId - Lead ID
 * @param {string} status - New status (can be Dutch or English)
 * @returns {Promise<Object>} Updated lead with Dutch serviceType and status
 */
const updateLeadStatus = async (leadId, status) => {
  const validStatuses = ["PENDING", "CONTACTED", "COMPLETED", "QUOTED", "CLOSED"];

  // Try to convert Dutch status to English, if already English keep it
  const englishStatus = statusDutchToEnum(status) || status;

  if (!validStatuses.includes(englishStatus)) {
    throw new Error(`Ongeldige status: ${status}`);
  }

  const lead = await prisma.lead.update({
    where: { id: leadId },
    data: { status: englishStatus },
  });

  // Convert service type and status to Dutch
  return {
    ...lead,
    serviceType: enumToDutch(lead.serviceType) || lead.serviceType,
    status: statusEnumToDutch(lead.status) || lead.status,
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
 * Map Dutch and English column headers to standard field names
 * @param {Object} row - Raw row from CSV/XLSX with any headers
 * @returns {Object} Row with standardized English field names
 */
const mapColumnHeaders = (row) => {
  // Column header mapping (case-insensitive)
  const headerMap = {
    // Full Name
    "volledige naam": "fullName",
    "full name": "fullName",
    "fullname": "fullName",
    "name": "fullName",
    "naam": "fullName",
    
    // Email
    "e-mailadres": "email",
    "email": "email",
    "e-mail": "email",
    "emailadres": "email",
    
    // Phone
    "telefoonnummer": "phone",
    "phone": "phone",
    "telefoon": "phone",
    "phone number": "phone",
    
    // Service Type
    "diensttype": "serviceType",
    "service type": "serviceType",
    "servicetype": "serviceType",
    "type": "serviceType",
    
    // Address
    "adres": "address",
    "address": "address",
    
    // Project Details
    "projectdetails": "projectDetails",
    "project details": "projectDetails",
    "details": "projectDetails",
    "beschrijving": "projectDetails",
    "description": "projectDetails",
    
    // Date Received
    "datum ontvangen": "dateReceived",
    "date received": "dateReceived",
    "datereceived": "dateReceived",
    "datum": "dateReceived",
    "date": "dateReceived",
    
    // Status
    "status": "status",
    
    // Aangemaakt op (Created At)
    "aangemaakt op": "createdAt",
    "created at": "createdAt",
    "aangemaakt": "createdAt",
    "created": "createdAt",
  };

  const mapped = {};
  const ignoredColumns = ["#", "pk", "_1", "__rownum__"]; // Columns to ignore

  for (const [key, value] of Object.entries(row)) {
    // Normalize key: lowercase and trim
    const normalizedKey = key.toLowerCase().trim();
    
    // Skip ignored columns (like row numbers, IDs, etc.)
    if (ignoredColumns.includes(normalizedKey)) {
      continue;
    }
    
    // Map to standard field name or keep original
    const mappedKey = headerMap[normalizedKey] || key;
    
    mapped[mappedKey] = value;
  }
  
  // Log for debugging (first row only)
  if (Object.keys(row).length > 0 && !mapped.__logged) {
    console.log("📋 CSV Column Mapping Debug:");
    console.log("Original columns:", Object.keys(row));
    console.log("Mapped columns:", Object.keys(mapped));
    mapped.__logged = true; // Prevent logging every row
  }

  return mapped;
};

/**
 * Normalize XLSX data to handle Excel-specific formats
 * @param {Object} row - Raw row from XLSX/CSV
 * @returns {Object} Normalized row with strings and mapped headers
 */
const normalizeRow = (row) => {
  // First map column headers to standard names
  const mappedRow = mapColumnHeaders(row);
  
  const normalized = {};

  for (const [key, value] of Object.entries(mappedRow)) {
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

    // Handle date strings in DD-MM-YYYY format (common in Dutch locale)
    if (key === "dateReceived" && typeof value === "string" && value.match(/^\d{1,2}-\d{1,2}-\d{4}/)) {
      const parts = value.split(/[\s,]+/)[0].split('-'); // Split by dash and take first part (date only)
      if (parts.length === 3) {
        const day = parts[0].padStart(2, '0');
        const month = parts[1].padStart(2, '0');
        const year = parts[2];
        normalized[key] = `${year}-${month}-${day}`;
        continue;
      }
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

    // Handle strings - clean up phone numbers with Excel quotes
    if (typeof value === "string") {
      let cleanedValue = value;
      
      // If it's a phone field and starts with a quote (Excel text prefix), remove it
      if (key === "phone" && cleanedValue.startsWith("'")) {
        cleanedValue = cleanedValue.substring(1);
      }
      
      // If phone doesn't start with +, add it (for numbers starting with country code)
      if (key === "phone" && cleanedValue && !cleanedValue.startsWith("+") && cleanedValue.match(/^\d{10,}/)) {
        cleanedValue = `+${cleanedValue}`;
      }
      
      normalized[key] = cleanedValue;
      continue;
    }

    // Keep other values as-is
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
        // Add debugging info about what fields are present
        const presentFields = Object.keys(row).filter(k => row[k]);
        const missingFields = [];
        if (!fullName) missingFields.push('fullName');
        if (!email) missingFields.push('email');
        if (!phone) missingFields.push('phone');
        if (!serviceType) missingFields.push('serviceType');
        if (!address) missingFields.push('address');
        
        throw new Error(
          `Missing required fields. Required: Full Name, Email, Phone, Service Type, Address. Missing: ${missingFields.join(', ')}. Present fields: ${presentFields.join(', ')}`
        );
      }

      // Convert service type to English enum (accept both English enum and Dutch names)
      const trimmedServiceType = serviceType.trim();
      const validEnums = ["PLUMBING_SERVICES", "ROOFING_SERVICES", "PLASTERING_SERVICE", "ELECTRICAL_SERVICES", "TILING_SERVICES", "COMPLETE_FLOORING_SOLUTIONS", "CLEANING_SERVICES", "OVERALL_SERVICE"];
      
      let englishServiceType;
      
      // Check if it's already a valid English enum
      if (validEnums.includes(trimmedServiceType)) {
        englishServiceType = trimmedServiceType;
      } else {
        // Try to convert from Dutch
        englishServiceType = dutchToEnum(trimmedServiceType);
      }

      if (!englishServiceType) {
        throw new Error(
          `Invalid service type: "${serviceType}". Must be one of:\nEnglish: ${validEnums.join(", ")}\nDutch: Loodgietersdiensten, Dakdekkersdiensten, Stukadoorsdienst, Elektrische diensten, Tegelservices, Complete vloeroplossingen op één plek, Schoonmaakdiensten, Algemene service`
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
        const trimmedStatus = row.status.trim();
        
        // Try to convert Dutch status to English, if already English keep it
        const englishStatus = statusDutchToEnum(trimmedStatus) || trimmedStatus.toUpperCase();
        
        if (!validStatuses.includes(englishStatus)) {
          throw new Error(
            `Invalid status: "${row.status}". Must be one of: PENDING, CONTACTED, QUOTED, COMPLETED, CLOSED (or Dutch: In afwachting, Gecontacteerd, Geoffreerd, Voltooid, Gesloten)`
          );
        }
        
        status = englishStatus;
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
