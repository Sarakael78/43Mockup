import mammoth from 'mammoth';
import { parseCSV as standardBankParseCSV } from './parsers/standardBankParser.js';
import { parseCSV as fnbParseCSV } from './parsers/fnbParser.js';
import { parseCSV as genericParseCSV } from './parsers/genericCSVParser.js';
import { extractTextFromPDFSimple } from './pdfExtractor';
import { generateId } from './constants';

const readFileAsText = (file) => {
  return new Promise((resolve, reject) => {
    // Ensure file is a Blob/File object by checking for Blob methods
    if (!file || typeof file.slice !== 'function' || typeof file.stream !== 'function') {
      reject(new Error('Invalid file object: expected Blob or File'));
      return;
    }
    const reader = new FileReader();
    reader.onload = (e) => resolve(e.target.result);
    reader.onerror = (e) => reject(new Error('Failed to read file'));
    reader.readAsText(file);
  });
};

const readFileAsArrayBuffer = (file) => {
  return new Promise((resolve, reject) => {
    // Ensure file is a Blob/File object by checking for Blob methods
    if (!file || typeof file.slice !== 'function' || typeof file.stream !== 'function') {
      reject(new Error('Invalid file object: expected Blob or File'));
      return;
    }
    const reader = new FileReader();
    reader.onload = (e) => resolve(e.target.result);
    reader.onerror = (e) => reject(new Error('Failed to read file'));
    reader.readAsArrayBuffer(file);
  });
};

