const dashboardService = require("../services/dashboardService");
const prisma = require("../lib/prisma");
const xlsx = require("xlsx");
const { statusEnumToDutch } = require("../utils/serviceCategoryMapping");

/**
 * ADMIN: Get dashboard data
 * GET /api/admin/dashboard
 */
const getDashboard = async (req, res) => {
  try {
    const dashboardData = await dashboardService.getDashboardData();

    res.status(200).json({
      success: true,
      data: dashboardData,
    });
  } catch (error) {
    console.error("Error fetching dashboard:", error);
    res.status(500).json({
      success: false,
      error: "Failed to fetch dashboard data",
    });
  }
};

/**
 * ADMIN: Get active giveaways only
 * GET /api/admin/dashboard/giveaways/active
 */
const getActiveGiveaways = async (req, res) => {
  try {
    const activeGiveaways = await prisma.giveaway.findMany({
      where: {
        status: "ACTIVE",
      },
      select: {
        id: true,
        title: true,
        description: true,
        totalTickets: true,
        ticketsSold: true,
        drawDate: true,
        bannerImage: true,
        packages: {
          select: {
            id: true,
            title: true,
            couponCount: true,
            price: true,
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    res.status(200).json({
      success: true,
      data: activeGiveaways,
    });
  } catch (error) {
    console.error("Error fetching active giveaways:", error);
    res.status(500).json({
      success: false,
      error: "Failed to fetch active giveaways",
    });
  }
};

/**
 * ADMIN: Export recent leads/quote requests to CSV
 * GET /api/admin/dashboard/leads/export
 */
const exportQuoteRequests = async (req, res) => {
  try {
    // Fetch all leads
    const leads = await prisma.lead.findMany({
      orderBy: {
        createdAt: "desc",
      },
      select: {
        id: true,
        fullName: true,
        email: true,
        phone: true,
        serviceType: true,
        address: true,
        projectDetails: true,
        status: true,
        createdAt: true,
      },
    });

    if (!leads || leads.length === 0) {
      return res.status(404).json({
        success: false,
        error: "No quote requests found to export",
      });
    }

    // Convert to Dutch status and prepare for export
    const exportData = leads.map((lead, index) => ({
      "#": index + 1,
      "Volledige Naam": lead.fullName,
      "E-mailadres": lead.email,
      "Telefoonnummer": lead.phone,
      "Diensttype": lead.serviceType,
      "Adres": lead.address,
      "Projectdetails": lead.projectDetails || "",
      "Datum Ontvangen": new Date(lead.createdAt).toLocaleDateString("nl-NL"),
      "Status": statusEnumToDutch(lead.status) || lead.status,
      "Aangemaakt op": new Date(lead.createdAt).toLocaleString("nl-NL"),
    }));

    // Create workbook and worksheet
    const workbook = xlsx.utils.book_new();
    const worksheet = xlsx.utils.json_to_sheet(exportData);

    // Set column widths for better readability
    worksheet["!cols"] = [
      { wch: 5 },   // #
      { wch: 20 },  // Volledige Naam
      { wch: 25 },  // E-mailadres
      { wch: 15 },  // Telefoonnummer
      { wch: 30 },  // Diensttype
      { wch: 35 },  // Adres
      { wch: 40 },  // Projectdetails
      { wch: 18 },  // Datum Ontvangen
      { wch: 15 },  // Status
      { wch: 20 },  // Aangemaakt op
    ];

    // Add worksheet to workbook
    xlsx.utils.book_append_sheet(workbook, worksheet, "Offerteverzoeken");

    // Generate buffer
    const buffer = xlsx.write(workbook, { type: "buffer", bookType: "xlsx" });

    // Set headers for file download
    const filename = `offerteverzoeken_${new Date().toISOString().split("T")[0]}.xlsx`;
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);

    res.send(buffer);
  } catch (error) {
    console.error("Error exporting quote requests:", error);
    res.status(500).json({
      success: false,
      error: "Failed to export quote requests",
    });
  }
};

module.exports = {
  getDashboard,
  getActiveGiveaways,
  exportQuoteRequests,
};
