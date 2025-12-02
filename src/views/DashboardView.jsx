import { useMemo, useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, LabelList } from 'recharts';
import { FileStack, Bell, AlertCircle, AlertTriangle, Flag, HelpCircle, FileQuestion, TrendingDown, Calendar, ArrowLeftRight, Scale, CheckCircle2, XCircle, FileText } from 'lucide-react';
import { getMissingStatements, getUnprovenClaims, getProvenAvgForMonths } from '../utils/analysisUtils';
import { generateClientReport } from '../utils/pdfExport';

// Note: getProvenAvgForMonths is now imported from analysisUtils

// Claims Comparison Chart - shows claimed vs proven for each category
const ClaimsComparisonChart = ({ claims, transactions, proofPeriod = '6M' }) => {
  const proofMonths = proofPeriod === '3M' ? 3 : 6;

  // Base data that doesn't depend on proof period (claimed amounts, names, etc.)
  const baseChartData = useMemo(() => {
    if (!claims || claims.length === 0) return [];

    return claims
      .filter(claim => claim.claimed > 0)
      .map(claim => ({
        name: claim.category.length > 20 ? claim.category.substring(0, 18) + '...' : claim.category,
        fullName: claim.category,
        claimed: claim.claimed
      }))
      .sort((a, b) => b.claimed - a.claimed);
  }, [claims]);

  // Proven data that depends on proof period
  const chartData = useMemo(() => {
    if (baseChartData.length === 0) return [];

    // Find latest transaction date
    const latestTxDate = transactions.length > 0
      ? transactions.reduce((latest, tx) => {
          if (!tx.date) return latest;
          const txDate = new Date(tx.date);
          return !latest || txDate > latest ? txDate : latest;
        }, null)
      : null;

    return baseChartData.map(item => {
      const provenAvg = getProvenAvgForMonths(transactions, item.fullName, proofMonths, latestTxDate);
      const pct = item.claimed > 0 ? Math.round((provenAvg / item.claimed) * 100) : 0;

      // Calculate color based on percentage (0-100 maps to hue 0-90) with reduced saturation for accessibility
      const cappedPct = Math.min(pct, 100);
      const hue = (cappedPct / 100) * 90;
      const barColor = `hsl(${hue}, 60%, 45%)`;

      return {
        ...item,
        proven: Math.round(provenAvg),
        pct,
        barColor
      };
    });
  }, [baseChartData, transactions, proofMonths]);

  if (chartData.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-slate-400 text-xs">
        No claims data. Import expense claims to see verification status.
      </div>
    );
  }

  // Custom tooltip content to show proven value with color
  const CustomTooltip = ({ active, payload, label }) => {
    if (!active || !payload || payload.length === 0) return null;
    
    const data = payload[0].payload;
    const claimedEntry = payload.find(p => p.dataKey === 'claimed');
    const provenEntry = payload.find(p => p.dataKey === 'proven');
    
    return (
      <div className="bg-white border border-slate-200 rounded shadow-lg p-2 text-xs">
        <p className="font-bold text-slate-700 mb-1">{data.fullName || label}</p>
        {claimedEntry && (
          <p className="text-slate-600">
            <span className="font-semibold">Claimed:</span> R {claimedEntry.value.toLocaleString()}
          </p>
        )}
        {provenEntry && (
          <p className="text-slate-600">
            <span className="font-semibold">Proven ({proofPeriod} Avg):</span>{' '}
            <span style={{ color: data.barColor, fontWeight: 'bold' }}>
              R {provenEntry.value.toLocaleString()}
            </span>
          </p>
        )}
      </div>
    );
  };

  return (
    <div className="h-full flex flex-col">
      {/* Legend */}
      <div className="flex items-center justify-center gap-4 mb-2 text-[9px] text-slate-600">
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 rounded" style={{ backgroundColor: 'hsl(90, 75%, 50%)' }}></div>
          <span>Claimed</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 rounded" style={{ backgroundColor: 'hsl(0, 75%, 50%)' }}></div>
          <span>Proven ({proofPeriod} Avg)</span>
        </div>
      </div>

      {/* Chart */}
      <div className="flex-1">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData} layout="vertical" margin={{ left: 0, right: 30, top: 5, bottom: 5 }}>
            <XAxis type="number" fontSize={8} axisLine={false} tickLine={false} tickFormatter={(val) => `R${val/1000}k`} />
            <YAxis type="category" dataKey="name" fontSize={8} axisLine={false} tickLine={false} width={80} />
            <Tooltip
              cursor={{ fill: '#f1f5f9' }}
              content={<CustomTooltip />}
            />
            <Bar dataKey="claimed" name="Claimed" fill="hsl(90, 60%, 45%)" radius={[0, 2, 2, 0]} barSize={10}>
              <LabelList
                dataKey="claimed"
                position="right"
                fontSize={8}
                formatter={(value) => value >= 1000 ? `R${(value/1000).toFixed(1)}k` : value > 0 ? '<R1k' : ''}
                fill="#64748b"
              />
            </Bar>
            <Bar
              dataKey="proven"
              name="Proven"
              radius={[0, 2, 2, 0]}
              barSize={10}
            >
              {chartData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.barColor} />
              ))}
              <LabelList
                dataKey="proven"
                position="right"
                fontSize={8}
                formatter={(value) => value >= 1000 ? `R${(value/1000).toFixed(1)}k` : value > 0 ? '<R1k' : 'R0k'}
                fill="#64748b"
              />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

