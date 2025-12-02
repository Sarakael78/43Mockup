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
      <div className="bg-red-50 border border-red-200 rounded-lg p-4">
        <div className="text-sm text-red-700">Invalid file: missing file name</div>
      </div>
    );
  }

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
              <option>CREDIT</option>
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

export default FileTriageRow;

