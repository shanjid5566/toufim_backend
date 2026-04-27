const prisma = require("../lib/prisma");

/**
 * Generate URL-friendly slug from service name
 * @param {string} name - Service name
 * @returns {string} URL-friendly slug
 */
const generateSlug = (name) => {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, "")
    .replace(/[\s_-]+/g, "-")
    .replace(/^-+|-+$/g, "");
};

/**
 * Create a new service
 * @param {object} serviceData - Service details
 * @param {object} files - Uploaded files {bannerImage, galleryImages}
 * @returns {object} Created service
 */
const createService = async (serviceData, files = {}) => {
  const { name, description, basePrice, category, status } = serviceData;

  // Generate unique slug
  const baseSlug = generateSlug(name);
  let slug = baseSlug;
  let counter = 1;

  // Check for slug uniqueness
  while (await prisma.service.findUnique({ where: { slug } })) {
    slug = `${baseSlug}-${counter}`;
    counter++;
  }

  // Process uploaded images
  const bannerImage = files.bannerImage ? `/uploads/${files.bannerImage.filename}` : null;
  const galleryImages = files.galleryImages
    ? files.galleryImages.map((file) => `/uploads/${file.filename}`)
    : [];

  const service = await prisma.service.create({
    data: {
      name,
      slug,
      description,
      basePrice: parseFloat(basePrice),
      category,
      bannerImage,
      galleryImages,
      status: status || "LIVE",
    },
  });

  return service;
};

/**
 * Get all services with pagination and optional filters
 * @param {number} page - Page number
 * @param {number} limit - Items per page
 * @param {string} category - Optional category filter
 * @param {string} status - Optional status filter
 * @returns {object} Services and pagination info
 */
const getAllServices = async (page = 1, limit = 10, category, status) => {
  const skip = (page - 1) * limit;
  const where = {};

  if (category) where.category = category;
  if (status) where.status = status;

  const [services, total] = await Promise.all([
    prisma.service.findMany({
      where,
      skip,
      take: parseInt(limit),
      orderBy: { createdAt: "desc" },
    }),
    prisma.service.count({ where }),
  ]);

  return {
    services,
    pagination: {
      page: parseInt(page),
      limit: parseInt(limit),
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
};

/**
 * Get service by ID
 * @param {string} serviceId - Service ID
 * @returns {object} Service details
 */
const getServiceById = async (serviceId) => {
  const service = await prisma.service.findUnique({
    where: { id: serviceId },
  });

  if (!service) {
    throw new Error("Service not found");
  }

  return service;
};

/**
 * Get service by slug (for public access)
 * @param {string} slug - Service slug
 * @returns {object} Service details
 */
const getServiceBySlug = async (slug) => {
  const service = await prisma.service.findUnique({
    where: { slug },
  });

  if (!service) {
    throw new Error("Service not found");
  }

  return service;
};

/**
 * Update service
 * @param {string} serviceId - Service ID
 * @param {object} updateData - Fields to update
 * @param {object} files - New uploaded files {bannerImage, galleryImages}
 * @returns {object} Updated service
 */
const updateService = async (serviceId, updateData, files = {}) => {
  // Check if service exists
  const existingService = await prisma.service.findUnique({
    where: { id: serviceId },
  });

  if (!existingService) {
    throw new Error("Service not found");
  }

  const data = {};

  // Update name and regenerate slug if name changed
  if (updateData.name && updateData.name !== existingService.name) {
    data.name = updateData.name;

    const baseSlug = generateSlug(updateData.name);
    let newSlug = baseSlug;
    let counter = 1;

    // Check for slug uniqueness (excluding current service)
    while (
      await prisma.service.findFirst({
        where: {
          slug: newSlug,
          id: { not: serviceId },
        },
      })
    ) {
      newSlug = `${baseSlug}-${counter}`;
      counter++;
    }

    data.slug = newSlug;
  }

  // Update other fields
  if (updateData.description !== undefined) data.description = updateData.description;
  if (updateData.basePrice !== undefined) data.basePrice = parseFloat(updateData.basePrice);
  if (updateData.category !== undefined) data.category = updateData.category;
  if (updateData.status !== undefined) data.status = updateData.status;

  // Handle banner image update
  if (files.bannerImage) {
    data.bannerImage = `/uploads/${files.bannerImage.filename}`;
  }

  // Handle gallery images update
  if (files.galleryImages && files.galleryImages.length > 0) {
    const newGalleryImages = files.galleryImages.map((file) => `/uploads/${file.filename}`);

    // Append to existing gallery images or replace
    // For now, we'll append (you can change this logic)
    data.galleryImages = [...existingService.galleryImages, ...newGalleryImages];
  }

  const service = await prisma.service.update({
    where: { id: serviceId },
    data,
  });

  return service;
};

/**
 * Delete service
 * @param {string} serviceId - Service ID
 * @returns {object} Deleted service
 */
const deleteService = async (serviceId) => {
  const service = await prisma.service.delete({
    where: { id: serviceId },
  });

  return service;
};

/**
 * Remove specific gallery images from a service
 * @param {string} serviceId - Service ID
 * @param {string[]} imageUrls - Array of image URLs to remove
 * @returns {object} Updated service
 */
const removeGalleryImages = async (serviceId, imageUrls) => {
  const service = await prisma.service.findUnique({
    where: { id: serviceId },
  });

  if (!service) {
    throw new Error("Service not found");
  }

  const updatedGalleryImages = service.galleryImages.filter(
    (img) => !imageUrls.includes(img)
  );

  const updatedService = await prisma.service.update({
    where: { id: serviceId },
    data: {
      galleryImages: updatedGalleryImages,
    },
  });

  return updatedService;
};

module.exports = {
  createService,
  getAllServices,
  getServiceById,
  getServiceBySlug,
  updateService,
  deleteService,
  removeGalleryImages,
};
