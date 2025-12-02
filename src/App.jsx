import { useState, useEffect, useRef } from 'react';
import { useToast } from './contexts/ToastContext';
import { processBankStatement, processFinancialAffidavit } from './utils/fileProcessors';
import { mapCategory } from './utils/categoryMapper';
import { exportProject, loadProject } from './utils/projectUtils';
import { TOAST_DELAY_MS, AUTO_SAVE_DEBOUNCE_MS, SAVED_INDICATOR_DURATION_MS, generateId } from './utils/constants';
import { ensureTransactionEntities } from './utils/transactionUtils';
import { defaultCategories } from './config/categories';
import NavSidebar from './components/NavSidebar';
import TopBar from './components/TopBar';
import Footer from './components/Footer';
import FileUploadModal from './components/FileUploadModal';
import SettingsModal, { FONT_SIZES, DENSITY_LEVELS } from './components/SettingsModal';
import DashboardView from './views/DashboardView';
import WorkbenchView from './views/WorkbenchView';
import EvidenceLockerView from './views/EvidenceLockerView';

const DEFAULT_DISPLAY_SETTINGS = {
  fontSize: 'md',
  density: 'compact'
};

const DEFAULT_LAYOUT = {
  leftPanelWidth: 42,
  filePanelHeight: 34,
  manualPanelHeight: 26,
  tablePanelHeight: 40,
  rightFiltersHeight: 12,
  rightTableHeight: 78,
  rightFooterHeight: 10
};

const normalizeLayout = (layout) => {
  const normalized = { ...DEFAULT_LAYOUT };
  if (layout && typeof layout === 'object') {
    Object.keys(DEFAULT_LAYOUT).forEach((key) => {
      const value = layout[key];
      if (typeof value === 'number' && Number.isFinite(value)) {
        normalized[key] = value;
      }
    });
  }
  return normalized;
};

