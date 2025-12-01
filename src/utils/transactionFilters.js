/**
 * Transaction filtering utilities
 */

const periodMonthsMap = { '1M': 1, '3M': 3, '6M': 6 };

/**
 * Get the latest transaction date from an array of transactions
 * @param {Array} transactions - Array of transaction objects
 * @returns {string|null} ISO date string or null
 */
export const getLatestTransactionDate = (transactions) => {
  if (!transactions?.length || !transactions[0]?.date) return null;
  return transactions.reduce((latest, tx) => (tx?.date && tx.date > latest ? tx.date : latest), transactions[0].date);
};

/**
 * Filter transactions by time period
 * @param {Array} transactions - Array of transactions
 * @param {string} periodFilter - Period filter ('1M', '3M', '6M')
 * @param {string} latestDateIso - Latest transaction date (ISO string)
 * @returns {Array} Filtered transactions
 */
export const filterTransactionsByPeriod = (transactions, periodFilter, latestDateIso) => {
  if (!latestDateIso) return transactions;
  const months = periodMonthsMap[periodFilter] || 1;
  const startDate = new Date(latestDateIso);
  startDate.setDate(1);
  startDate.setHours(0, 0, 0, 0);
  startDate.setMonth(startDate.getMonth() - (months - 1));

  return transactions.filter((tx) => {
    const txDate = new Date(tx.date);
    txDate.setHours(0, 0, 0, 0);
    return txDate >= startDate;
  });
};

/**
 * Filter transactions by entity
 * @param {Array} transactions - Array of transactions
 * @param {string} entity - Entity filter ('PERSONAL', 'BUSINESS', 'CREDIT', 'TRUST', 'ALL')
 * @param {Object} accounts - Account mapping object
 * @returns {Array} Filtered transactions
 */
export const filterTransactionsByEntity = (transactions, entity, accounts) => {
  if (!accounts) return transactions;
  if (entity === 'PERSONAL') return transactions.filter((t) => t.acc === accounts.PERSONAL || t.acc === accounts.TRUST);
  if (entity === 'BUSINESS') return transactions.filter((t) => t.acc === accounts.BUSINESS || t.acc === accounts.MYMOBIZ);
  if (entity === 'CREDIT') return transactions.filter((t) => t.acc === accounts.CREDIT);
  if (entity === 'TRUST') return transactions.filter((t) => t.acc === accounts.TRUST);
  return transactions;
};

/**
 * Get period months map
 * @returns {Object} Period months mapping
 */
export const getPeriodMonthsMap = () => periodMonthsMap;

