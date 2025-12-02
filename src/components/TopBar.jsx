import { useState, useEffect } from 'react';
import { Save, Plus, Check } from 'lucide-react';
import { CASE_NAME_MAX_LENGTH } from '../utils/constants';

const TopBar = ({ title, subtitle, caseName, onCaseNameChange, onSave, onNewCase, saved, onError }) => {
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
              className="px-1.5 py-0 bg-white text-amber-700 text-[9px] font-bold uppercase rounded-full tracking-wider border-2 border-amber-300 focus:outline-none focus:ring-2 focus:ring-amber-400"
              autoFocus
            />
          ) : (
            <span
              onClick={() => setIsEditing(true)}
              className="px-1.5 py-0 bg-amber-50 text-amber-700 text-[9px] font-bold uppercase rounded-full tracking-wider border border-amber-100 cursor-pointer hover:bg-amber-100 transition-colors"
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
        {onNewCase && (
          <button
            onClick={onNewCase}
            className="inline-flex items-center gap-0.5 px-1.5 py-0.5 text-[9px] font-bold rounded bg-blue-600 text-white shadow-sm hover:bg-blue-500 transition-colors"
            title="Start a new case (clears all current data)"
          >
            <Plus size={12} />
            New
          </button>
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

