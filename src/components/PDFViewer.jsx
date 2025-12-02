import { useState, useMemo, useEffect } from 'react';
import { FileText } from 'lucide-react';
import PDFDocumentViewer from './PDFDocumentViewer';
import CSVViewer from './CSVViewer';
import { transactionMatchesEntity, normalizeEntity } from '../utils/transactionUtils';

const PDFViewer = ({ entity, activeTxId, transactions, files, accounts, setClaims }) => {
  const [pdfUrl, setPdfUrl] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [numPages, setNumPages] = useState(null);
  const [zoom, setZoom] = useState(1.0);
  const [selectedFileId, setSelectedFileId] = useState(null);

  // Find all CSV files that match the entity
  const matchingCSVFiles = useMemo(() => {
    if (!files || !Array.isArray(files)) return [];
    const targetEntity = normalizeEntity(entity);
    
    return files.filter(f => {
      if (!f || !f.name) return false;
      const extension = (f.name.split('.').pop() || '').toLowerCase();
      if (extension !== 'csv') return false;

      const fileEntity = normalizeEntity(f.entity);
      if (targetEntity && fileEntity && fileEntity === targetEntity) {
        return true;
      }
      
      if (!transactions || !Array.isArray(transactions) || !f.id) return false;
      return transactions.some(tx => tx?.fileId === f.id && transactionMatchesEntity(tx, entity, accounts));
    });
  }, [files, entity, transactions, accounts]);

  // Reset selected file when entity changes or when files change
  useEffect(() => {
    setSelectedFileId(null);
  }, [entity, files]);

  const currentFile = useMemo(() => {
    if (!files || !Array.isArray(files)) return null;
    const targetEntity = normalizeEntity(entity);
    
    // If there are multiple CSV files for this entity, use the selected one (or first if none selected)
    if (matchingCSVFiles.length > 1) {
      if (selectedFileId) {
        const selected = matchingCSVFiles.find(f => f.id === selectedFileId);
        if (selected) return selected;
      }
      return matchingCSVFiles[0] || null;
    }
    
    // If there's exactly one CSV file for this entity, use it
    if (matchingCSVFiles.length === 1) {
      return matchingCSVFiles[0];
    }
    
    // Otherwise, use the existing file matching logic (for PDFs and other files)
    let matchedFile = files.find(f => normalizeEntity(f?.entity) === targetEntity);
    
    if (!matchedFile && transactions && Array.isArray(transactions)) {
      const filesWithEntityTx = files.filter(f => {
        if (!f || !f.id) return false;
        return transactions.some(tx => tx?.fileId === f.id && transactionMatchesEntity(tx, entity, accounts));
      });
      
      if (filesWithEntityTx.length > 0) {
        matchedFile = filesWithEntityTx[0];
      }
    }
    
    return matchedFile || null;
  }, [files, entity, transactions, accounts, matchingCSVFiles, selectedFileId]);
  

  // Determine file type
  const fileType = useMemo(() => {
    if (!currentFile) return null;
    const fileName = currentFile.name || '';
    const extension = fileName.split('.').pop()?.toLowerCase();
    return extension;
  }, [currentFile]);

  useEffect(() => {
    setCurrentPage(1);
    setNumPages(null);
    setZoom(1.0);
  }, [currentFile?.id, fileType]);

  // Handle file URL creation (for PDF files)
  useEffect(() => {
    let objectUrl = null;

    if (!currentFile || fileType !== 'pdf') {
      setPdfUrl(null);
      return;
    }

    // If file has a File object (from upload)
    if (currentFile.file && currentFile.file instanceof File) {
      objectUrl = URL.createObjectURL(currentFile.file);
      setPdfUrl(objectUrl);
    } else if (currentFile.url) {
      // If file has a URL property
      setPdfUrl(currentFile.url);
    } else if (currentFile.data) {
      // Try to create a data URL if file has data
      setPdfUrl(currentFile.data);
    } else {
      setPdfUrl(null);
    }

    // Cleanup: revoke object URL when component unmounts or file changes
    return () => {
      if (objectUrl) {
        URL.revokeObjectURL(objectUrl);
        objectUrl = null;
      }
    };
  }, [currentFile, fileType]);

  const handleLoadSuccess = (numPages) => {
    setNumPages(numPages);
  };

  // Determine if we should show the CSV file dropdown (when there are multiple CSV files for this entity)
  const showCSVDropdown = matchingCSVFiles.length > 1;

  return (
    <div className="h-full bg-slate-200 border-r border-slate-300 flex flex-col relative">
      <div className="h-10 bg-white border-b flex items-center justify-between px-4 shadow-sm z-10 shrink-0">
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <span className="text-xs font-bold text-slate-700 shrink-0">Document Viewer</span>
          {showCSVDropdown && (
            <>
              <span className="text-[10px] text-slate-400 shrink-0">|</span>
              <select
                value={selectedFileId || matchingCSVFiles[0]?.id || ''}
                onChange={(e) => setSelectedFileId(e.target.value)}
                className="text-xs px-2 py-1 rounded border border-slate-300 bg-white text-slate-700 min-w-0 flex-1 max-w-xs"
              >
                {matchingCSVFiles.map(file => (
                  <option key={file.id} value={file.id}>
                    {file.name ? file.name.replace(/[<>\"'&]/g, '') : 'Unnamed file'}
                  </option>
                ))}
              </select>
            </>
          )}
          {!showCSVDropdown && (
            <>
              <span className="text-[10px] text-slate-400 shrink-0">|</span>
              <span className="text-xs text-slate-600 font-mono truncate">{currentFile && currentFile.name ? currentFile.name.replace(/[<>\"'&]/g, '') : 'No file'}</span>
            </>
          )}
        </div>
      </div>
      
      {/* Document Viewer - PDF or CSV */}
      {fileType === 'csv' ? (
        <CSVViewer
          file={currentFile?.file}
          fileUrl={currentFile?.url}
          csvContent={currentFile?.csvContent}
        />
      ) : pdfUrl && fileType === 'pdf' ? (
        <PDFDocumentViewer
          fileUrl={pdfUrl}
          onLoadSuccess={handleLoadSuccess}
          currentPage={currentPage}
          onPageChange={setCurrentPage}
          zoom={zoom}
          onZoomChange={setZoom}
        />
      ) : (
        <div className="flex-1 overflow-auto custom-scroll p-8 flex justify-center bg-slate-200/50">
          <div className="bg-white w-[595px] h-[842px] shadow-lg shrink-0 p-10 relative text-slate-800 flex items-center justify-center">
            <div className="text-center text-slate-400">
              <FileText size={48} className="mx-auto mb-4" />
              <p className="text-sm">
                {fileType ? `Unsupported file type: ${fileType.toUpperCase()}` : currentFile ? 'No file available' : `No ${entity} files found`}
              </p>
              <p className="text-xs mt-2">
                {fileType ? 'Please upload a PDF or CSV file' : currentFile ? 'Upload a PDF or CSV file to view it here' : `Upload a file with entity "${entity}" to view it here`}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PDFViewer;

