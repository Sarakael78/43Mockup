import * as pdfjsLib from 'pdfjs-dist';
import './pdfConfig'; // Import shared worker configuration

/**
 * Extract text from PDF using pdfjs-dist
 * Preserves line structure by grouping text items by Y position
 * 
 * @param {ArrayBuffer} arrayBuffer - PDF file as ArrayBuffer
 * @returns {Promise<string>} Extracted text with line breaks preserved
 * @throws {Error} If PDF extraction fails
 */
export const extractTextFromPDF = async (arrayBuffer) => {
  try {
    const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
    const pdf = await loadingTask.promise;
    let fullText = '';

    // Extract text from all pages, preserving line structure
    for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
      const page = await pdf.getPage(pageNum);
      const textContent = await page.getTextContent();
      
      // Group text items by their Y position to preserve line structure
      const itemsByLine = {};
      textContent.items.forEach(item => {
        const y = Math.round(item.transform[5]); // Y coordinate
        if (!itemsByLine[y]) {
          itemsByLine[y] = [];
        }
        itemsByLine[y].push(item);
      });
      
      // Sort lines by Y position (top to bottom)
      const sortedLines = Object.keys(itemsByLine)
        .sort((a, b) => parseFloat(b) - parseFloat(a)) // Higher Y = top of page
        .map(y => {
          // Sort items in line by X position (left to right)
          const lineItems = itemsByLine[y].sort((a, b) => a.transform[4] - b.transform[4]);
          return lineItems.map(item => item.str).join(' ');
        });
      
      const pageText = sortedLines.join('\n');
      fullText += pageText + '\n';
    }

    return fullText;
  } catch (error) {
    throw new Error(`Failed to extract text from PDF: ${error.message}`);
  }
};

/**
 * Simple PDF text extraction (for basic use cases)
 * Does not preserve line structure - faster but less accurate
 * 
 * @param {ArrayBuffer} arrayBuffer - PDF file as ArrayBuffer
 * @returns {Promise<string>} Extracted text
 * @throws {Error} If PDF extraction fails
 */
export const extractTextFromPDFSimple = async (arrayBuffer) => {
  try {
    const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
    const pdf = await loadingTask.promise;
    let fullText = '';

    // Extract text from all pages
    for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
      const page = await pdf.getPage(pageNum);
      const textContent = await page.getTextContent();
      const pageText = textContent.items
        .map(item => item.str)
        .join(' ');
      fullText += pageText + '\n';
    }

    return fullText;
  } catch (error) {
    throw new Error(`Failed to extract text from PDF: ${error.message}`);
  }
};