// Proof Gauge - circular gauge showing overall proof percentage
const ProofGauge = ({ claims, transactions, proofPeriod = '6M' }) => {
  const [showTooltip, setShowTooltip] = useState(false);
  const proofMonths = proofPeriod === '3M' ? 3 : 6;
  const { totalClaimed, totalProven, percentage } = useMemo(() => {
    const totalClaimed = claims.reduce((sum, c) => sum + (c.claimed || 0), 0);
    
    // Find latest transaction date
    const latestTxDate = transactions.length > 0
      ? transactions.reduce((latest, tx) => {
          if (!tx.date) return latest;
          const txDate = new Date(tx.date);
          return !latest || txDate > latest ? txDate : latest;
        }, null)
      : null;
    
    let totalProven = 0;
    claims.forEach(claim => {
      totalProven += getProvenAvgForMonths(transactions, claim.category, proofMonths, latestTxDate);
    });
    
    const percentage = totalClaimed > 0 ? Math.round((totalProven / totalClaimed) * 100) : 0;
    return { totalClaimed, totalProven: Math.round(totalProven), percentage: Math.min(percentage, 100) };
  }, [claims, transactions, proofMonths]);

  // Calculate color based on semantic thresholds
  let color;
  if (percentage <= 49) {
    color = '#ef4444'; // Red/Danger (0-49%)
  } else if (percentage <= 79) {
    color = '#f97316'; // Orange/Warning (50-79%)
  } else {
    color = '#22c55e'; // Green/Success (80-100%)
  }
  
  // SVG arc calculation
  const radius = 38;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (percentage / 100) * circumference;

  return (
    <div className="bg-slate-50 rounded-lg p-2 flex flex-col items-center justify-center">
      <div className="text-[9px] font-bold text-slate-500 uppercase mb-1">Overall Proof</div>
      <div className="relative">
        <svg
          width="90"
          height="90"
          className="-rotate-90 cursor-pointer"
          onMouseEnter={() => setShowTooltip(true)}
          onMouseLeave={() => setShowTooltip(false)}
        >
          <circle
            cx="45"
            cy="45"
            r={radius}
            fill="none"
            stroke="#E5E7EB"
            strokeWidth="8"
          />
          <circle
            cx="45"
            cy="45"
            r={radius}
            fill="none"
            stroke={color}
            strokeWidth="8"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            strokeLinecap="round"
            className="transition-all duration-500"
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
          <span className="text-2xl font-bold block" style={{ color }}>{percentage}%</span>
          <span className="text-xs font-medium uppercase tracking-wider text-gray-500 block">PROVEN</span>
          <span className="text-sm">
            <span className="font-bold">R{totalProven.toLocaleString()}</span>
            <span className="text-gray-400"> / R{totalClaimed.toLocaleString()}</span>
          </span>
        </div>
        {showTooltip && (
          <div className="absolute top-full left-1/2 transform -translate-x-1/2 mt-2 bg-white border border-slate-200 rounded shadow-lg p-2 text-xs z-10 whitespace-nowrap">
            <div className="font-bold text-slate-700 mb-1">Unproven Balance</div>
            <div className="text-slate-600">
              R {(totalClaimed - totalProven).toLocaleString()} Remaining
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

// Category Breakdown - shows proven vs unproven categories
const CategoryBreakdown = ({ claims, transactions, proofPeriod = '6M' }) => {
  const proofMonths = proofPeriod === '3M' ? 3 : 6;
  const { proven, partial, unproven } = useMemo(() => {
    let proven = 0, partial = 0, unproven = 0;
    
    // Find latest transaction date
    const latestTxDate = transactions.length > 0
      ? transactions.reduce((latest, tx) => {
          if (!tx.date) return latest;
          const txDate = new Date(tx.date);
          return !latest || txDate > latest ? txDate : latest;
        }, null)
      : null;
    
    claims.forEach(claim => {
      if (!claim.claimed) return;
      const provenAvg = getProvenAvgForMonths(transactions, claim.category, proofMonths, latestTxDate);
      const pct = provenAvg / claim.claimed;
      
      if (pct >= 0.95) proven++;
      else if (pct >= 0.5) partial++;
      else unproven++;
    });
    
    return { proven, partial, unproven };
  }, [claims, transactions, proofMonths]);

  const total = proven + partial + unproven;
  if (total === 0) return null;

  const pieData = [
    { name: 'Proven', value: proven, color: '#10b981' },
    { name: 'Partial', value: partial, color: '#f59e0b' },
    { name: 'Unproven', value: unproven, color: '#f43f5e' }
  ].filter(d => d.value > 0);

  return (
    <div className="bg-slate-50 rounded-lg p-2 flex-1 flex flex-col">
      <div className="text-[9px] font-bold text-slate-500 uppercase mb-1 text-center">Categories</div>
      <div className="flex-1 flex items-center justify-center">
        <ResponsiveContainer width="100%" height={80}>
          <PieChart>
            <Pie
              data={pieData}
              cx="50%"
              cy="50%"
              innerRadius={20}
              outerRadius={35}
              paddingAngle={2}
              dataKey="value"
            >
              {pieData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.color} />
              ))}
            </Pie>
          </PieChart>
        </ResponsiveContainer>
      </div>
      <div className="flex justify-around text-[8px] mt-1">
        <div className="flex items-center gap-0.5">
          <CheckCircle2 size={8} className="text-emerald-500" />
          <span>{proven}</span>
        </div>
        <div className="flex items-center gap-0.5">
          <AlertCircle size={8} className="text-amber-500" />
          <span>{partial}</span>
        </div>
        <div className="flex items-center gap-0.5">
          <XCircle size={8} className="text-rose-500" />
          <span>{unproven}</span>
        </div>
      </div>
    </div>
  );
};

// Helper to filter transactions by selected time period
const filterTransactionsByPeriod = (transactions, months, latestTxDate) => {
  if (!latestTxDate || months === 0) return transactions;

  const startDate = new Date(latestTxDate);
  startDate.setDate(1);
  startDate.setHours(0, 0, 0, 0);
  startDate.setMonth(startDate.getMonth() - (months - 1));

  return transactions.filter(tx => {
    if (!tx || !tx.date) return false;
    const txDate = new Date(tx.date);
    return txDate >= startDate;
  });
};

const DashboardView = ({ data, transactions, claims, proofPeriod = '6M' }) => {
  // Calculate KPIs from actual data based on selected period
  const proofMonths = proofPeriod === '3M' ? 3 : 6;

  // Find latest transaction date for period filtering
  const latestTxDate = transactions.length > 0
    ? transactions.reduce((latest, tx) => {
        if (!tx.date) return latest;
        const txDate = new Date(tx.date);
        return !latest || txDate > latest ? txDate : latest;
      }, null)
    : null;

  // Filter transactions by selected period
  const periodTransactions = filterTransactionsByPeriod(transactions, proofMonths, latestTxDate);

  const totalIncome = periodTransactions
    .filter(tx => tx && tx.amount > 0)
    .reduce((sum, tx) => sum + (tx.amount || 0), 0);

  const totalExpenses = Math.abs(periodTransactions
    .filter(tx => tx && tx.amount < 0)
    .reduce((sum, tx) => sum + (tx.amount || 0), 0));

  const totalClaimed = claims
    .reduce((sum, claim) => sum + (claim.claimed || 0), 0);

  const deficit = totalIncome - totalExpenses;

  const hasData = transactions.length > 0 || claims.length > 0;

  // Calculate unique accounts
  const uniqueAccountCount = useMemo(() => {
    const accounts = new Set();
    transactions.forEach(tx => {
      if (tx.acc) accounts.add(tx.acc);
    });
    return accounts.size;
  }, [transactions]);

  // Calculate dynamic alerts using centralized Utils
  const computedAlerts = useMemo(() => {
    const alerts = [];
    
    // 1. Unproven Expenses
    const unprovenExpenses = getUnprovenClaims(claims, transactions, proofPeriod, latestTxDate);
    if (unprovenExpenses.length > 0) {
      alerts.push({
        id: 'unproven',
        type: 'critical',
        icon: TrendingDown,
        title: 'Unproven Monthly Expense Claims',
        msg: `${unprovenExpenses.length} expense categor${unprovenExpenses.length !== 1 ? 'ies' : 'y'} not fully proven`,
        value: unprovenExpenses.length
      });
    }
    
    // 2. Uncategorized items
    const uncategorizedItems = transactions.filter(tx => !tx.cat || tx.cat === 'Uncategorized');
    if (uncategorizedItems.length > 0) {
      alerts.push({
        id: 'uncategorized',
        type: 'warning',
        icon: HelpCircle,
        title: 'Uncategorized Transactions',
        msg: `${uncategorizedItems.length} transaction${uncategorizedItems.length !== 1 ? 's' : ''} need${uncategorizedItems.length === 1 ? 's' : ''} to be categorized`,
        value: uncategorizedItems.length
      });
    }
    
    // 3. Flagged items
    const flaggedItems = transactions.filter(tx => tx.flagged);
    if (flaggedItems.length > 0) {
      alerts.push({
        id: 'flagged',
        type: 'critical',
        icon: Flag,
        title: 'Flagged as Suspicious',
        msg: `${flaggedItems.length} transaction${flaggedItems.length !== 1 ? 's' : ''} flagged for review`,
        value: flaggedItems.length
      });
    }
    
    // 4. Inter-account transfers without corresponding entry (ORANGE)
    const transfers = transactions.filter(tx => {
      const cat = (tx.cat || '').toLowerCase();
      return cat.includes('inter-account') || cat === 'inter account' || cat === 'interaccount';
    });
    
    const unmatchedTransfers = [];
    transfers.forEach(tx => {
      const amount = Math.abs(tx.amount || 0);
      const date = tx.date;
      const hasMatch = transfers.some(other => {
        if (other.id === tx.id) return false;
        if (Math.abs(other.amount || 0) !== amount) return false;
        if ((tx.amount > 0 && other.amount > 0) || (tx.amount < 0 && other.amount < 0)) return false;
        const txDate = new Date(date);
        const otherDate = new Date(other.date);
        const daysDiff = Math.abs((txDate - otherDate) / (1000 * 60 * 60 * 24));
        return daysDiff <= 3;
      });
      if (!hasMatch && !unmatchedTransfers.find(t => t.id === tx.id)) {
        unmatchedTransfers.push(tx);
      }
    });
    
    if (unmatchedTransfers.length > 0) {
      alerts.push({
        id: 'unmatched-transfers',
        type: 'warning',
        icon: ArrowLeftRight,
        title: 'Unmatched Inter-Account',
        msg: `${unmatchedTransfers.length} inter-account transfer${unmatchedTransfers.length !== 1 ? 's' : ''} without matching entry in another account`,
        value: unmatchedTransfers.length
      });
    }
    
    // 5. Miscellaneous items (ORANGE)
    const miscItems = transactions.filter(tx => 
      tx.cat && tx.cat.toLowerCase().includes('miscellaneous')
    );
    if (miscItems.length > 0) {
      alerts.push({
        id: 'miscellaneous',
        type: 'warning',
        icon: FileQuestion,
        title: 'Miscellaneous Expenses',
        msg: `${miscItems.length} transaction${miscItems.length !== 1 ? 's' : ''} categorized as miscellaneous`,
        value: miscItems.length
      });
    }
    
    // 6. Missing bank statement periods (per account) - CYCLE AWARE
    // Group transactions by account and determine cycle day
    if (latestTxDate) {
      const accountTxMap = {};
      
      // Use Today as the anchor for checking outstanding statements, 
      // rather than just the latest transaction date.
      const now = new Date();
      const anchorDate = now;
      
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
        
        // Update cycleDay from most recent transaction/file metadata
        // Assuming transactions have 'cycleDay' property from file processing
        if (!accountTxMap[tx.acc].latestTx || new Date(tx.date) > new Date(accountTxMap[tx.acc].latestTx)) {
          accountTxMap[tx.acc].latestTx = tx.date;
          if (tx.cycleDay) {
            accountTxMap[tx.acc].cycleDay = tx.cycleDay;
          }
        }
      });

      Object.entries(accountTxMap).forEach(([account, { txs, cycleDay }]) => {
        const missingStatements = [];
        
        // Check last 6 cycles backwards from anchor date (today)
        for (let i = 0; i < 6; i++) {
          // Determine the target cycle's end date
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
              
            missingStatements.push(label);
          }
        }
        
        if (missingStatements.length > 0) {
          alerts.push({
            id: `missing-${account}`,
            type: 'critical',
            icon: Calendar,
            title: `Missing Statements: ${account}`,
            msg: `Missing cycles: ${missingStatements.reverse().slice(0, 3).join(', ')}${missingStatements.length > 3 ? '...' : ''}`,
            value: `${missingStatements.length}`
          });
        }
      });
    }

    // 7. Transaction confirmation status
    const totalTransactions = transactions.length;
    if (totalTransactions > 0) {
      const confirmedCount = transactions.filter(tx => (tx.status || 'pending') === 'confirmed').length;
      const pendingCount = transactions.filter(tx => (tx.status || 'pending') === 'pending').length;
      const confirmedPercentage = Math.round((confirmedCount / totalTransactions) * 100);

      alerts.push({
        id: 'confirmation-status',
        type: 'warning',
        icon: CheckCircle2,
        title: 'Transaction Confirmation Status',
        msg: `${confirmedCount} of ${totalTransactions} transactions confirmed (${confirmedPercentage}%)`,
        value: confirmedPercentage
      });
    }

    return alerts;
  }, [transactions, claims, proofPeriod, latestTxDate]);

  const handleGenerateReport = () => {
    const reportProofMonths = proofPeriod === '3M' ? 3 : 6;
    generateClientReport({
      caseName: 'Financial Analysis',
      missingStatements: getMissingStatements(transactions, latestTxDate),
      unprovenClaims: getUnprovenClaims(claims, transactions, proofPeriod, latestTxDate),
      transactions: transactions.filter(tx => tx.status !== 'proven'), // Only pending items
      period: `Last ${reportProofMonths} Months`
    });
  };

  return (
    <div className="p-1.5 overflow-auto h-full custom-scroll bg-slate-50/50">
      {!hasData && (
        <div className="flex flex-col items-center justify-center h-[60vh] text-center">
          <FileStack size={48} className="text-slate-300 mb-2" />
          <h2 className="text-lg font-bold text-slate-700 mb-1">No Data Yet</h2>
          <p className="text-xs text-slate-500 mb-4 max-w-md">
            Click <strong>+</strong> to upload bank statements and financial affidavits, or <strong>Open</strong> to load a saved project.
          </p>
        </div>
      )}

      {hasData && (
        <>
          <div className="grid grid-cols-5 gap-1.5 mb-1.5">
            <div className="p-2 rounded-lg border border-slate-100 shadow-sm bg-white border-l-4 border-l-emerald-500">
              <div className="text-[9px] font-bold text-slate-400 uppercase">Total Income ({proofPeriod})</div>
              <div className="text-lg font-mono font-bold text-emerald-600">
                {totalIncome.toLocaleString('en-ZA', { style: 'currency', currency: 'ZAR', maximumFractionDigits: 0 })}
              </div>
              <div className="text-[9px] text-slate-400">
                {periodTransactions.filter(tx => tx && tx.amount > 0).length} tx
              </div>
            </div>
            <div className="p-2 rounded-lg border border-slate-100 shadow-sm bg-white border-l-4 border-l-rose-500">
              <div className="text-[9px] font-bold text-slate-400 uppercase">Total Expenses ({proofPeriod})</div>
              <div className="text-lg font-mono font-bold text-rose-600">
                {totalExpenses.toLocaleString('en-ZA', { style: 'currency', currency: 'ZAR', maximumFractionDigits: 0 })}
              </div>
              <div className="text-[9px] text-rose-400">
                {periodTransactions.filter(tx => tx && tx.amount < 0).length} tx
              </div>
            </div>
            <div className="p-2 rounded-lg border border-slate-100 shadow-sm bg-white border-l-4 border-l-amber-500">
              <div className="text-[9px] font-bold text-slate-400 uppercase">Total Deficit ({proofPeriod})</div>
              <div className={`text-lg font-mono font-bold ${deficit < 0 ? 'text-amber-600' : 'text-emerald-600'}`}>
                {deficit.toLocaleString('en-ZA', { style: 'currency', currency: 'ZAR', maximumFractionDigits: 0 })}
              </div>
              <div className="text-[9px] text-slate-400">
                {proofPeriod} period
              </div>
            </div>
             <div className="p-2 rounded-lg border border-slate-100 shadow-sm bg-white border-l-4 border-l-blue-500">
              <div className="text-[9px] font-bold text-slate-400 uppercase">Active Accounts</div>
              <div className="text-lg font-mono font-bold text-blue-600">
                {uniqueAccountCount}
              </div>
               <div className="text-[9px] text-slate-400">
                Imported Sources
              </div>
            </div>
            <div className="p-2 rounded-lg border border-slate-100 shadow-sm bg-white border-l-4 border-l-slate-500">
              <div className="text-[9px] font-bold text-slate-400 uppercase">Monthly Claimed</div>
              <div className="text-lg font-mono font-bold text-slate-600">
                {totalClaimed.toLocaleString('en-ZA', { style: 'currency', currency: 'ZAR', maximumFractionDigits: 0 })}
              </div>
              <div className="text-[9px] text-slate-400">
                {claims.length} categor{claims.length !== 1 ? 'ies' : 'y'}
              </div>
            </div>
          </div>
        </>
      )}

      {hasData && (
        <div className="grid grid-cols-3 gap-1.5" style={{ height: 'calc(100% - 80px)' }}>
          <div className="col-span-2 bg-white p-2 rounded-lg border border-slate-200 shadow-sm flex flex-col">
            <div className="flex justify-between items-center mb-1">
              <h3 className="text-xs font-bold text-slate-700 flex items-center gap-1">
                <Scale size={12} className="text-blue-500" />
                Claims Verification Status
              </h3>
            </div>
            <div className="flex-1 w-full min-h-0 flex gap-2">
              {/* Left: Claims vs Proven horizontal bar chart */}
              <div className="flex-1 flex flex-col">
                <ClaimsComparisonChart claims={claims} transactions={transactions} proofPeriod={proofPeriod} />
              </div>
              
              {/* Right: Proof Status Gauge + Category Breakdown */}
              <div className="w-48 flex flex-col gap-2">
                <ProofGauge claims={claims} transactions={transactions} proofPeriod={proofPeriod} />
                <CategoryBreakdown claims={claims} transactions={transactions} proofPeriod={proofPeriod} />
              </div>
            </div>
          </div>

          <div className="bg-white p-2 rounded-lg border border-slate-200 shadow-sm overflow-auto custom-scroll flex flex-col">
            <div className="flex items-center justify-between mb-1.5 shrink-0">
              <h3 className="text-xs font-bold text-slate-700 flex items-center gap-1">
                <Bell className="text-slate-400" size={12} />
                Alerts
                {computedAlerts.length > 0 && (
                  <span className="bg-rose-500 text-white text-[8px] font-bold px-1.5 py-0.5 rounded-full">
                    {computedAlerts.length}
                  </span>
                )}
              </h3>
              <button 
                onClick={handleGenerateReport}
                className="flex items-center gap-1 px-2 py-1 bg-slate-800 text-white text-[10px] font-medium rounded hover:bg-slate-700 transition-colors"
              >
                <FileText size={10} />
                Client Request PDF
              </button>
            </div>
            <div className="flex-1 overflow-auto space-y-1">
              {computedAlerts.length > 0 ? (
                computedAlerts.map(alert => {
                  const IconComponent = alert.icon || (alert.type === 'critical' ? AlertCircle : AlertTriangle);
                  return (
                    <div key={alert.id} className={`flex items-start p-1.5 rounded border ${alert.type === 'critical' ? 'bg-rose-50 border-rose-200' : 'bg-amber-50 border-amber-200'}`}>
                      <div className={`mt-0.5 mr-1.5 shrink-0 ${alert.type === 'critical' ? 'text-rose-500' : 'text-amber-500'}`}>
                        <IconComponent size={12} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h4 className={`text-[10px] font-bold ${alert.type === 'critical' ? 'text-rose-800' : 'text-amber-800'}`}>{alert.title}</h4>
                        <p className={`text-[9px] ${alert.type === 'critical' ? 'text-rose-600' : 'text-amber-700'}`}>{alert.msg}</p>
                      </div>
                      <div className={`text-sm font-bold font-mono shrink-0 ${alert.type === 'critical' ? 'text-rose-600' : 'text-amber-600'}`}>
                        {alert.value}
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="text-center text-emerald-500 text-xs py-4 flex flex-col items-center gap-1">
                  <AlertCircle size={16} />
                  <span>All clear! No issues detected.</span>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DashboardView;

