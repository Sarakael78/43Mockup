import { useState, useRef, useCallback, useId, useEffect, useMemo } from 'react';
import {
  FileText,
  File,
  Scale,
  Sparkles,
  Trash2,
  CheckCheck,
  Edit3,
  X as CloseIcon,
  Save,
  ArrowUp,
  ArrowDown
} from 'lucide-react';

const DEFAULT_PANEL_HEIGHTS = {
  files: 34,
  manual: 26,
  table: 40
};

const DEFAULT_CLAIM_COLUMN_WIDTHS = {
  category: 120,
  claimed: 80,
  proven: 90,
  status: 70,
  actions: 40
};

const DocumentInventory = ({
  transactions,
  periodFilter,
  monthsInScope,
  files,
  claims,
  onImport,
  categories = [],
  onAddClaim,
  onDeleteClaim,
  onUpdateClaim,
  onReorderClaim,
  onCreateCategory,
  onDeleteFile,
  panelHeights = DEFAULT_PANEL_HEIGHTS,
  onPanelHeightsChange,
  focusedCategory = null,
  onFocusClaim,
  showFilesPanel = true,
  showHeader = true,
  showManualEntry = true
}) => {
  const [entryMode, setEntryMode] = useState('manual');
  const [dragState, setDragState] = useState(null);
  const [manualClaim, setManualClaim] = useState({
    category: '',
    description: '',
    amount: '',
    reference: ''
  });
  const [manualError, setManualError] = useState('');
  const [editingClaimId, setEditingClaimId] = useState(null);
  const [editingValues, setEditingValues] = useState({
    category: '',
    description: '',
    amount: '',
    reference: ''
  });
  const [editingError, setEditingError] = useState('');
  const categoryListId = `${useId()}-claim-categories`;
  const fileInputRef = useRef(null);
  const containerRef = useRef(null);
  const [claimColumnWidths, setClaimColumnWidths] = useState(DEFAULT_CLAIM_COLUMN_WIDTHS);
  const [claimColResizeState, setClaimColResizeState] = useState(null);
  const sortedCategories = useMemo(() => {
    const unique = Array.from(new Set(categories));
    return unique.sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));
  }, [categories]);
  const displayFilesPanel = showFilesPanel !== false;
  const displayHeader = showHeader !== false;
  const displayManualPanel = showManualEntry !== false;
  const basePanelHeights = useMemo(() => {
    if (panelHeights && typeof panelHeights === 'object') {
      return {
        ...DEFAULT_PANEL_HEIGHTS,
        ...panelHeights
      };
    }
    return DEFAULT_PANEL_HEIGHTS;
  }, [panelHeights]);
  const effectivePanelHeights = useMemo(() => {
    let heights = basePanelHeights;

    if (!displayFilesPanel) {
      const manual = basePanelHeights.manual ?? DEFAULT_PANEL_HEIGHTS.manual;
      const table = basePanelHeights.table ?? DEFAULT_PANEL_HEIGHTS.table;
      const total = Math.max(manual + table, 1);
      heights = {
        files: 0,
        manual: (manual / total) * 100,
        table: (table / total) * 100
      };
    }

    if (!displayManualPanel) {
      const filesHeight = displayFilesPanel ? heights.files ?? DEFAULT_PANEL_HEIGHTS.files : 0;
      const remainder = Math.max(100 - filesHeight, 0);
      return {
        files: filesHeight,
        manual: 0,
        table: remainder
      };
    }

    return heights;
  }, [basePanelHeights, displayFilesPanel, displayManualPanel]);
  const handleDragStart = (type, event) => {
    event.preventDefault();
    setDragState({
      type,
      startY: event.clientY,
      initial: effectivePanelHeights
    });
  };

  const emitPanelHeights = useCallback((next) => {
    if (!onPanelHeightsChange || !next) return;

    // If manual entry hidden, only table height matters (files height driven elsewhere)
    if (!displayManualPanel) {
      const payload = {};
      if (typeof next.table === 'number') {
        payload.table = next.table;
      }
      onPanelHeightsChange(payload);
      return;
    }

    if (!displayFilesPanel) {
      const payload = {};
      if (typeof next.manual === 'number') {
        payload.manual = next.manual;
      }
      if (typeof next.table === 'number') {
        payload.table = next.table;
      }
      onPanelHeightsChange(payload);
      return;
    }

    onPanelHeightsChange(next);
  }, [onPanelHeightsChange, displayFilesPanel, displayManualPanel]);

  useEffect(() => {
    if (!dragState) return;

    const handleMouseMove = (event) => {
      const container = containerRef.current;
      if (!container) return;
      const rect = container.getBoundingClientRect();
      if (rect.height === 0) return;

      const deltaPercent = ((event.clientY - dragState.startY) / rect.height) * 100;
      const MIN_PANEL = 15;

      if (dragState.type === 'files-manual') {
        let filesHeight = dragState.initial.files + deltaPercent;
        let manualHeight = dragState.initial.manual - deltaPercent;
        let tableHeight = dragState.initial.table;

        if (filesHeight < MIN_PANEL) {
          const diff = MIN_PANEL - filesHeight;
          filesHeight = MIN_PANEL;
          manualHeight -= diff;
        }

        if (manualHeight < MIN_PANEL) {
          const diff = MIN_PANEL - manualHeight;
          manualHeight = MIN_PANEL;
          filesHeight -= diff;
        }

        filesHeight = Math.max(MIN_PANEL, filesHeight);
        manualHeight = Math.max(MIN_PANEL, manualHeight);
        tableHeight = Math.max(MIN_PANEL, 100 - filesHeight - manualHeight);

        emitPanelHeights({
          files: filesHeight,
          manual: manualHeight,
          table: tableHeight
        });
      } else if (dragState.type === 'manual-table') {
        let manualHeight = dragState.initial.manual + deltaPercent;
        let tableHeight = dragState.initial.table - deltaPercent;
        const filesHeight = dragState.initial.files;

        if (manualHeight < MIN_PANEL) {
          const diff = MIN_PANEL - manualHeight;
          manualHeight = MIN_PANEL;
          tableHeight -= diff;
        }

        if (tableHeight < MIN_PANEL) {
          const diff = MIN_PANEL - tableHeight;
          tableHeight = MIN_PANEL;
          manualHeight -= diff;
        }

        manualHeight = Math.max(MIN_PANEL, manualHeight);
        tableHeight = Math.max(MIN_PANEL, tableHeight);

        emitPanelHeights({
          files: filesHeight,
          manual: manualHeight,
          table: Math.max(MIN_PANEL, 100 - filesHeight - manualHeight)
        });
      }
    };

    const handleMouseUp = () => {
      setDragState(null);
    };

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
  }, [dragState, emitPanelHeights]);

  // Column resize handling for claims table
  const handleClaimColResizeStart = (columnKey, e) => {
    e.preventDefault();
    setClaimColResizeState({
      column: columnKey,
      startX: e.clientX,
      startWidth: claimColumnWidths[columnKey]
    });
  };

  useEffect(() => {
    if (!claimColResizeState) return;

    const handleMouseMove = (e) => {
      const delta = e.clientX - claimColResizeState.startX;
      const newWidth = Math.max(30, claimColResizeState.startWidth + delta);
      setClaimColumnWidths(prev => ({
        ...prev,
        [claimColResizeState.column]: newWidth
      }));
    };

    const handleMouseUp = () => setClaimColResizeState(null);

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
  }, [claimColResizeState]);

  // Generate grid template from column widths
  const claimGridTemplate = `1fr ${claimColumnWidths.claimed}px ${claimColumnWidths.proven}px ${claimColumnWidths.status}px ${claimColumnWidths.actions}px`;

  const entryModes = [
    { key: 'manual', label: 'Manual' },
    { key: 'import', label: 'Import' },
    { key: 'auto', label: 'Auto-Calc', icon: <Sparkles size={12} className="text-blue-600" />, disabled: true }
  ];
  const entryModeCopy = {
    manual: 'Type figures exactly as they appear in the affidavit.',
    import: 'Parse annexures (DOCX/PDF) directly into the schedule.',
    auto: 'Infer claimed amounts from bank-statement averages (Magic Wand).'
  };

  const handleImportClick = useCallback(() => {
    if (entryMode === 'import' && fileInputRef.current) {
      fileInputRef.current.click();
    }
  }, [entryMode]);

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files.length > 0 && onImport) {
      onImport(e.target.files[0]);
      e.target.value = '';
      // Reset to manual mode after import
      setEntryMode('manual');
    }
  };

  const handleManualClaimChange = (field, value) => {
    setManualClaim(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleManualClaimSubmit = () => {
    if (!onAddClaim) return;
    const category = manualClaim.category.trim();
    const description = manualClaim.description.trim();
    const reference = manualClaim.reference.trim();
    const amountValue = Number(manualClaim.amount);

    if (!category) {
      setManualError('Category is required.');
      return;
    }
    if (!Number.isFinite(amountValue) || amountValue <= 0) {
      setManualError('Amount must be a positive number.');
      return;
    }

    // Auto-create category if it doesn't exist
    const categoryExists = sortedCategories.some(
      c => c.toLowerCase() === category.toLowerCase()
    );
    if (!categoryExists && onCreateCategory) {
      onCreateCategory(category);
    }

    onAddClaim({
      category,
      desc: description,
      claimed: amountValue,
      reference
    });
    setManualClaim({
      category: '',
      description: '',
      amount: '',
      reference: ''
    });
    setManualError('');
  };

  const handleStartEdit = (claim) => {
    if (!claim || !onUpdateClaim) return;
    setEditingClaimId(claim.id);
    setEditingValues({
      category: claim.category || '',
      description: claim.desc || '',
      amount: String(claim.claimed ?? ''),
      reference: claim.reference || ''
    });
    setEditingError('');
  };

  const handleEditingChange = (field, value) => {
    setEditingValues(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleEditingSave = () => {
    if (!editingClaimId || !onUpdateClaim) return;
    const category = editingValues.category.trim();
    const description = editingValues.description.trim();
    const reference = editingValues.reference.trim();
    const amountValue = Number(editingValues.amount);

    if (!category) {
      setEditingError('Category is required.');
      return;
    }
    if (!Number.isFinite(amountValue) || amountValue <= 0) {
      setEditingError('Amount must be a positive number.');
      return;
    }

    onUpdateClaim(editingClaimId, {
      category,
      desc: description,
      claimed: amountValue,
      reference: reference || undefined
    });
    setEditingClaimId(null);
    setEditingError('');
  };

  const handleEditingCancel = () => {
    setEditingClaimId(null);
    setEditingError('');
  };

  const handleReorder = (claimId, direction) => {
    if (!onReorderClaim) return;
    onReorderClaim(claimId, direction);
  };

  const getProvenAvg = (category) => {
    const total = transactions
      .filter(t => t.cat === category && t.amount < 0)
      .reduce((sum, t) => sum + Math.abs(t.amount), 0);

    const divisor = monthsInScope > 0 ? monthsInScope : 1;
    return total / divisor;
  };

  const getTrafficLight = (proven, claimed) => {
    if (!claimed) {
      return {
        ratio: 0,
        colorClass: 'text-slate-400',
        barClass: 'bg-slate-200',
        label: 'No Claim'
      };
    }

    const ratio = proven / claimed;

    if (ratio < 0.95) {
      return {
        ratio,
        colorClass: 'text-rose-500',
        barClass: 'bg-gradient-to-r from-amber-400 to-rose-500',
        label: 'Shortfall'
      };
    }

    if (ratio > 1.05) {
      return {
        ratio,
        colorClass: 'text-blue-600',
        barClass: 'bg-blue-600',
        label: 'Inflation'
      };
    }

    return {
      ratio,
      colorClass: 'text-slate-900',
      barClass: 'bg-slate-900',
      label: 'Verified'
    };
  };

  return (
    <div ref={containerRef} className="h-full bg-slate-50 flex flex-col border-r border-slate-200">
      {displayFilesPanel && (
        <>
          <div
            className="flex flex-col border-b border-slate-200 overflow-hidden"
            style={{ height: `${effectivePanelHeights.files}%` }}
          >
            {displayHeader && (
              <div className="h-6 bg-white border-b flex items-center px-1 shadow-sm shrink-0 font-semibold text-[10px] text-slate-700 justify-between">
                <span>Files</span>
                <span className="text-[8px] bg-slate-100 px-1 py-0 rounded text-slate-500">{files.length}</span>
              </div>
            )}
            <div className="p-0.5 overflow-auto custom-scroll bg-slate-50 flex-1">
              <div className="space-y-0.5">
                {files.map(file => {
                  if (!file || !file.id) return null;
                  const safeName = file.name ? String(file.name).replace(/[<>\"'&]/g, '') : 'Unknown';
                  const safeDesc = file.desc ? String(file.desc).replace(/[<>\"'&]/g, '') : '';
                  return (
                    <div key={file.id} className="bg-white border border-slate-200 rounded p-1 flex flex-col gap-0.5 shadow-sm hover:border-blue-300 transition-colors group">
                      <div className="flex items-center justify-between gap-1">
                        <div className="flex items-center gap-1 text-[10px] font-semibold text-slate-700 flex-1 min-w-0">
                          <div className="text-rose-600 shrink-0">
                            {safeName.toLowerCase().includes('pdf') ? <FileText size={10} /> : <File size={10} />}
                          </div>
                          <div className="truncate">{safeName}</div>
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          <span className={`text-[8px] px-0.5 py-0 rounded font-bold uppercase ${file.entity === 'LEGAL' ? 'bg-purple-50 text-purple-700' : 'bg-slate-100 text-slate-500'}`}>{file.entity || 'UNK'}</span>
                          {onDeleteFile && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                if (window.confirm(`Delete "${safeName}" and all associated transactions/claims?`)) {
                                  onDeleteFile(file.id);
                                }
                              }}
                              className="opacity-0 group-hover:opacity-100 text-rose-500 hover:text-rose-700 transition-opacity p-0"
                              title="Delete file"
                            >
                              <Trash2 size={10} />
                            </button>
                          )}
                        </div>
                      </div>
                      {safeDesc && <div className="text-[8px] text-slate-400 pl-1">{safeDesc}</div>}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
          {displayManualPanel && (
            <div
              className="h-1 bg-slate-300 hover:bg-amber-400 cursor-row-resize transition-colors"
              onMouseDown={(e) => handleDragStart('files-manual', e)}
            />
          )}
        </>
      )}
      {displayManualPanel && (
        <>
          <div
            className={`flex flex-col bg-white overflow-hidden ${displayFilesPanel ? 'border-t border-slate-200 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)]' : 'border border-slate-200 rounded-none'}`}
            style={{ height: `${effectivePanelHeights.manual}%` }}
          >
            <div className="h-6 bg-slate-50 border-b flex items-center justify-between px-1 shrink-0">
              <span className="text-[10px] font-bold text-slate-700 flex items-center gap-1">
                <Scale className="text-amber-600" size={11} />
                Schedule
              </span>
              <div className="flex items-center gap-1 text-[8px] font-semibold text-slate-500">
                <div className="flex bg-slate-200 rounded overflow-hidden">
                  {entryModes.map((mode) => (
                    <button
                      key={mode.key}
                      onClick={() => {
                        if (!mode.disabled) {
                          setEntryMode(mode.key);
                          if (mode.key === 'import' && fileInputRef.current) {
                            fileInputRef.current.click();
                          }
                        }
                      }}
                      disabled={mode.disabled}
                      className={`px-1 py-0 flex items-center gap-0.5 ${entryMode === mode.key ? 'bg-white text-slate-900' : mode.disabled ? 'text-slate-300 cursor-not-allowed' : 'text-slate-500'}`}
                      aria-pressed={entryMode === mode.key}
                    >
                      {mode.icon}
                      {mode.label}
                    </button>
                  ))}
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".docx,.doc,.pdf"
                  className="hidden"
                  onChange={handleFileChange}
                />
              </div>
            </div>
            <div className="flex-1 overflow-auto custom-scroll bg-white">
              <div className="px-1 py-0 text-[8px] text-slate-400 border-b border-slate-100 italic">
                {entryModeCopy[entryMode]}
              </div>
              {entryMode === 'manual' && onAddClaim && (
                <div className="px-1 py-1 bg-white border-b border-slate-100">
                  <div className="grid grid-cols-6 gap-1">
                    <div className="col-span-2">
                      <label className="block text-[8px] font-bold uppercase text-slate-500 mb-0.5">Category</label>
                      <input
                        type="text"
                        list={categoryListId}
                        value={manualClaim.category}
                        onChange={(e) => handleManualClaimChange('category', e.target.value)}
                        placeholder="Groceries"
                        className="w-full text-[10px] px-1 py-0.5 border border-slate-200 rounded focus:outline-none focus:ring-1 focus:ring-amber-400"
                      />
                      {sortedCategories.length > 0 && (
                        <datalist id={categoryListId}>
                          {sortedCategories.map(cat => (
                            <option key={cat} value={cat} />
                          ))}
                        </datalist>
                      )}
                    </div>
                    <div>
                      <label className="block text-[8px] font-bold uppercase text-slate-500 mb-0.5">Amount</label>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={manualClaim.amount}
                        onChange={(e) => handleManualClaimChange('amount', e.target.value)}
                        className="w-full text-[10px] px-1 py-0.5 border border-slate-200 rounded focus:outline-none focus:ring-1 focus:ring-amber-400"
                        placeholder="0"
                      />
                    </div>
                    <div className="col-span-2">
                      <label className="block text-[8px] font-bold uppercase text-slate-500 mb-0.5">Description</label>
                      <input
                        type="text"
                        value={manualClaim.description}
                        onChange={(e) => handleManualClaimChange('description', e.target.value)}
                        placeholder="Notes..."
                        className="w-full text-[10px] px-1 py-0.5 border border-slate-200 rounded focus:outline-none focus:ring-1 focus:ring-amber-400"
                      />
                    </div>
                    <div className="flex items-end">
                      <button
                        type="button"
                        onClick={handleManualClaimSubmit}
                        className="w-full px-1 py-0.5 text-[9px] font-bold rounded bg-amber-500 text-white shadow-sm hover:bg-amber-600 transition-colors"
                      >
                        Add
                      </button>
                    </div>
                  </div>
                  {manualError && (
                    <p className="text-[9px] text-rose-600 mt-0.5">{manualError}</p>
                  )}
                </div>
              )}
            </div>
          </div>
          <div
            className="h-1 bg-slate-300 hover:bg-amber-400 cursor-row-resize transition-colors"
            onMouseDown={(e) => handleDragStart('manual-table', e)}
          />
        </>
      )}
      <div
        className="flex-1 overflow-hidden bg-white"
        style={{ height: displayManualPanel ? `${effectivePanelHeights.table}%` : '100%' }}
      >
        <div className="h-full overflow-auto custom-scroll p-0">
          <div className="w-full">
            <div className="grid bg-slate-50 sticky top-0 z-10 text-[7px] font-bold text-slate-500 uppercase tracking-wide border-b border-slate-200" style={{ gridTemplateColumns: claimGridTemplate }}>
              <div className="px-1 py-0.5 relative flex items-center">
                Category
                <div
                  className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-amber-400 transition-colors"
                  onMouseDown={(e) => handleClaimColResizeStart('category', e)}
                />
              </div>
              <div className="px-1 py-0.5 text-right relative flex items-center justify-end">
                Claimed
                <div
                  className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-amber-400 transition-colors"
                  onMouseDown={(e) => handleClaimColResizeStart('claimed', e)}
                />
              </div>
              <div className="px-1 py-0.5 text-right relative flex items-center justify-end">
                Proven ({periodFilter})
                <div
                  className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-amber-400 transition-colors"
                  onMouseDown={(e) => handleClaimColResizeStart('proven', e)}
                />
              </div>
              <div className="px-1 py-0.5 text-right relative flex items-center justify-end">
                Status
                <div
                  className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-amber-400 transition-colors"
                  onMouseDown={(e) => handleClaimColResizeStart('status', e)}
                />
              </div>
              <div className="px-1 py-0.5"></div>
            </div>
            <div>
              {claims.map((claim, index) => {
                const proven = getProvenAvg(claim.category);
                const traffic = getTrafficLight(proven, claim.claimed);
                const isEditing = editingClaimId === claim.id;
                const canEdit = claim.source === 'manual' && Boolean(onUpdateClaim);
                const canMoveUp = Boolean(onReorderClaim) && index > 0;
                const canMoveDown = Boolean(onReorderClaim) && index < claims.length - 1;
                const isFocused = focusedCategory && claim.category && focusedCategory.toLowerCase() === claim.category.toLowerCase();

                return (
                  <div
                    key={claim.id}
                    className={`grid border-b border-slate-100 hover:bg-amber-50 text-[9px] group transition-colors items-center ${isFocused ? 'bg-amber-50/70' : ''}`}
                    style={{ gridTemplateColumns: claimGridTemplate }}
                    onDoubleClick={() => onFocusClaim && onFocusClaim(claim.category)}
                  >
                    <div className="px-1 py-0.5">
                      {isEditing ? (
                        <div className="space-y-0.5">
                          <input
                            type="text"
                            list={categoryListId}
                            value={editingValues.category}
                            onChange={(e) => handleEditingChange('category', e.target.value)}
                            className="w-full text-[10px] px-1 py-0.5 border border-slate-200 rounded focus:outline-none focus:ring-1 focus:ring-amber-400"
                          />
                          <input
                            type="text"
                            value={editingValues.description}
                            onChange={(e) => handleEditingChange('description', e.target.value)}
                            placeholder="Desc"
                            className="w-full text-[9px] px-1 py-0.5 border border-slate-200 rounded focus:outline-none focus:ring-1 focus:ring-amber-400"
                          />
                          {editingError && (
                            <p className="text-[8px] text-rose-600">{editingError}</p>
                          )}
                        </div>
                      ) : (
                        <>
                          <div className="font-semibold text-slate-700 text-[9px]">{claim.category}</div>
                          {claim.desc && <div className="text-[8px] text-slate-400 truncate">{claim.desc}</div>}
                        </>
                      )}
                    </div>
                    <div className="px-1 py-0.5 text-right font-mono text-slate-500 text-[9px]">
                      {isEditing ? (
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={editingValues.amount}
                          onChange={(e) => handleEditingChange('amount', e.target.value)}
                          className="w-full text-[10px] px-1 py-0.5 border border-slate-200 rounded focus:outline-none focus:ring-1 focus:ring-amber-400"
                        />
                      ) : (
                        claim.claimed.toLocaleString('en-ZA', { style: 'currency', currency: 'ZAR', maximumFractionDigits: 0 })
                      )}
                    </div>
                    <div className={`px-1 py-0.5 text-right font-mono font-bold text-[9px] ${traffic.colorClass}`}>
                      {proven > 0 ? proven.toLocaleString('en-ZA', { style: 'currency', currency: 'ZAR', maximumFractionDigits: 0 }) : '-'}
                    </div>
                    <div className="px-1 py-0.5">
                      <div className="flex flex-col gap-0.5">
                        <div className="w-full h-1 bg-slate-100 rounded-full overflow-hidden">
                          <div
                            className={`h-full ${traffic.barClass}`}
                            style={{ width: `${Math.max(0, Math.min(traffic.ratio * 100, 160))}%` }}
                          />
                        </div>
                        <div className={`text-[8px] font-semibold flex items-center gap-0.5 ${traffic.colorClass}`}>
                          {traffic.label === 'Verified' && <CheckCheck size={8} />}
                          {traffic.label}
                        </div>
                      </div>
                    </div>
                    <div className="px-0.5 py-0.5 text-right">
                      {isEditing ? (
                        <div className="flex gap-0.5 justify-end">
                          <button
                            type="button"
                            onClick={handleEditingSave}
                            className="p-0.5 text-emerald-500 hover:text-emerald-600"
                          >
                            <Save size={10} />
                          </button>
                          <button
                            type="button"
                            onClick={handleEditingCancel}
                            className="p-0.5 text-slate-400 hover:text-slate-600"
                          >
                            <CloseIcon size={10} />
                          </button>
                        </div>
                      ) : (
                        <div className="flex gap-0.5 justify-end opacity-0 group-hover:opacity-100">
                          {canMoveUp && (
                            <button type="button" onClick={() => handleReorder(claim.id, 'up')} className="text-slate-400 hover:text-slate-600" title="Up">
                              <ArrowUp size={10} />
                            </button>
                          )}
                          {canMoveDown && (
                            <button type="button" onClick={() => handleReorder(claim.id, 'down')} className="text-slate-400 hover:text-slate-600" title="Down">
                              <ArrowDown size={10} />
                            </button>
                          )}
                          {canEdit && (
                            <button type="button" onClick={() => handleStartEdit(claim)} className="text-slate-400 hover:text-amber-500" title="Edit">
                              <Edit3 size={10} />
                            </button>
                          )}
                          {onDeleteClaim && (
                            <button type="button" onClick={() => onDeleteClaim(claim.id)} className="text-slate-400 hover:text-rose-500" title="Delete">
                              <Trash2 size={10} />
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DocumentInventory;

