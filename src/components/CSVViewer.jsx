import { useState, useEffect, useMemo } from 'react';
import Papa from 'papaparse';
import { FileText, ArrowUp, ArrowDown, ArrowUpDown } from 'lucide-react';
import { CSV_PREVIEW_ROWS } from '../utils/constants';
import { logger } from '../utils/logger';

const CSVViewer = ({ file, fileUrl }) => {
  const [csvData, setCsvData] = useState([]);
  const [headers, setHeaders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [sortColumn, setSortColumn] = useState(null);
  const [sortDirection, setSortDirection] = useState('asc');

  useEffect(() => {
    const loadCSV = async () => {
      setLoading(true);
      setError(null);
      
      try {
        let csvText = '';
        
        // If we have a File object, read it
        if (file && file instanceof File) {
          csvText = await new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => resolve(e.target.result);
            reader.onerror = (e) => reject(new Error('Failed to read CSV file'));
            reader.readAsText(file);
          });
        } 
        // If we have a URL, fetch it
        else if (fileUrl) {
          const response = await fetch(fileUrl);
          if (!response.ok) {
            throw new Error('Failed to fetch CSV file');
          }
          csvText = await response.text();
        } else {
          throw new Error('No file or URL provided');
        }

        // Parse CSV
        Papa.parse(csvText, {
          header: true,
          skipEmptyLines: true,
          encoding: 'UTF-8',
          preview: CSV_PREVIEW_ROWS, // Limit rows for display
          complete: (results) => {
            if (results.errors && results.errors.length > 0) {
              logger.warn('CSV parsing warnings:', results.errors);
            }
            
            if (results.data && results.data.length > 0) {
              // Get headers from first row keys
              const firstRow = results.data[0];
              const allHeaders = Object.keys(firstRow);
              
              // Filter out Account column(s) - they're already shown in the title
              // Also filter out Sub_Category column - not needed in display
              // Filter out Original_Description - redundant information
              const accountColumnNames = ['account', 'account number', 'account_name', 'account name', 'acc'];
              const subCategoryColumnNames = ['sub_category', 'subcategory', 'sub-category', 'subcat', 'sub cat', 'sub_category'];
              const originalDescColumnNames = ['original_description', 'original description', 'original desc', 'original_desc'];
              const filteredHeaders = allHeaders.filter(header => {
                const headerLower = String(header).toLowerCase().trim();
                return !accountColumnNames.includes(headerLower) && 
                       !subCategoryColumnNames.includes(headerLower) &&
                       !originalDescColumnNames.includes(headerLower);
              });
              
              setHeaders(filteredHeaders);
              setCsvData(results.data);
            } else {
              setError('CSV file appears to be empty');
            }
            setLoading(false);
          },
          error: (error) => {
            setError(`Failed to parse CSV: ${error.message}`);
            setLoading(false);
          }
        });
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error loading CSV');
        setLoading(false);
      }
    };

    if (file || fileUrl) {
      loadCSV();
    }
  }, [file, fileUrl]);

  // Helper to normalize column names for comparison
  const normalizeColumnName = (name) => {
    return String(name).toLowerCase().trim();
  };

  // Sort the data - must be before early returns (hooks rule)
  const sortedData = useMemo(() => {
    if (!sortColumn || !csvData || csvData.length === 0) return csvData;

    return [...csvData].sort((a, b) => {
      const aVal = a[sortColumn];
      const bVal = b[sortColumn];

      // Handle empty/null values
      if (!aVal && !bVal) return 0;
      if (!aVal) return 1;
      if (!bVal) return -1;

      const normalizedHeader = normalizeColumnName(sortColumn);

      // Date sorting
      if (normalizedHeader === 'date') {
        const aDate = new Date(aVal);
        const bDate = new Date(bVal);
        if (isNaN(aDate.getTime()) || isNaN(bDate.getTime())) {
          // Fallback to string comparison if date parsing fails
          return String(aVal).localeCompare(String(bVal));
        }
        return sortDirection === 'asc' 
          ? aDate.getTime() - bDate.getTime()
          : bDate.getTime() - aDate.getTime();
      }

      // Amount sorting (numeric)
      if (normalizedHeader === 'amount') {
        // Remove currency symbols, commas, spaces and parse
        const aNum = parseFloat(String(aVal).replace(/[R,\s]/g, '')) || 0;
        const bNum = parseFloat(String(bVal).replace(/[R,\s]/g, '')) || 0;
        return sortDirection === 'asc' 
          ? aNum - bNum
          : bNum - aNum;
      }

      // Category or other string sorting
      const aStr = String(aVal).toLowerCase();
      const bStr = String(bVal).toLowerCase();
      if (aStr < bStr) return sortDirection === 'asc' ? -1 : 1;
      if (aStr > bStr) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });
  }, [csvData, sortColumn, sortDirection]);

  const handleSort = (column) => {
    if (sortColumn === column) {
      // Toggle direction if clicking same column
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      // New column, default to ascending for most columns
      setSortColumn(column);
      setSortDirection('asc');
    }
  };

  // Check if a column should be sortable (Date, Amount, Category)
  const isSortableColumn = (header) => {
    const normalized = normalizeColumnName(header);
    return normalized === 'date' || normalized === 'amount' || normalized === 'category';
  };

  // Get sort direction indicator
  const getSortIcon = (header) => {
    if (!isSortableColumn(header)) return null;
    const normalized = normalizeColumnName(header);
    if (sortColumn && normalizeColumnName(sortColumn) === normalized) {
      return sortDirection === 'asc' ? <ArrowUp size={12} /> : <ArrowDown size={12} />;
    }
    return <ArrowUpDown size={12} className="opacity-30" />;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full bg-slate-200 text-slate-500 text-sm">
        Loading CSV...
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-full bg-slate-200 text-red-600 text-sm p-4">
        <div className="text-center">
          <FileText size={48} className="mx-auto mb-4 text-slate-400" />
          <p className="font-semibold">Error loading CSV</p>
          <p className="text-xs mt-2">{error}</p>
        </div>
      </div>
    );
  }

  if (!csvData || csvData.length === 0) {
    return (
      <div className="flex items-center justify-center h-full bg-slate-200 text-slate-500 text-sm">
        <div className="text-center">
          <FileText size={48} className="mx-auto mb-4" />
          <p>CSV file is empty</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-auto bg-slate-50 p-4">
      <div className="bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead className="bg-slate-50 sticky top-0 z-10">
              <tr>
                {headers.map((header, idx) => {
                  const isSortable = isSortableColumn(header);
                  const headerDisplay = String(header).replace(/[<>\"'&]/g, '');
                  return (
                    <th
                      key={idx}
                      className={`px-4 py-2 text-xs font-bold text-slate-700 uppercase border-b border-slate-200 ${
                        isSortable ? 'cursor-pointer hover:text-slate-900 transition-colors' : ''
                      }`}
                      onClick={isSortable ? () => handleSort(header) : undefined}
                    >
                      <div className="flex items-center gap-1">
                        {headerDisplay}
                        {isSortable && getSortIcon(header)}
                      </div>
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {sortedData.map((row, rowIdx) => (
                <tr
                  key={rowIdx}
                  className="border-b border-slate-100 hover:bg-slate-50 transition-colors"
                >
                  {headers.map((header, colIdx) => {
                    const cellValue = row[header];
                    const safeValue = cellValue != null ? String(cellValue).replace(/[<>\"'&]/g, '') : '';
                    const normalizedHeader = normalizeColumnName(header);
                    // Right-align amounts
                    const isAmount = normalizedHeader === 'amount';
                    return (
                      <td
                        key={colIdx}
                        className={`px-4 py-2 text-xs text-slate-700 font-mono ${isAmount ? 'text-right' : ''}`}
                      >
                        {safeValue}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {csvData.length >= CSV_PREVIEW_ROWS && (
          <div className="px-4 py-2 bg-amber-50 border-t border-amber-200 text-xs text-amber-700">
            Showing first 1000 rows. CSV file may contain more data.
          </div>
        )}
      </div>
    </div>
  );
};

export default CSVViewer;

