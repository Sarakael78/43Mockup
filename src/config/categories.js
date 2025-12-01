/**
 * Categories configuration
 * Loads default categories from JSON config file
 */
import categoriesConfig from './categories.json';

export const defaultCategories = categoriesConfig.defaultCategories;

/**
 * Get default categories array
 * @returns {string[]} Array of category names
 */
export const getDefaultCategories = () => {
  return [...defaultCategories];
};

