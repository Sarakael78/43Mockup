import { useRef, useMemo } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts';
import { FileStack, FolderOpen, Bell, AlertCircle, AlertTriangle, Flag, HelpCircle, FileQuestion, TrendingDown, Calendar, ArrowLeftRight, Scale, CheckCircle2, XCircle } from 'lucide-react';

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
const ClaimsComparisonChart = ({ claims, transactions }) => {
  const chartData = useMemo(() => {
    if (!claims || claims.length === 0) return [];
    
    // Find latest transaction date
    const latestTxDate = transactions.length > 0
      ? transactions.reduce((latest, tx) => {
          if (!tx.date) return latest;
          const txDate = new Date(tx.date);
          return !latest || txDate > latest ? txDate : latest;
        }, null)
      : null;
    
    return claims
      .map(claim => {
        const provenAvg = getProvenAvgForMonths(transactions, claim.category, 6, latestTxDate);
        const pct = claim.claimed > 0 ? Math.round((provenAvg / claim.claimed) * 100) : 0;
        
        // Calculate color based on percentage (0-100 maps to hue 0-90)
        const cappedPct = Math.min(pct, 100);
        const hue = (cappedPct / 100) * 90;
        const barColor = `hsl(${hue}, 75%, 50%)`;
        
        return {
          name: claim.category.length > 20 ? claim.category.substring(0, 18) + '...' : claim.category,
          fullName: claim.category,
          claimed: claim.claimed,
          proven: Math.round(provenAvg),
          pct,
          barColor
        };
      })
      .filter(d => d.claimed > 0)
      .sort((a, b) => b.claimed - a.claimed)
      .slice(0, 8); // Top 8 categories
  }, [claims, transactions]);

  if (chartData.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-slate-400 text-xs">
        No claims data. Import expense claims to see verification status.
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={chartData} layout="vertical" margin={{ left: 0, right: 10 }}>
        <XAxis type="number" fontSize={8} axisLine={false} tickLine={false} tickFormatter={(val) => `R${val/1000}k`} />
        <YAxis type="category" dataKey="name" fontSize={8} axisLine={false} tickLine={false} width={80} />
        <Tooltip 
          cursor={{ fill: '#f1f5f9' }} 
          formatter={(value, name) => [`R ${value.toLocaleString()}`, name === 'claimed' ? 'Claimed' : 'Proven (6M Avg)']}
          labelFormatter={(label, payload) => payload?.[0]?.payload?.fullName || label}
        />
        <Bar dataKey="claimed" name="Claimed" fill="#94a3b8" radius={[0, 2, 2, 0]} barSize={10} />
        <Bar 
          dataKey="proven" 
          name="Proven" 
          radius={[0, 2, 2, 0]} 
          barSize={10}
        >
          {chartData.map((entry, index) => (
            <Cell key={`cell-${index}`} fill={entry.barColor} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
};

// Proof Gauge - circular gauge showing overall proof percentage
const ProofGauge = ({ claims, transactions }) => {
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
      totalProven += getProvenAvgForMonths(transactions, claim.category, 6, latestTxDate);
    });
    
    const percentage = totalClaimed > 0 ? Math.round((totalProven / totalClaimed) * 100) : 0;
    return { totalClaimed, totalProven: Math.round(totalProven), percentage: Math.min(percentage, 100) };
  }, [claims, transactions]);

  // Calculate color based on percentage (0-100 maps to hue 0-90)
  const hue = (percentage / 100) * 90;
  const color = `hsl(${hue}, 75%, 45%)`;
  
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
const CategoryBreakdown = ({ claims, transactions }) => {
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
      const provenAvg = getProvenAvgForMonths(transactions, claim.category, 6, latestTxDate);
      const pct = provenAvg / claim.claimed;
      
      if (pct >= 0.95) proven++;
      else if (pct >= 0.5) partial++;
      else unproven++;
    });
    
    return { proven, partial, unproven };
  }, [claims, transactions]);

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

