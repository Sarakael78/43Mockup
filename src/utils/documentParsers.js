import mammoth from 'mammoth';
import Papa from 'papaparse';
import { extractTextFromPDF } from './pdfExtractor';
import { generateId, CSV_MAX_ROWS } from './constants';
import { logger } from './logger';
import { MIN_AMOUNT_THRESHOLD, MAX_AMOUNT_THRESHOLD, MIN_LINE_LENGTH } from './constants';
import { readFileAsArrayBuffer, readFileAsText } from './fileUtils';

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
        if (amount >= MIN_AMOUNT_THRESHOLD) { // Filter out small amounts that might be page numbers, etc.
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
    logger.log('[PDF Claims Parser] Starting to parse PDF claims from file:', file.name);
    const arrayBuffer = await readFileAsArrayBuffer(file);
    // Use pdfjs-dist for browser-compatible PDF text extraction
    let text = await extractTextFromPDF(arrayBuffer);

    // Normalize text: combine numbers that are split with spaces (e.g., "9   000" -> "9000")
    // This happens because PDF text extraction splits numbers across text items
    // More aggressive: combine ALL digits separated by spaces (up to reasonable limit)
    // Repeat multiple times to handle cases like "9   0   0   0" -> "9000"
    for (let i = 0; i < 5; i++) {
      text = text.replace(/(\d)\s+(\d)/g, '$1$2');
    }
    
    // Also normalize multiple spaces to single spaces for cleaner parsing
    // But preserve single spaces between words
    text = text.replace(/\s{2,}/g, ' ');
    
    logger.log('[PDF Claims Parser] Normalized text:', text);
    logger.log('[PDF Claims Parser] Starting pattern matching...');
    const claims = [];
    let match;
    
    // NEW: Pattern 0: Multi-line concatenated format that works on full text
    // Handles cases where entries are concatenated: "Category: Description Amount Reference Category2: ..."
    // Example: "Accommodation: Rent (inclusive of utilities) 9000 KPR5 Groceries: Basic food..."
    logger.log('[PDF Claims Parser] Trying Pattern 0: Multi-line concatenated format');
    
    // Strategy: Find all category patterns, then extract the text between categories
    // Look for: Category: (any text) Amount (3-5 digits) Reference (optional KPR code)
    // Stop when we see the next category pattern or a total/income line
    
    // First, find all positions where we have "Category:" patterns
    // Categories should be meaningful words, not single letters or reference codes
    // Better pattern: require at least 2 words or a meaningful single word
    const categoryPattern = /([A-Z][a-zA-Z\s/&]+?):/g;
    const categoryPositions = [];
    let categoryMatch;
    
    // Reset regex
    categoryPattern.lastIndex = 0;
    while ((categoryMatch = categoryPattern.exec(text)) !== null) {
      let category = categoryMatch[1].trim();
      const matchStart = categoryMatch.index;
      const lowerCategory = category.toLowerCase();
      
      // Skip header/total patterns
      if (lowerCategory.includes('schedule') || 
          lowerCategory.includes('description') ||
          lowerCategory.includes('amount') ||
          lowerCategory.includes('reference')) {
        continue;
      }
      
      // Check what comes before this match to avoid matching reference codes
      // Look back up to 30 characters to see if there's a reference code pattern
      const contextBefore = text.substring(Math.max(0, matchStart - 30), matchStart);
      
      // Filter out invalid categories
      if (category.length < 3) {
        continue;
      }
      
      // CRITICAL FIX: Skip categories that start with a single letter + space
      // These are almost always part of reference codes (like "KPR8 A")
      // Valid categories like "Groceries" don't start with "A "
      // Check: first word is exactly one letter
      const firstWord = category.split(/\s+/)[0];
      if (firstWord && firstWord.length === 1 && /^[A-Z]$/.test(firstWord)) {
        // Always skip single-letter starts - they're reference code fragments
        // Examples: "A Household Consumables" -> skip (should be "Household Consumables")
        logger.log(`[PDF Claims Parser] Pattern 0: Skipping category starting with single letter: "${category}"`);
        continue;
      }
      
      // Also check if category name itself contains fragments from previous entries
      // Look for patterns like "transport Vehicle Maintenance" where "transport" is leftover
      // This happens when text is concatenated: "...transport Vehicle Maintenance & Insurance:"
      // Strategy: Find the first proper category name (starts with capital, followed by more capitals/words)
      const words = category.split(/\s+/);
      let properCategoryStart = -1;
      
      // Find where the real category name starts (first word that's all caps or starts with capital)
      for (let i = 0; i < words.length; i++) {
        const word = words[i];
        // Real category words: start with capital, are at least 3 chars, or are known category words
        if (/^[A-Z]/.test(word) && (word.length >= 3 || /^(A|&)$/.test(word))) {
          properCategoryStart = i;
          break;
        }
      }
      
      // If we found a proper start, use that part
      if (properCategoryStart > 0 && properCategoryStart < words.length) {
        category = words.slice(properCategoryStart).join(' ').trim();
        logger.log(`[PDF Claims Parser] Pattern 0: Cleaned category from "${categoryMatch[1]}" to "${category}"`);
      }
      
      // Final validation: category should start with a capital letter
      if (!/^[A-Z]/.test(category)) {
        logger.log(`[PDF Claims Parser] Pattern 0: Skipping category that doesn't start with capital: "${category}"`);
        continue;
      }
      
      categoryPositions.push({
        index: categoryMatch.index,
        category: category,
        fullMatch: categoryMatch[0]
      });
    }
    
    logger.log(`[PDF Claims Parser] Pattern 0: Found ${categoryPositions.length} category positions`);
    
    let pattern0Matches = 0;
    
    // Now extract entries between categories
    for (let i = 0; i < categoryPositions.length; i++) {
      const currentCategoryPos = categoryPositions[i];
      const nextCategoryPos = i < categoryPositions.length - 1 ? categoryPositions[i + 1] : null;
      
      // Extract text from current category to next category (or end of text)
      const startPos = currentCategoryPos.index + currentCategoryPos.fullMatch.length;
      const endPos = nextCategoryPos ? nextCategoryPos.index : text.length;
      const segment = text.substring(startPos, endPos).trim();
      
      // Look for amount pattern: 3-6 digit number, optionally followed by KPR reference
      // Find the first valid amount (3-6 digits) in the segment
      // It should be followed by optional reference code (like "KPR5", "KPR8 A") or whitespace/end
      // Use word boundary to avoid matching digits in the middle of words
      const amountPattern = /\b(\d{3,6})\b(?:\s+([A-Z][A-Z0-9]*(?:\s+[A-Z0-9]+)?))?/;
      const amountMatch = segment.match(amountPattern);
      
      if (amountMatch) {
        // Additional check: if we found an amount, verify it's not part of a larger number
        // by checking what comes before it (shouldn't be a digit)
        if (amountMatch.index > 0) {
          const charBefore = segment[amountMatch.index - 1];
          if (/\d/.test(charBefore)) {
            // Skip this match - it's part of a larger number
            logger.log(`[PDF Claims Parser] Pattern 0: Skipping amount "${amountMatch[1]}" (part of larger number)`);
            continue;
          }
        }
        const amountStr = amountMatch[1];
        const ref = amountMatch[2] ? amountMatch[2].trim() : '';
        const amount = parseFloat(amountStr.replace(/,/g, '')) || 0;
        
        // Extract description: everything before the amount
        const descEndPos = amountMatch.index;
        let desc = segment.substring(0, descEndPos).trim();
        
        // Clean up description - remove trailing punctuation and extra whitespace
        desc = desc.replace(/[,\s]+$/, '').trim();
        
        // If description seems to continue after amount+ref (like "detergents, small sundries"),
        // that's likely from next entry concatenation - we already have the correct desc
        
        const category = currentCategoryPos.category;
        const lowerCategory = category.toLowerCase();
        
        // Filter out totals and income
        if (lowerCategory.includes('total') || 
            lowerCategory.includes('income') ||
            lowerCategory.includes('shortfall')) {
          logger.log(`[PDF Claims Parser] Pattern 0: Skipping total/income line: "${category}"`);
          continue;
        }
        
        if (category && amount > 0 && amount >= MIN_AMOUNT_THRESHOLD && amount < MAX_AMOUNT_THRESHOLD) {
          const existing = claims.find(c => c.category.toLowerCase() === lowerCategory);
          if (!existing) {
            logger.log(`[PDF Claims Parser] Pattern 0 match: "${category}" = R${amount} (desc: "${desc.substring(0, 50)}...")`);
            claims.push({
              id: generateId(),
              category: category,
              claimed: amount,
              desc: desc
            });
            pattern0Matches++;
          } else {
            logger.log(`[PDF Claims Parser] Pattern 0: Skipping duplicate "${category}"`);
          }
        } else {
          logger.log(`[PDF Claims Parser] Pattern 0: Rejected (category: "${category}", amount: ${amount})`);
        }
      } else {
        logger.log(`[PDF Claims Parser] Pattern 0: No amount found for category "${currentCategoryPos.category}" in segment: "${segment.substring(0, 100)}..."`);
      }
    }
    logger.log(`[PDF Claims Parser] Pattern 0 found ${pattern0Matches} matches`);
    
    // Pattern 1: Direct "Category: description | amount" format (table-like)
    // Matches: "Accommodation: Rent (inclusive of utilities) | 9000"
    logger.log('[PDF Claims Parser] Trying Pattern 1: Table format with pipe separator');
    const tablePattern = /([A-Z][a-zA-Z\s/&]+?):\s*([^|]*?)\s*\|\s*([\d,]+\.?\d*)/g;
    let pattern1Matches = 0;
    tablePattern.lastIndex = 0;
    while ((match = tablePattern.exec(text)) !== null) {
      const [, category, desc, amountStr] = match;
      const amount = parseFloat(amountStr.replace(/,/g, '')) || 0;
      
      logger.log(`[PDF Claims Parser] Pattern 1 match: "${category.trim()}" = R${amount} (desc: "${desc.trim()}")`);
      
      if (category.trim() && amount > 0) {
        const existing = claims.find(c => c.category.toLowerCase() === category.trim().toLowerCase());
        if (!existing) {
          claims.push({
            id: generateId(),
            category: category.trim(),
            claimed: amount,
            desc: desc.trim()
          });
          pattern1Matches++;
        }
      }
    }
    logger.log(`[PDF Claims Parser] Pattern 1 found ${pattern1Matches} matches`);
    
    // Pattern 1b: Try the "Category: Description Amount Reference" format (line-by-line)
    // Format from PDF: "Accommodation: Rent (inclusive of utilities) 9000 KPR5"
    let pattern1bMatches = 0;
    const lines = text.split('\n');
    
    lines.forEach((line, lineIndex) => {
      const trimmed = line.trim();
      if (!trimmed || trimmed.length < MIN_LINE_LENGTH) return; // Skip very short lines
      
      // Skip header lines and totals
      if (trimmed.match(/^(Description|Amount|Reference|Total|Shortfall|Monthly Income|Schedule)/i)) {
        logger.log(`[PDF Claims Parser] Skipping header/total line ${lineIndex}: "${trimmed}"`);
        return;
      }
      
      // Look for pattern: Category: Description Amount Reference
      // Category starts with capital letter, ends with colon
      // Description is everything until we hit a number (the amount)
      // Amount is 3-6 digits (to match amounts like 500, 750, 9000, 30833)
      // Reference is optional alphanumeric (like KPR5, KPR8A)
      const linePattern = /^([A-Z][a-zA-Z\s/&]+?):\s*(.+?)\s+(\d{3,6})\s*([A-Z0-9\s]+)?$/;
      const match = trimmed.match(linePattern);
      
      if (match) {
        const [, category, desc, amountStr, ref] = match;
        const amount = parseFloat(amountStr.replace(/,/g, '')) || 0;
        
        logger.log(`[PDF Claims Parser] Pattern 1b match on line ${lineIndex}: "${category.trim()}" = R${amount}`);
        logger.log(`[PDF Claims Parser] Full line: "${trimmed}"`);
        logger.log(`[PDF Claims Parser] Extracted: category="${category.trim()}", desc="${desc.trim()}", amount=${amount}, ref="${ref ? ref.trim() : ''}"`);
        
        // Filter out totals and income lines
        if (category.trim().toLowerCase().includes('total') || 
            category.trim().toLowerCase().includes('income') ||
            category.trim().toLowerCase().includes('shortfall')) {
          logger.log(`[PDF Claims Parser] Pattern 1b: Skipping total/income line`);
          return;
        }
        
        if (category.trim() && amount > 0 && amount >= MIN_AMOUNT_THRESHOLD) {
          const existing = claims.find(c => c.category.toLowerCase() === category.trim().toLowerCase());
          if (!existing) {
            claims.push({
              id: generateId(),
              category: category.trim(),
              claimed: amount,
              desc: desc.trim()
            });
            pattern1bMatches++;
          } else {
            logger.log(`[PDF Claims Parser] Pattern 1b: Skipping duplicate "${category.trim()}"`);
          }
        } else {
          logger.log(`[PDF Claims Parser] Pattern 1b: Rejected (category: "${category.trim()}", amount: ${amount})`);
        }
      } else {
        // Log lines that don't match for debugging
        if (trimmed.includes(':') && trimmed.match(/\d/)) {
          logger.log(`[PDF Claims Parser] Pattern 1b: No match on line ${lineIndex}: "${trimmed}"`);
        }
      }
    });
    logger.log(`[PDF Claims Parser] Pattern 1b found ${pattern1bMatches} matches`);
    
    // Pattern 2: Simple "Category: R amount" or "Category: amount" format
    logger.log('[PDF Claims Parser] Trying Pattern 2: Simple category:amount format');
    const categoryPattern2 = /([A-Z][a-zA-Z\s/&]+?):\s*R?\s*([\d,]+\.?\d*)/g;
    let pattern2Matches = 0;
    
    while ((match = categoryPattern2.exec(text)) !== null) {
      const [, category, amountStr] = match;
      const amount = parseFloat(amountStr.replace(/,/g, '')) || 0;
      
      if (category.trim() && amount > 0) {
        // Check if we already have this category from pattern 1
        const existing = claims.find(c => c.category.toLowerCase() === category.trim().toLowerCase());
        if (!existing) {
          logger.log(`[PDF Claims Parser] Pattern 2 match: "${category.trim()}" = R${amount}`);
          claims.push({
            id: generateId(),
            category: category.trim(),
            claimed: amount,
            desc: ''
          });
          pattern2Matches++;
        } else {
          logger.log(`[PDF Claims Parser] Pattern 2: Skipping "${category.trim()}" (already found by Pattern 1)`);
        }
      }
    }
    logger.log(`[PDF Claims Parser] Pattern 2 found ${pattern2Matches} new matches`);

    // Pattern 3: Look for table-like structures (lines with amounts)
    logger.log('[PDF Claims Parser] Trying Pattern 3: Line-by-line table structure');
    let currentCategory = '';
    let pattern3Matches = 0;
    
    lines.forEach((line, lineIndex) => {
      const trimmed = line.trim();
      
      // Check if line looks like a category header (capitalized, reasonable length, no numbers)
      if (/^[A-Z][a-zA-Z\s/&]+$/.test(trimmed) && trimmed.length < 50 && !trimmed.match(/\d/) && !trimmed.includes(':')) {
        currentCategory = trimmed;
        logger.log(`[PDF Claims Parser] Pattern 3: Found category header on line ${lineIndex}: "${currentCategory}"`);
      }
      
      // Look for amounts on lines (could be in a separate column)
      const amountMatch = trimmed.match(/\b([\d,]+\.?\d*)\b/);
      if (amountMatch && currentCategory) {
        const amount = parseFloat(amountMatch[1].replace(/,/g, '')) || 0;
        // Filter out small amounts (likely page numbers, dates, etc.) and totals
        if (amount >= MIN_AMOUNT_THRESHOLD && amount < MAX_AMOUNT_THRESHOLD) {
          const existing = claims.find(c => c.category.toLowerCase() === currentCategory.toLowerCase());
          if (!existing) {
            logger.log(`[PDF Claims Parser] Pattern 3 match on line ${lineIndex}: "${currentCategory}" = R${amount}`);
            claims.push({
              id: generateId(),
              category: currentCategory,
              claimed: amount,
              desc: ''
            });
            pattern3Matches++;
          }
        }
      }
      
      // Reset category on empty lines or section breaks
      if (trimmed.length === 0 || trimmed.match(/^[=\-]{3,}$/)) {
        if (currentCategory) {
          logger.log(`[PDF Claims Parser] Pattern 3: Resetting category on line ${lineIndex}`);
        }
        currentCategory = '';
      }
    });
    logger.log(`[PDF Claims Parser] Pattern 3 found ${pattern3Matches} matches`);

    logger.log(`[PDF Claims Parser] Total claims found before deduplication: ${claims.length}`);
    logger.log('[PDF Claims Parser] All claims:', claims);
    
    // Remove duplicates
    const uniqueClaims = [];
    const seenCategories = new Set();
    
    claims.forEach(claim => {
      const lowerCategory = claim.category.toLowerCase();
      if (!seenCategories.has(lowerCategory)) {
        seenCategories.add(lowerCategory);
        uniqueClaims.push(claim);
      } else {
        logger.log(`[PDF Claims Parser] Removing duplicate: "${claim.category}"`);
      }
    });

    logger.log(`[PDF Claims Parser] Final unique claims: ${uniqueClaims.length}`);
    logger.log('[PDF Claims Parser] Final claims:', uniqueClaims);
    return uniqueClaims;

  } catch (error) {
    throw new Error(`Failed to parse PDF: ${error.message}`);
  }
};

