import { useState } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import { ChevronLeft, ChevronRight, ZoomIn, ZoomOut } from 'lucide-react';
import '../utils/pdfConfig';

const PDFDocumentViewer = ({ fileUrl, onLoadSuccess, currentPage: externalPage, onPageChange, zoom: externalZoom, onZoomChange }) => {
  const [numPages, setNumPages] = useState(null);
  const [pageNumber, setPageNumber] = useState(externalPage || 1);
  const [zoom, setZoom] = useState(externalZoom || 1.0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const handleDocumentLoadSuccess = ({ numPages }) => {
    setNumPages(numPages);
    setLoading(false);
    setError(null);
    if (onLoadSuccess) {
      onLoadSuccess(numPages);
    }
  };

  const handleDocumentLoadError = (error) => {
    setLoading(false);
    setError(`Failed to load PDF: ${error.message}`);
  };

  const goToPreviousPage = () => {
    const newPage = Math.max(1, pageNumber - 1);
    setPageNumber(newPage);
    if (onPageChange) onPageChange(newPage);
  };

  const goToNextPage = () => {
    const newPage = Math.min(numPages || 1, pageNumber + 1);
    setPageNumber(newPage);
    if (onPageChange) onPageChange(newPage);
  };

  const handleZoomIn = () => {
    const newZoom = Math.min(2.0, zoom + 0.25);
    setZoom(newZoom);
    if (onZoomChange) onZoomChange(newZoom);
  };

  const handleZoomOut = () => {
    const newZoom = Math.max(0.5, zoom - 0.25);
    setZoom(newZoom);
    if (onZoomChange) onZoomChange(newZoom);
  };

  const handlePageInput = (e) => {
    const input = parseInt(e.target.value);
    if (!isNaN(input) && input >= 1 && input <= (numPages || 1)) {
      setPageNumber(input);
      if (onPageChange) onPageChange(input);
    }
  };

  // Sync with external page changes
  if (externalPage !== undefined && externalPage !== pageNumber) {
    setPageNumber(externalPage);
  }

  // Sync with external zoom changes
  if (externalZoom !== undefined && externalZoom !== zoom) {
    setZoom(externalZoom);
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-full bg-slate-200 text-red-600 text-sm">
        {error}
      </div>
    );
  }

  if (!fileUrl) {
    return (
      <div className="flex items-center justify-center h-full bg-slate-200 text-slate-500 text-sm">
        No PDF available
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Controls */}
      <div className="bg-white border-b border-slate-200 px-4 py-2 flex items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <button
            onClick={goToPreviousPage}
            disabled={pageNumber <= 1}
            className="p-1.5 rounded hover:bg-slate-100 disabled:opacity-50 disabled:cursor-not-allowed text-slate-600"
          >
            <ChevronLeft size={16} />
          </button>
          <div className="flex items-center gap-2 text-xs text-slate-600">
            <input
              type="number"
              value={pageNumber}
              onChange={handlePageInput}
              min={1}
              max={numPages || 1}
              className="w-12 px-2 py-1 border border-slate-200 rounded text-center font-mono"
            />
            <span>of {numPages || '?'}</span>
          </div>
          <button
            onClick={goToNextPage}
            disabled={!numPages || pageNumber >= numPages}
            className="p-1.5 rounded hover:bg-slate-100 disabled:opacity-50 disabled:cursor-not-allowed text-slate-600"
          >
            <ChevronRight size={16} />
          </button>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleZoomOut}
            disabled={zoom <= 0.5}
            className="p-1.5 rounded hover:bg-slate-100 disabled:opacity-50 disabled:cursor-not-allowed text-slate-600"
          >
            <ZoomOut size={16} />
          </button>
          <span className="text-xs text-slate-600 font-mono min-w-[3rem] text-center">
            {Math.round(zoom * 100)}%
          </span>
          <button
            onClick={handleZoomIn}
            disabled={zoom >= 2.0}
            className="p-1.5 rounded hover:bg-slate-100 disabled:opacity-50 disabled:cursor-not-allowed text-slate-600"
          >
            <ZoomIn size={16} />
          </button>
        </div>
      </div>

      {/* PDF Document */}
      <div className="flex-1 overflow-auto bg-slate-200/50 flex justify-center items-start p-8">
        {loading && (
          <div className="flex items-center justify-center h-full text-slate-500 text-sm">
            Loading PDF...
          </div>
        )}
        <div style={{ transform: `scale(${zoom})`, transformOrigin: 'top center' }}>
          <Document
            file={fileUrl}
            onLoadSuccess={handleDocumentLoadSuccess}
            onLoadError={handleDocumentLoadError}
            loading={null}
            error={null}
          >
            <Page
              pageNumber={pageNumber}
              renderTextLayer={true}
              renderAnnotationLayer={true}
              width={595} // A4 width in points
            />
          </Document>
        </div>
      </div>
    </div>
  );
};

export default PDFDocumentViewer;

