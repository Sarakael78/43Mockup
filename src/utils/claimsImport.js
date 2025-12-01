/**
 * Claims import utilities
 */

import { parseDOCXClaims, parsePDFClaims } from './documentParsers';
import { mapCategory } from './categoryMapper';

/**
 * Create a claims import handler function
 * @param {Function} setClaims - State setter for claims
 * @param {Function} onError - Error callback function
 * @returns {Function} Claims import handler
 */
export const createClaimsImportHandler = (setClaims, onError) => {
  return async (file) => {
    try {
      if (!file || !file.name) {
        throw new Error('File name is missing');
      }

      if (onError) {
        onError({ message: `Parsing ${file.name}...`, type: 'info' });
      }

      let parsedClaims = [];
      const fileExtension = file.name.split('.').pop()?.toLowerCase();

      if (fileExtension === 'docx' || fileExtension === 'doc') {
        parsedClaims = await parseDOCXClaims(file);
      } else if (fileExtension === 'pdf') {
        parsedClaims = await parsePDFClaims(file);
      } else {
        throw new Error('Unsupported file type. Please use DOCX or PDF.');
      }

      // Map categories
      parsedClaims = parsedClaims.map(claim => ({
        ...claim,
        category: mapCategory(claim.category) || 'Uncategorized'
      }));

      // Add to claims state
      if (setClaims) {
        setClaims(prev => {
          // Check for duplicates and merge or add
          const existingCategories = new Set(prev.map(c => c.category.toLowerCase()));
          const newClaims = parsedClaims.filter(c => !existingCategories.has(c.category.toLowerCase()));
          return [...prev, ...newClaims];
        });
      }

      if (onError) {
        onError({ 
          message: `Imported ${parsedClaims.length} claim(s) from ${file.name}`, 
          type: 'success' 
        });
      }
    } catch (error) {
      if (onError) {
        onError({ 
          message: `Error importing ${file.name}: ${error.message}`, 
          type: 'error' 
        });
      }
    }
  };
};

