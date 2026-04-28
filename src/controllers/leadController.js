const leadService = require("../services/leadService");

/**
 * Convert relative image URLs to absolute URLs
 * @param {Object} lead - Lead object
 * @param {Object} req - Express request object
 * @returns {Object} Lead with absolute image URLs
 */
const convertImagesToAbsoluteUrls = (lead, req) => {
  if (!lead) return lead;
  
  const baseUrl = `${req.protocol}://${req.get("host")}`;
  
  return {
    ...lead,
    referenceImages: lead.referenceImages?.map(img => {
      // If already absolute URL, return as is
      if (img.startsWith("http://") || img.startsWith("https://")) {
        return img;
      }
      // Convert relative to absolute
      return `${baseUrl}${img}`;
    }) || []
  };
};

/**
 * PUBLIC: Submit contact form (lead)
 * POST /api/leads
 */
const submitContactForm = async (req, res) => {
  try {
    const { fullName, email, phone, serviceType, address, projectDetails } = req.body;

    // Get uploaded file paths with full URLs
    const baseUrl = `${req.protocol}://${req.get("host")}`;
    const referenceImages = req.files?.map((file) => `${baseUrl}/uploads/${file.filename}`) || [];

    const lead = await leadService.createLead(
      {
        fullName,
        email,
        phone,
        serviceType,
        address,
        projectDetails,
      },
      referenceImages
    );

    res.status(201).json({
      success: true,
      message: "Uw offerteverzoek is succesvol ingediend. We nemen binnenkort contact met u op!",
      data: lead,
    });
  } catch (error) {
    console.error("Error submitting contact form:", error);

    // User-friendly error messages
    if (error.message.includes("verplicht") || error.message.includes("Ongeldige")) {
      return res.status(400).json({
        success: false,
        error: error.message,
      });
    }

    res.status(500).json({
      success: false,
      error: "Er is een fout opgetreden bij het verwerken van uw aanvraag",
    });
  }
};

/**
 * ADMIN: Get all leads
 * GET /api/admin/leads
 */
const getAllLeads = async (req, res) => {
  try {
    const { status } = req.query;

    const leads = await leadService.getAllLeads({ status });

    // Convert relative image URLs to absolute URLs
    const leadsWithAbsoluteUrls = leads.map(lead => convertImagesToAbsoluteUrls(lead, req));

    res.status(200).json({
      success: true,
      data: leadsWithAbsoluteUrls,
    });
  } catch (error) {
    console.error("Error fetching leads:", error);
    res.status(500).json({
      success: false,
      error: "Failed to fetch leads",
    });
  }
};

/**
 * ADMIN: Get lead by ID
 * GET /api/admin/leads/:id
 */
const getLeadById = async (req, res) => {
  try {
    const { id } = req.params;

    const lead = await leadService.getLeadById(id);

    // Convert relative image URLs to absolute URLs
    const leadWithAbsoluteUrls = convertImagesToAbsoluteUrls(lead, req);

    res.status(200).json({
      success: true,
      data: leadWithAbsoluteUrls,
    });
  } catch (error) {
    console.error("Error fetching lead:", error);

    if (error.message.includes("niet gevonden")) {
      return res.status(404).json({
        success: false,
        error: "Lead not found",
      });
    }

    res.status(500).json({
      success: false,
      error: "Failed to fetch lead",
    });
  }
};

/**
 * ADMIN: Update lead status
 * PATCH /api/admin/leads/:id/status
 */
const updateLeadStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!status) {
      return res.status(400).json({
        success: false,
        error: "Status is required",
      });
    }

    const lead = await leadService.updateLeadStatus(id, status);

    // Convert relative image URLs to absolute URLs
    const leadWithAbsoluteUrls = convertImagesToAbsoluteUrls(lead, req);

    res.status(200).json({
      success: true,
      message: "Lead status updated successfully",
      data: leadWithAbsoluteUrls,
    });
  } catch (error) {
    console.error("Error updating lead status:", error);

    if (error.message.includes("Ongeldige status")) {
      return res.status(400).json({
        success: false,
        error: error.message,
      });
    }

    res.status(500).json({
      success: false,
      error: "Failed to update lead status",
    });
  }
};

/**
 * ADMIN: Delete lead
 * DELETE /api/admin/leads/:id
 */
const deleteLead = async (req, res) => {
  try {
    const { id } = req.params;

    await leadService.deleteLead(id);

    res.status(200).json({
      success: true,
      message: "Lead deleted successfully",
    });
  } catch (error) {
    console.error("Error deleting lead:", error);
    res.status(500).json({
      success: false,
      error: "Failed to delete lead",
    });
  }
};

module.exports = {
  submitContactForm,
  getAllLeads,
  getLeadById,
  updateLeadStatus,
  deleteLead,
};
