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

module.exports = {
  createLead,
  getAllLeads,
  getLeadById,
  updateLeadStatus,
  deleteLead,
};
