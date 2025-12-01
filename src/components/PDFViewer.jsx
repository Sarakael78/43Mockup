import { useState, useMemo, useEffect } from 'react';
import { FileText } from 'lucide-react';
import PDFDocumentViewer from './PDFDocumentViewer';
import CSVViewer from './CSVViewer';

const PDFViewer = ({ entity, activeTxId, transactions, files, accounts, setClaims }) => {
  const [pdfUrl, setPdfUrl] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [numPages, setNumPages] = useState(null);
  const [zoom, setZoom] = useState(1.0);

  const currentFile = (files && Array.isArray(files)) ? (files.find(f => f && f.entity === entity) || files[0]) : null;
  
  const entityAccounts = useMemo(() => {
    if (!accounts || typeof accounts !== 'object') return [];
    if (entity === 'PERSONAL') return [accounts.PERSONAL, accounts.TRUST].filter(Boolean);
    if (entity === 'BUSINESS') return [accounts.BUSINESS, accounts.MYMOBIZ].filter(Boolean);
    if (entity === 'CREDIT') return [accounts.CREDIT].filter(Boolean);
    if (entity === 'TRUST') return [accounts.TRUST].filter(Boolean);
    return [];
  }, [entity, accounts]);

  const viewerTransactions = entityAccounts.length && Array.isArray(transactions)
    ? transactions.filter((tx) => tx && tx.acc && entityAccounts.includes(tx.acc))
    : (Array.isArray(transactions) ? transactions : []);

  // Determine file type
  const fileType = useMemo(() => {
    if (!currentFile) return null;
    const fileName = currentFile.name || '';
    const extension = fileName.split('.').pop()?.toLowerCase();
    return extension;
  }, [currentFile]);

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
      }
    };
  }, [currentFile, fileType]);

  const handleLoadSuccess = (numPages) => {
    setNumPages(numPages);
  };

  return (
    <div className="h-full bg-slate-200 border-r border-slate-300 flex flex-col relative">
      <div className="h-10 bg-white border-b flex items-center justify-between px-4 shadow-sm z-10 shrink-0">
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-slate-700">Document Viewer</span>
          <span className="text-[10px] text-slate-400">|</span>
          <span className="text-xs text-slate-600 font-mono">{currentFile && currentFile.name ? currentFile.name.replace(/[<>\"'&]/g, '') : 'No file'}</span>
        </div>
      </div>
      
      {/* Document Viewer - PDF or CSV */}
      {fileType === 'csv' ? (
        <CSVViewer
          file={currentFile?.file}
          fileUrl={currentFile?.url || pdfUrl}
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
                {fileType ? `Unsupported file type: ${fileType.toUpperCase()}` : 'No file available'}
              </p>
              <p className="text-xs mt-2">
                {fileType ? 'Please upload a PDF or CSV file' : 'Upload a PDF or CSV file to view it here'}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Transaction Overlay - Side Panel */}
      <div className="absolute right-0 top-10 bottom-0 w-64 bg-white/95 border-l border-slate-300 shadow-lg overflow-auto custom-scroll">
        <div className="p-3 border-b border-slate-200 bg-slate-50">
          <div className="text-xs font-bold text-slate-700">Transactions ({viewerTransactions.length})</div>
        </div>
        <div className="p-2 space-y-1">
          {viewerTransactions.map((tx) => {
            if (!tx || !tx.id) return null;
            const safeDesc = tx.desc ? String(tx.desc).replace(/[<>\"'&]/g, '') : '';
            return (
              <div 
                key={tx.id} 
                className={`p-2 text-xs border-b border-slate-100 hover:bg-yellow-50 cursor-pointer ${activeTxId === tx.id ? 'bg-yellow-100' : ''}`}
              >
                <div className="font-mono text-[10px] text-slate-500">{tx.date || ''}</div>
                <div className="truncate font-semibold text-slate-700">{safeDesc}</div>
                <div className="text-right font-mono font-bold text-slate-800">
                  {tx.amount ? (tx.amount < 0 ? '-' : '+') + Math.abs(tx.amount).toFixed(2) : '0.00'}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default PDFViewer;

