import { useState, useRef } from 'react';
import { UploadCloud, X } from 'lucide-react';
import { FILE_SIZE_LIMIT_BYTES } from '../utils/constants';
import FileTriageRow from './FileTriageRow';

const ALLOWED_FILE_EXTENSIONS = ['pdf', 'docx', 'doc', 'csv'];
const formatList = ALLOWED_FILE_EXTENSIONS.map(ext => ext.toUpperCase()).join(', ');

const getFileExtension = (fileName) => {
  if (!fileName || typeof fileName !== 'string') return '';
  const parts = fileName.split('.');
  return parts.length > 1 ? parts.pop().toLowerCase() : '';
};

const isSupportedExtension = (fileName) => {
  const ext = getFileExtension(fileName);
  return ALLOWED_FILE_EXTENSIONS.includes(ext);
};

const FileUploadModal = ({ isOpen, onClose, onUpload, showToast }) => {
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
      const allFiles = Array.from(e.dataTransfer.files);
      const rejectedBySize = [];
      const rejectedByType = [];
      const newFiles = allFiles.filter(file => {
        // Validate file has required properties
        if (!file || !file.name) {
          if (showToast) {
            showToast('Some files were rejected: missing file name', 'warning');
          }
          return false;
        }
        if (!isSupportedExtension(file.name)) {
          rejectedByType.push(file.name);
          return false;
        }
        if (file.size > FILE_SIZE_LIMIT_BYTES) {
          rejectedBySize.push(file.name);
          return false;
        }
        return true;
      });
      
      if (rejectedByType.length > 0 && showToast) {
        showToast(`${rejectedByType.length} file(s) rejected: unsupported type. Allowed: ${formatList}.`, 'warning');
      }

      if (rejectedBySize.length > 0 && showToast) {
        showToast(`${rejectedBySize.length} file(s) rejected: exceeds ${FILE_SIZE_LIMIT_BYTES / 1024 / 1024}MB limit. ${rejectedBySize.slice(0, 3).join(', ')}${rejectedBySize.length > 3 ? '...' : ''}`, 'warning');
      }
      
      setFiles(prev => [...prev, ...newFiles]);
    }
  };

  const handleFileInput = (e) => {
    if (e.target.files && e.target.files.length > 0) {
      const allFiles = Array.from(e.target.files);
      const rejectedBySize = [];
      const rejectedByType = [];
      const newFiles = allFiles.filter(file => {
        // Validate file has required properties
        if (!file || !file.name) {
          if (showToast) {
            showToast('Some files were rejected: missing file name', 'warning');
          }
          return false;
        }
        if (!isSupportedExtension(file.name)) {
          rejectedByType.push(file.name);
          return false;
        }
        if (file.size > FILE_SIZE_LIMIT_BYTES) {
          rejectedBySize.push(file.name);
          return false;
        }
        return true;
      });
      
      if (rejectedByType.length > 0 && showToast) {
        showToast(`${rejectedByType.length} file(s) rejected: unsupported type. Allowed: ${formatList}.`, 'warning');
      }

      if (rejectedBySize.length > 0 && showToast) {
        showToast(`${rejectedBySize.length} file(s) rejected: exceeds ${FILE_SIZE_LIMIT_BYTES / 1024 / 1024}MB limit. ${rejectedBySize.slice(0, 3).join(', ')}${rejectedBySize.length > 3 ? '...' : ''}`, 'warning');
      }
      
      setFiles(prev => [...prev, ...newFiles]);
    }
  };

  const handleRemoveFile = (index) => {
    setFiles(prev => prev.filter((_, i) => i !== index));
  };

  const handleTriageSubmit = (fileIndex, triageData) => {
    setFiles(prev => prev.map((f, i) => {
      if (i === fileIndex) {
        // Add triage property directly to the file using defineProperty
        // This preserves the File object's getters and methods
        if (f && f instanceof File) {
          // Create a copy to avoid mutating the original
          const fileWithTriage = f;
          Object.defineProperty(fileWithTriage, 'triage', {
            value: triageData,
            writable: true,
            enumerable: true,
            configurable: true
          });
          return fileWithTriage;
        } else {
          // If it's already a plain object, spread it
          return { ...f, triage: triageData };
        }
      }
      return f;
    }));
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
        // Files already have triage attached via defineProperty, so just pass them directly
        await onUpload(files);
      }
      setFiles([]);
      setUploading(false);
      onClose();
    } catch (error) {
      setUploading(false);
      const message = error instanceof Error ? error.message : 'Unknown error uploading files';
      if (showToast) {
        showToast(`Upload failed: ${message}`, 'error');
      }
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
            <p className="text-xs text-slate-500 mb-4">
              Supported: {formatList.replace(/,/g, ', ')} • Max {(FILE_SIZE_LIMIT_BYTES / 1024 / 1024)}MB per file
            </p>
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
              accept=".pdf,.docx,.doc,.csv"
            />
          </div>

          {files.length > 0 && (
            <div className="mt-6 space-y-4">
              <h3 className="text-sm font-bold text-slate-700">Files to Process ({files.length})</h3>
              {files.map((file, index) => {
                // Safely extract file properties to avoid getter issues
                let fileName, fileSize;
                try {
                  fileName = file?.name || `file-${index}`;
                  fileSize = file?.size || 0;
                } catch (e) {
                  // Fallback if accessing properties fails
                  fileName = `file-${index}`;
                  fileSize = 0;
                }
                
                return (
                  <FileTriageRow
                    key={`${fileName}-${fileSize}-${index}`}
                    file={file}
                    onRemove={() => handleRemoveFile(index)}
                    onSubmit={(data) => handleTriageSubmit(index, data)}
                  />
                );
              })}
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

export default FileUploadModal;

