import { useState } from 'react';
import { StickyNote, X } from 'lucide-react';
import { NOTE_MAX_LENGTH } from '../utils/constants';

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
              if (sanitized.length > NOTE_MAX_LENGTH) {
                sanitized = sanitized.substring(0, NOTE_MAX_LENGTH);
              }
              setNoteText(sanitized);
            }}
            placeholder="Add annotation or note about this transaction..."
            className="w-full h-32 p-3 border border-slate-200 rounded-md text-sm resize-none focus:outline-none focus:ring-2 focus:ring-amber-400"
            maxLength={NOTE_MAX_LENGTH}
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

export default NoteModal;

