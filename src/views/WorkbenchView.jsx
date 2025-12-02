import { useState, useMemo, useRef, useEffect } from 'react';
import { ArrowUp, ArrowDown, ArrowUpDown, StickyNote, Flag } from 'lucide-react';
import { getLatestTransactionDate, filterTransactionsByEntity, filterTransactionsByPeriod, getPeriodMonthsMap } from '../utils/transactionFilters';
import { createClaimsImportHandler } from '../utils/claimsImport';
import DocumentInventory from '../components/DocumentInventory';
import PDFViewer from '../components/PDFViewer';
import NoteModal from '../components/NoteModal';

const ENTITY_FILTERS = ['ALL', 'PERSONAL', 'BUSINESS', 'TRUST', 'SPOUSE', 'CREDIT'];
const DEFAULT_RIGHT_PANEL_HEIGHTS = {
  filters: 12,
  table: 78,
  footer: 10
};
const DEFAULT_INVENTORY_PANEL_HEIGHTS = {
  files: 34,
  manual: 26,
  table: 40
};
const EVIDENCE_STATUS_OPTIONS = [
  { value: 'pending', label: 'Pending' },
  { value: 'confirmed', label: 'Confirmed' },
  { value: 'rejected', label: 'Rejected' }
];

// Default column widths for transactions table (right panel)
const DEFAULT_TX_COLUMN_WIDTHS = {
  checkbox: 24,
  date: 70,
  description: 200,
  category: 100,
  amount: 80,
  evidence: 75,
  flag: 24,
  notes: 24
};