export const parseCSVClaims = async (file) => {
  try {
    logger.log('[CSV Claims Parser] Starting to parse CSV claims from file:', file.name);
    const csvText = await readFileAsText(file);
    
    const results = Papa.parse(csvText, {
      header: true,
      skipEmptyLines: true,
      encoding: 'UTF-8',
      preview: CSV_MAX_ROWS
    });

    if (!results.data || results.data.length === 0) {
      logger.log('[CSV Claims Parser] CSV file is empty or invalid');
      return [];
    }

    // Auto-detect column names (case-insensitive)
    const firstRow = results.data[0];
    if (!firstRow) {
      logger.log('[CSV Claims Parser] Could not read CSV header row');
      return [];
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
      throw new Error('Could not find category column in CSV. Expected columns: Category, Amount.');
    }

    if (!amountCol) {
      throw new Error('Could not find amount column in CSV. Expected columns: Category, Amount.');
    }

    const claims = [];
    
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

      if (amount > 0 && amount >= MIN_AMOUNT_THRESHOLD) {
        // Check for duplicates (same category)
        const existing = claims.find(c => c.category.toLowerCase() === categoryStr.toLowerCase());
        if (!existing) {
          logger.log(`[CSV Claims Parser] Parsed claim: "${categoryStr}" = R${amount}`);
          claims.push({
            id: generateId(),
            category: categoryStr,
            claimed: amount,
            desc: descStr
          });
        } else {
          logger.log(`[CSV Claims Parser] Skipping duplicate category: "${categoryStr}"`);
        }
      }
    });

    logger.log(`[CSV Claims Parser] Successfully parsed ${claims.length} unique claims from CSV`);
    return claims;

  } catch (error) {
    throw new Error(`Failed to parse CSV: ${error.message}`);
  }
};


