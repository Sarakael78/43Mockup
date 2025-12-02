import { useState, useEffect } from 'react';
import { StickyNote, X } from 'lucide-react';
import { NOTE_MAX_LENGTH } from '../utils/constants';

const NoteModal = ({ isOpen, onClose, transaction, note, onSave }) => {
  const [noteText, setNoteText] = useState(note || '');

  useEffect(() => {
    if (isOpen) {
      setNoteText(note || '');
    } else {
      setNoteText('');
    }
  }, [isOpen, note, transaction?.id]);

  if (!isOpen) return null;

  const handleSave = () => {
    if (onSave && transaction?.id) {
      onSave(transaction.id, noteText);
    }
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={onClose}>
      <div className="bg-white rounded-lg shadow-2xl w-full max-w-sm" onClick={(e) => e.stopPropagation()}>
        <div className="px-3 py-2 border-b border-slate-200 flex items-center justify-between">
          <h3 className="text-xs font-bold text-slate-800 flex items-center gap-1">
            <StickyNote size={12} className="text-amber-500" />
            Note
          </h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <X size={14} />
          </button>
        </div>
        <div className="p-3">
          <div className="mb-2 text-[10px] text-slate-600">
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
              if (sanitized.length > NOTE_MAX_LENGTH) {
                sanitized = sanitized.substring(0, NOTE_MAX_LENGTH);
              }
              setNoteText(sanitized);
            }}
            placeholder="Add annotation..."
            className="w-full h-24 p-2 border border-slate-200 rounded text-[11px] resize-none focus:outline-none focus:ring-1 focus:ring-amber-400"
            maxLength={NOTE_MAX_LENGTH}
          />
        </div>
        <div className="px-3 py-2 border-t border-slate-200 flex justify-end gap-1.5">
          <button
            onClick={onClose}
            className="px-2 py-1 text-[10px] font-bold text-slate-600 hover:text-slate-800"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="px-2 py-1 bg-amber-500 text-white text-[10px] font-bold rounded hover:bg-amber-600 transition-colors"
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
};

export default NoteModal;

