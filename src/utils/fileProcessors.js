import Papa from 'papaparse';
import mammoth from 'mammoth';
import { parseCSV as standardBankParseCSV } from './parsers/standardBankParser.js';

// Dynamic import for pdf-parse to handle ESM/CJS differences
const getPdfParse = async () => {
  try {
    const module = await import('pdf-parse');
    return module.default || module;
  } catch (e) {
    // Fallback if import fails
    return null;
  }
};
import { parseCSV as fnbParseCSV } from './parsers/fnbParser.js';
import { parseCSV as genericParseCSV } from './parsers/genericCSVParser.js';

const generateId = () => `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

const readFileAsText = (file) => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => resolve(e.target.result);
    reader.onerror = (e) => reject(new Error('Failed to read file'));
    reader.readAsText(file);
  });
};

const readFileAsArrayBuffer = (file) => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => resolve(e.target.result);
    reader.onerror = (e) => reject(new Error('Failed to read file'));
    reader.readAsArrayBuffer(file);
  });
};

export const processBankStatement = async (file, parser, entity) => {
  const errors = [];
  const transactions = [];

  try {
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

      // Update entity for parsed transactions
      const entityMap = {
        'PERSONAL': 'PERSONAL',
        'BUSINESS': 'BUSINESS',
        'CREDIT': 'CREDIT',
        'TRUST': 'TRUST'
      };

      parsed.forEach(tx => {
        tx.acc = entityMap[entity] || 'PERSONAL';
      });

      transactions.push(...parsed);

    } else if (fileExtension === 'pdf') {
      // PDF processing - basic text extraction
      const pdfParse = await getPdfParse();
      if (!pdfParse) {
        throw new Error('PDF parsing not available');
      }
      const arrayBuffer = await readFileAsArrayBuffer(file);
      const pdfData = await pdfParse(Buffer.from(arrayBuffer));
      const text = pdfData.text;
      
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
              type: amount < 0 ? 'expense' : 'income'
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

export const processFinancialAffidavit = async (file) => {
  const errors = [];
  const claims = [];

  try {
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
            desc: ''
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
                desc: ''
              });
            }
          }
        }
      });

      if (claims.length === 0) {
        errors.push({ file: file.name, message: 'Could not extract claims from document. Please ensure the document contains expense categories and amounts.' });
      }

    } else if (fileExtension === 'pdf') {
      const pdfParse = await getPdfParse();
      if (!pdfParse) {
        throw new Error('PDF parsing not available');
      }
      const arrayBuffer = await readFileAsArrayBuffer(file);
      const pdfData = await pdfParse(Buffer.from(arrayBuffer));
      const text = pdfData.text;

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
            desc: ''
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

export const validateTransactionData = (transactions) => {
  const errors = [];
  
  transactions.forEach((tx, index) => {
    if (!tx.id) errors.push(`Transaction ${index}: missing id`);
    if (!tx.date) errors.push(`Transaction ${index}: missing date`);
    if (typeof tx.amount !== 'number') errors.push(`Transaction ${index}: invalid amount`);
    if (!tx.desc && !tx.clean) errors.push(`Transaction ${index}: missing description`);
  });

  return errors;
};

