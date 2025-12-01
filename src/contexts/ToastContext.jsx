import { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react';
import { AlertCircle, CheckCircle, AlertTriangle, Info, X } from 'lucide-react';

const ToastContext = createContext(null);

export const useToast = () => {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within ToastProvider');
  }
  return context;
};

const Toast = ({ id, message, type = 'error', onClose }) => {
  const [isVisible, setIsVisible] = useState(true);
  const timeoutRef = useRef(null);

  const handleClose = useCallback(() => {
    setIsVisible(false);
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    timeoutRef.current = setTimeout(() => {
      if (onClose) onClose(id);
    }, 300); // Wait for animation
  }, [id, onClose]);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  if (!isVisible) return null;

  const config = {
    error: {
      bg: 'bg-rose-50',
      border: 'border-rose-200',
      text: 'text-rose-800',
      icon: 'text-rose-500',
      Icon: AlertCircle
    },
    success: {
      bg: 'bg-emerald-50',
      border: 'border-emerald-200',
      text: 'text-emerald-800',
      icon: 'text-emerald-500',
      Icon: CheckCircle
    },
    warning: {
      bg: 'bg-amber-50',
      border: 'border-amber-200',
      text: 'text-amber-800',
      icon: 'text-amber-500',
      Icon: AlertTriangle
    },
    info: {
      bg: 'bg-blue-50',
      border: 'border-blue-200',
      text: 'text-blue-800',
      icon: 'text-blue-500',
      Icon: Info
    }
  };

  const style = config[type] || config.error;
  const Icon = style.Icon;

  return (
    <div className={`${style.bg} ${style.border} border rounded-lg shadow-lg px-4 py-3 max-w-md mb-2 animate-fade-in`}>
      <div className="flex items-start gap-3">
        <div className={style.icon}>
          <Icon size={20} />
        </div>
        <div className="flex-1">
          <p className={`text-sm font-semibold ${style.text}`}>{message}</p>
        </div>
        <button onClick={handleClose} className={`${style.text} hover:opacity-70 transition-opacity`}>
          <X size={16} />
        </button>
      </div>
    </div>
  );
};

const ToastContainer = ({ toasts, removeToast }) => {
  return (
    <div className="fixed top-4 right-4 z-50 flex flex-col items-end">
      {toasts.map(toast => (
        <Toast
          key={toast.id}
          id={toast.id}
          message={toast.message}
          type={toast.type}
          onClose={removeToast}
        />
      ))}
    </div>
  );
};

export const ToastProvider = ({ children }) => {
  const [toasts, setToasts] = useState([]);
  const timeoutRefs = useRef(new Map());

  const showToast = useCallback((message, type = 'error', duration = 5000) => {
    const id = Date.now() + Math.random();
    const newToast = { id, message, type };
    
    setToasts(prev => [...prev, newToast]);

    // Auto-dismiss after duration
    if (duration > 0) {
      const timeoutId = setTimeout(() => {
        setToasts(prev => prev.filter(t => t.id !== id));
        timeoutRefs.current.delete(id);
      }, duration);
      timeoutRefs.current.set(id, timeoutId);
    }

    return id;
  }, []);

  const removeToast = useCallback((id) => {
    // Clear timeout if exists
    const timeoutId = timeoutRefs.current.get(id);
    if (timeoutId) {
      clearTimeout(timeoutId);
      timeoutRefs.current.delete(id);
    }
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  // Cleanup timeouts on unmount
  useEffect(() => {
    return () => {
      timeoutRefs.current.forEach(timeoutId => clearTimeout(timeoutId));
      timeoutRefs.current.clear();
    };
  }, []);

  return (
    <ToastContext.Provider value={{ showToast, removeToast }}>
      {children}
      <ToastContainer toasts={toasts} removeToast={removeToast} />
    </ToastContext.Provider>
  );
};

