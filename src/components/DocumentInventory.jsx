import { useState, useRef, useCallback } from 'react';
import { FileText, File, Scale, Sparkles, Trash2, CheckCheck } from 'lucide-react';

const DocumentInventory = ({ transactions, periodFilter, monthsInScope, files, claims, onImport, setClaims, onDeleteFile }) => {
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
                <div key={file.id} className="bg-white border border-slate-200 rounded p-3 flex flex-col gap-1 shadow-sm hover:border-blue-300 transition-colors group">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-xs font-bold text-slate-700 flex-1 min-w-0">
                      <div className="text-rose-600 shrink-0">
                        {safeName.toLowerCase().includes('pdf') ? <FileText size={14} /> : <File size={14} />}
                      </div>
                      <div className="truncate">{safeName}</div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className={`text-[9px] px-1.5 py-0.5 rounded font-bold uppercase ${file.entity === 'LEGAL' ? 'bg-purple-50 text-purple-700' : 'bg-slate-100 text-slate-500'}`}>{file.entity || 'UNKNOWN'}</span>
                      {onDeleteFile && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            if (window.confirm(`Delete "${safeName}" and all associated transactions/claims?`)) {
                              onDeleteFile(file.id);
                            }
                          }}
                          className="opacity-0 group-hover:opacity-100 text-rose-500 hover:text-rose-700 transition-opacity p-1"
                          title="Delete file and all associated data"
                        >
                          <Trash2 size={14} />
                        </button>
                      )}
                    </div>
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
                  onClick={() => {
                    if (!mode.disabled) {
                      setEntryMode(mode.key);
                      // Trigger file picker directly on user click (not in useEffect)
                      if (mode.key === 'import' && fileInputRef.current) {
                        fileInputRef.current.click();
                      }
                    }
                  }}
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

export default DocumentInventory;

