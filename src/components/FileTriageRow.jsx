import { useState } from 'react';
import { FileText, X, Check } from 'lucide-react';

const FileTriageRow = ({ file, onRemove, onSubmit }) => {
  const [triage, setTriage] = useState({
    type: 'Bank Statement',
    entity: 'PERSONAL',
    parser: 'Standard Bank'
  });
  const [submitted, setSubmitted] = useState(false);

  // Validate file has name
  if (!file || !file.name) {
    return (
      <div className="bg-red-50 border border-red-200 rounded p-2">
        <div className="text-[10px] text-red-700">Invalid file</div>
      </div>
    );
  }

  const handleSubmit = () => {
    onSubmit(triage);
    setSubmitted(true);
  };

  return (
    <div className="bg-slate-50 border border-slate-200 rounded p-2">
      <div className="flex items-start justify-between mb-1.5">
        <div className="flex-1">
          <div className="flex items-center gap-1.5">
            <FileText size={12} className="text-rose-600" />
            <span className="text-[11px] font-semibold text-slate-700">{file.name}</span>
            <span className="text-[9px] text-slate-400">({file.size ? (file.size / 1024 / 1024).toFixed(1) : '0'} MB)</span>
          </div>
        </div>
        <button onClick={onRemove} className="text-slate-400 hover:text-rose-500">
          <X size={12} />
        </button>
      </div>
      
      {!submitted ? (
        <div className="grid grid-cols-4 gap-1.5 items-end">
          <div>
            <label className="block text-[8px] font-bold text-slate-500 uppercase mb-0.5">Type</label>
            <select
              value={triage.type}
              onChange={(e) => setTriage({ ...triage, type: e.target.value })}
              className="w-full text-[10px] px-1 py-0.5 border border-slate-200 rounded bg-white"
            >
              <option>Bank Statement</option>
              <option>Financial Affidavit</option>
              <option>Other</option>
            </select>
          </div>
          <div>
            <label className="block text-[8px] font-bold text-slate-500 uppercase mb-0.5">Entity</label>
            <select
              value={triage.entity}
              onChange={(e) => setTriage({ ...triage, entity: e.target.value })}
              className="w-full text-[10px] px-1 py-0.5 border border-slate-200 rounded bg-white"
            >
              <option>PERSONAL</option>
              <option>BUSINESS</option>
              <option>TRUST</option>
              <option>SPOUSE</option>
              <option>CREDIT</option>
            </select>
          </div>
          <div>
            <label className="block text-[8px] font-bold text-slate-500 uppercase mb-0.5">Parser</label>
            <select
              value={triage.parser}
              onChange={(e) => setTriage({ ...triage, parser: e.target.value })}
              className="w-full text-[10px] px-1 py-0.5 border border-slate-200 rounded bg-white"
            >
              <option>Standard Bank</option>
              <option>FNB</option>
              <option>Investec</option>
              <option>Generic CSV</option>
            </select>
          </div>
          <button
            onClick={handleSubmit}
            className="px-2 py-0.5 bg-blue-600 text-white text-[10px] font-bold rounded hover:bg-blue-500 transition-colors"
          >
            ✓ Confirm
          </button>
        </div>
      ) : (
        <div className="flex items-center gap-1 text-[10px] text-emerald-600">
          <Check size={10} />
          <span>{triage.type} | {triage.entity} | {triage.parser}</span>
        </div>
      )}
    </div>
  );
};

export default FileTriageRow;

