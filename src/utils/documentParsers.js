import mammoth from 'mammoth';

// Dynamic import for pdf-parse to handle ESM/CJS differences
const getPdfParse = async () => {
  try {
    const module = await import('pdf-parse');
    return module.default || module;
  } catch (e) {
    return null;
  }
};

const generateId = () => `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

const readFileAsArrayBuffer = (file) => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => resolve(e.target.result);
    reader.onerror = (e) => reject(new Error('Failed to read file'));
    reader.readAsArrayBuffer(file);
  });
};

export const parseDOCXClaims = async (file) => {
  try {
    const arrayBuffer = await readFileAsArrayBuffer(file);
    const result = await mammoth.extractRawText({ arrayBuffer });
    const text = result.value;

    const claims = [];
    
    // Pattern 1: "Category: R amount" or "Category: amount"
    const categoryPattern = /([A-Z][a-zA-Z\s/]+?):\s*R?\s*([\d,]+\.?\d*)/g;
    
    let match;
    while ((match = categoryPattern.exec(text)) !== null) {
      const [, category, amountStr] = match;
      const amount = parseFloat(amountStr.replace(/,/g, '')) || 0;
      
      if (category.trim() && amount > 0) {
        claims.push({
          id: generateId(),
          category: category.trim(),
          claimed: amount,
          desc: ''
        });
      }
    }

    // Pattern 2: Table-like structures - look for lines that might be categories followed by amounts
    const lines = text.split('\n');
    let currentCategory = '';
    
    lines.forEach((line, index) => {
      const trimmed = line.trim();
      
      // Check if line looks like a category header (capitalized, short, no numbers)
      if (/^[A-Z][a-zA-Z\s/]+$/.test(trimmed) && trimmed.length < 40 && !trimmed.match(/\d/)) {
        currentCategory = trimmed;
      }
      
      // Check if line has an amount and we have a category
      const amountMatch = trimmed.match(/R?\s*([\d,]+\.?\d*)/);
      if (amountMatch && currentCategory) {
        const amount = parseFloat(amountMatch[1].replace(/,/g, '')) || 0;
        if (amount > 100) { // Filter out small amounts that might be page numbers, etc.
          // Check if we already have this category
          const existing = claims.find(c => c.category.toLowerCase() === currentCategory.toLowerCase());
          if (!existing) {
            claims.push({
              id: generateId(),
              category: currentCategory,
              claimed: amount,
              desc: ''
            });
          }
        }
      }
      
      // Reset category if we hit what looks like a section break
      if (trimmed.length === 0 || trimmed.match(/^[=\-]{3,}$/)) {
        currentCategory = '';
      }
    });

    // Pattern 3: Look for numbered lists with categories and amounts
    const numberedPattern = /^\d+[\.\)]\s*([A-Z][a-zA-Z\s/]+?)[:;]?\s*R?\s*([\d,]+\.?\d*)/gm;
    let numberedMatch;
    while ((numberedMatch = numberedPattern.exec(text)) !== null) {
      const [, category, amountStr] = numberedMatch;
      const amount = parseFloat(amountStr.replace(/,/g, '')) || 0;
      
      if (category.trim() && amount > 0) {
        const existing = claims.find(c => c.category.toLowerCase() === category.trim().toLowerCase());
        if (!existing) {
          claims.push({
            id: generateId(),
            category: category.trim(),
            claimed: amount,
            desc: ''
          });
        }
      }
    }

    // Remove duplicates based on category name (case-insensitive)
    const uniqueClaims = [];
    const seenCategories = new Set();
    
    claims.forEach(claim => {
      const lowerCategory = claim.category.toLowerCase();
      if (!seenCategories.has(lowerCategory)) {
        seenCategories.add(lowerCategory);
        uniqueClaims.push(claim);
      }
    });

    return uniqueClaims;

  } catch (error) {
    throw new Error(`Failed to parse DOCX: ${error.message}`);
  }
};

export const parsePDFClaims = async (file) => {
  try {
    const pdfParse = await getPdfParse();
    if (!pdfParse) {
      throw new Error('PDF parsing not available');
    }
    const arrayBuffer = await readFileAsArrayBuffer(file);
    const pdfData = await pdfParse(Buffer.from(arrayBuffer));
    const text = pdfData.text;

    const claims = [];
    
    // Similar patterns to DOCX parsing
    const categoryPattern = /([A-Z][a-zA-Z\s/]+?):\s*R?\s*([\d,]+\.?\d*)/g;
    
    let match;
    while ((match = categoryPattern.exec(text)) !== null) {
      const [, category, amountStr] = match;
      const amount = parseFloat(amountStr.replace(/,/g, '')) || 0;
      
      if (category.trim() && amount > 0) {
        claims.push({
          id: generateId(),
          category: category.trim(),
          claimed: amount,
          desc: ''
        });
      }
    }

    // Look for table-like structures
    const lines = text.split('\n');
    let currentCategory = '';
    
    lines.forEach(line => {
      const trimmed = line.trim();
      
      if (/^[A-Z][a-zA-Z\s/]+$/.test(trimmed) && trimmed.length < 40 && !trimmed.match(/\d/)) {
        currentCategory = trimmed;
      }
      
      const amountMatch = trimmed.match(/R?\s*([\d,]+\.?\d*)/);
      if (amountMatch && currentCategory) {
        const amount = parseFloat(amountMatch[1].replace(/,/g, '')) || 0;
        if (amount > 100) {
          const existing = claims.find(c => c.category.toLowerCase() === currentCategory.toLowerCase());
          if (!existing) {
            claims.push({
              id: generateId(),
              category: currentCategory,
              claimed: amount,
              desc: ''
            });
          }
        }
      }
      
      if (trimmed.length === 0) {
        currentCategory = '';
      }
    });

    // Remove duplicates
    const uniqueClaims = [];
    const seenCategories = new Set();
    
    claims.forEach(claim => {
      const lowerCategory = claim.category.toLowerCase();
      if (!seenCategories.has(lowerCategory)) {
        seenCategories.add(lowerCategory);
        uniqueClaims.push(claim);
      }
    });

    return uniqueClaims;

  } catch (error) {
    throw new Error(`Failed to parse PDF: ${error.message}`);
  }
};

export const validateClaimsData = (claims) => {
  const errors = [];
  
  claims.forEach((claim, index) => {
    if (!claim.id) errors.push(`Claim ${index}: missing id`);
    if (!claim.category) errors.push(`Claim ${index}: missing category`);
    if (typeof claim.claimed !== 'number' || claim.claimed <= 0) {
      errors.push(`Claim ${index}: invalid claimed amount`);
    }
  });

  return errors;
};

