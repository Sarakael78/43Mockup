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
    <div className="p-3 overflow-auto h-full custom-scroll bg-slate-50/50">
      <div className="mb-3 flex justify-end">
        <button
          onClick={handleLoadClick}
          className="inline-flex items-center gap-2 px-3 py-1.5 text-xs font-bold rounded-md bg-white text-slate-700 border border-slate-300 shadow-sm hover:bg-slate-50 transition-colors"
        >
          <FolderOpen size={16} />
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
          <FileStack size={64} className="text-slate-300 mb-4" />
          <h2 className="text-xl font-bold text-slate-700 mb-2">No Data Yet</h2>
          <p className="text-sm text-slate-500 mb-6 max-w-md">
            Get started by clicking the <strong>+</strong> button in the sidebar to upload bank statements and financial affidavits,<br />
            or use the <strong>Open Case</strong> button above to load a saved project file.
          </p>
        </div>
      )}

      {hasData && (
        <>
          <div className="grid grid-cols-4 gap-3 mb-3">
            <div className="p-3 rounded-xl border border-slate-100 shadow-sm bg-white border-l-4 border-l-emerald-500">
              <div className="text-xs font-bold text-slate-400 uppercase">Income (Proven)</div>
              <div className="text-2xl font-mono font-bold text-emerald-600">
                {totalIncome.toLocaleString('en-ZA', { style: 'currency', currency: 'ZAR', maximumFractionDigits: 0 })}
              </div>
              <div className="text-[10px] text-slate-400 mt-1">
                {transactions.filter(tx => tx && tx.amount > 0).length} transactions
              </div>
            </div>
            <div className="p-3 rounded-xl border border-slate-100 shadow-sm bg-white border-l-4 border-l-rose-500">
              <div className="text-xs font-bold text-slate-400 uppercase">Expenses (Proven)</div>
              <div className="text-2xl font-mono font-bold text-rose-600">
                {totalExpenses.toLocaleString('en-ZA', { style: 'currency', currency: 'ZAR', maximumFractionDigits: 0 })}
              </div>
              <div className="text-[10px] text-rose-400 mt-1">
                {transactions.filter(tx => tx && tx.amount < 0).length} transactions
              </div>
            </div>
            <div className="p-3 rounded-xl border border-slate-100 shadow-sm bg-white border-l-4 border-l-slate-500">
              <div className="text-xs font-bold text-slate-400 uppercase">Claimed Needs (KPR8)</div>
              <div className="text-2xl font-mono font-bold text-slate-600">
                {totalClaimed.toLocaleString('en-ZA', { style: 'currency', currency: 'ZAR', maximumFractionDigits: 0 })}
              </div>
              <div className="text-[10px] text-slate-400 mt-1">
                {claims.length} claim{claims.length !== 1 ? 's' : ''}
              </div>
            </div>
            <div className="p-3 rounded-xl border border-slate-100 shadow-sm bg-white border-l-4 border-l-amber-500">
              <div className="text-xs font-bold text-slate-400 uppercase">Deficit (Actual)</div>
              <div className={`text-2xl font-mono font-bold ${deficit < 0 ? 'text-amber-600' : 'text-emerald-600'}`}>
                {deficit.toLocaleString('en-ZA', { style: 'currency', currency: 'ZAR', maximumFractionDigits: 0 })}
              </div>
              <div className={`text-[10px] mt-1 ${deficit < 0 ? 'text-amber-400' : 'text-emerald-400'}`}>
                {deficit < 0 ? 'Negative balance' : 'Positive balance'}
              </div>
            </div>
          </div>
        </>
      )}

      {hasData && (
        <div className="grid grid-cols-3 gap-3 h-[320px]">
          <div className="col-span-2 bg-white p-3 rounded-xl border border-slate-200 shadow-sm flex flex-col">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-bold text-slate-700">Financial Trend</h3>
            </div>
            <div className="flex-1 w-full min-h-0">
              {data.charts && data.charts.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={data.charts}>
                    <XAxis dataKey="name" fontSize={10} axisLine={false} tickLine={false} />
                    <YAxis fontSize={10} axisLine={false} tickLine={false} tickFormatter={(val) => `R${val/1000}k`} />
                    <Tooltip cursor={{ fill: '#f1f5f9' }} formatter={(value) => `R ${value.toLocaleString()}`} />
                    <Bar dataKey="income" name="Income" fill="#10b981" radius={[4, 4, 0, 0]} barSize={20} />
                    <Bar dataKey="expense" name="Expenses" fill="#f43f5e" radius={[4, 4, 0, 0]} barSize={20} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex items-center justify-center h-full text-slate-400 text-sm">
                  No chart data available. Chart data will appear when you have sufficient transaction history.
                </div>
              )}
            </div>
          </div>

          <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-sm overflow-auto custom-scroll">
            <h3 className="font-bold text-slate-700 mb-3 flex items-center gap-2">
              <Bell className="text-slate-400" size={16} />
              Forensic Alerts
            </h3>
            {data.alerts && data.alerts.length > 0 ? (
              data.alerts.map(alert => (
                <div key={alert.id} className={`flex items-start p-3 rounded-lg border mb-3 ${alert.type === 'critical' ? 'bg-rose-50 border-rose-100' : 'bg-amber-50 border-amber-100'}`}>
                  <div className={`mt-0.5 mr-3 ${alert.type === 'critical' ? 'text-rose-500' : 'text-amber-500'}`}>
                    {alert.type === 'critical' ? <AlertCircle size={14} /> : <AlertTriangle size={14} />}
                  </div>
                  <div className="flex-1">
                    <h4 className={`text-xs font-bold ${alert.type === 'critical' ? 'text-rose-800' : 'text-amber-800'}`}>{alert.title}</h4>
                    <p className={`text-[10px] mt-1 ${alert.type === 'critical' ? 'text-rose-600' : 'text-amber-700'}`}>{alert.msg}</p>
                  </div>
                  <div className={`text-xs font-bold font-mono ${alert.type === 'critical' ? 'text-rose-700' : 'text-amber-700'}`}>
                    {alert.value}
                  </div>
                </div>
              ))
            ) : (
              <div className="text-center text-slate-400 text-sm py-8">
                No alerts. Alerts will appear when anomalies are detected in your data.
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default DashboardView;

