import { useMemo } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, LabelList } from 'recharts';
import { FileStack, Bell, AlertCircle, AlertTriangle, Flag, HelpCircle, FileQuestion, TrendingDown, Calendar, ArrowLeftRight, Scale, CheckCircle2, XCircle } from 'lucide-react';

// Helper to calculate proven average using same logic as expense progress bars
const getProvenAvgForMonths = (transactions, category, months, latestTxDate) => {
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

  // Calculate color based on percentage (0-100 maps to hue 0-90) with reduced saturation for accessibility
  const hue = (percentage / 100) * 90;
  const color = `hsl(${hue}, 60%, 45%)`;
  
  // SVG arc calculation
  const radius = 38;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (percentage / 100) * circumference;

  return (
    <div className="bg-slate-50 rounded-lg p-2 flex flex-col items-center">
      <div className="text-[9px] font-bold text-slate-500 uppercase mb-1">Overall Proof</div>
      <div className="relative">
        <svg width="90" height="90" className="-rotate-90">
          <circle
            cx="45"
            cy="45"
            r={radius}
            fill="none"
            stroke="#e2e8f0"
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
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-xl font-bold" style={{ color }}>{percentage}%</span>
          <span className="text-[8px] text-slate-400">verified</span>
        </div>
      </div>
      <div className="text-[8px] text-slate-500 mt-1 text-center">
        R{totalProven.toLocaleString()} / R{totalClaimed.toLocaleString()}
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

  // Calculate dynamic alerts
  const computedAlerts = useMemo(() => {
    const alerts = [];
    
    // 1. Expenses not fully proven (claimed > proven) - TOP PRIORITY (RED)
    // Find latest transaction date for proper calculation
    const latestTxDate = transactions.length > 0
      ? transactions.reduce((latest, tx) => {
          if (!tx.date) return latest;
          const txDate = new Date(tx.date);
          return !latest || txDate > latest ? txDate : latest;
        }, null)
      : null;
    
    const proofMonths = (proofPeriod || '6M') === '3M' ? 3 : 6;
    const unprovenExpenses = claims.filter(claim => {
      if (!claim.claimed || claim.claimed <= 0) return false;
      const provenAvg = getProvenAvgForMonths(transactions, claim.category, proofMonths, latestTxDate);
      return provenAvg < claim.claimed * 0.95; // Less than 95% proven
    });
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
    
    // 6. Missing bank statement periods (per account)
    const accountMonths = {};
    transactions.forEach(tx => {
      if (!tx.date || !tx.acc) return;
      const date = new Date(tx.date);
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      const acc = tx.acc || tx.entity || 'Unknown';
      if (!accountMonths[acc]) accountMonths[acc] = new Set();
      accountMonths[acc].add(monthKey);
    });
    
    // Check for gaps in each account
    Object.entries(accountMonths).forEach(([account, months]) => {
      if (months.size < 2) return;
      const sortedMonths = Array.from(months).sort();
      const startDate = new Date(sortedMonths[0] + '-01');
      const endDate = new Date(sortedMonths[sortedMonths.length - 1] + '-01');
      
      const expectedMonths = [];
      const current = new Date(startDate);
      while (current <= endDate) {
        expectedMonths.push(`${current.getFullYear()}-${String(current.getMonth() + 1).padStart(2, '0')}`);
        current.setMonth(current.getMonth() + 1);
      }
      
      const missingMonths = expectedMonths.filter(m => !months.has(m));
      if (missingMonths.length > 0) {
        alerts.push({
          id: `missing-${account}`,
          type: 'critical',
          icon: Calendar,
          title: `Missing Periods: ${account}`,
          msg: `${missingMonths.length} month${missingMonths.length !== 1 ? 's' : ''} missing: ${missingMonths.slice(0, 3).join(', ')}${missingMonths.length > 3 ? '...' : ''}`,
          value: missingMonths.length
        });
      }
    });

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
  }, [transactions, claims, proofPeriod]);

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
          <div className="grid grid-cols-4 gap-1.5 mb-1.5">
            <div className="p-2 rounded-lg border border-slate-100 shadow-sm bg-white border-l-4 border-l-emerald-500">
              <div className="text-[9px] font-bold text-slate-400 uppercase">Total Income</div>
              <div className="text-lg font-mono font-bold text-emerald-600">
                {totalIncome.toLocaleString('en-ZA', { style: 'currency', currency: 'ZAR', maximumFractionDigits: 0 })}
              </div>
              <div className="text-[9px] text-slate-400">
                {transactions.filter(tx => tx && tx.amount > 0).length} tx
              </div>
            </div>
            <div className="p-2 rounded-lg border border-slate-100 shadow-sm bg-white border-l-4 border-l-rose-500">
              <div className="text-[9px] font-bold text-slate-400 uppercase">Total Expenses</div>
              <div className="text-lg font-mono font-bold text-rose-600">
                {totalExpenses.toLocaleString('en-ZA', { style: 'currency', currency: 'ZAR', maximumFractionDigits: 0 })}
              </div>
              <div className="text-[9px] text-rose-400">
                {transactions.filter(tx => tx && tx.amount < 0).length} tx
              </div>
            </div>
            <div className="p-2 rounded-lg border border-slate-100 shadow-sm bg-white border-l-4 border-l-amber-500">
              <div className="text-[9px] font-bold text-slate-400 uppercase">Total Deficit</div>
              <div className={`text-lg font-mono font-bold ${deficit < 0 ? 'text-amber-600' : 'text-emerald-600'}`}>
                {deficit.toLocaleString('en-ZA', { style: 'currency', currency: 'ZAR', maximumFractionDigits: 0 })}
              </div>
              <div className="text-[9px] text-slate-400">
                {proofPeriod} period
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
                <Scale size={12} className="text-amber-500" />
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
            <h3 className="text-xs font-bold text-slate-700 mb-1.5 flex items-center gap-1 shrink-0">
              <Bell className="text-slate-400" size={12} />
              Alerts
              {computedAlerts.length > 0 && (
                <span className="bg-rose-500 text-white text-[8px] font-bold px-1.5 py-0.5 rounded-full">
                  {computedAlerts.length}
                </span>
              )}
            </h3>
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

