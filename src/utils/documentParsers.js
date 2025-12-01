import mammoth from 'mammoth';
import { extractTextFromPDF } from './pdfExtractor';
import { generateId } from './constants';
import { logger } from './logger';
import { MIN_AMOUNT_THRESHOLD, MAX_AMOUNT_THRESHOLD, MIN_LINE_LENGTH } from './constants';
import { readFileAsArrayBuffer } from './fileUtils';

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
    
    // NEW: Pattern 0: Multi-line concatenated format that works on full text
    // Handles cases where entries are concatenated: "Category: Description Amount Reference Category2: ..."
    // Example: "Accommodation: Rent (inclusive of utilities) 9000 KPR5 Groceries: Basic food..."
    logger.log('[PDF Claims Parser] Trying Pattern 0: Multi-line concatenated format');
    
    // Strategy: Find all category patterns, then extract the text between categories
    // Look for: Category: (any text) Amount (3-5 digits) Reference (optional KPR code)
    // Stop when we see the next category pattern or a total/income line
    
    // First, find all positions where we have "Category:" patterns
    const categoryPattern = /([A-Z][a-zA-Z\s/&]+?):/g;
    const categoryPositions = [];
    let categoryMatch;
    
    // Reset regex
    categoryPattern.lastIndex = 0;
    while ((categoryMatch = categoryPattern.exec(text)) !== null) {
      const category = categoryMatch[1].trim();
      const lowerCategory = category.toLowerCase();
      
      // Skip header/total patterns
      if (lowerCategory.includes('schedule') || 
          lowerCategory.includes('description') ||
          lowerCategory.includes('amount') ||
          lowerCategory.includes('reference')) {
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
      // Pattern: amount (3-6 digits) optional reference (KPR codes like "KPR5", "KPR8 A", etc.)
      const amountPattern = /\s+(\d{3,6})\s+([A-Z0-9]+(?:\s+[A-Z0-9]+)?)?/;
      const amountMatch = segment.match(amountPattern);
      
      if (amountMatch) {
        const amountStr = amountMatch[1];
        const ref = amountMatch[2] ? amountMatch[2].trim() : '';
        const amount = parseFloat(amountStr.replace(/,/g, '')) || 0;
        
        // Extract description: everything before the amount
        const descEndPos = amountMatch.index;
        let desc = segment.substring(0, descEndPos).trim();
        
        // Clean up description - remove trailing reference codes and category-like text
        desc = desc.replace(/\s+[A-Z0-9]+(?:\s+[A-Z0-9]+)?\s*$/, '').trim();
        desc = desc.replace(/\s+[A-Z][a-zA-Z\s/&]+$/, '').trim();
        
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


