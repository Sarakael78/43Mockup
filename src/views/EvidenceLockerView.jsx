import { useState, useMemo } from 'react';
import { getLatestTransactionDate, filterTransactionsByEntity, filterTransactionsByPeriod, getPeriodMonthsMap } from '../utils/transactionFilters';
import { createClaimsImportHandler } from '../utils/claimsImport';
import DocumentInventory from '../components/DocumentInventory';
import PDFViewer from '../components/PDFViewer';

const ENTITY_FILTERS = ['ALL', 'PERSONAL', 'BUSINESS', 'TRUST', 'CREDIT'];
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
  onUpdateFile,
  onAddClaim,
  onDeleteClaim,
  onUpdateClaim,
  onReorderClaim,
  onCreateCategory,
  setCategories,
  categories = [],
  inventoryPanelHeights = DEFAULT_INVENTORY_PANEL_HEIGHTS,
  onInventoryPanelHeightsChange,
  proofPeriod = '6M'
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
      <div className="h-7 border-b border-slate-200 flex items-center justify-between px-1.5 bg-white">
        <div className="flex items-center gap-1.5">
          <div className="text-[10px] font-bold text-slate-700">Evidence Locker</div>
          <span className="text-[9px] text-slate-400">|</span>
          <div className="text-[9px] text-slate-500">Source to schedule</div>
        </div>
        <div className="flex items-center gap-1">
          <div className="flex bg-slate-200 p-0.5 rounded">
            {ENTITY_FILTERS.map((f) => (
              <button 
                key={f} 
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setFilterEntity(f);
                }} 
                className={`px-1.5 py-0 text-[9px] font-bold rounded transition-all ${filterEntity === f ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
              >
                {f}
              </button>
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
              onImport={createClaimsImportHandler(setClaims, onError, onCreateCategory, setCategories)}
              onAddClaim={onAddClaim}
              onDeleteClaim={onDeleteClaim}
              onUpdateClaim={onUpdateClaim}
              onReorderClaim={onReorderClaim}
              onCreateCategory={onCreateCategory}
              onDeleteFile={onDeleteFile}
              onUpdateFile={onUpdateFile}
              panelHeights={inventoryPanelHeights}
              onPanelHeightsChange={onInventoryPanelHeightsChange}
              showClaimsTable={false}
              proofPeriod={proofPeriod}
            />
          )
          : <PDFViewer entity={filterEntity} transactions={transactions} activeTxId={null} files={files} accounts={accounts} setClaims={setClaims} />
        }
      </div>
    </div>
  );
};

export default EvidenceLockerView;

