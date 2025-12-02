import { useState, useMemo } from 'react';
import { getLatestTransactionDate, filterTransactionsByEntity, filterTransactionsByPeriod, getPeriodMonthsMap } from '../utils/transactionFilters';
import { createClaimsImportHandler } from '../utils/claimsImport';
import DocumentInventory from '../components/DocumentInventory';
import PDFViewer from '../components/PDFViewer';

const ENTITY_FILTERS = ['ALL', 'PERSONAL', 'BUSINESS', 'TRUST', 'SPOUSE', 'CREDIT'];
const DEFAULT_INVENTORY_PANEL_HEIGHTS = {
  files: 34,
  manual: 26,
  table: 40
};

const EvidenceLockerView = ({
  transactions,
  claims,
  files,
  accounts,
  onError,
  setClaims,
  onDeleteFile,
  onAddClaim,
  onDeleteClaim,
  onUpdateClaim,
  onReorderClaim,
  onCreateCategory,
  categories = [],
  inventoryPanelHeights = DEFAULT_INVENTORY_PANEL_HEIGHTS,
  onInventoryPanelHeightsChange
}) => {
  const [filterEntity, setFilterEntity] = useState('ALL');
  const [periodFilter, setPeriodFilter] = useState('3M');
  const periodMonthsMap = getPeriodMonthsMap();
  const monthsInScope = periodMonthsMap[periodFilter] || 1;
  const latestTransactionDate = useMemo(() => getLatestTransactionDate(transactions), [transactions]);

  const scopedTransactions = useMemo(() => {
    const byEntity = filterTransactionsByEntity(transactions, filterEntity, accounts);
    return filterTransactionsByPeriod(byEntity, periodFilter, latestTransactionDate);
  }, [transactions, filterEntity, periodFilter, accounts, latestTransactionDate]);
  const sortedCategories = useMemo(() => {
    return [...categories].sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));
  }, [categories]);

  return (
    <div className="flex flex-col h-full bg-slate-50">
      <div className="h-9 border-b border-slate-200 flex items-center justify-between px-2 bg-white">
        <div>
          <div className="text-[12px] font-bold text-slate-700">Evidence Locker</div>
          <div className="text-[10px] text-slate-500">Golden thread from source to schedule.</div>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="flex bg-slate-200 p-0.5 rounded-md">
            {ENTITY_FILTERS.map((f) => (
              <button 
                key={f} 
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setFilterEntity(f);
                }} 
                className={`px-2.5 py-0.5 text-[10px] font-bold rounded-md transition-all ${filterEntity === f ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
              >
                {f}
              </button>
            ))}
          </div>
          <div className="flex bg-slate-200 p-0.5 rounded-md">
            {['1M', '3M', '6M'].map((p) => (
              <button key={p} onClick={() => setPeriodFilter(p)} className={`px-2.5 py-0.5 text-[10px] font-bold rounded-md transition-all ${periodFilter === p ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>{p}</button>
            ))}
          </div>
        </div>
      </div>
      <div className="flex-1 min-h-0">
        {filterEntity === 'ALL'
          ? (
            <DocumentInventory
              transactions={scopedTransactions}
              periodFilter={periodFilter}
              monthsInScope={monthsInScope}
              files={files}
              claims={claims}
              categories={sortedCategories}
              onImport={createClaimsImportHandler(setClaims, onError)}
              onAddClaim={onAddClaim}
              onDeleteClaim={onDeleteClaim}
              onUpdateClaim={onUpdateClaim}
              onReorderClaim={onReorderClaim}
              onCreateCategory={onCreateCategory}
              onDeleteFile={onDeleteFile}
              panelHeights={inventoryPanelHeights}
              onPanelHeightsChange={onInventoryPanelHeightsChange}
            />
          )
          : <PDFViewer entity={filterEntity} transactions={transactions} activeTxId={null} files={files} accounts={accounts} setClaims={setClaims} />
        }
      </div>
    </div>
  );
};

export default EvidenceLockerView;

