import { useState, useMemo } from 'react';
import { getLatestTransactionDate, filterTransactionsByEntity, filterTransactionsByPeriod, getPeriodMonthsMap } from '../utils/transactionFilters';
import { createClaimsImportHandler } from '../utils/claimsImport';
import DocumentInventory from '../components/DocumentInventory';
import PDFViewer from '../components/PDFViewer';

const EvidenceLockerView = ({ transactions, claims, files, accounts, onError, setClaims, onDeleteFile }) => {
  const [filterEntity, setFilterEntity] = useState('ALL');
  const [periodFilter, setPeriodFilter] = useState('3M');
  const periodMonthsMap = getPeriodMonthsMap();
  const monthsInScope = periodMonthsMap[periodFilter] || 1;
  const latestTransactionDate = useMemo(() => getLatestTransactionDate(transactions), [transactions]);

  const scopedTransactions = useMemo(() => {
    const byEntity = filterTransactionsByEntity(transactions, filterEntity, accounts);
    return filterTransactionsByPeriod(byEntity, periodFilter, latestTransactionDate);
  }, [transactions, filterEntity, periodFilter, accounts, latestTransactionDate]);

  return (
    <div className="flex flex-col h-full bg-slate-50">
      <div className="h-12 border-b border-slate-200 flex items-center justify-between px-6 bg-white">
        <div>
          <div className="text-sm font-bold text-slate-700">Evidence Locker</div>
          <div className="text-[11px] text-slate-500">Trace the Golden Thread between source, data, and claims.</div>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex bg-slate-200 p-0.5 rounded-lg">
            {['ALL', 'PERSONAL', 'BUSINESS', 'CREDIT'].map((f) => (
              <button key={f} onClick={() => setFilterEntity(f)} className={`px-3 py-1 text-[10px] font-bold rounded-md transition-all ${filterEntity === f ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>{f}</button>
            ))}
          </div>
          <div className="flex bg-slate-200 p-0.5 rounded-lg">
            {['1M', '3M', '6M'].map((p) => (
              <button key={p} onClick={() => setPeriodFilter(p)} className={`px-3 py-1 text-[10px] font-bold rounded-md transition-all ${periodFilter === p ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>{p}</button>
            ))}
          </div>
        </div>
      </div>
      <div className="flex-1 min-h-0">
        {filterEntity === 'ALL'
          ? <DocumentInventory transactions={scopedTransactions} periodFilter={periodFilter} monthsInScope={monthsInScope} files={files} claims={claims} onImport={createClaimsImportHandler(setClaims, onError)} setClaims={setClaims} onDeleteFile={onDeleteFile} />
          : <PDFViewer entity={filterEntity} transactions={transactions} activeTxId={null} files={files} accounts={accounts} setClaims={setClaims} />
        }
      </div>
    </div>
  );
};

export default EvidenceLockerView;

