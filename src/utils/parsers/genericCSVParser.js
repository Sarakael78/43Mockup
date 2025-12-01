import Papa from 'papaparse';

const generateId = () => `${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;

const cleanDescription = (desc) => {
  if (!desc) return '';
  return String(desc).trim().replace(/\s+/g, ' ');
};

export const parseCSV = (csvText) => {
  try {
    const results = Papa.parse(csvText, {
      header: true,
      skipEmptyLines: true,
      encoding: 'UTF-8',
      // Limit rows to prevent DoS attacks
      preview: 100000
    });

    // CSV parsing errors are handled silently - invalid rows are filtered out
    // If needed, errors can be collected and returned to caller

    // Auto-detect column names (case-insensitive)
    const firstRow = results.data[0];
    if (!firstRow) return [];

    const findColumn = (names) => {
      const keys = Object.keys(firstRow);
      const lowerKeys = keys.map(k => k.toLowerCase());
      for (const name of names) {
        const idx = lowerKeys.indexOf(name.toLowerCase());
        if (idx >= 0) return keys[idx];
      }
      return null;
    };

    const dateCol = findColumn(['date', 'transaction date', 'posting date', 'value date']);
    const descCol = findColumn(['description', 'original_description', 'original description', 'details', 'narrative', 'transaction description', 'memo']);
    const amountCol = findColumn(['amount', 'transaction amount', 'debit', 'credit', 'balance']);
    const accountCol = findColumn(['account', 'account number', 'account_name', 'account name', 'acc']);
    const categoryCol = findColumn(['category', 'cat', 'categories', 'expense category', 'transaction category']);
    const subCategoryCol = findColumn(['subcategory', 'sub_category', 'sub-category', 'subcat', 'sub cat', 'sub_category']);

    if (!dateCol) {
      throw new Error('Could not find date column in CSV');
    }

    // Limit rows to prevent DoS attacks
    const MAX_ROWS = 100000;
    const dataRows = results.data.slice(0, MAX_ROWS);
    if (results.data.length > MAX_ROWS) {
      console.warn(`CSV file contains ${results.data.length} rows. Processing first ${MAX_ROWS} rows only.`);
    }

    const transactions = dataRows
      .filter(row => row && row[dateCol])
      .map(row => {
        const dateStr = row[dateCol] || '';
        const desc = (descCol && row[descCol]) || '';
        const amountStr = (amountCol && row[amountCol]) || '0';
        const accountStr = (accountCol && row[accountCol]) || '';
        const categoryStr = (categoryCol && row[categoryCol]) || '';
        const subCategoryStr = (subCategoryCol && row[subCategoryCol]) || '';
        
        // Try to parse date
        let date = '';
        try {
          if (dateStr.includes('/')) {
            const parts = dateStr.split('/');
            if (parts.length === 3) {
              const [d, m, y] = parts;
              date = `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
            }
          } else if (dateStr.includes('-')) {
            date = dateStr.split(' ')[0]; // Take first part if there's time
          } else {
            date = dateStr;
          }
        } catch (e) {
          date = dateStr;
        }

        // Parse amount
        const amount = parseFloat(String(amountStr).replace(/[R,\s]/g, '')) || 0;
        
        // Clean and sanitize account field - normalize spaces and trim
        let account = 'PERSONAL';
        if (accountStr && accountStr.trim()) {
          // Normalize spaces (replace multiple spaces/tabs with single space) and trim
          const cleaned = String(accountStr).trim().replace(/\s+/g, ' ').substring(0, 200);
          if (cleaned) {
            account = cleaned;
          }
        }
        
        // Sanitize category to prevent CSV injection
        let category = 'Uncategorized';
        if (categoryStr && categoryStr.trim()) {
          // Remove potentially dangerous characters (=, +, -, @, etc.) that could be formula injection
          const sanitized = String(categoryStr).trim().replace(/^[=+\-@]/, '').substring(0, 100);
          if (sanitized) {
            category = sanitized;
          }
        }
        
        // Sanitize sub-category to prevent CSV injection
        let subCategory = '';
        if (subCategoryStr && subCategoryStr.trim()) {
          // Remove potentially dangerous characters (=, +, -, @, etc.) that could be formula injection
          const sanitized = String(subCategoryStr).trim().replace(/^[=+\-@]/, '').substring(0, 100);
          if (sanitized) {
            subCategory = sanitized;
          }
        }

        return {
          id: generateId(),
          date,
          desc: cleanDescription(desc),
          clean: cleanDescription(desc),
          amount,
          acc: account,
          cat: category,
          subcat: subCategory || undefined, // Only include if present
          status: 'pending',
          type: amount < 0 ? 'expense' : 'income'
        };
      })
      .filter(tx => tx.date && (tx.desc || tx.amount !== 0));

    return transactions;
  } catch (error) {
    throw new Error(`Failed to parse CSV: ${error.message}`);
  }
};

