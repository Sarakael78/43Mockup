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
    const descCol = findColumn(['description', 'details', 'narrative', 'transaction description', 'memo']);
    const amountCol = findColumn(['amount', 'transaction amount', 'debit', 'credit', 'balance']);

    if (!dateCol) {
      throw new Error('Could not find date column in CSV');
    }

    const transactions = results.data
      .filter(row => row && row[dateCol])
      .map(row => {
        const dateStr = row[dateCol] || '';
        const desc = (descCol && row[descCol]) || '';
        const amountStr = (amountCol && row[amountCol]) || '0';
        
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
      .filter(tx => tx.date && (tx.desc || tx.amount !== 0));

    return transactions;
  } catch (error) {
    throw new Error(`Failed to parse CSV: ${error.message}`);
  }
};

