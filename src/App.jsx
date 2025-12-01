import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import {
  PieChart,
  TableProperties,
  Bell,
  AlertCircle,
  AlertTriangle,
  FileText,
  File,
  Scale,
  StickyNote,
  FileStack,
  Sparkles,
  CheckCheck,
  UploadCloud,
  Save,
  FolderOpen,
  X,
  Plus,
  Check
} from 'lucide-react';
import { useToast } from './contexts/ToastContext';
import { processBankStatement, processFinancialAffidavit } from './utils/fileProcessors';
import { parseDOCXClaims, parsePDFClaims } from './utils/documentParsers';
import { mapCategory } from './utils/categoryMapper';
import PDFDocumentViewer from './components/PDFDocumentViewer';

const periodMonthsMap = { '1M': 1, '3M': 3, '6M': 6 };

// ErrorToast component removed - now using ToastContext

const getLatestTransactionDate = (transactions) => {
  if (!transactions?.length || !transactions[0]?.date) return null;
  return transactions.reduce((latest, tx) => (tx?.date && tx.date > latest ? tx.date : latest), transactions[0].date);
};

const filterTransactionsByPeriod = (transactions, periodFilter, latestDateIso) => {
  if (!latestDateIso) return transactions;
  const months = periodMonthsMap[periodFilter] || 1;
  const startDate = new Date(latestDateIso);
  startDate.setDate(1);
  startDate.setHours(0, 0, 0, 0);
  startDate.setMonth(startDate.getMonth() - (months - 1));

  return transactions.filter((tx) => {
    const txDate = new Date(tx.date);
    txDate.setHours(0, 0, 0, 0);
    return txDate >= startDate;
  });
};

const filterTransactionsByEntity = (transactions, entity, accounts) => {
  if (!accounts) return transactions;
  if (entity === 'PERSONAL') return transactions.filter((t) => t.acc === accounts.PERSONAL || t.acc === accounts.TRUST);
  if (entity === 'BUSINESS') return transactions.filter((t) => t.acc === accounts.BUSINESS || t.acc === accounts.MYMOBIZ);
  if (entity === 'CREDIT') return transactions.filter((t) => t.acc === accounts.CREDIT);
  if (entity === 'TRUST') return transactions.filter((t) => t.acc === accounts.TRUST);
  return transactions;
};

// --- UTILITY FUNCTIONS ---

