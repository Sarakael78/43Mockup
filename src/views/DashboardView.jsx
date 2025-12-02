import { useRef } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { FileStack, FolderOpen, Bell, AlertCircle, AlertTriangle } from 'lucide-react';

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
            </h3>
            <div className="flex-1 overflow-auto">
              {data.alerts && data.alerts.length > 0 ? (
                data.alerts.map(alert => (
                  <div key={alert.id} className={`flex items-start p-1.5 rounded border mb-1.5 ${alert.type === 'critical' ? 'bg-rose-50 border-rose-100' : 'bg-amber-50 border-amber-100'}`}>
                    <div className={`mt-0.5 mr-1.5 ${alert.type === 'critical' ? 'text-rose-500' : 'text-amber-500'}`}>
                      {alert.type === 'critical' ? <AlertCircle size={12} /> : <AlertTriangle size={12} />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className={`text-[10px] font-bold ${alert.type === 'critical' ? 'text-rose-800' : 'text-amber-800'}`}>{alert.title}</h4>
                      <p className={`text-[9px] ${alert.type === 'critical' ? 'text-rose-600' : 'text-amber-700'}`}>{alert.msg}</p>
                    </div>
                    <div className={`text-[10px] font-bold font-mono shrink-0 ${alert.type === 'critical' ? 'text-rose-700' : 'text-amber-700'}`}>
                      {alert.value}
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center text-slate-400 text-xs py-4">
                  No alerts detected.
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