export const processBankStatement = async (file, parser, entity, fileId = null) => {
  const errors = [];
  const transactions = [];

  try {
    if (!file || !file.name) {
      throw new Error('File name is missing');
    }

    if (!file.triage || !file.triage.type || file.triage.type !== 'Bank Statement') {
      throw new Error('Invalid file type for bank statement processing');
    }

    const fileExtension = file.name.split('.').pop()?.toLowerCase();
    
    if (fileExtension === 'csv') {
      const csvText = await readFileAsText(file);
      let parsed = [];
      
      switch (parser) {
        case 'Standard Bank':
          parsed = standardBankParseCSV(csvText);
          break;
        case 'FNB':
          parsed = fnbParseCSV(csvText);
          break;
        case 'Generic CSV':
        default:
          parsed = genericParseCSV(csvText);
          break;
      }

      // Preserve account name from CSV if it was parsed (not a default value)
      // The parsers now extract the Account column and clean it (normalize spaces)
      // Only use entity-based default if account wasn't found in CSV
      const entityMap = {
        'PERSONAL': 'PERSONAL',
        'BUSINESS': 'BUSINESS',
        'CREDIT': 'CREDIT',
        'TRUST': 'TRUST'
      };
      
      parsed.forEach(tx => {
        // If account is still a generic default (PERSONAL/BUSINESS), it means CSV didn't have Account column
        // In that case, use entity-based mapping. Otherwise, preserve the parsed account name.
        if (tx.acc === 'PERSONAL' || tx.acc === 'BUSINESS') {
          tx.acc = entityMap[entity] || tx.acc;
        }
        // If account was parsed from CSV (contains account identifier), keep it as-is
        // Add fileId to track source
        if (fileId) {
          tx.fileId = fileId;
        }
      });

      transactions.push(...parsed);

    } else if (fileExtension === 'pdf') {
      // PDF processing - basic text extraction using pdfjs-dist
      const arrayBuffer = await readFileAsArrayBuffer(file);
      const text = await extractTextFromPDF(arrayBuffer);
      
      // Basic regex parsing for transactions in PDF
      // This is simplified - real implementation would need more sophisticated parsing
      const lines = text.split('\n').filter(l => l.trim());
      
      // Try to extract date-amount-description patterns
      const transactionPattern = /(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})\s+(.+?)\s+([-]?R?\s*\d+[,\d]*\.?\d*)/i;
      
      lines.forEach(line => {
        const match = line.match(transactionPattern);
        if (match) {
          const [, dateStr, desc, amountStr] = match;
          
          // Parse date
          let date = dateStr.replace(/\//g, '-');
          if (dateStr.includes('/')) {
            const parts = dateStr.split('/');
            if (parts.length === 3) {
              const [d, m, y] = parts;
              date = `${y.length === 2 ? '20' + y : y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
            }
          }
          
          const amount = parseFloat(amountStr.replace(/[R,\s]/g, '')) || 0;
          
          if (date && desc && amount !== 0) {
            transactions.push({
              id: generateId(),
              date,
              desc: desc.trim(),
              clean: desc.trim(),
              amount,
              acc: entity || 'PERSONAL',
              cat: 'Uncategorized',
              status: 'pending',
              type: amount < 0 ? 'expense' : 'income',
              fileId: fileId || null
            });
          }
        }
      });

      if (transactions.length === 0) {
        errors.push({ file: file.name, message: 'Could not extract transactions from PDF. Please use CSV format for better results.' });
      }

    } else {
      throw new Error(`Unsupported file format: ${fileExtension}. Please use CSV or PDF.`);
    }

    return { transactions, errors };

  } catch (error) {
    errors.push({ file: file.name, message: error.message });
    return { transactions: [], errors };
  }
};

export const processFinancialAffidavit = async (file, fileId = null) => {
  const errors = [];
  const claims = [];

  try {
    if (!file || !file.name) {
      throw new Error('File name is missing');
    }

    if (!file.triage || !file.triage.type || file.triage.type !== 'Financial Affidavit') {
      throw new Error('Invalid file type for financial affidavit processing');
    }

    const fileExtension = file.name.split('.').pop()?.toLowerCase();

    if (fileExtension === 'docx' || fileExtension === 'doc') {
      const arrayBuffer = await readFileAsArrayBuffer(file);
      const result = await mammoth.extractRawText({ arrayBuffer });
      const text = result.value;

      // Parse claims from text - look for category: amount patterns
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
            desc: '',
            fileId: fileId || null
          });
        }
      }

      // Pattern 2: Table-like structures with amounts
      const lines = text.split('\n');
      let currentCategory = '';
      
      lines.forEach(line => {
        const trimmed = line.trim();
        
        // Check if line looks like a category header
        if (/^[A-Z][a-zA-Z\s/]+$/.test(trimmed) && trimmed.length < 30) {
          currentCategory = trimmed;
        }
        
        // Check if line has an amount
        const amountMatch = trimmed.match(/R?\s*([\d,]+\.?\d*)/);
        if (amountMatch && currentCategory) {
          const amount = parseFloat(amountMatch[1].replace(/,/g, '')) || 0;
          if (amount > 0) {
            // Check if we already have this category
            const existing = claims.find(c => c.category === currentCategory);
            if (!existing) {
              claims.push({
                id: generateId(),
                category: currentCategory,
                claimed: amount,
                desc: '',
                fileId: fileId || null
              });
            }
          }
        }
      });

      if (claims.length === 0) {
        errors.push({ file: file.name, message: 'Could not extract claims from document. Please ensure the document contains expense categories and amounts.' });
      }

    } else if (fileExtension === 'pdf') {
      // Use pdfjs-dist for browser-compatible PDF text extraction
      const arrayBuffer = await readFileAsArrayBuffer(file);
      const text = await extractTextFromPDF(arrayBuffer);

      // Similar parsing logic for PDF
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
            desc: '',
            fileId: fileId || null
          });
        }
      }

      if (claims.length === 0) {
        errors.push({ file: file.name, message: 'Could not extract claims from PDF. Please ensure the document contains expense categories and amounts.' });
      }

    } else {
      throw new Error(`Unsupported file format: ${fileExtension}. Please use DOCX or PDF.`);
    }

    return { claims, errors };

  } catch (error) {
    errors.push({ file: file.name, message: error.message });
    return { claims: [], errors };
  }
};