const WorkbenchView = ({
  data,
  transactions,
  setTransactions,
  claims,
  setClaims,
  notes,
  setNotes,
  onError,
  onDeleteFile,
  onAddClaim,
  onDeleteClaim,
  onUpdateClaim,
  onReorderClaim,
  onCreateCategory,
  setCategories,
  onUpdateTransactionStatus,
  inventoryPanelHeights = DEFAULT_INVENTORY_PANEL_HEIGHTS,
  onInventoryPanelHeightsChange,
  leftPanelWidth = 50,
  onLeftPanelWidthChange,
  rightPanelHeights = DEFAULT_RIGHT_PANEL_HEIGHTS,
  onRightPanelHeightsChange
}) => {
  const [filterEntity, setFilterEntity] = useState('ALL');
  const [periodFilter, setPeriodFilter] = useState('1M');
  const [noteModal, setNoteModal] = useState({ isOpen: false, transaction: null });
  const [sortColumn, setSortColumn] = useState('date');
  const [sortDirection, setSortDirection] = useState('desc'); // 'asc' or 'desc'
  const [isResizing, setIsResizing] = useState(false);
  const containerRef = useRef(null);
  const [rightDragState, setRightDragState] = useState(null);
  const rightContainerRef = useRef(null);
  const [internalLeftWidth, setInternalLeftWidth] = useState(leftPanelWidth);
  const [internalRightHeights, setInternalRightHeights] = useState(rightPanelHeights);
  const [txColumnWidths, setTxColumnWidths] = useState(DEFAULT_TX_COLUMN_WIDTHS);
  const [colResizeState, setColResizeState] = useState(null);
  const tableRef = useRef(null);
  const periodMonthsMap = getPeriodMonthsMap();
  const monthsInScope = periodMonthsMap[periodFilter] || 1;
  const latestTransactionDate = useMemo(() => getLatestTransactionDate(transactions), [transactions]);
  const sortedCategories = useMemo(() => {
    const list = data.categories || [];
    return [...list].sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));
  }, [data.categories]);
  const [focusedCategory, setFocusedCategory] = useState(null);
  const [selectedTxIds, setSelectedTxIds] = useState(new Set());
  const [selectionAnchor, setSelectionAnchor] = useState(null); // For shift+click range selection
  const [descriptionSearch, setDescriptionSearch] = useState('');
  const currentLeftPanelWidth = onLeftPanelWidthChange ? leftPanelWidth : internalLeftWidth;
  const currentRightPanelHeights = onRightPanelHeightsChange ? rightPanelHeights : internalRightHeights;

  useEffect(() => {
    setInternalLeftWidth(leftPanelWidth);
  }, [leftPanelWidth]);

  useEffect(() => {
    setInternalRightHeights(rightPanelHeights);
  }, [rightPanelHeights]);

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
    
    // Apply description search filter
    if (descriptionSearch.trim()) {
      const searchLower = descriptionSearch.toLowerCase().trim();
      result = result.filter(tx => {
        const desc = (tx.clean || tx.desc || '').toLowerCase();
        return desc.includes(searchLower);
      });
    }
    
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
  }, [transactions, filterEntity, periodFilter, data.accounts, latestTransactionDate, sortColumn, sortDirection, descriptionSearch]);
  const normalizedFocusedCategory = focusedCategory ? focusedCategory.toLowerCase() : null;
  const displayedTx = useMemo(() => {
    if (!normalizedFocusedCategory) return filteredTx;
    return filteredTx.filter(tx => (tx.cat || '').toLowerCase() === normalizedFocusedCategory);
  }, [filteredTx, normalizedFocusedCategory]);

  const handleCategoryChange = (id, newCat) => {
    // If this transaction is selected and there are multiple selections, update all selected
    if (selectedTxIds.has(id) && selectedTxIds.size > 1) {
      setTransactions(prev => prev.map(t => 
        selectedTxIds.has(t.id) ? { ...t, cat: newCat } : t
      ));
    } else {
      // Just update the single transaction
      setTransactions(prev => prev.map(t => t.id === id ? { ...t, cat: newCat } : t));
    }
  };

  const handleStatusChange = (id, newStatus) => {
    // If this transaction is selected and there are multiple selections, update all selected
    if (selectedTxIds.has(id) && selectedTxIds.size > 1) {
      setTransactions(prev => prev.map(t => 
        selectedTxIds.has(t.id) ? { ...t, status: newStatus } : t
      ));
    } else {
      // Just update the single transaction
      if (onUpdateTransactionStatus) {
        onUpdateTransactionStatus(id, newStatus);
      }
    }
  };

  const handleTxSelect = (id, e) => {
    const displayedIds = displayedTx.map(tx => tx.id);
    
    if (e.shiftKey && selectionAnchor !== null) {
      // Shift-click: select range from anchor to clicked item
      const anchorIdx = displayedIds.indexOf(selectionAnchor);
      const currentIdx = displayedIds.indexOf(id);
      if (anchorIdx !== -1 && currentIdx !== -1) {
        const start = Math.min(anchorIdx, currentIdx);
        const end = Math.max(anchorIdx, currentIdx);
        const rangeIds = displayedIds.slice(start, end + 1);
        setSelectedTxIds(new Set(rangeIds));
        // Don't change anchor on shift-click
        return;
      }
    }
    
    if (e.ctrlKey || e.metaKey) {
      // Ctrl/Cmd-click: toggle selection, update anchor
      setSelectedTxIds(prev => {
        const newSet = new Set(prev);
        if (newSet.has(id)) {
          newSet.delete(id);
        } else {
          newSet.add(id);
        }
        return newSet;
      });
      setSelectionAnchor(id);
    } else {
      // Regular click: select only this one, set as anchor
      setSelectedTxIds(prev => {
        if (prev.size === 1 && prev.has(id)) {
          setSelectionAnchor(null);
          return new Set(); // Deselect
        }
        return new Set([id]);
      });
      setSelectionAnchor(id);
    }
  };

  const handleSelectAll = () => {
    if (selectedTxIds.size === displayedTx.length) {
      setSelectedTxIds(new Set());
    } else {
      setSelectedTxIds(new Set(displayedTx.map(tx => tx.id)));
    }
  };

  const handleFocusClaim = (category) => {
    const normalized = (category || '').trim();
    if (!normalized) return;
    setFocusedCategory(prev => prev && prev.toLowerCase() === normalized.toLowerCase() ? null : normalized);
  };

  const handleClearFocus = () => setFocusedCategory(null);

  const handleNoteClick = (tx) => {
    setNoteModal({ isOpen: true, transaction: tx });
  };

  const handleToggleFlag = (txId) => {
    setTransactions(prev => prev.map(tx => 
      tx.id === txId ? { ...tx, flagged: !tx.flagged } : tx
    ));
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

  const normalizeStatusValue = (value) => {
    const normalized = (value || '').toLowerCase();
    if (normalized === 'proven') return 'confirmed';
    if (normalized === 'flagged') return 'rejected';
    if (normalized === 'confirmed' || normalized === 'rejected') return normalized;
    return 'pending';
  };

  const getStatusSelectClasses = (status) => {
    const normalized = normalizeStatusValue(status);
    if (normalized === 'confirmed') return 'bg-emerald-50 text-emerald-700 border-emerald-200';
    if (normalized === 'rejected') return 'bg-rose-50 text-rose-700 border-rose-200';
    return 'bg-slate-50 text-slate-600 border-slate-200';
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
      if (onLeftPanelWidthChange) {
        onLeftPanelWidthChange(constrainedPercent);
      } else {
        setInternalLeftWidth(constrainedPercent);
      }
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
  }, [isResizing, onLeftPanelWidthChange]);

  const handleRightDragStart = (type, event) => {
    event.preventDefault();
    setRightDragState({
      type,
      startY: event.clientY,
      initial: rightPanelHeights
    });
  };

  useEffect(() => {
    if (!rightDragState) return;

    const handleMouseMove = (event) => {
      const container = rightContainerRef.current;
      if (!container) return;
      const rect = container.getBoundingClientRect();
      if (!rect.height) return;

      const deltaPercent = ((event.clientY - rightDragState.startY) / rect.height) * 100;
      const MIN_SECTION = 10;

      if (rightDragState.type === 'filters-table') {
        const remaining = 100 - rightDragState.initial.footer;
        let newFilters = rightDragState.initial.filters + deltaPercent;
        newFilters = Math.max(MIN_SECTION, Math.min(newFilters, remaining - MIN_SECTION));
        const newTable = remaining - newFilters;
        const next = {
          filters: newFilters,
          table: newTable,
          footer: currentRightPanelHeights.footer
        };
        if (onRightPanelHeightsChange) {
          onRightPanelHeightsChange(next);
        } else {
          setInternalRightHeights(next);
        }
      } else if (rightDragState.type === 'table-footer') {
        const remaining = 100 - rightDragState.initial.filters;
        let newTable = rightDragState.initial.table + deltaPercent;
        newTable = Math.max(MIN_SECTION, Math.min(newTable, remaining - MIN_SECTION));
        const newFooter = remaining - newTable;
        const next = {
          filters: currentRightPanelHeights.filters,
          table: newTable,
          footer: newFooter
        };
        if (onRightPanelHeightsChange) {
          onRightPanelHeightsChange(next);
        } else {
          setInternalRightHeights(next);
        }
      }
    };

    const handleMouseUp = () => setRightDragState(null);

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    document.body.style.cursor = 'row-resize';
    document.body.style.userSelect = 'none';

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
  }, [rightDragState, rightPanelHeights, onRightPanelHeightsChange]);

  // Column resize handling for transaction table
  const handleColResizeStart = (columnKey, e) => {
    e.preventDefault();
    setColResizeState({
      column: columnKey,
      startX: e.clientX,
      startWidth: txColumnWidths[columnKey]
    });
  };

  useEffect(() => {
    if (!colResizeState) return;

    const handleMouseMove = (e) => {
      const delta = e.clientX - colResizeState.startX;
      const newWidth = Math.max(30, colResizeState.startWidth + delta);
      setTxColumnWidths(prev => ({
        ...prev,
        [colResizeState.column]: newWidth
      }));
    };

    const handleMouseUp = () => setColResizeState(null);

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
  }, [colResizeState]);

  // Generate grid template from column widths
  const txGridTemplate = `${txColumnWidths.checkbox}px ${txColumnWidths.date}px 1fr ${txColumnWidths.category}px ${txColumnWidths.amount}px ${txColumnWidths.evidence}px ${txColumnWidths.flag}px ${txColumnWidths.notes}px`;

  return (
    <div ref={containerRef} className="flex flex-1 h-full overflow-hidden relative">
      <div className="flex flex-col" style={{ width: `${currentLeftPanelWidth}%` }}>
        {filterEntity === 'ALL'
          ? (
            <DocumentInventory
              transactions={transactions}
              periodFilter="1M"
              monthsInScope={1}
              files={data.files}
              claims={claims}
              categories={sortedCategories}
              onImport={createClaimsImportHandler(setClaims, onError, onCreateCategory, setCategories)}
              onAddClaim={onAddClaim}
              onDeleteClaim={onDeleteClaim}
              onUpdateClaim={onUpdateClaim}
              onReorderClaim={onReorderClaim}
              onCreateCategory={onCreateCategory}
              onDeleteFile={onDeleteFile}
              panelHeights={inventoryPanelHeights}
              onPanelHeightsChange={onInventoryPanelHeightsChange}
              focusedCategory={focusedCategory}
              onFocusClaim={handleFocusClaim}
              showFilesPanel={false}
              showHeader={false}
              showManualEntry={false}
            />
          )
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
      <div className="bg-white flex flex-col h-full shadow-xl z-20" style={{ width: `${100 - currentLeftPanelWidth}%` }}>
        <div ref={rightContainerRef} className="flex flex-col h-full">
          <div className="border-b border-slate-200 bg-slate-50" style={{ height: `${currentRightPanelHeights.filters}%` }}>
            <div className="h-full px-1 py-0.5 flex flex-col gap-0.5 overflow-auto">
              <div className="flex flex-wrap gap-0.5 bg-slate-200 p-0.5 rounded w-fit">
                {ENTITY_FILTERS.map(f => (
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
              <div className="flex bg-slate-200 p-0.5 rounded w-fit">
                {['1M', '3M', '6M'].map(p => (
                  <button key={p} onClick={() => setPeriodFilter(p)} className={`px-1.5 py-0 text-[9px] font-bold rounded transition-all ${periodFilter === p ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>{p}</button>
                ))}
              </div>
              <div className="flex items-center gap-1 flex-1">
                <input
                  type="text"
                  value={descriptionSearch}
                  onChange={(e) => setDescriptionSearch(e.target.value)}
                  placeholder="Search description..."
                  className="flex-1 max-w-xs text-[9px] px-1.5 py-0.5 border border-slate-200 rounded bg-white focus:outline-none focus:ring-1 focus:ring-amber-400 focus:border-amber-400"
                />
                {descriptionSearch && (
                  <button
                    onClick={() => setDescriptionSearch('')}
                    className="text-[9px] text-slate-400 hover:text-slate-600 px-1"
                    title="Clear search"
                  >
                    ×
                  </button>
                )}
              </div>
            </div>
          </div>
          <div
            className="h-1 bg-slate-300 hover:bg-amber-400 cursor-row-resize transition-colors"
            onMouseDown={(e) => handleRightDragStart('filters-table', e)}
          />
          <div className="flex flex-col overflow-hidden" style={{ height: `${currentRightPanelHeights.table}%` }}>
            <div 
              className="flex-1 overflow-auto custom-scroll"
              onClick={(e) => {
                // Clear focus and selection when clicking on whitespace (not on rows, buttons, selects, or inputs)
                if (!e.target.closest('.transaction-row') && !e.target.closest('button') && !e.target.closest('select') && !e.target.closest('th') && !e.target.closest('input')) {
                  handleClearFocus();
                  setSelectedTxIds(new Set());
                  setSelectionAnchor(null);
                }
              }}
            >
              {focusedCategory && (
                <div className="px-1 py-0.5 text-[9px] bg-amber-50 border-b border-amber-100 flex items-center justify-between text-amber-800">
                  <span>
                    Linked to <span className="font-semibold">{focusedCategory}</span>
                  </span>
                  <button
                    type="button"
                    onClick={handleClearFocus}
                    className="text-[9px] font-bold px-1 py-0 rounded border border-amber-200 hover:bg-amber-100 transition-colors"
                  >
                    ×
                  </button>
                </div>
              )}
              {selectedTxIds.size > 1 && (
                <div className="px-1.5 py-1 text-[9px] bg-blue-50 border-b border-blue-100 flex items-center justify-between text-blue-800">
                  <span>
                    <span className="font-bold">{selectedTxIds.size}</span> items selected
                    <span className="text-blue-500 ml-2">(Change category on any to update all)</span>
                  </span>
                  <button
                    type="button"
                    onClick={() => { setSelectedTxIds(new Set()); setSelectionAnchor(null); }}
                    className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-blue-100 hover:bg-blue-200 transition-colors"
                  >
                    Clear selection
                  </button>
                </div>
              )}
              <div ref={tableRef} className="grid bg-slate-50 border-y border-slate-200 text-[7px] font-bold text-slate-500 uppercase tracking-wide py-0.5 px-1 sticky top-0 z-10" style={{ gridTemplateColumns: txGridTemplate }}>
                <div className="flex items-center justify-center">
                  <input
                    type="checkbox"
                    checked={displayedTx.length > 0 && selectedTxIds.size === displayedTx.length}
                    onChange={handleSelectAll}
                    className="w-3 h-3 rounded border-slate-300 text-amber-500 focus:ring-amber-400 cursor-pointer"
                    title="Select all"
                  />
                </div>
                <div className="flex items-center relative">
                  <button
                    onClick={() => handleSort('date')}
                    className="flex items-center gap-1 hover:text-slate-700 transition-colors text-left flex-1"
                  >
                    Date
                    {sortColumn === 'date' ? (
                      sortDirection === 'asc' ? <ArrowUp size={10} /> : <ArrowDown size={10} />
                    ) : (
                      <ArrowUpDown size={10} className="opacity-30" />
                    )}
                  </button>
                  <div
                    className="absolute right-0 top-0 bottom-0 w-2 cursor-col-resize hover:bg-amber-400 transition-colors"
                    onMouseDown={(e) => handleColResizeStart('date', e)}
                  />
                </div>
                <div className="flex items-center relative">
                  <button
                    onClick={() => handleSort('description')}
                    className="flex items-center gap-1 hover:text-slate-700 transition-colors text-left flex-1"
                  >
                    Description
                    {sortColumn === 'description' ? (
                      sortDirection === 'asc' ? <ArrowUp size={10} /> : <ArrowDown size={10} />
                    ) : (
                      <ArrowUpDown size={10} className="opacity-30" />
                    )}
                  </button>
                </div>
                <div className="flex items-center relative">
                  <button
                    onClick={() => handleSort('category')}
                    className="flex items-center gap-1 hover:text-slate-700 transition-colors text-left flex-1"
                  >
                    Category
                    {sortColumn === 'category' ? (
                      sortDirection === 'asc' ? <ArrowUp size={10} /> : <ArrowDown size={10} />
                    ) : (
                      <ArrowUpDown size={10} className="opacity-30" />
                    )}
                  </button>
                  <div
                    className="absolute right-0 top-0 bottom-0 w-2 cursor-col-resize hover:bg-amber-400 transition-colors"
                    onMouseDown={(e) => handleColResizeStart('category', e)}
                  />
                </div>
                <div className="flex items-center relative">
                  <button
                    onClick={() => handleSort('amount')}
                    className="flex items-center gap-1 hover:text-slate-700 transition-colors text-right justify-end flex-1"
                  >
                    Amount
                    {sortColumn === 'amount' ? (
                      sortDirection === 'asc' ? <ArrowUp size={10} /> : <ArrowDown size={10} />
                    ) : (
                      <ArrowUpDown size={10} className="opacity-30" />
                    )}
                  </button>
                  <div
                    className="absolute right-0 top-0 bottom-0 w-2 cursor-col-resize hover:bg-amber-400 transition-colors"
                    onMouseDown={(e) => handleColResizeStart('amount', e)}
                  />
                </div>
                <div className="flex items-center relative">
                  <button
                    onClick={() => handleSort('evidence')}
                    className="flex items-center gap-1 hover:text-slate-700 transition-colors text-center justify-center flex-1"
                  >
                    Evidence
                    {sortColumn === 'evidence' ? (
                      sortDirection === 'asc' ? <ArrowUp size={10} /> : <ArrowDown size={10} />
                    ) : (
                      <ArrowUpDown size={10} className="opacity-30" />
                    )}
                  </button>
                  <div
                    className="absolute right-0 top-0 bottom-0 w-2 cursor-col-resize hover:bg-amber-400 transition-colors"
                    onMouseDown={(e) => handleColResizeStart('evidence', e)}
                  />
                </div>
                <div className="text-center text-[7px]" title="Flag suspicious transactions">
                  <Flag size={10} className="inline-block text-slate-400" />
                </div>
                <div className="text-center text-[7px]"></div>
              </div>
              {displayedTx.length === 0 ? (
                <div className="flex items-center justify-center h-full text-slate-400 text-xs p-2">
                  <div className="text-center">
                    <p className="font-semibold text-[11px]">No transactions</p>
                    <p className="text-[9px] mt-0.5">
                      {focusedCategory
                        ? `No lines for ${focusedCategory}`
                        : 'Try different filters'}
                    </p>
                  </div>
                </div>
              ) : (
                displayedTx.map(tx => {
                  if (!tx || !tx.id) return null;
                  const safeClean = tx.clean ? String(tx.clean).replace(/[<>\"'&]/g, '') : '';
                  const normalizedStatus = normalizeStatusValue(tx.status);
                  const statusLabel = EVIDENCE_STATUS_OPTIONS.find(opt => opt.value === normalizedStatus)?.label || 'Pending';
                  const isSelected = selectedTxIds.has(tx.id);
                  return (
                    <div 
                      key={tx.id} 
                      className={`transaction-row grid border-b py-0.5 px-1 text-[9px] items-center group transition-colors cursor-pointer ${tx.flagged ? 'bg-rose-50 border-rose-200' : 'border-slate-100'} ${isSelected ? 'bg-amber-100 hover:bg-amber-150' : tx.flagged ? 'hover:bg-rose-100' : 'hover:bg-amber-50'}`} 
                      style={{ gridTemplateColumns: txGridTemplate }}
                      onClick={(e) => {
                        // Don't trigger selection when clicking on interactive elements
                        if (!e.target.closest('select') && !e.target.closest('button') && !e.target.closest('input')) {
                          handleTxSelect(tx.id, e);
                        }
                      }}
                    >
                      <div className="flex items-center justify-center" onClick={(e) => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={(e) => handleTxSelect(tx.id, { ctrlKey: true, metaKey: false, shiftKey: false })}
                          className="w-3 h-3 rounded border-slate-300 text-amber-500 focus:ring-amber-400 cursor-pointer"
                        />
                      </div>
                      <div className="font-mono text-slate-500 text-[8px]">{tx.date || ''}</div>
                      <div className="pr-1">
                        <div className="font-bold text-slate-700 truncate text-[9px]">{safeClean}</div>
                      </div>
                      <div>
                        <select 
                          className={`text-[8px] px-0.5 py-0 rounded border border-slate-200 w-full outline-none focus:border-amber-400 ${tx.cat === 'Uncategorized' || !tx.cat ? 'bg-slate-100 text-slate-500' : 'bg-white text-slate-700 font-medium'}`} 
                          value={tx.cat || 'Uncategorized'} 
                          onChange={(e) => handleCategoryChange(tx.id, e.target.value)}
                        >
                          {sortedCategories.map(c => <option key={c} value={c}>{c}</option>)}
                        </select>
                      </div>
                      <div className={`font-mono font-bold text-right text-[9px] ${tx.type === 'income' ? 'text-emerald-600' : 'text-slate-700'}`}>
                        {tx.type === 'income' ? '+' : ''}{tx.amount ? Math.abs(tx.amount).toFixed(2) : '0.00'}
                      </div>
                      <div className="flex items-center justify-center">
                        {onUpdateTransactionStatus ? (
                          <select
                            value={normalizedStatus}
                            onChange={(e) => handleStatusChange(tx.id, e.target.value)}
                            className={`text-[8px] px-1.5 py-0.5 border rounded-full font-bold cursor-pointer focus:outline-none focus:ring-1 focus:ring-amber-400 appearance-none text-center ${getStatusSelectClasses(normalizedStatus)}`}
                            style={{ minWidth: '65px' }}
                          >
                            {EVIDENCE_STATUS_OPTIONS.map(opt => (
                              <option key={opt.value} value={opt.value}>{opt.label}</option>
                            ))}
                          </select>
                        ) : (
                          <span className={`px-1.5 py-0.5 rounded-full text-[8px] font-bold capitalize border ${getStatusSelectClasses(normalizedStatus)}`}>
                            {statusLabel}
                          </span>
                        )}
                      </div>
                      <div className="text-center">
                        <button
                          onClick={(e) => { e.stopPropagation(); handleToggleFlag(tx.id); }}
                          className={`transition-colors ${tx.flagged ? 'text-rose-500' : 'text-slate-300 opacity-0 group-hover:opacity-100 hover:text-rose-400'}`}
                          title={tx.flagged ? 'Remove flag' : 'Flag as suspicious'}
                        >
                          <Flag size={12} fill={tx.flagged ? 'currentColor' : 'none'} />
                        </button>
                      </div>
                      <div className="text-center opacity-0 group-hover:opacity-100 transition-opacity relative">
                        <button
                          onClick={() => handleNoteClick(tx)}
                          className={`text-slate-400 hover:text-amber-500 ${notes[tx.id] ? 'text-amber-500 opacity-100' : ''}`}
                          title={notes[tx.id] ? 'Edit note' : 'Add note'}
                        >
                          <StickyNote size={12} />
                        </button>
                        {notes[tx.id] && (
                          <span className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 bg-amber-500 rounded-full"></span>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
          <div
            className="h-1 bg-slate-300 hover:bg-amber-400 cursor-row-resize transition-colors"
            onMouseDown={(e) => handleRightDragStart('table-footer', e)}
          />
          <div
            className="bg-slate-50 border-t border-slate-200 flex items-center justify-between px-1.5 text-[10px] font-bold text-slate-600"
            style={{ height: `${currentRightPanelHeights.footer}%` }}
          >
            <span>Total:</span>
            <span className="font-mono">
              {displayedTx.length > 0 ? displayedTx.reduce((sum, t) => sum + (t.amount || 0), 0).toLocaleString('en-ZA', { style: 'currency', currency: 'ZAR' }) : 'R 0.00'}
            </span>
          </div>
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

