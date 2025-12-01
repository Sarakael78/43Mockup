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
      encoding: 'UTF-8'
    });

    // CSV parsing errors are handled silently - invalid rows are filtered out
    // If needed, errors can be collected and returned to caller

    const transactions = results.data
      .filter(row => row && (row.Date || row.DATE || row.date))
      .map(row => {
        // Try various column name variations
        const dateStr = row.Date || row.DATE || row.date || '';
        const desc = row.Description || row.DESCRIPTION || row.description || row.Details || row.DETAILS || '';
        const amountStr = row.Amount || row.AMOUNT || row.amount || row['Transaction Amount'] || '0';
        
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

        return {
          id: generateId(),
          date,
          desc: cleanDescription(desc),
          clean: cleanDescription(desc),
          amount,
          acc: 'PERSONAL',
          cat: 'Uncategorized',
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


