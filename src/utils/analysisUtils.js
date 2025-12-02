/**
 * Analysis Utilities
 * Centralizes logic for detecting missing data and calculating proofs
 */

// Calculate average proven amount for a category over a period
export const getProvenAvgForMonths = (transactions, category, months, latestTxDate) => {
  if (!latestTxDate) return 0;
  
  const startDate = new Date(latestTxDate);
  startDate.setDate(1);
  startDate.setHours(0, 0, 0, 0);
  startDate.setMonth(startDate.getMonth() - (months - 1));
  
  const periodTotal = transactions
    .filter(t => {
      if (t.cat !== category || t.amount >= 0) return false;
      const txDate = new Date(t.date);
      return txDate >= startDate;
    })
    .reduce((sum, t) => sum + Math.abs(t.amount), 0);
  
  return periodTotal / months;
};

// Identify unproven claims based on thresholds
export const getUnprovenClaims = (claims, transactions, proofPeriod = '6M', latestTxDate) => {
  const proofMonths = proofPeriod === '3M' ? 3 : 6;
  
  return claims.filter(claim => {
    if (!claim.claimed || claim.claimed <= 0) return false;
    const provenAvg = getProvenAvgForMonths(transactions, claim.category, proofMonths, latestTxDate);
    // Flag if less than 95% proven
    return provenAvg < claim.claimed * 0.95;
  }).map(claim => {
    const provenAvg = getProvenAvgForMonths(transactions, claim.category, proofMonths, latestTxDate);
    return {
      category: claim.category,
      claimed: claim.claimed,
      proven: provenAvg,
      shortfall: claim.claimed - provenAvg
    };
  }).sort((a, b) => b.shortfall - a.shortfall);
};

// Identify missing bank statement periods based on cycle days
export const getMissingStatements = (transactions, latestTxDate) => {
  // Use Today as the anchor for checking outstanding statements,
  // rather than just the latest transaction date.
  const now = new Date();
  const anchorDate = now;

  const accountTxMap = {};
  
  // Group transactions by account
  transactions.forEach(tx => {
    if (!tx.acc) return;
    if (!accountTxMap[tx.acc]) {
      accountTxMap[tx.acc] = {
        txs: [],
        cycleDay: 'last',
        latestTx: null
      };
    }
    
    accountTxMap[tx.acc].txs.push(tx);
    
    // Update cycleDay from most recent transaction metadata
    if (!accountTxMap[tx.acc].latestTx || new Date(tx.date) > new Date(accountTxMap[tx.acc].latestTx)) {
      accountTxMap[tx.acc].latestTx = tx.date;
      if (tx.cycleDay) {
        accountTxMap[tx.acc].cycleDay = tx.cycleDay;
      }
    }
  });

  const missingAlerts = [];

  Object.entries(accountTxMap).forEach(([account, { txs, cycleDay }]) => {
    const missingPeriods = [];
    
    // Check last 6 cycles backwards from anchor date (today)
    for (let i = 0; i < 6; i++) {
      let targetMonth = new Date(anchorDate);
      targetMonth.setMonth(targetMonth.getMonth() - i);
      
      let cycleEnd, cycleStart;
      
      if (cycleDay === 'last') {
        // Standard calendar month
        cycleEnd = new Date(targetMonth.getFullYear(), targetMonth.getMonth() + 1, 0); // Last day of month
        cycleStart = new Date(targetMonth.getFullYear(), targetMonth.getMonth(), 1);   // 1st day of month
      } else {
        // Custom cycle day (e.g., 25th)
        const day = parseInt(cycleDay, 10);
        const daysInMonth = new Date(targetMonth.getFullYear(), targetMonth.getMonth() + 1, 0).getDate();
        const validDay = Math.min(day, daysInMonth);
        
        cycleEnd = new Date(targetMonth.getFullYear(), targetMonth.getMonth(), validDay);
        
        // Start date is previous month's cycle day + 1
        cycleStart = new Date(cycleEnd);
        cycleStart.setMonth(cycleStart.getMonth() - 1);
        cycleStart.setDate(cycleStart.getDate() + 1);
      }
      
      // CRITICAL: If the cycle ends in the future relative to today, skip it.
      // The statement for this cycle hasn't been generated yet.
      if (cycleEnd > now) continue;
      
      // Check if any transaction exists within this specific cycle window
      const hasData = txs.some(tx => {
        const d = new Date(tx.date);
        return d >= cycleStart && d <= cycleEnd;
      });
      
      if (!hasData) {
        // Create a label for the missing period
        const monthName = cycleEnd.toLocaleDateString('en-ZA', { month: 'short', year: 'numeric' });
        const label = cycleDay === 'last' 
          ? monthName 
          : `End ${cycleEnd.getDate()} ${monthName}`;
          
        missingPeriods.push(label);
      }
    }
    
    if (missingPeriods.length > 0) {
      missingAlerts.push({
        account,
        missing: missingPeriods.reverse()
      });
    }
  });

  return missingAlerts;
};

