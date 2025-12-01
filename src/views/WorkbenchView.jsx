import { useState, useMemo, useRef, useEffect } from 'react';
import { ArrowUp, ArrowDown, ArrowUpDown, StickyNote } from 'lucide-react';
import { getLatestTransactionDate, filterTransactionsByEntity, filterTransactionsByPeriod, getPeriodMonthsMap } from '../utils/transactionFilters';
import { createClaimsImportHandler } from '../utils/claimsImport';
import DocumentInventory from '../components/DocumentInventory';
import PDFViewer from '../components/PDFViewer';
import NoteModal from '../components/NoteModal';

const WorkbenchView = ({ data, transactions, setTransactions, claims, setClaims, notes, setNotes, onError, onDeleteFile }) => {
  const [filterEntity, setFilterEntity] = useState('ALL');
  const [periodFilter, setPeriodFilter] = useState('1M');
  const [noteModal, setNoteModal] = useState({ isOpen: false, transaction: null });
  const [sortColumn, setSortColumn] = useState('date');
  const [sortDirection, setSortDirection] = useState('desc'); // 'asc' or 'desc'
  const [leftPanelWidth, setLeftPanelWidth] = useState(50); // Percentage
  const [isResizing, setIsResizing] = useState(false);
  const containerRef = useRef(null);
  const periodMonthsMap = getPeriodMonthsMap();
  const monthsInScope = periodMonthsMap[periodFilter] || 1;
  const latestTransactionDate = useMemo(() => getLatestTransactionDate(transactions), [transactions]);

  const handleSort = (column) => {
    if (sortColumn === column) {
      // Toggle direction if clicking same column
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      // New column, default to descending for date/amount, ascending for text
      setSortColumn(column);
      setSortDirection(column === 'date' || column === 'amount' ? 'desc' : 'asc');
    }
  };

  const filteredTx = useMemo(() => {
    let result = filterTransactionsByEntity(transactions, filterEntity, data.accounts);
    result = filterTransactionsByPeriod(result, periodFilter, latestTransactionDate);
    
    // Apply sorting
    const sorted = [...result].sort((a, b) => {
      let aVal, bVal;
      
      switch (sortColumn) {
        case 'date':
          aVal = a.date ? new Date(a.date).getTime() : 0;
          bVal = b.date ? new Date(b.date).getTime() : 0;
          break;
        case 'description':
          aVal = (a.clean || a.desc || '').toLowerCase();
          bVal = (b.clean || b.desc || '').toLowerCase();
          break;
        case 'category':
          aVal = (a.cat || 'Uncategorized').toLowerCase();
          bVal = (b.cat || 'Uncategorized').toLowerCase();
          break;
        case 'amount':
          aVal = a.amount || 0;
          bVal = b.amount || 0;
          break;
        case 'evidence':
          aVal = (a.status || 'pending').toLowerCase();
          bVal = (b.status || 'pending').toLowerCase();
          break;
        default:
          return 0;
      }
      
      if (aVal < bVal) return sortDirection === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });
    
    return sorted;
  }, [transactions, filterEntity, periodFilter, data.accounts, latestTransactionDate, sortColumn, sortDirection]);

  const handleCategoryChange = (id, newCat) => {
    setTransactions(prev => prev.map(t => t.id === id ? { ...t, cat: newCat } : t));
  };

  const handleNoteClick = (tx) => {
    setNoteModal({ isOpen: true, transaction: tx });
  };

  const handleNoteSave = (txId, noteText) => {
    setNotes(prev => {
      const updated = { ...prev };
      if (noteText.trim()) {
        updated[txId] = noteText;
      } else {
        delete updated[txId];
      }
      return updated;
    });
  };

  const evidenceBadge = (status) => {
    if (status === 'proven') return 'bg-emerald-50 text-emerald-700 border border-emerald-100';
    if (status === 'flagged') return 'bg-amber-50 text-amber-700 border border-amber-100';
    return 'bg-slate-100 text-slate-600 border border-slate-200';
  };

  // Handle resizing
  useEffect(() => {
    const handleMouseMove = (e) => {
      if (!isResizing || !containerRef.current) return;
      
      const container = containerRef.current;
      const rect = container.getBoundingClientRect();
      const newLeftPercent = ((e.clientX - rect.left) / rect.width) * 100;
      
      // Constrain between 20% and 80%
      const constrainedPercent = Math.max(20, Math.min(80, newLeftPercent));
      setLeftPanelWidth(constrainedPercent);
    };

    const handleMouseUp = () => {
      setIsResizing(false);
    };

    if (isResizing) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';
      
      return () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
      };
    }
  }, [isResizing]);

  return (
    <div ref={containerRef} className="flex flex-1 h-full overflow-hidden relative">
      <div className="flex flex-col" style={{ width: `${leftPanelWidth}%` }}>
        {filterEntity === 'ALL'
          ? <DocumentInventory transactions={filteredTx} periodFilter={periodFilter} monthsInScope={monthsInScope} files={data.files} claims={claims} onImport={createClaimsImportHandler(setClaims, onError)} setClaims={setClaims} onDeleteFile={onDeleteFile} />
          : <PDFViewer entity={filterEntity} transactions={transactions} activeTxId={null} files={data.files} accounts={data.accounts} setClaims={setClaims} />
        }
      </div>
      <div
        className="w-1 cursor-col-resize bg-slate-300 hover:bg-amber-400 transition-colors relative z-30 flex items-center justify-center group"
        onMouseDown={(e) => {
          e.preventDefault();
          setIsResizing(true);
        }}
      >
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="w-1 h-8 bg-slate-400 group-hover:bg-amber-500 rounded-full transition-colors"></div>
        </div>
      </div>
      <div className="bg-white flex flex-col h-full shadow-xl z-20" style={{ width: `${100 - leftPanelWidth}%` }}>
        <div className="h-12 border-b border-slate-200 flex items-center justify-between px-4 shrink-0 bg-slate-50">
          <div className="flex bg-slate-200 p-0.5 rounded-lg">
            {['ALL', 'PERSONAL', 'BUSINESS', 'TRUST'].map(f => (
              <button 
                key={f} 
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setFilterEntity(f);
                }} 
                className={`px-3 py-1 text-[10px] font-bold rounded-md transition-all ${filterEntity === f ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
              >
                {f}
              </button>
            ))}
          </div>
          <div className="flex bg-slate-200 p-0.5 rounded-lg ml-2">
            {['1M', '3M', '6M'].map(p => (
              <button key={p} onClick={() => setPeriodFilter(p)} className={`px-3 py-1 text-[10px] font-bold rounded-md transition-all ${periodFilter === p ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>{p}</button>
            ))}
          </div>
        </div>
        <div className="flex-1 overflow-auto custom-scroll">
          <div className="grid grid-cols-[80px_1fr_120px_110px_110px_30px] bg-slate-50 border-y border-slate-200 text-[9px] font-bold text-slate-500 uppercase py-2 px-3 sticky top-0 z-10">
            <button
              onClick={() => handleSort('date')}
              className="flex items-center gap-1 hover:text-slate-700 transition-colors text-left"
            >
              Date
              {sortColumn === 'date' ? (
                sortDirection === 'asc' ? <ArrowUp size={10} /> : <ArrowDown size={10} />
              ) : (
                <ArrowUpDown size={10} className="opacity-30" />
              )}
            </button>
            <button
              onClick={() => handleSort('description')}
              className="flex items-center gap-1 hover:text-slate-700 transition-colors text-left"
            >
              Description
              {sortColumn === 'description' ? (
                sortDirection === 'asc' ? <ArrowUp size={10} /> : <ArrowDown size={10} />
              ) : (
                <ArrowUpDown size={10} className="opacity-30" />
              )}
            </button>
            <button
              onClick={() => handleSort('category')}
              className="flex items-center gap-1 hover:text-slate-700 transition-colors text-left"
            >
              Category
              {sortColumn === 'category' ? (
                sortDirection === 'asc' ? <ArrowUp size={10} /> : <ArrowDown size={10} />
              ) : (
                <ArrowUpDown size={10} className="opacity-30" />
              )}
            </button>
            <button
              onClick={() => handleSort('amount')}
              className="flex items-center gap-1 hover:text-slate-700 transition-colors text-right justify-end"
            >
              Amount
              {sortColumn === 'amount' ? (
                sortDirection === 'asc' ? <ArrowUp size={10} /> : <ArrowDown size={10} />
              ) : (
                <ArrowUpDown size={10} className="opacity-30" />
              )}
            </button>
            <button
              onClick={() => handleSort('evidence')}
              className="flex items-center gap-1 hover:text-slate-700 transition-colors text-center justify-center"
            >
              Evidence
              {sortColumn === 'evidence' ? (
                sortDirection === 'asc' ? <ArrowUp size={10} /> : <ArrowDown size={10} />
              ) : (
                <ArrowUpDown size={10} className="opacity-30" />
              )}
            </button>
            <div></div>
          </div>
          {filteredTx.length === 0 ? (
            <div className="flex items-center justify-center h-full text-slate-400 text-sm p-8">
              <div className="text-center">
                <p className="font-semibold">No transactions found</p>
                <p className="text-xs mt-2">Try selecting a different entity filter or time period</p>
              </div>
            </div>
          ) : (
            filteredTx.map(tx => {
              if (!tx || !tx.id) return null;
              const safeClean = tx.clean ? String(tx.clean).replace(/[<>\"'&]/g, '') : '';
              return (
                <div key={tx.id} className="grid grid-cols-[80px_1fr_120px_110px_110px_30px] border-b border-slate-100 py-2.5 px-3 text-xs items-center hover:bg-amber-50 group transition-colors">
                  <div className="font-mono text-slate-500 text-[10px]">{tx.date || ''}</div>
                  <div className="pr-2">
                    <div className="font-bold text-slate-700 truncate">{safeClean}</div>
                  </div>
                <div>
                  <select className={`text-[10px] px-1 py-1 rounded border border-slate-200 w-full outline-none focus:border-amber-400 ${tx.cat === 'Uncategorized' ? 'bg-slate-100 text-slate-500' : 'bg-white text-slate-700 font-medium'}`} value={tx.cat || 'Uncategorized'} onChange={(e) => handleCategoryChange(tx.id, e.target.value)}>
                    {(data.categories || []).map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                  <div className={`font-mono font-bold text-right ${tx.type === 'income' ? 'text-emerald-600' : 'text-slate-700'}`}>
                    {tx.type === 'income' ? '+' : ''}{tx.amount ? Math.abs(tx.amount).toFixed(2) : '0.00'}
                  </div>
                  <div className="flex justify-center">
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold capitalize ${evidenceBadge(tx.status)}`}>
                      {tx.status || 'pending'}
                    </span>
                  </div>
                  <div className="text-center opacity-0 group-hover:opacity-100 transition-opacity relative">
                    <button
                      onClick={() => handleNoteClick(tx)}
                      className={`text-slate-400 hover:text-amber-500 ${notes[tx.id] ? 'text-amber-500 opacity-100' : ''}`}
                      title={notes[tx.id] ? 'Edit note' : 'Add note'}
                    >
                      <StickyNote size={14} />
                    </button>
                    {notes[tx.id] && (
                      <span className="absolute -top-1 -right-1 w-2 h-2 bg-amber-500 rounded-full"></span>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
        <div className="h-10 bg-slate-50 border-t border-slate-200 flex items-center justify-between px-4 text-xs font-bold text-slate-600 shrink-0">
          <span>Total Visible:</span>
          <span className="font-mono">{filteredTx.length > 0 ? filteredTx.reduce((sum, t) => sum + (t.amount || 0), 0).toLocaleString('en-ZA', { style: 'currency', currency: 'ZAR' }) : 'R 0.00'}</span>
        </div>
      </div>
      <NoteModal
        isOpen={noteModal.isOpen}
        onClose={() => setNoteModal({ isOpen: false, transaction: null })}
        transaction={noteModal.transaction}
        note={noteModal.transaction ? notes[noteModal.transaction.id] : ''}
        onSave={handleNoteSave}
      />
    </div>
  );
};

export default WorkbenchView;

