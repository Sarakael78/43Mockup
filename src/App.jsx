import React, { useState, useMemo, useEffect } from 'react';
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
  Download,
  Sparkles,
  CheckCheck,
  UploadCloud,
  Save,
  FolderOpen,
  X,
  Plus,
  Check
} from 'lucide-react';

const periodMonthsMap = { '1M': 1, '3M': 3, '6M': 6 };

const getLatestTransactionDate = (transactions) => {
  if (!transactions?.length) return null;
  return transactions.reduce((latest, tx) => (tx.date > latest ? tx.date : latest), transactions[0].date);
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
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};

const loadProject = (file, setAppData, setTransactions, setClaims, setCaseName) => {
  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      const projectData = JSON.parse(e.target.result);
      
      // Validate schema
      if (!projectData.accounts || !projectData.transactions || !projectData.claims) {
        throw new Error('Invalid project file format');
      }
      
      setAppData({
        accounts: projectData.accounts,
        categories: projectData.categories || [],
        files: projectData.files || [],
        charts: projectData.charts || [],
        alerts: projectData.alerts || []
      });
      setTransactions(projectData.transactions || []);
      setClaims(projectData.claims || []);
      if (projectData.caseName) {
        setCaseName(projectData.caseName);
      }
      
      // Save to localStorage
      localStorage.setItem('r43_project', JSON.stringify(projectData));
    } catch (error) {
      alert(`Error loading project: ${error.message}`);
      console.error('Load error:', error);
    }
  };
  reader.readAsText(file);
};

// --- COMPONENTS ---

