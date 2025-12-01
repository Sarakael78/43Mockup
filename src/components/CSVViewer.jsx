import { useState, useEffect } from 'react';
import Papa from 'papaparse';
import { FileText } from 'lucide-react';

const CSVViewer = ({ file, fileUrl }) => {
  const [csvData, setCsvData] = useState([]);
  const [headers, setHeaders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

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
          preview: 1000, // Limit to 1000 rows for display
          complete: (results) => {
            if (results.errors && results.errors.length > 0) {
              console.warn('CSV parsing warnings:', results.errors);
            }
            
            if (results.data && results.data.length > 0) {
              // Get headers from first row keys
              const firstRow = results.data[0];
              setHeaders(Object.keys(firstRow));
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
                {headers.map((header, idx) => (
                  <th
                    key={idx}
                    className="px-4 py-2 text-xs font-bold text-slate-700 uppercase border-b border-slate-200"
                  >
                    {String(header).replace(/[<>\"'&]/g, '')}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {csvData.map((row, rowIdx) => (
                <tr
                  key={rowIdx}
                  className="border-b border-slate-100 hover:bg-slate-50 transition-colors"
                >
                  {headers.map((header, colIdx) => {
                    const cellValue = row[header];
                    const safeValue = cellValue != null ? String(cellValue).replace(/[<>\"'&]/g, '') : '';
                    return (
                      <td
                        key={colIdx}
                        className="px-4 py-2 text-xs text-slate-700 font-mono"
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
        {csvData.length >= 1000 && (
          <div className="px-4 py-2 bg-amber-50 border-t border-amber-200 text-xs text-amber-700">
            Showing first 1000 rows. CSV file may contain more data.
          </div>
        )}
      </div>
    </div>
  );
};

export default CSVViewer;

