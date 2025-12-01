import Papa from 'papaparse';

const generateId = () => `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

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

export const parsePDF = async (pdfBuffer) => {
  // Basic PDF text extraction - for Standard Bank PDFs
  // This is a simplified version. Full implementation would require more sophisticated parsing
  throw new Error('PDF parsing for Standard Bank not yet implemented. Please use CSV format.');
};