const FileUploadModal = ({ isOpen, onClose, onUpload }) => {
  const [dragActive, setDragActive] = useState(false);
  const [files, setFiles] = useState([]);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = React.useRef(null);

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
      const newFiles = Array.from(e.dataTransfer.files);
      setFiles(prev => [...prev, ...newFiles]);
    }
  };

  const handleFileInput = (e) => {
    if (e.target.files && e.target.files.length > 0) {
      const newFiles = Array.from(e.target.files);
      setFiles(prev => [...prev, ...newFiles]);
    }
  };

  const handleRemoveFile = (index) => {
    setFiles(prev => prev.filter((_, i) => i !== index));
  };

  const handleTriageSubmit = (fileIndex, triageData) => {
    setFiles(prev => prev.map((f, i) => 
      i === fileIndex ? { ...f, triage: triageData } : f
    ));
  };

  const handleUpload = async () => {
    setUploading(true);
    // Simulate upload progress
    await new Promise(resolve => setTimeout(resolve, 1000));
    if (onUpload) {
      onUpload(files);
    }
    setFiles([]);
    setUploading(false);
    onClose();
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
            <p className="text-xs text-slate-500 mb-4">Bank Statements, Financial Affidavits, PDFs, DOCX</p>
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
                  key={index}
                  file={file}
                  index={index}
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

const FileTriageRow = ({ file, index, onRemove, onSubmit }) => {
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
            <span className="text-xs text-slate-400">({(file.size / 1024 / 1024).toFixed(2)} MB)</span>
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
    if (onSave) {
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
            <div className="font-semibold">{transaction?.clean || transaction?.desc}</div>
            <div className="text-slate-400">{transaction?.date} • {transaction?.acc}</div>
          </div>
          <textarea
            value={noteText}
            onChange={(e) => setNoteText(e.target.value)}
            placeholder="Add annotation or note about this transaction..."
            className="w-full h-32 p-3 border border-slate-200 rounded-md text-sm resize-none focus:outline-none focus:ring-2 focus:ring-amber-400"
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

const TopBar = ({ title, subtitle, caseName, onCaseNameChange, onSave, saved }) => {
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
              onChange={(e) => setEditValue(e.target.value)}
              onBlur={handleSave}
              onKeyDown={handleKeyDown}
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
        <button className="inline-flex items-center gap-2 px-3 py-2 text-xs font-bold rounded-md bg-blue-600 text-white shadow-sm hover:bg-blue-500 transition-colors">
          <Download size={14} />
          Download Report
        </button>
      </div>
    </div>
  );
};

const DashboardView = ({ data, onLoadProject }) => {
  const fileInputRef = React.useRef(null);

  const handleLoadClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files.length > 0) {
      onLoadProject(e.target.files[0]);
      e.target.value = ''; // Reset input
    }
  };

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
    <div className="grid grid-cols-4 gap-6 mb-8">
      <div className="p-5 rounded-xl border border-slate-100 shadow-sm bg-white border-l-4 border-l-emerald-500">
        <div className="text-xs font-bold text-slate-400 uppercase">Sept Income (Proven)</div>
        <div className="text-2xl font-mono font-bold text-emerald-600">R 14,992</div>
        <div className="text-[10px] text-slate-400 mt-1">Excludes inter-company transfers</div>
      </div>
      <div className="p-5 rounded-xl border border-slate-100 shadow-sm bg-white border-l-4 border-l-rose-500">
        <div className="text-xs font-bold text-slate-400 uppercase">Sept Expenses (Proven)</div>
        <div className="text-2xl font-mono font-bold text-rose-600">R 58,500</div>
        <div className="text-[10px] text-rose-400 mt-1">Includes R30k Legal Fee</div>
      </div>
      <div className="p-5 rounded-xl border border-slate-100 shadow-sm bg-white border-l-4 border-l-slate-500">
        <div className="text-xs font-bold text-slate-400 uppercase">Claimed Needs (KPR8)</div>
        <div className="text-2xl font-mono font-bold text-slate-600">R 34,633</div>
        <div className="text-[10px] text-slate-400 mt-1">Monthly Budget Annexure</div>
      </div>
      <div className="p-5 rounded-xl border border-slate-100 shadow-sm bg-white border-l-4 border-l-amber-500">
        <div className="text-xs font-bold text-slate-400 uppercase">Deficit (Actual)</div>
        <div className="text-2xl font-mono font-bold text-amber-600">-R 43,508</div>
        <div className="text-[10px] text-amber-400 mt-1">Burn rate critical</div>
      </div>
    </div>

    <div className="grid grid-cols-3 gap-6 h-[400px]">
      <div className="col-span-2 bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex flex-col">
        <div className="flex justify-between items-center mb-6">
          <h3 className="font-bold text-slate-700">Financial Trend (June - Sept 2025)</h3>
        </div>
        <div className="flex-1 w-full min-h-0">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data.charts}>
              <XAxis dataKey="name" fontSize={10} axisLine={false} tickLine={false} />
              <YAxis fontSize={10} axisLine={false} tickLine={false} tickFormatter={(val) => `R${val/1000}k`} />
              <Tooltip cursor={{ fill: '#f1f5f9' }} formatter={(value) => `R ${value.toLocaleString()}`} />
              <Bar dataKey="income" name="Income" fill="#10b981" radius={[4, 4, 0, 0]} barSize={20} />
              <Bar dataKey="expense" name="Expenses" fill="#f43f5e" radius={[4, 4, 0, 0]} barSize={20} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm overflow-auto custom-scroll">
        <h3 className="font-bold text-slate-700 mb-4 flex items-center gap-2">
          <Bell className="text-slate-400" size={16} />
          Forensic Alerts
        </h3>
        {data.alerts.map(alert => (
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
        ))}
      </div>
    </div>
  </div>
  );
};

const DocumentInventory = ({ transactions, periodFilter, monthsInScope, files, claims, onImport }) => {
  const [entryMode, setEntryMode] = useState('manual');
  const fileInputRef = React.useRef(null);
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

  const handleImportClick = () => {
    if (entryMode === 'import') {
      fileInputRef.current?.click();
    }
  };

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
  }, [entryMode]);

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
            {files.map(file => (
              <div key={file.id} className="bg-white border border-slate-200 rounded p-3 flex flex-col gap-1 shadow-sm hover:border-blue-300 cursor-pointer transition-colors group">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-xs font-bold text-slate-700">
                    <div className="text-rose-600">
                      {file.name.includes('pdf') ? <FileText size={14} /> : <File size={14} />}
                    </div>
                    <div className="truncate max-w-[180px]">{file.name}</div>
                  </div>
                  <span className={`text-[9px] px-1.5 py-0.5 rounded font-bold uppercase ${file.entity === 'LEGAL' ? 'bg-purple-50 text-purple-700' : 'bg-slate-100 text-slate-500'}`}>{file.entity}</span>
                </div>
                <div className="text-[10px] text-slate-400 pl-6">{file.desc}</div>
              </div>
            ))}
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

