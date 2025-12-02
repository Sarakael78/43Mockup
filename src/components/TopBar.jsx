import { useState, useEffect, useRef } from 'react';
import { Save, Plus, Check, Settings, FolderOpen, Calendar } from 'lucide-react';
import { CASE_NAME_MAX_LENGTH } from '../utils/constants';

const TopBar = ({ title, subtitle, caseName, onCaseNameChange, onSave, onNewCase, onLoadProject, saved, onError, onOpenSettings, proofPeriod, onProofPeriodChange }) => {
  const fileInputRef = useRef(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(caseName);

  useEffect(() => {
    setEditValue(caseName);
  }, [caseName]);

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
    <div className="h-8 bg-white border-b border-slate-200 flex items-center justify-between px-1.5 shrink-0 z-10">
      <div className="flex items-center gap-2">
        <h1 className="text-xs font-bold text-slate-800 flex items-center gap-1">
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
                if (sanitized.length > CASE_NAME_MAX_LENGTH) {
                  sanitized = sanitized.substring(0, CASE_NAME_MAX_LENGTH);
                }
                setEditValue(sanitized);
              }}
              onBlur={handleSave}
              onKeyDown={handleKeyDown}
              maxLength={CASE_NAME_MAX_LENGTH}
              className="px-1.5 py-0 bg-white text-slate-700 text-[9px] font-bold uppercase rounded-full tracking-wider border-2 border-slate-300 focus:outline-none focus:ring-2 focus:ring-slate-400"
              autoFocus
            />
          ) : (
            <span
              onClick={() => setIsEditing(true)}
              className="px-1.5 py-0 bg-slate-50 text-slate-700 text-[9px] font-bold uppercase rounded-full tracking-wider border border-slate-100 cursor-pointer hover:bg-slate-100 transition-colors"
              title="Click to edit case name"
            >
              {caseName}
            </span>
          )}
          {saved && (
            <span className="text-emerald-600 flex items-center gap-0.5 text-[9px] animate-fade-in">
              <Check size={10} />
              Saved
            </span>
          )}
        </h1>
        <span className="text-[10px] text-slate-400">|</span>
        <p className="text-[10px] text-slate-500">{subtitle}</p>
      </div>
      <div className="flex items-center gap-1">
        <div className="flex bg-slate-100 p-0.5 rounded">
          <button className="px-1.5 py-0 text-[9px] font-bold rounded bg-white text-slate-800 shadow-sm border border-slate-200">Rule 43</button>
          <button className="px-1.5 py-0 text-[9px] font-bold rounded text-slate-500 hover:text-slate-700">Divorce</button>
        </div>
        {onProofPeriodChange && (
          <div className="flex bg-slate-100 p-0.5 rounded">
            <button
              onClick={() => onProofPeriodChange('3M')}
              className={`px-2 py-0.5 text-[8px] font-bold rounded transition-all ${
                proofPeriod === '3M'
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'text-slate-500 hover:text-slate-700'
              }`}
              title="Use 3-month average to determine if claims are proven"
            >
              3M
            </button>
            <button
              onClick={() => onProofPeriodChange('6M')}
              className={`px-2 py-0.5 text-[8px] font-bold rounded transition-all ${
                proofPeriod === '6M'
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'text-slate-500 hover:text-slate-700'
              }`}
              title="Use 6-month average to determine if claims are proven"
            >
              6M
            </button>
          </div>
        )}
        {onOpenSettings && (
          <button
            onClick={onOpenSettings}
            className="p-1 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded transition-colors"
            title="Display Settings"
          >
            <Settings size={14} />
          </button>
        )}
        {onNewCase && (
          <button
            onClick={onNewCase}
            className="inline-flex items-center gap-0.5 px-1.5 py-0.5 text-[9px] font-bold rounded bg-slate-600 text-white shadow-sm hover:bg-slate-500 transition-colors"
            title="Start a new case (clears all current data)"
          >
            <Plus size={12} />
            New
          </button>
        )}
        {onLoadProject && (
          <>
            <button
              onClick={() => fileInputRef.current?.click()}
              className="inline-flex items-center gap-0.5 px-1.5 py-0.5 text-[9px] font-bold rounded bg-white text-slate-700 border border-slate-300 shadow-sm hover:bg-slate-50 transition-colors"
              title="Open a saved case file"
            >
              <FolderOpen size={12} />
              Open
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".r43,.json"
              className="hidden"
              onChange={(e) => {
                if (e.target.files && e.target.files.length > 0) {
                  onLoadProject(e.target.files[0]);
                  e.target.value = '';
                }
              }}
            />
          </>
        )}
        <button
          onClick={onSave}
          className="inline-flex items-center gap-0.5 px-1.5 py-0.5 text-[9px] font-bold rounded bg-emerald-600 text-white shadow-sm hover:bg-emerald-500 transition-colors"
          title="Export Analysis (Save Project)"
        >
          <Save size={12} />
          Export
        </button>
      </div>
    </div>
  );
};

export default TopBar;

