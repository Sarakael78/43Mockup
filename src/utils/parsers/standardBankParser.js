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

    // Limit rows to prevent DoS attacks
    const MAX_ROWS = 100000;
    const dataRows = results.data.slice(0, MAX_ROWS);
    if (results.data.length > MAX_ROWS) {
      console.warn(`CSV file contains ${results.data.length} rows. Processing first ${MAX_ROWS} rows only.`);
    }

    const transactions = dataRows
      .filter(row => row && (row.Date || row.DATE || row.date))
      .map(row => {
        // Try various column name variations
        const dateStr = row.Date || row.DATE || row.date || '';
        const desc = row.Description || row.DESCRIPTION || row.description || row.Original_Description || row.ORIGINAL_DESCRIPTION || row['Original Description'] || row.Details || row.DETAILS || '';
        const amountStr = row.Amount || row.AMOUNT || row.amount || row['Transaction Amount'] || '0';
        const accountStr = row.Account || row.ACCOUNT || row.account || row.Account_Number || row['Account Number'] || row.Account_Name || row['Account Name'] || '';
        const categoryStr = row.Category || row.CATEGORY || row.category || row.Cat || row.CAT || '';
        const subCategoryStr = row.SubCategory || row.SUBCATEGORY || row.Sub_Category || row.SUB_CATEGORY || row['Sub-Category'] || row.subcategory || row.subcat || row.sub_category || row['Sub Category'] || '';
        
        // Parse date - Standard Bank format is usually YYYY-MM-DD or DD/MM/YYYY
        let date = '';
        try {
          if (dateStr.includes('/')) {
            const [day, month, year] = dateStr.split('/');
            date = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
          } else {
            date = dateStr;
          }
        } catch (e) {
          date = dateStr;
        }

        // Parse amount - remove currency symbols and commas
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
      .filter(tx => tx.date && tx.desc);

    return transactions;
  } catch (error) {
    throw new Error(`Failed to parse CSV: ${error.message}`);
  }
};


