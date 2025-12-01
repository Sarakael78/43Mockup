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
      .filter(row => row && (row.Date || row.DATE || row['Transaction Date']))
      .map(row => {
        const dateStr = row.Date || row.DATE || row['Transaction Date'] || row.date || '';
        const desc = row.Description || row.DESCRIPTION || row.description || row.Details || '';
        const amountStr = row.Amount || row.AMOUNT || row.amount || row['Transaction Amount'] || row.Balance || '0';
        const categoryStr = row.Category || row.CATEGORY || row.category || row.Cat || row.CAT || '';
        
        // Parse date - FNB format varies
        let date = '';
        try {
          if (dateStr.includes('/')) {
            const parts = dateStr.split('/');
            if (parts.length === 3) {
              const [day, month, year] = parts;
              date = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
            } else {
              date = dateStr;
            }
          } else if (dateStr.includes('-')) {
            date = dateStr;
          } else {
            date = dateStr;
          }
        } catch (e) {
          date = dateStr;
        }

        // Parse amount
        const amount = parseFloat(String(amountStr).replace(/[R,\s]/g, '')) || 0;
        
        // Sanitize category to prevent CSV injection
        let category = 'Uncategorized';
        if (categoryStr && categoryStr.trim()) {
          // Remove potentially dangerous characters (=, +, -, @, etc.) that could be formula injection
          const sanitized = String(categoryStr).trim().replace(/^[=+\-@]/, '').substring(0, 100);
          if (sanitized) {
            category = sanitized;
          }
        }

        return {
          id: generateId(),
          date,
          desc: cleanDescription(desc),
          clean: cleanDescription(desc),
          amount,
          acc: 'BUSINESS',
          cat: category,
          status: 'pending',
          type: amount < 0 ? 'expense' : 'income'
        };
      })
      .filter(tx => tx.date && tx.desc);

    return transactions;
  } catch (error) {
    throw new Error(`Failed to parse FNB CSV: ${error.message}`);
  }
};


