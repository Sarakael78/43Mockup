import { useRef, useMemo } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { FileStack, FolderOpen, Bell, AlertCircle, AlertTriangle, Flag, HelpCircle, FileQuestion, TrendingDown, Calendar, ArrowLeftRight } from 'lucide-react';

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
    
    // 3. Miscellaneous items
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
        title: 'Unproven Expenses',
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
    
    // 6. Inter-account transfers without corresponding entry
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
              <div className="text-[9px] font-bold text-slate-400 uppercase">Claimed (KPR8)</div>
              <div className="text-lg font-mono font-bold text-slate-600">
                {totalClaimed.toLocaleString('en-ZA', { style: 'currency', currency: 'ZAR', maximumFractionDigits: 0 })}
              </div>
              <div className="text-[9px] text-slate-400">
                {claims.length} claim{claims.length !== 1 ? 's' : ''}
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
              <h3 className="text-xs font-bold text-slate-700">Financial Trend</h3>
            </div>
            <div className="flex-1 w-full min-h-0">
              {data.charts && data.charts.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={data.charts}>
                    <XAxis dataKey="name" fontSize={9} axisLine={false} tickLine={false} />
                    <YAxis fontSize={9} axisLine={false} tickLine={false} tickFormatter={(val) => `R${val/1000}k`} />
                    <Tooltip cursor={{ fill: '#f1f5f9' }} formatter={(value) => `R ${value.toLocaleString()}`} />
                    <Bar dataKey="income" name="Income" fill="#10b981" radius={[2, 2, 0, 0]} barSize={16} />
                    <Bar dataKey="expense" name="Expenses" fill="#f43f5e" radius={[2, 2, 0, 0]} barSize={16} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex items-center justify-center h-full text-slate-400 text-xs">
                  No chart data. Charts appear with sufficient transaction history.
                </div>
              )}
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