const PDFViewer = ({ entity, activeTxId, transactions, files, accounts }) => {
  const currentFile = files.find(f => f.entity === entity) || files[0];
  const entityAccounts = useMemo(() => {
    if (!accounts) return [];
    if (entity === 'PERSONAL') return [accounts.PERSONAL, accounts.TRUST].filter(Boolean);
    if (entity === 'BUSINESS') return [accounts.BUSINESS, accounts.MYMOBIZ].filter(Boolean);
    if (entity === 'CREDIT') return [accounts.CREDIT].filter(Boolean);
    if (entity === 'TRUST') return [accounts.TRUST].filter(Boolean);
    return [];
  }, [entity, accounts]);

  const viewerTransactions = entityAccounts.length
    ? transactions.filter((tx) => entityAccounts.includes(tx.acc))
    : transactions;

  return (
    <div className="h-full bg-slate-200 border-r border-slate-300 flex flex-col relative">
      <div className="h-10 bg-white border-b flex items-center justify-between px-4 shadow-sm z-10 shrink-0">
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-slate-700">Document Viewer</span>
          <span className="text-[10px] text-slate-400">|</span>
          <span className="text-xs text-slate-600 font-mono">{currentFile.name}</span>
        </div>
      </div>
      <div className="flex-1 overflow-auto custom-scroll p-8 flex justify-center bg-slate-200/50">
        <div className="bg-white w-[595px] h-[842px] shadow-lg shrink-0 p-10 relative text-slate-800">
          <div className="flex justify-between items-start mb-8 border-b-2 pb-4 border-slate-800">
            <div className="text-xl font-black text-slate-800 uppercase tracking-tighter">
              {entity === 'PERSONAL' ? 'STANDARD BANK' : entity === 'BUSINESS' ? 'FNB / SBSA' : 'STATEMENT'}
            </div>
            <div className="text-right text-xs font-mono text-slate-500">
              Page 1 of 3<br />2025-09-30
            </div>
          </div>
          {/* Simulated OCR Overlay */}
          <div className="space-y-1 font-mono text-[9px] text-slate-600">
            <div className="grid grid-cols-[60px_1fr_60px] font-bold border-b border-slate-200 pb-1 mb-2">
              <span>DATE</span>
              <span>DESCRIPTION</span>
              <span className="text-right">AMOUNT</span>
            </div>
          {viewerTransactions.map((tx) => (
              <div key={tx.id} className={`relative flex py-1 border-b border-dotted border-slate-100 hover:bg-yellow-50 ${activeTxId === tx.id ? 'bg-yellow-100' : ''}`}>
                <span className="w-16">{tx.date}</span>
                <span className="flex-1 truncate pr-2 uppercase">{tx.desc}</span>
                <span className="w-20 text-right">{Math.abs(tx.amount).toFixed(2)}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

const EvidenceLockerView = ({ transactions, claims, files, accounts }) => {
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
          ? <DocumentInventory transactions={scopedTransactions} periodFilter={periodFilter} monthsInScope={monthsInScope} files={files} claims={claims} onImport={(file) => alert(`Importing ${file.name}. Document parsing would happen here in production.`)} />
          : <PDFViewer entity={filterEntity} transactions={transactions} activeTxId={null} files={files} accounts={accounts} />
        }
      </div>
    </div>
  );
};

const WorkbenchView = ({ data, transactions, setTransactions, claims, notes, setNotes }) => {
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
          ? <DocumentInventory transactions={filteredTx} periodFilter={periodFilter} monthsInScope={monthsInScope} files={data.files} claims={claims} onImport={(file) => alert(`Importing ${file.name}. Document parsing would happen here in production.`)} />
          : <PDFViewer entity={filterEntity} transactions={transactions} activeTxId={null} files={data.files} accounts={data.accounts} />
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
          {filteredTx.map(tx => (
            <div key={tx.id} className="grid grid-cols-[80px_1fr_120px_110px_110px_30px] border-b border-slate-100 py-2.5 px-3 text-xs items-center hover:bg-amber-50 group transition-colors">
              <div className="font-mono text-slate-500 text-[10px]">{tx.date}</div>
              <div className="pr-2">
                <div className="font-bold text-slate-700 truncate">{tx.clean}</div>
                <div className="text-[9px] text-slate-400 truncate">{tx.acc}</div>
              </div>
              <div>
                <select className={`text-[10px] px-1 py-1 rounded border border-slate-200 w-full outline-none focus:border-amber-400 ${tx.cat === 'Uncategorized' ? 'bg-slate-100 text-slate-500' : 'bg-white text-slate-700 font-medium'}`} value={tx.cat} onChange={(e) => handleCategoryChange(tx.id, e.target.value)}>
                  {data.categories.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div className={`font-mono font-bold text-right ${tx.type === 'income' ? 'text-emerald-600' : 'text-slate-700'}`}>
                {tx.type === 'income' ? '+' : ''}{Math.abs(tx.amount).toFixed(2)}
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
          ))}
        </div>
        <div className="h-10 bg-slate-50 border-t border-slate-200 flex items-center justify-between px-4 text-xs font-bold text-slate-600 shrink-0">
          <span>Total Visible:</span>
          <span className="font-mono">{filteredTx.reduce((sum, t) => sum + t.amount, 0).toLocaleString('en-ZA', { style: 'currency', currency: 'ZAR' })}</span>
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
  const [view, setView] = useState('dashboard');
  const [appData, setAppData] = useState(null);
  const [loadError, setLoadError] = useState(null);
  const [transactions, setTransactions] = useState([]);
  const [claims, setClaims] = useState([]);
  const [notes, setNotes] = useState({});
  const [caseName, setCaseName] = useState('Rademan vs Rademan');
  const [fileUploadModal, setFileUploadModal] = useState(false);
  const [saved, setSaved] = useState(false);
  const saveTimeoutRef = React.useRef(null);

  // Load from localStorage on mount
  useEffect(() => {
    const savedProject = localStorage.getItem('r43_project');
    if (savedProject) {
      try {
        const projectData = JSON.parse(savedProject);
        if (projectData.accounts && projectData.transactions && projectData.claims) {
          setAppData({
            accounts: projectData.accounts,
            categories: projectData.categories || [],
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
          return; // Don't fetch from file if we loaded from localStorage
        }
      } catch (error) {
        console.error('Error loading from localStorage:', error);
      }
    }

    // Fallback to fetching financial_data.json
    fetch('./financial_data.json')
      .then(res => {
        if (!res.ok) throw new Error('Network response was not ok');
        return res.json();
      })
      .then(data => {
        setAppData(data);
        setTransactions(data.transactions);
        setClaims(data.claims);
      })
      .catch(err => {
        console.error('Failed to load financial_data.json', err);
        setLoadError(err.message || String(err));
      });
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
      localStorage.setItem('r43_project', JSON.stringify(projectData));
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    }, 1000); // Debounce auto-save by 1 second

    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, [appData, transactions, claims, notes, caseName]);

  const handleSave = () => {
    if (appData) {
      exportProject(appData, transactions, claims, caseName);
    }
  };

  const handleLoadProject = (file) => {
    loadProject(file, setAppData, setTransactions, setClaims, setCaseName);
  };

  const handleFileUpload = (files) => {
    // In a real implementation, this would process and add files
    // For now, just show a message
    alert(`${files.length} file(s) uploaded. Processing would happen here in production.`);
  };

  if (loadError) {
    return <div className="flex items-center justify-center h-screen text-red-600">Error loading data: {loadError}</div>;
  }

  if (!appData) {
    return <div className="flex items-center justify-center h-screen">Loading financial data...</div>;
  }

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
        />
        <div className="flex-1 min-h-0 relative">
          {view === 'dashboard' && <DashboardView data={appData} onLoadProject={handleLoadProject} />}
          {view === 'workbench' && (
            <WorkbenchView
              data={appData}
              transactions={transactions}
              setTransactions={setTransactions}
              claims={claims}
              notes={notes}
              setNotes={setNotes}
            />
          )}
          {view === 'evidence' && (
            <EvidenceLockerView
              transactions={transactions}
              claims={claims}
              files={appData.files}
              accounts={appData.accounts}
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