const exportProject = (appData, transactions, claims, caseName) => {
  const projectData = {
    version: '1.0',
    caseName: caseName || 'Rademan vs Rademan',
    exportedAt: new Date().toISOString(),
    accounts: appData.accounts,
    categories: appData.categories,
    files: appData.files,
    transactions: transactions,
    claims: claims,
    charts: appData.charts,
    alerts: appData.alerts
  };
  
  const blob = new Blob([JSON.stringify(projectData, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  const safeCaseName = (caseName || 'Rademan_v_Rademan').replace(/\s+/g, '_').replace(/[^a-zA-Z0-9_]/g, '');
  const dateStr = new Date().toISOString().split('T')[0];
  a.download = `${safeCaseName}_${dateStr}.r43`;
  
  try {
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  } finally {
    // Always revoke URL to prevent memory leak
    URL.revokeObjectURL(url);
  }
};

const loadProject = (file, setAppData, setTransactions, setClaims, setCaseName, setNotes, showToast) => {
  // Validate file size (max 10MB)
  const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
  if (file.size > MAX_FILE_SIZE) {
    if (showToast) {
      showToast(`File too large. Maximum size is ${MAX_FILE_SIZE / 1024 / 1024}MB.`, 'error');
    }
    return () => {}; // Return cleanup function for consistency
  }

  // Validate file type
  if (!file.name.endsWith('.r43') && !file.name.endsWith('.json')) {
    if (showToast) {
      showToast('Invalid file type. Please select a .r43 or .json file.', 'error');
    }
    return () => {};
  }

  const reader = new FileReader();
  let isCancelled = false;
  
  reader.onload = (e) => {
    if (isCancelled) return;
    
    try {
      const projectData = JSON.parse(e.target.result);
      
      // Enhanced schema validation
      if (!projectData || typeof projectData !== 'object') {
        throw new Error('Invalid project file: not a valid JSON object');
      }
      
      if (!projectData.accounts || typeof projectData.accounts !== 'object') {
        throw new Error('Invalid project file: missing or invalid accounts');
      }
      
      if (!Array.isArray(projectData.transactions)) {
        throw new Error('Invalid project file: transactions must be an array');
      }
      
      if (!Array.isArray(projectData.claims)) {
        throw new Error('Invalid project file: claims must be an array');
      }
      
      // Validate transaction structure
      for (const tx of projectData.transactions) {
        if (!tx.id || typeof tx.amount !== 'number' || !tx.date) {
          throw new Error('Invalid project file: transactions must have id, amount, and date');
        }
      }
      
      // Validate claims structure
      for (const claim of projectData.claims) {
        if (!claim.id || typeof claim.claimed !== 'number' || !claim.category) {
          throw new Error('Invalid project file: claims must have id, claimed amount, and category');
        }
      }
      
      setAppData({
        accounts: projectData.accounts,
        categories: Array.isArray(projectData.categories) ? projectData.categories : [],
        files: Array.isArray(projectData.files) ? projectData.files : [],
        charts: Array.isArray(projectData.charts) ? projectData.charts : [],
        alerts: Array.isArray(projectData.alerts) ? projectData.alerts : []
      });
      setTransactions(projectData.transactions || []);
      setClaims(projectData.claims || []);
      if (projectData.caseName && typeof projectData.caseName === 'string') {
        setCaseName(projectData.caseName);
      }
      if (projectData.notes && typeof projectData.notes === 'object' && setNotes) {
        setNotes(projectData.notes || {});
      }
      
      // Save to localStorage with error handling
      try {
        localStorage.setItem('r43_project', JSON.stringify(projectData));
      } catch (storageError) {
        // localStorage quota exceeded or disabled
        if (showToast) {
          showToast('Project loaded but could not save to browser storage.', 'warning');
        }
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error loading project';
      if (showToast) {
        showToast(`Error loading project: ${errorMessage}`, 'error');
      }
    }
  };
  
  reader.onerror = () => {
    if (!isCancelled) {
      if (showToast) {
        showToast('Error reading file. Please try again.', 'error');
      }
    }
  };
  
  reader.readAsText(file);
  
  // Return cleanup function
  return () => {
    isCancelled = true;
    if (reader.readyState === FileReader.LOADING) {
      reader.abort();
    }
  };
};

// Shared function for importing claims from DOCX/PDF files
const createClaimsImportHandler = (setClaims, onError) => {
  return async (file) => {
    try {
      if (onError) {
        onError({ message: `Parsing ${file.name}...`, type: 'info' });
      }

      let parsedClaims = [];
      const fileExtension = file.name.split('.').pop()?.toLowerCase();

      if (fileExtension === 'docx' || fileExtension === 'doc') {
        parsedClaims = await parseDOCXClaims(file);
      } else if (fileExtension === 'pdf') {
        parsedClaims = await parsePDFClaims(file);
      } else {
        throw new Error('Unsupported file type. Please use DOCX or PDF.');
      }

      // Map categories
      parsedClaims = parsedClaims.map(claim => ({
        ...claim,
        category: mapCategory(claim.category) || 'Uncategorized'
      }));

      // Add to claims state
      if (setClaims) {
        setClaims(prev => {
          // Check for duplicates and merge or add
          const existingCategories = new Set(prev.map(c => c.category.toLowerCase()));
          const newClaims = parsedClaims.filter(c => !existingCategories.has(c.category.toLowerCase()));
          return [...prev, ...newClaims];
        });
      }

      if (onError) {
        onError({ 
          message: `Imported ${parsedClaims.length} claim(s) from ${file.name}`, 
          type: 'success' 
        });
      }
    } catch (error) {
      if (onError) {
        onError({ 
          message: `Error importing ${file.name}: ${error.message}`, 
          type: 'error' 
        });
      }
    }
  };
};

// --- COMPONENTS ---

const FileUploadModal = ({ isOpen, onClose, onUpload }) => {
  const [dragActive, setDragActive] = useState(false);
  const [files, setFiles] = useState([]);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef(null);

  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
      const newFiles = Array.from(e.dataTransfer.files).filter(file => {
        if (file.size > MAX_FILE_SIZE) {
          return false;
        }
        return true;
      });
      setFiles(prev => [...prev, ...newFiles]);
    }
  };

  const handleFileInput = (e) => {
    if (e.target.files && e.target.files.length > 0) {
      const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
      const newFiles = Array.from(e.target.files).filter(file => {
        if (file.size > MAX_FILE_SIZE) {
          return false;
        }
        return true;
      });
      setFiles(prev => [...prev, ...newFiles]);
    }
  };

  const handleRemoveFile = (index) => {
    setFiles(prev => prev.filter((_, i) => i !== index));
  };

  const handleTriageSubmit = (fileIndex, triageData) => {
    setFiles(prev => prev.map((f, i) => 
      i === fileIndex ? { ...f, triage: triageData } : { ...f }
    ));
  };

  const handleUpload = async () => {
    setUploading(true);
    let uploadTimeout;
    
    try {
      // Simulate upload progress
      await new Promise(resolve => {
        uploadTimeout = setTimeout(resolve, 1000);
      });
      if (onUpload) {
        onUpload(files);
      }
      setFiles([]);
      setUploading(false);
      onClose();
    } catch (error) {
      // Upload failed - error handling would be implemented here
      setUploading(false);
    } finally {
      if (uploadTimeout) {
        clearTimeout(uploadTimeout);
      }
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-auto custom-scroll" onClick={(e) => e.stopPropagation()}>
        <div className="p-6 border-b border-slate-200 flex items-center justify-between">
          <h2 className="text-lg font-bold text-slate-800">Add Evidence</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <X size={20} />
          </button>
        </div>
        
        <div className="p-6">
          <div
            className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
              dragActive ? 'border-blue-500 bg-blue-50' : 'border-slate-300 bg-slate-50'
            }`}
            onDragEnter={handleDrag}
            onDragLeave={handleDrag}
            onDragOver={handleDrag}
            onDrop={handleDrop}
          >
            <UploadCloud className="mx-auto mb-4 text-slate-400" size={48} />
            <p className="text-sm font-semibold text-slate-700 mb-2">Drop files here or click to browse</p>
            <p className="text-xs text-slate-500 mb-4">Bank Statements, Financial Affidavits, PDFs, DOCX (Max 10MB per file)</p>
            <button
              onClick={() => fileInputRef.current?.click()}
              className="px-4 py-2 bg-blue-600 text-white text-sm font-bold rounded-md hover:bg-blue-500 transition-colors"
            >
              Select Files
            </button>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              className="hidden"
              onChange={handleFileInput}
              accept=".pdf,.docx,.doc,.csv,.xlsx,.xls"
            />
          </div>

          {files.length > 0 && (
            <div className="mt-6 space-y-4">
              <h3 className="text-sm font-bold text-slate-700">Files to Process ({files.length})</h3>
              {files.map((file, index) => (
                <FileTriageRow
                  key={`${file.name}-${file.size}-${index}`}
                  file={file}
                  onRemove={() => handleRemoveFile(index)}
                  onSubmit={(data) => handleTriageSubmit(index, data)}
                />
              ))}
              <div className="flex justify-end gap-3 pt-4 border-t border-slate-200">
                <button
                  onClick={onClose}
                  className="px-4 py-2 text-sm font-bold text-slate-600 hover:text-slate-800"
                >
                  Cancel
                </button>
                <button
                  onClick={handleUpload}
                  disabled={uploading || files.some(f => !f.triage)}
                  className="px-4 py-2 bg-blue-600 text-white text-sm font-bold rounded-md hover:bg-blue-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {uploading ? 'Uploading...' : 'Upload & Process'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

const FileTriageRow = ({ file, onRemove, onSubmit }) => {
  const [triage, setTriage] = useState({
    type: 'Bank Statement',
    entity: 'PERSONAL',
    parser: 'Standard Bank'
  });
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = () => {
    onSubmit(triage);
    setSubmitted(true);
  };

  return (
    <div className="bg-slate-50 border border-slate-200 rounded-lg p-4">
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <FileText size={16} className="text-rose-600" />
            <span className="text-sm font-semibold text-slate-700">{file.name}</span>
            <span className="text-xs text-slate-400">({file.size ? (file.size / 1024 / 1024).toFixed(2) : '0.00'} MB)</span>
          </div>
        </div>
        <button onClick={onRemove} className="text-slate-400 hover:text-rose-500">
          <X size={16} />
        </button>
      </div>
      
      {!submitted ? (
        <div className="grid grid-cols-3 gap-3">
          <div>
            <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Type</label>
            <select
              value={triage.type}
              onChange={(e) => setTriage({ ...triage, type: e.target.value })}
              className="w-full text-xs px-2 py-1.5 border border-slate-200 rounded-md bg-white"
            >
              <option>Bank Statement</option>
              <option>Financial Affidavit</option>
              <option>Other</option>
            </select>
          </div>
          <div>
            <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Entity</label>
            <select
              value={triage.entity}
              onChange={(e) => setTriage({ ...triage, entity: e.target.value })}
              className="w-full text-xs px-2 py-1.5 border border-slate-200 rounded-md bg-white"
            >
              <option>PERSONAL</option>
              <option>BUSINESS</option>
              <option>TRUST</option>
              <option>SPOUSE</option>
            </select>
          </div>
          <div>
            <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Parser</label>
            <select
              value={triage.parser}
              onChange={(e) => setTriage({ ...triage, parser: e.target.value })}
              className="w-full text-xs px-2 py-1.5 border border-slate-200 rounded-md bg-white"
            >
              <option>Standard Bank</option>
              <option>FNB</option>
              <option>Investec</option>
              <option>Generic CSV</option>
            </select>
          </div>
        </div>
      ) : (
        <div className="flex items-center gap-2 text-xs text-emerald-600">
          <Check size={14} />
          <span>Classified: {triage.type} | {triage.entity} | {triage.parser}</span>
        </div>
      )}
      
      {!submitted && (
        <button
          onClick={handleSubmit}
          className="mt-3 px-3 py-1.5 bg-blue-600 text-white text-xs font-bold rounded-md hover:bg-blue-500 transition-colors"
        >
          Confirm Classification
        </button>
      )}
    </div>
  );
};

const NoteModal = ({ isOpen, onClose, transaction, note, onSave }) => {
  const [noteText, setNoteText] = useState(note || '');

  if (!isOpen) return null;

  const handleSave = () => {
    if (onSave && transaction?.id) {
      onSave(transaction.id, noteText);
    }
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md" onClick={(e) => e.stopPropagation()}>
        <div className="p-4 border-b border-slate-200 flex items-center justify-between">
          <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
            <StickyNote size={16} className="text-amber-500" />
            Transaction Note
          </h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <X size={18} />
          </button>
        </div>
        <div className="p-4">
          <div className="mb-3 text-xs text-slate-600">
            <div className="font-semibold">{(transaction?.clean || transaction?.desc || '').replace(/[<>\"'&]/g, '')}</div>
            <div className="text-slate-400">{(transaction?.date || '')} • {(transaction?.acc || '').replace(/[<>\"'&]/g, '')}</div>
          </div>
          <textarea
            value={noteText}
            onChange={(e) => {
              // Sanitize note input
              let sanitized = e.target.value
                .replace(/<[^>]*>/g, '') // Remove HTML tags
                .replace(/javascript:/gi, '') // Remove javascript: protocol
                .replace(/on\w+=/gi, ''); // Remove event handlers
              // Limit length to prevent DoS
              if (sanitized.length > 1000) {
                sanitized = sanitized.substring(0, 1000);
              }
              setNoteText(sanitized);
            }}
            placeholder="Add annotation or note about this transaction..."
            className="w-full h-32 p-3 border border-slate-200 rounded-md text-sm resize-none focus:outline-none focus:ring-2 focus:ring-amber-400"
            maxLength={1000}
          />
        </div>
        <div className="p-4 border-t border-slate-200 flex justify-end gap-2">
          <button
            onClick={onClose}
            className="px-3 py-1.5 text-xs font-bold text-slate-600 hover:text-slate-800"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="px-3 py-1.5 bg-amber-500 text-white text-xs font-bold rounded-md hover:bg-amber-600 transition-colors"
          >
            Save Note
          </button>
        </div>
      </div>
    </div>
  );
};

const NavSidebar = ({ view, setView, onAddEvidence }) => (
  <nav className="w-16 bg-slate-900 flex flex-col items-center py-6 space-y-8 shrink-0 z-20 shadow-xl relative">
    <div className="w-10 h-10 bg-amber-500 rounded-lg flex items-center justify-center text-white font-bold text-xs shadow-lg shadow-amber-900/50">
      R43
    </div>
    <div className="flex flex-col space-y-6 w-full items-center">
      <button onClick={() => setView('dashboard')} className={`w-10 h-10 rounded-lg flex items-center justify-center transition-all ${view === 'dashboard' ? 'bg-slate-700 text-amber-400' : 'text-slate-500 hover:text-slate-300'}`} title="Dashboard">
        <PieChart size={20} />
      </button>
      <button onClick={() => setView('workbench')} className={`w-10 h-10 rounded-lg flex items-center justify-center transition-all ${view === 'workbench' ? 'bg-slate-700 text-amber-400' : 'text-slate-500 hover:text-slate-300'}`} title="Reconciliation Workbench">
        <TableProperties size={20} />
      </button>
      <button onClick={() => setView('evidence')} className={`w-10 h-10 rounded-lg flex items-center justify-center transition-all ${view === 'evidence' ? 'bg-slate-700 text-amber-400' : 'text-slate-500 hover:text-slate-300'}`} title="Evidence Locker">
        <FileStack size={20} />
      </button>
    </div>
    <div className="mt-auto flex flex-col space-y-6">
      <button
        onClick={onAddEvidence}
        className="w-12 h-12 rounded-full bg-blue-600 text-white flex items-center justify-center shadow-lg hover:bg-blue-500 transition-all hover:scale-110"
        title="Add Evidence"
      >
        <Plus size={20} />
      </button>
      <div className="w-8 h-8 rounded-full bg-slate-700 border-2 border-slate-600 flex items-center justify-center text-[10px] text-white font-bold">
        SC
      </div>
    </div>
  </nav>
);

const TopBar = ({ title, subtitle, caseName, onCaseNameChange, onSave, saved, onError }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(caseName);

  const handleSave = () => {
    if (onCaseNameChange) {
      onCaseNameChange(editValue);
    }
    setIsEditing(false);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      handleSave();
    } else if (e.key === 'Escape') {
      setEditValue(caseName);
      setIsEditing(false);
    }
  };

  return (
    <div className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-6 shrink-0 z-10">
      <div>
        <h1 className="text-lg font-bold text-slate-800 flex items-center gap-2">
          {title}
          {isEditing ? (
            <input
              type="text"
              value={editValue}
              onChange={(e) => {
                // Enhanced input sanitization: remove HTML tags, script tags, and dangerous characters
                let sanitized = e.target.value
                  .replace(/<[^>]*>/g, '') // Remove HTML tags
                  .replace(/[<>\"'&]/g, '') // Remove dangerous characters
                  .replace(/javascript:/gi, '') // Remove javascript: protocol
                  .replace(/on\w+=/gi, '') // Remove event handlers
                  .replace(/data:/gi, '') // Remove data: protocol
                  .replace(/vbscript:/gi, '') // Remove vbscript: protocol
                  .trim(); // Remove leading/trailing whitespace
                // Limit length to prevent DoS
                if (sanitized.length > 100) {
                  sanitized = sanitized.substring(0, 100);
                }
                setEditValue(sanitized);
              }}
              onBlur={handleSave}
              onKeyDown={handleKeyDown}
              maxLength={100}
              className="px-2 py-0.5 bg-white text-amber-700 text-[10px] font-bold uppercase rounded-full tracking-wider border-2 border-amber-300 focus:outline-none focus:ring-2 focus:ring-amber-400"
              autoFocus
            />
          ) : (
            <span
              onClick={() => setIsEditing(true)}
              className="px-2 py-0.5 bg-amber-50 text-amber-700 text-[10px] font-bold uppercase rounded-full tracking-wider border border-amber-100 cursor-pointer hover:bg-amber-100 transition-colors"
              title="Click to edit case name"
            >
              {caseName}
            </span>
          )}
          {saved && (
            <span className="text-emerald-600 flex items-center gap-1 text-[10px] animate-fade-in">
              <Check size={12} />
              Saved
            </span>
          )}
        </h1>
        <p className="text-xs text-slate-500 font-medium">{subtitle}</p>
      </div>
      <div className="flex items-center gap-4">
        <div className="flex bg-slate-100 p-1 rounded-lg">
          <button className="px-3 py-1.5 text-xs font-bold rounded-md bg-white text-slate-800 shadow-sm border border-slate-200">Rule 43</button>
          <button className="px-3 py-1.5 text-xs font-bold rounded-md text-slate-500 hover:text-slate-700">Divorce</button>
        </div>
        <button
          onClick={onSave}
          className="inline-flex items-center gap-2 px-3 py-2 text-xs font-bold rounded-md bg-emerald-600 text-white shadow-sm hover:bg-emerald-500 transition-colors"
          title="Export Analysis (Save Project)"
        >
          <Save size={14} />
          Export Analysis
        </button>
        {/* Download Report button hidden for MVP demo - to be implemented in future release */}
        {false && (
          <button 
            onClick={() => {
              // Download Report functionality - to be implemented
              if (onError) {
                onError({ 
                  message: 'Download Report functionality is not yet available.', 
                  type: 'warning' 
                });
              }
            }}
            className="inline-flex items-center gap-2 px-3 py-2 text-xs font-bold rounded-md bg-blue-600 text-white shadow-sm hover:bg-blue-500 transition-colors"
            title="Download Report (Not yet implemented)"
          >
            <Download size={14} />
            Download Report
          </button>
        )}
      </div>
    </div>
  );
};

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
    <div className="p-8 overflow-auto h-full custom-scroll bg-slate-50/50">
      <div className="mb-6 flex justify-end">
        <button
          onClick={handleLoadClick}
          className="inline-flex items-center gap-2 px-4 py-2 text-sm font-bold rounded-md bg-white text-slate-700 border border-slate-300 shadow-sm hover:bg-slate-50 transition-colors"
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
          <div className="grid grid-cols-4 gap-6 mb-8">
            <div className="p-5 rounded-xl border border-slate-100 shadow-sm bg-white border-l-4 border-l-emerald-500">
              <div className="text-xs font-bold text-slate-400 uppercase">Income (Proven)</div>
              <div className="text-2xl font-mono font-bold text-emerald-600">
                {totalIncome.toLocaleString('en-ZA', { style: 'currency', currency: 'ZAR', maximumFractionDigits: 0 })}
              </div>
              <div className="text-[10px] text-slate-400 mt-1">
                {transactions.filter(tx => tx && tx.amount > 0).length} transactions
              </div>
            </div>
            <div className="p-5 rounded-xl border border-slate-100 shadow-sm bg-white border-l-4 border-l-rose-500">
              <div className="text-xs font-bold text-slate-400 uppercase">Expenses (Proven)</div>
              <div className="text-2xl font-mono font-bold text-rose-600">
                {totalExpenses.toLocaleString('en-ZA', { style: 'currency', currency: 'ZAR', maximumFractionDigits: 0 })}
              </div>
              <div className="text-[10px] text-rose-400 mt-1">
                {transactions.filter(tx => tx && tx.amount < 0).length} transactions
              </div>
            </div>
            <div className="p-5 rounded-xl border border-slate-100 shadow-sm bg-white border-l-4 border-l-slate-500">
              <div className="text-xs font-bold text-slate-400 uppercase">Claimed Needs (KPR8)</div>
              <div className="text-2xl font-mono font-bold text-slate-600">
                {totalClaimed.toLocaleString('en-ZA', { style: 'currency', currency: 'ZAR', maximumFractionDigits: 0 })}
              </div>
              <div className="text-[10px] text-slate-400 mt-1">
                {claims.length} claim{claims.length !== 1 ? 's' : ''}
              </div>
            </div>
            <div className="p-5 rounded-xl border border-slate-100 shadow-sm bg-white border-l-4 border-l-amber-500">
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
        <div className="grid grid-cols-3 gap-6 h-[400px]">
          <div className="col-span-2 bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex flex-col">
            <div className="flex justify-between items-center mb-6">
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

          <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm overflow-auto custom-scroll">
            <h3 className="font-bold text-slate-700 mb-4 flex items-center gap-2">
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

const DocumentInventory = ({ transactions, periodFilter, monthsInScope, files, claims, onImport, setClaims }) => {
  const [entryMode, setEntryMode] = useState('manual');
  const fileInputRef = useRef(null);
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
    if (entryMode === 'import') {
      fileInputRef.current?.click();
    }
  }, [entryMode]);

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files.length > 0 && onImport) {
      onImport(e.target.files[0]);
      e.target.value = '';
    }
  };

  useEffect(() => {
    if (entryMode === 'import') {
      handleImportClick();
    }
  }, [entryMode, handleImportClick]);

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
    <div className="h-full bg-slate-50 flex flex-col border-r border-slate-200">
      <div className="flex-1 flex flex-col min-h-0 border-b border-slate-200">
        <div className="h-10 bg-white border-b flex items-center px-4 shadow-sm shrink-0 font-bold text-xs text-slate-700 justify-between">
          <span>Evidence Locker</span>
          <span className="text-[10px] bg-slate-100 px-2 py-0.5 rounded text-slate-500">{files.length} Files</span>
        </div>
        <div className="p-4 overflow-auto custom-scroll bg-slate-50">
          <div className="space-y-2">
            {files.map(file => {
              if (!file || !file.id) return null;
              const safeName = file.name ? String(file.name).replace(/[<>\"'&]/g, '') : 'Unknown';
              const safeDesc = file.desc ? String(file.desc).replace(/[<>\"'&]/g, '') : '';
              return (
                <div key={file.id} className="bg-white border border-slate-200 rounded p-3 flex flex-col gap-1 shadow-sm hover:border-blue-300 cursor-pointer transition-colors group">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-xs font-bold text-slate-700">
                      <div className="text-rose-600">
                        {safeName.toLowerCase().includes('pdf') ? <FileText size={14} /> : <File size={14} />}
                      </div>
                      <div className="truncate max-w-[180px]">{safeName}</div>
                    </div>
                    <span className={`text-[9px] px-1.5 py-0.5 rounded font-bold uppercase ${file.entity === 'LEGAL' ? 'bg-purple-50 text-purple-700' : 'bg-slate-100 text-slate-500'}`}>{file.entity || 'UNKNOWN'}</span>
                  </div>
                  <div className="text-[10px] text-slate-400 pl-6">{safeDesc}</div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <div className="h-3/5 flex flex-col bg-white border-t border-slate-200 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)] z-10">
        <div className="h-10 bg-slate-50 border-b flex items-center justify-between px-4 shrink-0">
          <span className="text-xs font-bold text-slate-700 flex items-center gap-2">
            <Scale className="text-amber-600" size={14} />
            Claimed vs. Proven (KPR8)
          </span>
          <div className="flex items-center gap-2 text-[9px] font-semibold text-slate-500">
            <span className="uppercase tracking-wide">Entry Mode:</span>
            <div className="flex bg-slate-200 rounded-md overflow-hidden">
              {entryModes.map((mode) => (
                <button
                  key={mode.key}
                  onClick={() => !mode.disabled && setEntryMode(mode.key)}
                  disabled={mode.disabled}
                  className={`px-2 py-0.5 flex items-center gap-1 ${entryMode === mode.key ? 'bg-white text-slate-900' : mode.disabled ? 'text-slate-300 cursor-not-allowed' : 'text-slate-500'}`}
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
        <div className="px-4 py-1 text-[9px] text-slate-400 bg-white border-b border-slate-100 italic">
          {entryModeCopy[entryMode]}
        </div>
        <div className="flex-1 overflow-auto custom-scroll p-0">
          <table className="w-full text-left border-collapse">
            <thead className="bg-slate-50 sticky top-0 z-10 text-[9px] font-bold text-slate-500 uppercase">
              <tr>
                <th className="px-3 py-2 border-b">Category / Description</th>
                <th className="px-3 py-2 border-b text-right">Claimed</th>
                <th className="px-3 py-2 border-b text-right">Proven (Avg, {periodFilter})</th>
                <th className="px-3 py-2 border-b text-right w-32">Status</th>
              </tr>
            </thead>
            <tbody>
              {claims.map(claim => {
                const proven = getProvenAvg(claim.category);
                const traffic = getTrafficLight(proven, claim.claimed);

                return (
                  <tr key={claim.id} className="border-b border-slate-100 hover:bg-amber-50 text-xs group transition-colors">
                    <td className="px-3 py-2">
                      <div className="font-semibold text-slate-700">{claim.category}</div>
                      <div className="text-[9px] text-slate-400">{claim.desc}</div>
                    </td>
                    <td className="px-3 py-2 text-right font-mono text-slate-500">
                      {claim.claimed.toLocaleString('en-ZA', { style: 'currency', currency: 'ZAR', maximumFractionDigits: 0 })}
                    </td>
                    <td className={`px-3 py-2 text-right font-mono font-bold ${traffic.colorClass}`}>
                      {proven > 0 ? proven.toLocaleString('en-ZA', { style: 'currency', currency: 'ZAR', maximumFractionDigits: 0 }) : '-'}
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex flex-col gap-1">
                        <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                          <div
                            className={`h-full ${traffic.barClass}`}
                            style={{ width: `${Math.max(0, Math.min(traffic.ratio * 100, 160))}%` }}
                          />
                        </div>
                        <div className={`text-[9px] font-semibold flex items-center gap-1 ${traffic.colorClass}`}>
                          {traffic.label === 'Verified' && <CheckCheck size={10} />}
                          {traffic.label}
                        </div>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

const PDFViewer = ({ entity, activeTxId, transactions, files, accounts, setClaims }) => {
  const [pdfUrl, setPdfUrl] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [numPages, setNumPages] = useState(null);
  const [zoom, setZoom] = useState(1.0);

  const currentFile = (files && Array.isArray(files)) ? (files.find(f => f && f.entity === entity) || files[0]) : null;
  
  const entityAccounts = useMemo(() => {
    if (!accounts || typeof accounts !== 'object') return [];
    if (entity === 'PERSONAL') return [accounts.PERSONAL, accounts.TRUST].filter(Boolean);
    if (entity === 'BUSINESS') return [accounts.BUSINESS, accounts.MYMOBIZ].filter(Boolean);
    if (entity === 'CREDIT') return [accounts.CREDIT].filter(Boolean);
    if (entity === 'TRUST') return [accounts.TRUST].filter(Boolean);
    return [];
  }, [entity, accounts]);

  const viewerTransactions = entityAccounts.length && Array.isArray(transactions)
    ? transactions.filter((tx) => tx && tx.acc && entityAccounts.includes(tx.acc))
    : (Array.isArray(transactions) ? transactions : []);

  // Handle file URL creation
  useEffect(() => {
    let objectUrl = null;

    if (!currentFile) {
      setPdfUrl(null);
      return;
    }

    // If file has a File object (from upload)
    if (currentFile.file && currentFile.file instanceof File) {
      objectUrl = URL.createObjectURL(currentFile.file);
      setPdfUrl(objectUrl);
    } else if (currentFile.url) {
      // If file has a URL property
      setPdfUrl(currentFile.url);
    } else if (currentFile.data) {
      // Try to create a data URL if file has data
      setPdfUrl(currentFile.data);
    } else {
      setPdfUrl(null);
    }

    // Cleanup: revoke object URL when component unmounts or file changes
    return () => {
      if (objectUrl) {
        URL.revokeObjectURL(objectUrl);
      }
    };
  }, [currentFile]);

  const handleLoadSuccess = (numPages) => {
    setNumPages(numPages);
  };

  return (
    <div className="h-full bg-slate-200 border-r border-slate-300 flex flex-col relative">
      <div className="h-10 bg-white border-b flex items-center justify-between px-4 shadow-sm z-10 shrink-0">
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-slate-700">Document Viewer</span>
          <span className="text-[10px] text-slate-400">|</span>
          <span className="text-xs text-slate-600 font-mono">{currentFile && currentFile.name ? currentFile.name.replace(/[<>\"'&]/g, '') : 'No file'}</span>
        </div>
      </div>
      
      {/* PDF Viewer */}
      {pdfUrl ? (
        <PDFDocumentViewer
          fileUrl={pdfUrl}
          onLoadSuccess={handleLoadSuccess}
          currentPage={currentPage}
          onPageChange={setCurrentPage}
          zoom={zoom}
          onZoomChange={setZoom}
        />
      ) : (
        <div className="flex-1 overflow-auto custom-scroll p-8 flex justify-center bg-slate-200/50">
          <div className="bg-white w-[595px] h-[842px] shadow-lg shrink-0 p-10 relative text-slate-800 flex items-center justify-center">
            <div className="text-center text-slate-400">
              <FileText size={48} className="mx-auto mb-4" />
              <p className="text-sm">No PDF file available</p>
              <p className="text-xs mt-2">Upload a PDF file to view it here</p>
            </div>
          </div>
        </div>
      )}

      {/* Transaction Overlay - Side Panel */}
      <div className="absolute right-0 top-10 bottom-0 w-64 bg-white/95 border-l border-slate-300 shadow-lg overflow-auto custom-scroll">
        <div className="p-3 border-b border-slate-200 bg-slate-50">
          <div className="text-xs font-bold text-slate-700">Transactions ({viewerTransactions.length})</div>
        </div>
        <div className="p-2 space-y-1">
          {viewerTransactions.map((tx) => {
            if (!tx || !tx.id) return null;
            const safeDesc = tx.desc ? String(tx.desc).replace(/[<>\"'&]/g, '') : '';
            return (
              <div 
                key={tx.id} 
                className={`p-2 text-xs border-b border-slate-100 hover:bg-yellow-50 cursor-pointer ${activeTxId === tx.id ? 'bg-yellow-100' : ''}`}
              >
                <div className="font-mono text-[10px] text-slate-500">{tx.date || ''}</div>
                <div className="truncate font-semibold text-slate-700">{safeDesc}</div>
                <div className="text-right font-mono font-bold text-slate-800">
                  {tx.amount ? (tx.amount < 0 ? '-' : '+') + Math.abs(tx.amount).toFixed(2) : '0.00'}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

const EvidenceLockerView = ({ transactions, claims, files, accounts, onError, setClaims }) => {
  const [filterEntity, setFilterEntity] = useState('ALL');
  const [periodFilter, setPeriodFilter] = useState('3M');
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
          ? <DocumentInventory transactions={scopedTransactions} periodFilter={periodFilter} monthsInScope={monthsInScope} files={files} claims={claims} onImport={createClaimsImportHandler(setClaims, onError)} setClaims={setClaims} />
          : <PDFViewer entity={filterEntity} transactions={transactions} activeTxId={null} files={files} accounts={accounts} setClaims={setClaims} />
        }
      </div>
    </div>
  );
};

const WorkbenchView = ({ data, transactions, setTransactions, claims, setClaims, notes, setNotes, onError }) => {
  const [filterEntity, setFilterEntity] = useState('ALL');
  const [periodFilter, setPeriodFilter] = useState('1M');
  const [noteModal, setNoteModal] = useState({ isOpen: false, transaction: null });
  const monthsInScope = periodMonthsMap[periodFilter] || 1;
  const latestTransactionDate = useMemo(() => getLatestTransactionDate(transactions), [transactions]);

  const filteredTx = useMemo(() => {
    const byEntity = filterTransactionsByEntity(transactions, filterEntity, data.accounts);
    return filterTransactionsByPeriod(byEntity, periodFilter, latestTransactionDate);
  }, [transactions, filterEntity, periodFilter, data.accounts, latestTransactionDate]);

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

  return (
    <div className="flex flex-1 h-full overflow-hidden">
      <div className="w-1/2 flex flex-col">
        {filterEntity === 'ALL'
          ? <DocumentInventory transactions={filteredTx} periodFilter={periodFilter} monthsInScope={monthsInScope} files={data.files} claims={claims} onImport={createClaimsImportHandler(setClaims, onError)} setClaims={setClaims} />
          : <PDFViewer entity={filterEntity} transactions={transactions} activeTxId={null} files={data.files} accounts={data.accounts} setClaims={setClaims} />
        }
      </div>
      <div className="w-1/2 bg-white flex flex-col h-full border-l border-slate-200 shadow-xl z-20">
        <div className="h-12 border-b border-slate-200 flex items-center justify-between px-4 shrink-0 bg-slate-50">
          <div className="flex bg-slate-200 p-0.5 rounded-lg">
            {['ALL', 'PERSONAL', 'BUSINESS', 'CREDIT'].map(f => (
              <button key={f} onClick={() => setFilterEntity(f)} className={`px-3 py-1 text-[10px] font-bold rounded-md transition-all ${filterEntity === f ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>{f}</button>
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
            <div>Date</div>
            <div>Description</div>
            <div>Category</div>
            <div className="text-right">Amount</div>
            <div className="text-center">Evidence</div>
            <div></div>
          </div>
          {filteredTx.map(tx => {
            if (!tx || !tx.id) return null;
            const safeClean = tx.clean ? String(tx.clean).replace(/[<>\"'&]/g, '') : '';
            const safeAcc = tx.acc ? String(tx.acc).replace(/[<>\"'&]/g, '') : '';
            return (
              <div key={tx.id} className="grid grid-cols-[80px_1fr_120px_110px_110px_30px] border-b border-slate-100 py-2.5 px-3 text-xs items-center hover:bg-amber-50 group transition-colors">
                <div className="font-mono text-slate-500 text-[10px]">{tx.date || ''}</div>
                <div className="pr-2">
                  <div className="font-bold text-slate-700 truncate">{safeClean}</div>
                  <div className="text-[9px] text-slate-400 truncate">{safeAcc}</div>
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
          })}
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

const App = () => {
  // Default categories for the application
  const defaultCategories = [
    'Groceries/Household', 'School Fees', 'Medical', 'Utilities', 'Transport',
    'Insurance', 'Bond Repayment', 'Rent', 'Maintenance', 'Child Maintenance',
    'Legal Fees', 'Clothing', 'Entertainment', 'Uncategorized'
  ];

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
  const [saved, setSaved] = useState(false);
  const { showToast } = useToast();
  const saveTimeoutRef = useRef(null);
  const savedTimeoutRef = useRef(null);
  const loadProjectCleanupRef = useRef(null);

  // Load from localStorage on mount
  useEffect(() => {
    const savedProject = localStorage.getItem('r43_project');
    if (savedProject) {
      try {
        const projectData = JSON.parse(savedProject);
        if (projectData.accounts && projectData.transactions && projectData.claims) {
          setAppData({
            accounts: projectData.accounts,
            categories: projectData.categories && projectData.categories.length > 0 
              ? projectData.categories 
              : defaultCategories,
            files: projectData.files || [],
            charts: projectData.charts || [],
            alerts: projectData.alerts || []
          });
          setTransactions(projectData.transactions || []);
          setClaims(projectData.claims || []);
          if (projectData.caseName) {
            setCaseName(projectData.caseName);
          }
          if (projectData.notes) {
            setNotes(projectData.notes || {});
          }
        }
      } catch (error) {
        // Error loading from localStorage - continue with empty state
        console.error('Error loading project from localStorage:', error);
      }
    }
    // No fallback to mock data - app starts empty
  }, []);

  // Auto-save to localStorage whenever data changes
  useEffect(() => {
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
        alerts: appData.alerts
      };
      try {
        localStorage.setItem('r43_project', JSON.stringify(projectData));
        setSaved(true);
        // Clear previous saved timeout if exists
        if (savedTimeoutRef.current) {
          clearTimeout(savedTimeoutRef.current);
        }
        savedTimeoutRef.current = setTimeout(() => setSaved(false), 3000);
      } catch (storageError) {
        // localStorage quota exceeded or disabled - auto-save failure shouldn't break the app
      }
    }, 1000); // Debounce auto-save by 1 second

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
  }, [appData, transactions, claims, notes, caseName]);

  const handleSave = () => {
    if (appData) {
      exportProject(appData, transactions, claims, caseName);
    }
  };

  const handleLoadProject = (file) => {
    // Cleanup previous load if still in progress
    if (loadProjectCleanupRef.current) {
      loadProjectCleanupRef.current();
      loadProjectCleanupRef.current = null;
    }
    
    const cleanup = loadProject(file, setAppData, setTransactions, setClaims, setCaseName, setNotes, showToast);
    if (cleanup) {
      loadProjectCleanupRef.current = cleanup;
    }
  };

  // Cleanup loadProject on unmount
  useEffect(() => {
    return () => {
      if (loadProjectCleanupRef.current) {
        loadProjectCleanupRef.current();
      }
    };
  }, []);

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
        if (!file.triage || !file.triage.type) {
          errors.push({ file: file.name, message: 'File triage not completed' });
          continue;
        }

        if (file.triage.type === 'Bank Statement') {
          const result = await processBankStatement(
            file,
            file.triage.parser || 'Generic CSV',
            file.triage.entity || 'PERSONAL'
          );

          if (result.errors && result.errors.length > 0) {
            errors.push(...result.errors);
          }

          if (result.transactions && result.transactions.length > 0) {
            setTransactions(prev => [...prev, ...result.transactions]);
            transactionCount += result.transactions.length;
            processedCount++;
          }

          // Add file metadata
          newFiles.push({
            id: `${Date.now()}-${Math.random().toString(36).substring(2, 11)}`,
            name: file.name,
            desc: `Bank Statement - ${file.triage.parser}`,
            entity: file.triage.entity || 'PERSONAL',
            type: 'Bank Statement',
            uploadedAt: new Date().toISOString()
          });

        } else if (file.triage.type === 'Financial Affidavit') {
          const result = await processFinancialAffidavit(file);

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
            id: `${Date.now()}-${Math.random().toString(36).substring(2, 11)}`,
            name: file.name,
            desc: 'Financial Affidavit',
            entity: file.triage.entity || 'LEGAL',
            type: 'Financial Affidavit',
            uploadedAt: new Date().toISOString()
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

  // App always has appData initialized, no loading state needed

  return (
    <div className="flex h-screen w-screen bg-slate-100 font-sans text-slate-900">
      <NavSidebar view={view} setView={setView} onAddEvidence={() => setFileUploadModal(true)} />
      <div className="flex-1 flex flex-col min-w-0">
        <TopBar
          title="Rule 43 Workspace"
          subtitle="Financial Analysis & Reconciliation"
          caseName={caseName}
          onCaseNameChange={setCaseName}
          onSave={handleSave}
          saved={saved}
          onError={(err) => showToast(err.message, err.type || 'error')}
        />
        <div className="flex-1 min-h-0 relative">
          {view === 'dashboard' && <DashboardView data={appData} transactions={transactions} claims={claims} onLoadProject={handleLoadProject} />}
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
            />
          )}
        </div>
      </div>
      <FileUploadModal
        isOpen={fileUploadModal}
        onClose={() => setFileUploadModal(false)}
        onUpload={handleFileUpload}
      />
    </div>
  );
};

export default App;