const DashboardView = ({ data, transactions, claims, onLoadProject }) => {
  const fileInputRef = useRef(null);

  const handleLoadClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files.length > 0) {
      onLoadProject(e.target.files[0]);
      e.target.value = ''; // Reset input
    }
  };

  // Calculate KPIs from actual data
  const totalIncome = transactions
    .filter(tx => tx && tx.amount > 0)
    .reduce((sum, tx) => sum + (tx.amount || 0), 0);
  
  const totalExpenses = Math.abs(transactions
    .filter(tx => tx && tx.amount < 0)
    .reduce((sum, tx) => sum + (tx.amount || 0), 0));
  
  const totalClaimed = claims
    .reduce((sum, claim) => sum + (claim.claimed || 0), 0);
  
  const deficit = totalIncome - totalExpenses;

  const hasData = transactions.length > 0 || claims.length > 0;

  // Calculate dynamic alerts
  const computedAlerts = useMemo(() => {
    const alerts = [];
    
    // 1. Uncategorized items
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
    
    // 2. Flagged items
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
    
    // 3. Inter-account transfers without corresponding entry
    // Only look at transactions categorized as Inter-Account
    const transfers = transactions.filter(tx => {
      const cat = (tx.cat || '').toLowerCase();
      return cat.includes('inter-account') || cat === 'inter account' || cat === 'interaccount';
    });
    
    // Group by approximate amount and date to find unmatched transfers
    const unmatchedTransfers = [];
    transfers.forEach(tx => {
      const amount = Math.abs(tx.amount || 0);
      const date = tx.date;
      // Look for a corresponding opposite transfer (±1 day, same amount)
      const hasMatch = transfers.some(other => {
        if (other.id === tx.id) return false;
        if (Math.abs(other.amount || 0) !== amount) return false;
        if ((tx.amount > 0 && other.amount > 0) || (tx.amount < 0 && other.amount < 0)) return false;
        // Check if dates are within 3 days
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
    
    // 4. Miscellaneous items
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
    
    // 4. Expenses not fully proven (claimed > proven)
    const unprovenExpenses = claims.filter(claim => {
      const provenTotal = transactions
        .filter(tx => tx.cat === claim.category && tx.amount < 0)
        .reduce((sum, tx) => sum + Math.abs(tx.amount), 0);
      // Calculate monthly average (assume 3 months if no date info)
      const monthsInData = 3;
      const provenAvg = provenTotal / monthsInData;
      return claim.claimed > 0 && provenAvg < claim.claimed * 0.95; // Less than 95% proven
    });
    if (unprovenExpenses.length > 0) {
      alerts.push({
        id: 'unproven',
        type: 'warning',
        icon: TrendingDown,
        title: 'Unproven Monthly Expense Claims',
        msg: `${unprovenExpenses.length} expense categor${unprovenExpenses.length !== 1 ? 'ies' : 'y'} not fully proven`,
        value: unprovenExpenses.length
      });
    }
    
    // 5. Missing bank statement periods (per account)
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
    
    return alerts;
  }, [transactions, claims]);

  return (
    <div className="p-1.5 overflow-auto h-full custom-scroll bg-slate-50/50">
      <div className="mb-1.5 flex justify-end">
        <button
          onClick={handleLoadClick}
          className="inline-flex items-center gap-1 px-2 py-1 text-[10px] font-bold rounded bg-white text-slate-700 border border-slate-300 shadow-sm hover:bg-slate-50 transition-colors"
        >
          <FolderOpen size={12} />
          Open Case
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept=".r43,.json"
          className="hidden"
          onChange={handleFileChange}
        />
      </div>
      
      {!hasData && (
        <div className="flex flex-col items-center justify-center h-[60vh] text-center">
          <FileStack size={48} className="text-slate-300 mb-2" />
          <h2 className="text-lg font-bold text-slate-700 mb-1">No Data Yet</h2>
          <p className="text-xs text-slate-500 mb-4 max-w-md">
            Click <strong>+</strong> to upload bank statements and financial affidavits, or <strong>Open Case</strong> to load a saved project.
          </p>
        </div>
      )}

      {hasData && (
        <>
          <div className="grid grid-cols-4 gap-1.5 mb-1.5">
            <div className="p-2 rounded-lg border border-slate-100 shadow-sm bg-white border-l-4 border-l-emerald-500">
              <div className="text-[9px] font-bold text-slate-400 uppercase">Income (Proven)</div>
              <div className="text-lg font-mono font-bold text-emerald-600">
                {totalIncome.toLocaleString('en-ZA', { style: 'currency', currency: 'ZAR', maximumFractionDigits: 0 })}
              </div>
              <div className="text-[9px] text-slate-400">
                {transactions.filter(tx => tx && tx.amount > 0).length} tx
              </div>
            </div>
            <div className="p-2 rounded-lg border border-slate-100 shadow-sm bg-white border-l-4 border-l-rose-500">
              <div className="text-[9px] font-bold text-slate-400 uppercase">Expenses (Proven)</div>
              <div className="text-lg font-mono font-bold text-rose-600">
                {totalExpenses.toLocaleString('en-ZA', { style: 'currency', currency: 'ZAR', maximumFractionDigits: 0 })}
              </div>
              <div className="text-[9px] text-rose-400">
                {transactions.filter(tx => tx && tx.amount < 0).length} tx
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
            <div className="p-2 rounded-lg border border-slate-100 shadow-sm bg-white border-l-4 border-l-amber-500">
              <div className="text-[9px] font-bold text-slate-400 uppercase">Deficit</div>
              <div className={`text-lg font-mono font-bold ${deficit < 0 ? 'text-amber-600' : 'text-emerald-600'}`}>
                {deficit.toLocaleString('en-ZA', { style: 'currency', currency: 'ZAR', maximumFractionDigits: 0 })}
              </div>
              <div className={`text-[9px] ${deficit < 0 ? 'text-amber-400' : 'text-emerald-400'}`}>
                {deficit < 0 ? 'Negative' : 'Positive'}
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
                <ClaimsComparisonChart claims={claims} transactions={transactions} />
              </div>
              
              {/* Right: Proof Status Gauge + Category Breakdown */}
              <div className="w-48 flex flex-col gap-2">
                <ProofGauge claims={claims} transactions={transactions} />
                <CategoryBreakdown claims={claims} transactions={transactions} />
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

