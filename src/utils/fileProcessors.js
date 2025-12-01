import mammoth from 'mammoth';
import Papa from 'papaparse';
import { parseCSV as standardBankParseCSV } from './parsers/standardBankParser.js';
import { parseCSV as fnbParseCSV } from './parsers/fnbParser.js';
import { parseCSV as genericParseCSV } from './parsers/genericCSVParser.js';
import { extractTextFromPDF } from './pdfExtractor';
import { generateId, CSV_MAX_ROWS } from './constants';
import { readFileAsText, readFileAsArrayBuffer } from './fileUtils';

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
        // If account is still a generic default (exactly 'PERSONAL' or 'BUSINESS' without any account identifier),
        // it means CSV didn't have Account column. In that case, use entity-based mapping.
        // Otherwise, preserve the parsed account name (which may contain account numbers, names, etc.)
        // Only override if it's exactly the generic default, not if it was parsed from CSV
        const accValue = tx.acc || '';
        if (accValue === 'PERSONAL' || accValue === 'BUSINESS') {
          // This is a generic default, use entity-based mapping
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

    if (fileExtension === 'csv') {
      // Parse claims from CSV file
      const csvText = await readFileAsText(file);
      
      try {
        const results = Papa.parse(csvText, {
          header: true,
          skipEmptyLines: true,
          encoding: 'UTF-8',
          preview: CSV_MAX_ROWS
        });

        if (!results.data || results.data.length === 0) {
          errors.push({ file: file.name, message: 'CSV file is empty or invalid.' });
          return { claims, errors };
        }

        // Auto-detect column names (case-insensitive)
        const firstRow = results.data[0];
        if (!firstRow) {
          errors.push({ file: file.name, message: 'Could not read CSV header row.' });
          return { claims, errors };
        }

        const findColumn = (names) => {
          const keys = Object.keys(firstRow);
          const lowerKeys = keys.map(k => k.toLowerCase());
          for (const name of names) {
            const idx = lowerKeys.indexOf(name.toLowerCase());
            if (idx >= 0) return keys[idx];
          }
          return null;
        };

        const categoryCol = findColumn(['category', 'cat', 'expense category', 'claim category', 'name']);
        const amountCol = findColumn(['amount', 'claimed', 'claim amount', 'value', 'total']);
        const descCol = findColumn(['description', 'desc', 'details', 'notes', 'comment']);

        if (!categoryCol) {
          errors.push({ file: file.name, message: 'Could not find category column in CSV. Expected columns: Category, Amount.' });
          return { claims, errors };
        }

        if (!amountCol) {
          errors.push({ file: file.name, message: 'Could not find amount column in CSV. Expected columns: Category, Amount.' });
          return { claims, errors };
        }

        // Process each row
        const dataRows = results.data.slice(0, CSV_MAX_ROWS);
        dataRows.forEach((row, index) => {
          if (!row || !row[categoryCol]) return; // Skip empty rows

          const categoryStr = String(row[categoryCol] || '').trim();
          const amountStr = String(row[amountCol] || '0').trim();
          const descStr = descCol ? String(row[descCol] || '').trim() : '';

          if (!categoryStr) return; // Skip rows without category

          // Parse amount - remove currency symbols and commas
          const amount = parseFloat(amountStr.replace(/[R,\s]/g, '')) || 0;

          if (amount > 0) {
            // Check for duplicates (same category)
            const existing = claims.find(c => c.category.toLowerCase() === categoryStr.toLowerCase());
            if (!existing) {
              claims.push({
                id: generateId(),
                category: categoryStr,
                claimed: amount,
                desc: descStr,
                fileId: fileId || null
              });
            }
          }
        });

        if (claims.length === 0) {
          errors.push({ file: file.name, message: 'No valid claims found in CSV. Please ensure the CSV contains Category and Amount columns with valid data.' });
        }

      } catch (csvError) {
        errors.push({ file: file.name, message: `Error parsing CSV: ${csvError.message}` });
      }

    } else if (fileExtension === 'docx' || fileExtension === 'doc') {
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
      throw new Error(`Unsupported file format: ${fileExtension}. Please use CSV, DOCX, or PDF.`);
    }

    return { claims, errors };

  } catch (error) {
    errors.push({ file: file.name, message: error.message });
    return { claims: [], errors };
  }
};


