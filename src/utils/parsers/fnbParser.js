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

    if (results.errors.length > 0) {
      console.warn('CSV parsing errors:', results.errors);
    }

    const transactions = results.data
      .filter(row => row && (row.Date || row.DATE || row['Transaction Date']))
      .map(row => {
        const dateStr = row.Date || row.DATE || row['Transaction Date'] || row.date || '';
        const desc = row.Description || row.DESCRIPTION || row.description || row.Details || '';
        const amountStr = row.Amount || row.AMOUNT || row.amount || row['Transaction Amount'] || row.Balance || '0';
        
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

        return {
          id: generateId(),
          date,
          desc: cleanDescription(desc),
          clean: cleanDescription(desc),
          amount,
          acc: 'BUSINESS',
          cat: 'Uncategorized',
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

export const parsePDF = async (pdfBuffer) => {
  throw new Error('PDF parsing for FNB not yet implemented. Please use CSV format.');
};

