/**
 * Claims import utilities
 */

import { parseDOCXClaims, parsePDFClaims, parseCSVClaims } from './documentParsers';
import { mapCategory } from './categoryMapper';

/**
 * Create a claims import handler function
 * @param {Function} setClaims - State setter for claims
 * @param {Function} onError - Error callback function
 * @param {Function} onCreateCategory - Optional callback to create new categories
 * @param {Function} setCategories - Optional callback to replace all categories (used for CSV import)
 * @returns {Function} Claims import handler
 */
export const createClaimsImportHandler = (setClaims, onError, onCreateCategory, setCategories) => {
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
        // Map categories only for DOCX/DOC (where we extract from unstructured text)
        parsedClaims = parsedClaims.map(claim => ({
          ...claim,
          category: mapCategory(claim.category) || 'Uncategorized'
        }));
        // Add categories from claims to the category list
        if (onCreateCategory) {
          const newCategories = parsedClaims.map(c => c.category).filter(c => c && c !== 'Uncategorized');
          newCategories.forEach(category => onCreateCategory(category));
        }
      } else if (fileExtension === 'pdf') {
        parsedClaims = await parsePDFClaims(file);
        // Map categories only for PDF (where we extract from unstructured text)
        parsedClaims = parsedClaims.map(claim => ({
          ...claim,
          category: mapCategory(claim.category) || 'Uncategorized'
        }));
        // Add categories from claims to the category list
        if (onCreateCategory) {
          const newCategories = parsedClaims.map(c => c.category).filter(c => c && c !== 'Uncategorized');
          newCategories.forEach(category => onCreateCategory(category));
        }
      } else if (fileExtension === 'csv') {
        // CSV: preserve exact category names as provided
        parsedClaims = await parseCSVClaims(file);
        
        // For CSV imports, REPLACE the entire category list with CSV categories
        // This ensures the transaction dropdown shows only the imported categories
        if (setCategories) {
          const csvCategories = parsedClaims
            .map(c => c.category)
            .filter(c => c && c !== 'Uncategorized');
          // Get unique categories and add Uncategorized at the end
          const uniqueCategories = [...new Set(csvCategories)];
          uniqueCategories.push('Uncategorized');
          setCategories(uniqueCategories);
        }
      } else {
        throw new Error('Unsupported file type. Please use CSV, DOCX, or PDF.');
      }

      // Add to claims state
      if (setClaims) {
        setClaims(prev => {
          const existingIds = new Set(prev.map(c => c.id));
          const uniqueClaims = parsedClaims.filter(c => !existingIds.has(c.id));
          return [...prev, ...uniqueClaims];
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