const App = () => {

  const [view, setView] = useState('dashboard');
  const [appData, setAppData] = useState({
    accounts: {},
    categories: defaultCategories,
    files: [],
    charts: [],
    alerts: []
  });
  const [transactions, setTransactions] = useState([]);
  const [claims, setClaims] = useState([]);
  const [notes, setNotes] = useState({});
  const [caseName, setCaseName] = useState('New Case');
  const [fileUploadModal, setFileUploadModal] = useState(false);
  const [settingsModal, setSettingsModal] = useState(false);
  const [saved, setSaved] = useState(false);
  const [layoutSettings, setLayoutSettings] = useState(DEFAULT_LAYOUT);
  const [displaySettings, setDisplaySettings] = useState(DEFAULT_DISPLAY_SETTINGS);
  const { showToast } = useToast();
  const saveTimeoutRef = useRef(null);
  const savedTimeoutRef = useRef(null);
  const loadProjectCleanupRef = useRef(null);
  const newCaseToastTimeoutRef = useRef(null);

  // Load from localStorage on mount
  useEffect(() => {
    // Load display settings
    const savedDisplaySettings = localStorage.getItem('r43_display_settings');
    if (savedDisplaySettings) {
      try {
        const parsed = JSON.parse(savedDisplaySettings);
        setDisplaySettings({ ...DEFAULT_DISPLAY_SETTINGS, ...parsed });
      } catch (e) {
        // Use defaults
      }
    }

    const savedProject = localStorage.getItem('r43_project');
    if (savedProject) {
      try {
        const projectData = JSON.parse(savedProject);
        if (projectData.accounts && projectData.transactions && projectData.claims) {
          const loadedCategories = projectData.categories && projectData.categories.length > 0 
            ? projectData.categories 
            : defaultCategories;
          const sortedLoadedCategories = [...loadedCategories].sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));
          setAppData({
            accounts: projectData.accounts,
            categories: sortedLoadedCategories,
            files: projectData.files || [],
            charts: projectData.charts || [],
            alerts: projectData.alerts || []
          });
          const normalizedTransactions = ensureTransactionEntities(projectData.transactions || [], projectData.files || []);
          setTransactions(normalizedTransactions);
          setClaims(projectData.claims || []);
          if (projectData.caseName) {
            setCaseName(projectData.caseName);
          }
          if (projectData.notes) {
            setNotes(projectData.notes || {});
          }
          if (projectData.layout) {
            setLayoutSettings(normalizeLayout(projectData.layout));
          }
        }
      } catch (error) {
        // Error loading from localStorage - continue with empty state
        // Silently fail - user can still use the app with empty state
      }
    }
    // No fallback to mock data - app starts empty
  }, []);

  // Apply CSS variables when display settings change
  useEffect(() => {
    const fontScale = FONT_SIZES.find(f => f.value === displaySettings.fontSize)?.scale || 1;
    const densityScale = DENSITY_LEVELS.find(d => d.value === displaySettings.density)?.scale || 1;
    
    document.documentElement.style.setProperty('--font-scale', String(fontScale));
    document.documentElement.style.setProperty('--density-scale', String(densityScale));
    // Combined zoom for the app - average of font and density scales
    document.documentElement.style.setProperty('--app-zoom', String((fontScale + densityScale) / 2));
    
    // Save to localStorage
    try {
      localStorage.setItem('r43_display_settings', JSON.stringify(displaySettings));
    } catch (e) {
      // localStorage may be disabled
    }
  }, [displaySettings]);

  // Calculate effective scales for inline styles
  const fontScale = FONT_SIZES.find(f => f.value === displaySettings.fontSize)?.scale || 1;
  const densityScale = DENSITY_LEVELS.find(d => d.value === displaySettings.density)?.scale || 1;

  // Auto-save to localStorage whenever data changes
  useEffect(() => {
    // appData is always initialized, but check for safety
    if (!appData) return;

    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    saveTimeoutRef.current = setTimeout(() => {
      const projectData = {
        version: '1.0',
        caseName: caseName,
        exportedAt: new Date().toISOString(),
        accounts: appData.accounts,
        categories: appData.categories,
        files: appData.files,
        transactions: transactions,
        claims: claims,
        notes: notes,
        charts: appData.charts,
        alerts: appData.alerts,
        layout: layoutSettings
      };
      try {
        localStorage.setItem('r43_project', JSON.stringify(projectData));
        setSaved(true);
        // Clear previous saved timeout if exists
        if (savedTimeoutRef.current) {
          clearTimeout(savedTimeoutRef.current);
        }
        savedTimeoutRef.current = setTimeout(() => setSaved(false), SAVED_INDICATOR_DURATION_MS);
      } catch (storageError) {
        // localStorage quota exceeded or disabled - auto-save failure shouldn't break the app
      }
    }, AUTO_SAVE_DEBOUNCE_MS);

    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
        saveTimeoutRef.current = null;
      }
      if (savedTimeoutRef.current) {
        clearTimeout(savedTimeoutRef.current);
        savedTimeoutRef.current = null;
      }
    };
  }, [appData, transactions, claims, notes, caseName, layoutSettings]);

  const handleSave = () => {
    if (appData) {
      try {
        exportProject(appData, transactions, claims, caseName, notes, layoutSettings);
        showToast('Project saved successfully', 'success');
      } catch (error) {
        showToast('Failed to save project', 'error');
      }
    }
  };

  const handleNewCase = () => {
    // Check if there's any data to lose
    const hasData = transactions.length > 0 || claims.length > 0 || 
                    (appData.files && appData.files.length > 0) ||
                    Object.keys(appData.accounts).length > 0 ||
                    Object.keys(notes).length > 0;

    if (hasData) {
      const confirmed = window.confirm(
        'Starting a new case will clear all current data (transactions, claims, files, notes).\n\n' +
        'Make sure you have saved your current case if needed.\n\n' +
        'Do you want to continue?'
      );
      if (!confirmed) {
        return;
      }
    }

    // Reset all state to empty defaults
    setAppData({
      accounts: {},
      categories: defaultCategories,
      files: [],
      charts: [],
      alerts: []
    });
    setTransactions([]);
    setClaims([]);
    setNotes({});
    setCaseName('New Case');
    setLayoutSettings(DEFAULT_LAYOUT);

    // Clear localStorage immediately so auto-save doesn't restore old data
    try {
      localStorage.removeItem('r43_project');
    } catch (error) {
      // localStorage may be disabled, continue anyway
    }

    // Small delay to ensure state updates complete before showing toast
    // Clear any existing timeout first
    if (newCaseToastTimeoutRef.current) {
      clearTimeout(newCaseToastTimeoutRef.current);
    }
    newCaseToastTimeoutRef.current = setTimeout(() => {
      showToast('New case started', 'success');
      newCaseToastTimeoutRef.current = null;
    }, TOAST_DELAY_MS);
  };

  const handleLoadProject = (file) => {
    // Cleanup previous load if still in progress
    if (loadProjectCleanupRef.current) {
      loadProjectCleanupRef.current();
      loadProjectCleanupRef.current = null;
    }
    
    const cleanup = loadProject(
      file,
      setAppData,
      setTransactions,
      setClaims,
      setCaseName,
      setNotes,
      (layout) => {
        if (layout) {
          setLayoutSettings(normalizeLayout(layout));
        } else {
          setLayoutSettings(DEFAULT_LAYOUT);
        }
      },
      showToast
    );
    if (cleanup) {
      loadProjectCleanupRef.current = cleanup;
    }
  };

  // Cleanup loadProject and timeouts on unmount
  useEffect(() => {
    return () => {
      if (loadProjectCleanupRef.current) {
        loadProjectCleanupRef.current();
      }
      if (newCaseToastTimeoutRef.current) {
        clearTimeout(newCaseToastTimeoutRef.current);
        newCaseToastTimeoutRef.current = null;
      }
    };
  }, []);

  const handleDeleteFile = (fileId) => {
    if (!fileId) return;

    // Remove the file from appData
    setAppData(prev => ({
      ...prev,
      files: (prev.files || []).filter(f => f.id !== fileId)
    }));

    // Remove all transactions associated with this file
    setTransactions(prev => prev.filter(tx => tx.fileId !== fileId));

    // Remove all claims associated with this file
    setClaims(prev => prev.filter(claim => claim.fileId !== fileId));

    showToast('File and all associated data deleted', 'success');
  };

  const handleFileUpload = async (files) => {
    if (!files || files.length === 0) return;

    let processedCount = 0;
    let transactionCount = 0;
    let claimCount = 0;
    const errors = [];
    const newFiles = [];

    showToast(`Processing ${files.length} file(s)...`, 'info');

    for (const file of files) {
      try {
        // Validate file object has required properties
        if (!file) {
          errors.push({ file: 'Unknown', message: 'File object is missing' });
          continue;
        }

        if (!file.name) {
          errors.push({ file: 'Unknown', message: 'File name is missing. Please ensure the file was selected correctly.' });
          continue;
        }

        if (!file.triage || !file.triage.type) {
          errors.push({ file: file.name, message: 'File triage not completed' });
          continue;
        }

        // Generate fileId before processing so we can track which transactions/claims came from this file
        const fileId = `${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;

        if (file.triage.type === 'Bank Statement') {
          const normalizedEntity = (file.triage.entity || 'PERSONAL').toUpperCase();
          const result = await processBankStatement(
            file,
            file.triage.parser || 'Generic CSV',
            file.triage.entity || 'PERSONAL',
            fileId // Pass fileId to track source
          );

          if (result.errors && result.errors.length > 0) {
            errors.push(...result.errors);
          }

          const cycleDay = file.triage.cycleDay || 'last';
          const transactionsWithEntity = (result.transactions || [])
            .filter(Boolean)
            .map(tx => {
              const txEntity = tx?.entity ? String(tx.entity).toUpperCase() : normalizedEntity;
              return { ...tx, entity: txEntity, cycleDay }; // Include cycle day for period calculations
            });

          if (transactionsWithEntity.length > 0) {
            setTransactions(prev => [...prev, ...transactionsWithEntity]);
            transactionCount += transactionsWithEntity.length;
            processedCount++;
            
            // Add any new categories from transactions to the category list
            const txCategories = transactionsWithEntity
              .map(tx => tx.cat)
              .filter(c => c && c !== 'Uncategorized');
            if (txCategories.length > 0) {
              setAppData(prev => {
                const existing = prev.categories || [];
                const existingLower = existing.map(c => c.toLowerCase());
                const toAdd = [...new Set(txCategories)].filter(c => 
                  !existingLower.includes(c.toLowerCase())
                );
                if (toAdd.length === 0) return prev;
                const merged = [...existing, ...toAdd].sort((a, b) => {
                  if (a === 'Uncategorized') return 1;
                  if (b === 'Uncategorized') return -1;
                  return a.localeCompare(b, undefined, { sensitivity: 'base' });
                });
                return { ...prev, categories: merged };
              });
            }
          }

          // Read CSV content for later viewing (needed after export/import)
          let csvContent = null;
          if (file.name.toLowerCase().endsWith('.csv')) {
            try {
              csvContent = await new Promise((resolve, reject) => {
                const reader = new FileReader();
                reader.onload = (e) => resolve(e.target.result);
                reader.onerror = () => reject(new Error('Failed to read CSV'));
                reader.readAsText(file);
              });
            } catch (e) {
              // Silent fail - CSV viewing will just not work
            }
          }

          // Add file metadata (include file object and content for viewing)
          newFiles.push({
            id: fileId,
            name: file.name,
            desc: `Bank Statement - ${file.triage.parser}`,
            entity: file.triage.entity || 'PERSONAL',
            type: 'Bank Statement',
            cycleDay: file.triage.cycleDay || 'last', // Statement cycle day (1-31 or 'last')
            uploadedAt: new Date().toISOString(),
            file: file, // Store file object for viewing (current session only)
            csvContent: csvContent // Store CSV content for viewing after export/import
          });

        } else if (file.triage.type === 'Financial Affidavit') {
          const result = await processFinancialAffidavit(file, fileId); // Pass fileId to track source

          if (result.errors && result.errors.length > 0) {
            errors.push(...result.errors);
          }

          if (result.claims && result.claims.length > 0) {
            // Map categories
            const mappedClaims = result.claims.map(claim => ({
              ...claim,
              category: mapCategory(claim.category)
            }));

            setClaims(prev => [...prev, ...mappedClaims]);
            claimCount += mappedClaims.length;
            processedCount++;
          }

          // Add file metadata
          newFiles.push({
            id: fileId,
            name: file.name,
            desc: 'Financial Affidavit',
            entity: file.triage.entity || 'LEGAL',
            type: 'Financial Affidavit',
            uploadedAt: new Date().toISOString()
          });
        } else {
          errors.push({
            file: file.name,
            message: `Unsupported file classification: ${file.triage.type}`
          });
        }

      } catch (error) {
        errors.push({ 
          file: file.name, 
          message: error instanceof Error ? error.message : 'Unknown error processing file' 
        });
      }
    }

    // Add files to appData
    if (newFiles.length > 0) {
      setAppData(prev => ({
        ...prev,
        files: [...(prev.files || []), ...newFiles]
      }));
    }

    // Show results
    if (processedCount > 0) {
      const successMsg = `Processed ${processedCount} file(s): ${transactionCount} transactions, ${claimCount} claims extracted.`;
      showToast(successMsg, 'success');
    }

    if (errors.length > 0) {
      errors.forEach(err => {
        showToast(`${err.file}: ${err.message}`, 'error');
      });
    }

    if (processedCount === 0 && errors.length === 0) {
      showToast('No files were processed. Please ensure files are properly triaged.', 'warning');
    }
  };

  const handleAddManualClaim = ({ category, desc = '', claimed, reference }) => {
    const sanitizedCategory = (category || '').trim();
    if (!sanitizedCategory) {
      showToast('Category is required to add a claim.', 'error');
      return;
    }

    if (!Number.isFinite(claimed) || claimed <= 0) {
      showToast('Amount must be a positive number.', 'error');
      return;
    }

    const newClaim = {
      id: generateId(),
      category: sanitizedCategory,
      desc: (desc || '').trim(),
      claimed,
      reference: reference && reference.trim() ? reference.trim() : undefined,
      source: 'manual'
    };

    setClaims(prev => [...prev, newClaim]);
    showToast('Claim added to schedule.', 'success');
  };

  const handleDeleteClaim = (claimId) => {
    if (!claimId) return;
    setClaims(prev => prev.filter(claim => claim.id !== claimId));
    showToast('Claim removed.', 'info');
  };

  const handleUpdateClaim = (claimId, updates) => {
    if (!claimId) return;
    setClaims(prev => prev.map(claim => {
      if (claim.id !== claimId) return claim;
      return {
        ...claim,
        ...updates
      };
    }));
    showToast('Claim updated.', 'success');
  };

  const handleReorderClaim = (claimId, direction) => {
    if (!claimId || !direction) return;
    setClaims(prev => {
      const index = prev.findIndex(claim => claim.id === claimId);
      if (index === -1) return prev;
      const newIndex = direction === 'up'
        ? Math.max(0, index - 1)
        : Math.min(prev.length - 1, index + 1);
      if (index === newIndex) return prev;
      const next = [...prev];
      const [moved] = next.splice(index, 1);
      next.splice(newIndex, 0, moved);
      return next;
    });
  };

  const handleCreateCategory = (name) => {
    const sanitized = (name || '').trim();
    if (!sanitized) return false;
    const normalized = sanitized.replace(/\s+/g, ' ');
    let added = false;
    setAppData(prev => {
      const existing = prev.categories || [];
      if (existing.some(cat => cat.toLowerCase() === normalized.toLowerCase())) {
        return prev;
      }
      added = true;
      const updated = [...existing, normalized].sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));
      return {
        ...prev,
        categories: updated
      };
    });
    if (added) {
      showToast(`Category "${normalized}" added.`, 'success');
      return true;
    }
    return false;
  };

  // Merge new categories with existing ones (used when importing CSV with expense categories)
  const handleSetCategories = (newCategories) => {
    if (!Array.isArray(newCategories)) return;
    
    setAppData(prev => {
      const existing = prev.categories || [];
      // Merge: add new categories that don't already exist (case-insensitive)
      const existingLower = existing.map(c => c.toLowerCase());
      const toAdd = newCategories.filter(c => 
        c && !existingLower.includes(c.toLowerCase())
      );
      const merged = [...existing, ...toAdd];
      
      // Sort with "Uncategorized" at the end
      const sorted = merged.sort((a, b) => {
        if (a === 'Uncategorized') return 1;
        if (b === 'Uncategorized') return -1;
        return a.localeCompare(b, undefined, { sensitivity: 'base' });
      });
      
      return {
        ...prev,
        categories: sorted
      };
    });
    
    showToast(`Categories merged: ${newCategories.length} categories from CSV.`, 'success');
  };

  const handleUpdateTransactionStatus = (txId, status) => {
    if (!txId) return;
    setTransactions(prev => prev.map(tx => tx.id === txId ? { ...tx, status } : tx));
  };
  const inventoryPanelHeights = {
    files: layoutSettings.filePanelHeight,
    manual: layoutSettings.manualPanelHeight,
    table: layoutSettings.tablePanelHeight
  };

  const rightPanelHeights = {
    filters: layoutSettings.rightFiltersHeight,
    table: layoutSettings.rightTableHeight,
    footer: layoutSettings.rightFooterHeight
  };

  const handleLeftPanelWidthChange = (width) => {
    const clamped = Math.max(20, Math.min(80, width));
    setLayoutSettings(prev => ({ ...prev, leftPanelWidth: clamped }));
  };

  const handleInventoryPanelHeightsChange = (next) => {
    if (!next) return;
    setLayoutSettings(prev => ({
      ...prev,
      filePanelHeight: next.files,
      manualPanelHeight: next.manual,
      tablePanelHeight: next.table
    }));
  };

  const handleRightPanelHeightsChange = (next) => {
    if (!next) return;
    setLayoutSettings(prev => ({
      ...prev,
      rightFiltersHeight: next.filters,
      rightTableHeight: next.table,
      rightFooterHeight: next.footer
    }));
  };

  // Calculate dimensions to counteract zoom and fill viewport
  const zoomCompensatedWidth = `${100 / fontScale}vw`;
  const zoomCompensatedHeight = `${100 / fontScale}vh`;

  return (
    <div 
      className="flex bg-slate-100 font-sans text-slate-900 origin-top-left overflow-hidden" 
      style={{ 
        zoom: fontScale,
        width: zoomCompensatedWidth,
        height: zoomCompensatedHeight,
      }}
    >
      <NavSidebar 
        view={view} 
        setView={setView} 
        onAddEvidence={() => setFileUploadModal(true)} 
        densityScale={densityScale}
      />
      <div className="flex-1 flex flex-col min-w-0">
        <TopBar
          title="Rule 43 Workspace"
          subtitle="Financial Analysis & Reconciliation"
          caseName={caseName}
          onCaseNameChange={setCaseName}
          onSave={handleSave}
          onNewCase={handleNewCase}
          onLoadProject={handleLoadProject}
          saved={saved}
          onError={(err) => showToast(err.message, err.type || 'error')}
          onOpenSettings={() => setSettingsModal(true)}
        />
        <div className="flex-1 min-h-0 relative">
          {view === 'dashboard' && <DashboardView data={appData} transactions={transactions} claims={claims} />}
          {view === 'workbench' && (
            <WorkbenchView
              data={appData}
              transactions={transactions}
              setTransactions={setTransactions}
              claims={claims}
              setClaims={setClaims}
              notes={notes}
              setNotes={setNotes}
              onError={(err) => showToast(err.message, err.type || 'error')}
              onDeleteFile={handleDeleteFile}
              onAddClaim={handleAddManualClaim}
              onDeleteClaim={handleDeleteClaim}
              onUpdateClaim={handleUpdateClaim}
              onReorderClaim={handleReorderClaim}
              onCreateCategory={handleCreateCategory}
              setCategories={handleSetCategories}
              onUpdateTransactionStatus={handleUpdateTransactionStatus}
              inventoryPanelHeights={inventoryPanelHeights}
              onInventoryPanelHeightsChange={handleInventoryPanelHeightsChange}
              leftPanelWidth={layoutSettings.leftPanelWidth}
              onLeftPanelWidthChange={handleLeftPanelWidthChange}
              rightPanelHeights={rightPanelHeights}
              onRightPanelHeightsChange={handleRightPanelHeightsChange}
            />
          )}
          {view === 'evidence' && (
            <EvidenceLockerView
              transactions={transactions}
              claims={claims}
              files={appData.files || []}
              accounts={appData.accounts || {}}
              onError={(err) => showToast(err.message, err.type || 'error')}
              setClaims={setClaims}
              onDeleteFile={handleDeleteFile}
              onAddClaim={handleAddManualClaim}
              onDeleteClaim={handleDeleteClaim}
              onUpdateClaim={handleUpdateClaim}
              onReorderClaim={handleReorderClaim}
              onCreateCategory={handleCreateCategory}
              setCategories={handleSetCategories}
              categories={appData.categories || []}
              inventoryPanelHeights={inventoryPanelHeights}
              onInventoryPanelHeightsChange={handleInventoryPanelHeightsChange}
            />
          )}
        </div>
        <Footer />
      </div>
      <FileUploadModal
        isOpen={fileUploadModal}
        onClose={() => setFileUploadModal(false)}
        onUpload={handleFileUpload}
        showToast={showToast}
      />
      <SettingsModal
        isOpen={settingsModal}
        onClose={() => setSettingsModal(false)}
        settings={displaySettings}
        onSettingsChange={setDisplaySettings}
      />
    </div>
  );
};

export default App;
