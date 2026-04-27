/**
 * Service Category Translation Mapping
 * Maps between English enum values (database) and Dutch display names (frontend)
 */

const CATEGORY_TRANSLATIONS = {
  // English enum -> Dutch display name
  PLUMBING_SERVICES: "Loodgietersdiensten",
  ROOFING_SERVICES: "Dakdekkersdiensten",
  PLASTERING_SERVICE: "Stukadoorsdienst",
  ELECTRICAL_SERVICES: "Elektrische diensten",
  TILING_SERVICES: "Tegelservices",
  COMPLETE_FLOORING_SOLUTIONS: "Complete vloeroplossingen op één plek",
  CLEANING_SERVICES: "Schoonmaakdiensten",
  OVERALL_SERVICE: "Algemene service",
};

// Reverse mapping: Dutch display name -> English enum
const DUTCH_TO_ENUM = Object.entries(CATEGORY_TRANSLATIONS).reduce((acc, [key, value]) => {
  acc[value] = key;
  return acc;
}, {});

/**
 * Convert Dutch category name to English enum value
 * @param {string} dutchName - Dutch category name
 * @returns {string|null} English enum value or null if not found
 */
const dutchToEnum = (dutchName) => {
  return DUTCH_TO_ENUM[dutchName] || null;
};

/**
 * Convert English enum value to Dutch display name
 * @param {string} enumValue - English enum value
 * @returns {string|null} Dutch display name or null if not found
 */
const enumToDutch = (enumValue) => {
  return CATEGORY_TRANSLATIONS[enumValue] || null;
};

/**
 * Get all valid Dutch category names
 * @returns {string[]} Array of Dutch category names
 */
const getAllDutchCategories = () => {
  return Object.values(CATEGORY_TRANSLATIONS);
};

/**
 * Get all valid English enum values
 * @returns {string[]} Array of English enum values
 */
const getAllEnumCategories = () => {
  return Object.keys(CATEGORY_TRANSLATIONS);
};

/**
 * Check if Dutch category name is valid
 * @param {string} dutchName - Dutch category name
 * @returns {boolean} True if valid
 */
const isValidDutchCategory = (dutchName) => {
  return DUTCH_TO_ENUM.hasOwnProperty(dutchName);
};

/**
 * Transform service object: Convert category enum to Dutch
 * @param {object} service - Service object with category enum
 * @returns {object} Service object with Dutch category name
 */
const serviceWithDutchCategory = (service) => {
  if (!service) return service;

  return {
    ...service,
    category: enumToDutch(service.category) || service.category,
  };
};

/**
 * Transform multiple services: Convert category enums to Dutch
 * @param {object[]} services - Array of service objects
 * @returns {object[]} Array of services with Dutch category names
 */
const servicesWithDutchCategories = (services) => {
  if (!Array.isArray(services)) return services;

  return services.map(serviceWithDutchCategory);
};

module.exports = {
  dutchToEnum,
  enumToDutch,
  getAllDutchCategories,
  getAllEnumCategories,
  isValidDutchCategory,
  serviceWithDutchCategory,
  servicesWithDutchCategories,
  CATEGORY_TRANSLATIONS,
  DUTCH_TO_ENUM,
};
