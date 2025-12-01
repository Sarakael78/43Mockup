# Implementation Plans: Critical Features
**Generated:** 2025-12-01  
**Project:** Rule 43 Financial Intelligence Workspace

This document provides granularized, step-by-step implementation plans for the 4 critical production blockers.

---

## Plan 1: Error Handling System
**Replace 4 alert() calls with proper React error UI components**

### Overview
Replace all blocking `alert()` calls with non-blocking, user-friendly error notifications that match the application's design system.

### Current Issues
- **Line 89** (`src/App.jsx`): File size validation error
- **Line 128** (`src/App.jsx`): Project loading error
- **Line 134** (`src/App.jsx`): FileReader error
- **Line 1143** (`src/App.jsx`): File upload confirmation

### Implementation Steps

#### Step 1.1: Create Error Toast Component
**File:** `src/components/ErrorToast.jsx` (new file)

**Actions:**
1. Create `src/components/` directory
2. Create `ErrorToast.jsx` component with:
   - Props: `message`, `type` ('error' | 'warning' | 'success' | 'info'), `onClose`, `duration` (default 5000ms)
   - Design: Match Tailwind slate/rose color scheme
   - Animation: Slide in from top-right, fade out
   - Icons: Use Lucide React (AlertCircle, CheckCircle, etc.)
   - Auto-dismiss after duration
   - Manual dismiss button

**Code Structure:**
```jsx
const ErrorToast = ({ message, type = 'error', onClose, duration = 5000 }) => {
  // useState for visibility
  // useEffect for auto-dismiss timer
  // Tailwind classes based on type
  // Return JSX with icon, message, close button
}
```

#### Step 1.2: Create Toast Context Provider
**File:** `src/contexts/ToastContext.jsx` (new file)

**Actions:**
1. Create `src/contexts/` directory
2. Create React Context for toast management
3. Implement:
   - `showToast(message, type)` function
   - State management for toast queue
   - Support multiple toasts (stack)
   - Auto-remove from queue after dismissal

**Code Structure:**
```jsx
const ToastContext = createContext();

export const ToastProvider = ({ children }) => {
  const [toasts, setToasts] = useState([]);
  
  const showToast = (message, type = 'error') => {
    const id = Date.now();
    setToasts(prev => [...prev, { id, message, type }]);
    return id;
  };
  
  const removeToast = (id) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  };
  
  return (
    <ToastContext.Provider value={{ showToast, removeToast }}>
      {children}
      <ToastContainer toasts={toasts} />
    </ToastContext.Provider>
  );
};
```

#### Step 1.3: Create Toast Container Component
**File:** `src/components/ToastContainer.jsx` (new file)

**Actions:**
1. Create container that renders multiple toasts
2. Position: Fixed top-right (z-index: 9999)
3. Stack toasts vertically with spacing
4. Animate entrance/exit

#### Step 1.4: Integrate Toast System into App
**File:** `src/App.jsx`

**Actions:**
1. Import `ToastProvider` and wrap App component
2. Import `useToast` hook in App component
3. Replace `alert()` at line 89:
   ```jsx
   // OLD: alert(`File too large. Maximum size is ${MAX_FILE_SIZE / 1024 / 1024}MB.`);
   // NEW:
   showToast(`File too large. Maximum size is ${MAX_FILE_SIZE / 1024 / 1024}MB.`, 'error');
   ```
4. Replace `alert()` at line 128:
   ```jsx
   // OLD: alert(`Error loading project: ${error.message}`);
   // NEW:
   showToast(`Error loading project: ${error.message}`, 'error');
   ```
5. Replace `alert()` at line 134:
   ```jsx
   // OLD: alert('Error reading file. Please try again.');
   // NEW:
   showToast('Error reading file. Please try again.', 'error');
   ```
6. Replace `alert()` at line 1143:
   ```jsx
   // OLD: alert(`${files.length} file(s) uploaded. Processing would happen here in production.`);
   // NEW:
   showToast(`${files.length} file(s) uploaded successfully.`, 'success');
   ```

#### Step 1.5: Add Error Boundary Component
**File:** `src/components/ErrorBoundary.jsx` (new file)

**Actions:**
1. Create React Error Boundary class component
2. Catch React component errors
3. Display user-friendly error UI
4. Log errors to console
5. Wrap main App component

#### Step 1.6: Testing
- Test each error scenario
- Verify toast appears and auto-dismisses
- Verify multiple toasts stack correctly
- Verify manual dismiss works
- Test error boundary with intentional error

### Dependencies
- None (using existing React and Lucide React)

### Estimated Time
- Step 1.1: 1 hour
- Step 1.2: 1.5 hours
- Step 1.3: 1 hour
- Step 1.4: 30 minutes
- Step 1.5: 1 hour
- Step 1.6: 30 minutes
- **Total: ~5.5 hours**

---

## Plan 2: File Upload Processing
**Backend logic missing (currently shows alert)**

### Overview
Implement actual file processing logic to parse uploaded bank statements and financial affidavits, extract transactions, and integrate them into the application state.

### Current State
- **Line 1140-1143** (`src/App.jsx`): `handleFileUpload` only shows alert
- File upload modal exists with triage step
- Files are collected but not processed

### Implementation Steps

#### Step 2.1: Create File Processing Utilities
**File:** `src/utils/fileProcessors.js` (new file)

**Actions:**
1. Create `src/utils/` directory
2. Create processor functions:
   - `processBankStatement(file, parser, entity)` - Parse bank statement PDF/CSV
   - `processFinancialAffidavit(file)` - Parse DOCX financial affidavit
   - `extractTransactionsFromCSV(csvText, parser)` - Extract transactions from CSV
   - `extractTransactionsFromPDF(pdfFile, parser)` - Extract transactions from PDF (basic)
   - `validateTransactionData(transactions)` - Validate extracted data

**Code Structure:**
```javascript
export const processBankStatement = async (file, parser, entity) => {
  // Read file based on type
  // Parse based on parser type (Standard Bank, FNB, etc.)
  // Extract transactions
  // Return { transactions: [], errors: [] }
};

export const processFinancialAffidavit = async (file) => {
  // Parse DOCX
  // Extract claimed expenses
  // Return { claims: [], errors: [] }
};
```

#### Step 2.2: Install Required Dependencies
**File:** `package.json`

**Actions:**
1. Install CSV parser: `npm install papaparse`
2. Install DOCX parser: `npm install mammoth` (for .docx) or `npm install docx` (alternative)
3. Install PDF parser: `npm install pdf-parse` (for basic PDF text extraction)
4. Update package.json

**Commands:**
```bash
npm install papaparse mammoth pdf-parse
```

#### Step 2.3: Create Parser Implementations
**File:** `src/utils/parsers/` (new directory)

**Actions:**
1. Create `standardBankParser.js` - Parse Standard Bank CSV/PDF format
2. Create `fnbParser.js` - Parse FNB CSV/PDF format
3. Create `investecParser.js` - Parse Investec CSV/PDF format
4. Create `genericCSVParser.js` - Generic CSV parser with configurable column mapping
5. Each parser exports: `parseCSV(csvText)`, `parsePDF(pdfBuffer)` functions

**Parser Interface:**
```javascript
export const parseCSV = (csvText) => {
  // Parse CSV
  // Map columns to: date, description, amount, account
  // Return array of transaction objects
  return transactions.map(tx => ({
    id: generateId(),
    date: tx.date,
    desc: tx.description,
    clean: cleanDescription(tx.description),
    amount: parseFloat(tx.amount),
    acc: tx.account,
    cat: 'Uncategorized',
    status: 'pending',
    type: tx.amount < 0 ? 'expense' : 'income'
  }));
};
```

#### Step 2.4: Implement CSV Processing
**File:** `src/utils/fileProcessors.js`

**Actions:**
1. Import `papaparse`
2. Implement CSV reading and parsing
3. Route to appropriate parser based on selected parser type
4. Handle encoding issues
5. Validate parsed data structure

#### Step 2.5: Implement PDF Text Extraction (Basic)
**File:** `src/utils/fileProcessors.js`

**Actions:**
1. Import `pdf-parse`
2. Extract text from PDF
3. Use regex patterns to find transaction data
4. Parse dates, amounts, descriptions
5. Handle multi-page PDFs
6. Note: Full OCR would require backend service

#### Step 2.6: Implement DOCX Processing
**File:** `src/utils/fileProcessors.js`

**Actions:**
1. Import `mammoth`
2. Convert DOCX to HTML/text
3. Extract claimed expense amounts using regex patterns
4. Look for patterns like "Groceries: R4,800" or table structures
5. Map to claims array format

#### Step 2.7: Update File Upload Handler
**File:** `src/App.jsx`

**Actions:**
1. Import file processing utilities
2. Update `handleFileUpload` function:
   ```javascript
   const handleFileUpload = async (files) => {
     const results = [];
     
     for (const file of files) {
       try {
         if (file.triage.type === 'Bank Statement') {
           const result = await processBankStatement(
             file,
             file.triage.parser,
             file.triage.entity
           );
           // Add transactions to state
           setTransactions(prev => [...prev, ...result.transactions]);
           results.push({ file: file.name, success: true, count: result.transactions.length });
         } else if (file.triage.type === 'Financial Affidavit') {
           const result = await processFinancialAffidavit(file);
           // Add claims to state
           setClaims(prev => [...prev, ...result.claims]);
           results.push({ file: file.name, success: true, count: result.claims.length });
         }
       } catch (error) {
         results.push({ file: file.name, success: false, error: error.message });
       }
     }
     
     // Show success/error toasts
     showToast(`Processed ${results.filter(r => r.success).length} of ${files.length} files`, 'success');
   };
   ```

#### Step 2.8: Add Progress Tracking
**File:** `src/components/FileUploadModal.jsx`

**Actions:**
1. Add state for processing progress
2. Show progress bar per file
3. Update progress as files are processed
4. Show success/error indicators per file

#### Step 2.9: Update Files State
**File:** `src/App.jsx`

**Actions:**
1. After processing, add files to `appData.files` array
2. Include metadata: name, size, entity, parser, processed date
3. Update file list in DocumentInventory component

#### Step 2.10: Error Handling
**File:** `src/utils/fileProcessors.js`

**Actions:**
1. Wrap all parsing in try-catch
2. Return structured errors: `{ transactions: [], errors: [{ file, message }] }`
3. Validate file types before processing
4. Handle corrupted files gracefully

### Dependencies
- `papaparse` - CSV parsing
- `mammoth` - DOCX parsing
- `pdf-parse` - PDF text extraction

### Estimated Time
- Step 2.1: 2 hours
- Step 2.2: 15 minutes
- Step 2.3: 4 hours (parser implementations)
- Step 2.4: 1.5 hours
- Step 2.5: 2 hours
- Step 2.6: 2 hours
- Step 2.7: 1.5 hours
- Step 2.8: 1 hour
- Step 2.9: 30 minutes
- Step 2.10: 1 hour
- **Total: ~16 hours**

---

## Plan 3: Document Import/Parsing
**DOCX/PDF parser not implemented**

### Overview
Implement document parsing for the Import mode in DocumentInventory, allowing users to import claimed expenses directly from annexures and financial affidavits.

### Current State
- **Line 906, 956** (`src/App.jsx`): `onImport` handler only shows alert
- Import mode UI exists with file picker
- No actual parsing implementation

### Implementation Steps

#### Step 3.1: Create Document Parser Module
**File:** `src/utils/documentParsers.js` (new file)

**Actions:**
1. Create specialized parser for financial documents
2. Focus on extracting claimed expense amounts
3. Support DOCX and PDF formats
4. Handle various document structures (tables, lists, paragraphs)

#### Step 3.2: Implement DOCX Parser for Claims
**File:** `src/utils/documentParsers.js`

**Actions:**
1. Use `mammoth` to convert DOCX to HTML
2. Parse HTML to find expense patterns:
   - Look for tables with category/amount columns
   - Find patterns like "Groceries: R4,800"
   - Extract from structured lists
   - Handle KPR8 annexure format specifically
3. Map extracted data to claims format:
   ```javascript
   {
     id: generateId(),
     category: extractedCategory,
     claimed: parseFloat(amount),
     desc: extractedDescription
   }
   ```

#### Step 3.3: Implement PDF Parser for Claims
**File:** `src/utils/documentParsers.js`

**Actions:**
1. Use `pdf-parse` to extract text
2. Apply regex patterns to find expense claims
3. Handle common formats:
   - "Category: Amount" patterns
   - Table structures
   - Numbered lists with amounts
4. Extract category names and amounts

#### Step 3.4: Create Category Mapping
**File:** `src/utils/categoryMapper.js` (new file)

**Actions:**
1. Map extracted category names to standard categories
2. Handle variations: "Groceries" → "Groceries/Household"
3. Fuzzy matching for similar category names
4. Default to "Uncategorized" if no match

#### Step 3.5: Implement Import Handler
**File:** `src/App.jsx`

**Actions:**
1. Update `onImport` prop in DocumentInventory calls (lines 906, 956)
2. Create `handleDocumentImport` function:
   ```javascript
   const handleDocumentImport = async (file) => {
     try {
       showToast(`Parsing ${file.name}...`, 'info');
       
       let claims = [];
       if (file.name.endsWith('.docx')) {
         claims = await parseDOCXClaims(file);
       } else if (file.name.endsWith('.pdf')) {
         claims = await parsePDFClaims(file);
       } else {
         throw new Error('Unsupported file type. Please use DOCX or PDF.');
       }
       
       // Map categories
       claims = claims.map(claim => ({
         ...claim,
         category: mapCategory(claim.category) || 'Uncategorized'
       }));
       
       // Add to claims state
       setClaims(prev => [...prev, ...claims]);
       
       showToast(`Imported ${claims.length} claims from ${file.name}`, 'success');
     } catch (error) {
       showToast(`Error importing ${file.name}: ${error.message}`, 'error');
     }
   };
   ```

#### Step 3.6: Add Import Validation
**File:** `src/utils/documentParsers.js`

**Actions:**
1. Validate extracted data structure
2. Check for required fields (category, amount)
3. Validate amount is numeric
4. Filter out invalid entries
5. Return validation errors

#### Step 3.7: Handle Duplicate Claims
**File:** `src/App.jsx`

**Actions:**
1. Check for existing claims with same category
2. Offer merge or replace options
3. Show confirmation dialog if duplicates found
4. Update existing claim or add new one

#### Step 3.8: Add Import Preview
**File:** `src/components/ImportPreview.jsx` (new file, optional)

**Actions:**
1. Show preview of extracted claims before importing
2. Allow user to edit/correct extracted data
3. Show confidence scores if applicable
4. Confirm import action

#### Step 3.9: Update UI Feedback
**File:** `src/App.jsx` (DocumentInventory component)

**Actions:**
1. Show loading state during parsing
2. Display parsing progress
3. Show success message with count
4. Handle errors gracefully

### Dependencies
- `mammoth` - DOCX parsing (shared with Plan 2)
- `pdf-parse` - PDF parsing (shared with Plan 2)

### Estimated Time
- Step 3.1: 1 hour
- Step 3.2: 3 hours
- Step 3.3: 2.5 hours
- Step 3.4: 1.5 hours
- Step 3.5: 1.5 hours
- Step 3.6: 1 hour
- Step 3.7: 2 hours
- Step 3.8: 2 hours (optional)
- Step 3.9: 1 hour
- **Total: ~15.5 hours** (or ~13.5 hours without preview)

---

## Plan 4: PDF Viewer Integration
**Currently simulated; needs react-pdf integration**

### Overview
Replace the simulated PDF viewer with actual PDF rendering using `react-pdf` library, enabling real document viewing and interaction.

### Current State
- **Line 818-867** (`src/App.jsx`): PDFViewer shows simulated content
- Hardcoded "Page 1 of 3" and date
- Shows transactions as overlay but no actual PDF

### Implementation Steps

#### Step 4.1: Install react-pdf
**File:** `package.json`

**Actions:**
1. Install react-pdf: `npm install react-pdf`
2. Install PDF.js worker: `npm install pdfjs-dist`
3. Update package.json

**Commands:**
```bash
npm install react-pdf pdfjs-dist
```

#### Step 4.2: Configure PDF.js Worker
**File:** `src/utils/pdfConfig.js` (new file)

**Actions:**
1. Configure PDF.js worker path
2. Set up worker for Vite build
3. Handle worker loading

**Code:**
```javascript
import { pdfjs } from 'react-pdf';

// Set worker path for Vite
if (import.meta.env.PROD) {
  pdfjs.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjs.version}/pdf.worker.min.js`;
} else {
  pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.js`;
}
```

#### Step 4.3: Create PDF Document Component
**File:** `src/components/PDFDocumentViewer.jsx` (new file)

**Actions:**
1. Create component using react-pdf's `Document` and `Page` components
2. Handle PDF loading states
3. Implement error handling
4. Support page navigation
5. Add zoom controls

**Code Structure:**
```jsx
import { Document, Page, pdfjs } from 'react-pdf';
import 'react-pdf/dist/esm/Page/AnnotationLayer.css';
import 'react-pdf/dist/esm/Page/TextLayer.css';

const PDFDocumentViewer = ({ fileUrl, onLoadSuccess, currentPage, onPageChange }) => {
  const [numPages, setNumPages] = useState(null);
  const [pageNumber, setPageNumber] = useState(currentPage || 1);
  
  function onDocumentLoadSuccess({ numPages }) {
    setNumPages(numPages);
    if (onLoadSuccess) onLoadSuccess(numPages);
  }
  
  return (
    <Document
      file={fileUrl}
      onLoadSuccess={onDocumentLoadSuccess}
      loading={<div>Loading PDF...</div>}
      error={<div>Error loading PDF</div>}
    >
      <Page
        pageNumber={pageNumber}
        renderTextLayer={true}
        renderAnnotationLayer={true}
      />
    </Document>
  );
};
```

#### Step 4.4: Update PDFViewer Component
**File:** `src/App.jsx` (PDFViewer component, lines 818-867)

**Actions:**
1. Import PDFDocumentViewer component
2. Replace simulated content with actual PDF rendering
3. Add state for:
   - Current page number
   - Total pages
   - PDF file URL
   - Loading state
4. Implement page navigation controls
5. Keep transaction overlay functionality

**Updated Structure:**
```jsx
const PDFViewer = ({ entity, activeTxId, transactions, files, accounts }) => {
  const [currentPage, setCurrentPage] = useState(1);
  const [numPages, setNumPages] = useState(null);
  const [pdfUrl, setPdfUrl] = useState(null);
  
  const currentFile = files?.find(f => f.entity === entity) || files?.[0];
  
  // Convert file to URL for react-pdf
  useEffect(() => {
    if (currentFile?.file) {
      // If file is a File object, create object URL
      const url = URL.createObjectURL(currentFile.file);
      setPdfUrl(url);
      return () => URL.revokeObjectURL(url);
    } else if (currentFile?.url) {
      // If file has URL property
      setPdfUrl(currentFile.url);
    }
  }, [currentFile]);
  
  // ... rest of component with PDFDocumentViewer
};
```

#### Step 4.5: Add Page Navigation Controls
**File:** `src/App.jsx` (PDFViewer component)

**Actions:**
1. Add Previous/Next page buttons
2. Add page number input
3. Display "Page X of Y"
4. Disable buttons at boundaries
5. Use Lucide React icons (ChevronLeft, ChevronRight)

#### Step 4.6: Add Zoom Controls
**File:** `src/components/PDFDocumentViewer.jsx`

**Actions:**
1. Add zoom in/out buttons
2. Add zoom level display
3. Implement zoom functionality
4. Default zoom: 100%
5. Zoom range: 50% - 200%

#### Step 4.7: Integrate Transaction Overlay
**File:** `src/App.jsx` (PDFViewer component)

**Actions:**
1. Keep transaction list overlay
2. Position overlay over PDF
3. Highlight transactions on PDF (if coordinates available)
4. Maintain "Tick and Bash" verification workflow
5. Sync transaction selection with PDF view

#### Step 4.8: Handle File Sources
**File:** `src/App.jsx`

**Actions:**
1. Support multiple file sources:
   - File objects from upload
   - URLs from server
   - Base64 encoded PDFs
2. Create object URLs for File objects
3. Clean up object URLs on unmount
4. Handle file loading errors

#### Step 4.9: Add PDF Loading States
**File:** `src/components/PDFDocumentViewer.jsx`

**Actions:**
1. Show loading spinner while PDF loads
2. Display error message if PDF fails to load
3. Show "No PDF available" if file missing
4. Handle corrupted PDF files

#### Step 4.10: Style PDF Viewer
**File:** `src/App.jsx` (PDFViewer component)

**Actions:**
1. Match existing design (slate-200 background, white PDF container)
2. Ensure PDF fits container (595px width for A4)
3. Add shadow and border styling
4. Maintain responsive layout
5. Style navigation controls

#### Step 4.11: Update File Data Structure
**File:** `src/App.jsx` and `financial_data.json`

**Actions:**
1. Ensure files array includes file objects or URLs
2. For uploaded files, store File objects
3. For reference files, use URLs or paths
4. Update file metadata structure

### Dependencies
- `react-pdf` - PDF rendering
- `pdfjs-dist` - PDF.js library

### Estimated Time
- Step 4.1: 15 minutes
- Step 4.2: 30 minutes
- Step 4.3: 2 hours
- Step 4.4: 2 hours
- Step 4.5: 1.5 hours
- Step 4.6: 1.5 hours
- Step 4.7: 2 hours
- Step 4.8: 1.5 hours
- Step 4.9: 1 hour
- Step 4.10: 1 hour
- Step 4.11: 30 minutes
- **Total: ~14.5 hours**

---

## Implementation Priority & Timeline

### Recommended Order
1. **Plan 1: Error Handling** (5.5 hours) - Foundation for other features
2. **Plan 4: PDF Viewer** (14.5 hours) - Independent, improves UX immediately
3. **Plan 2: File Upload Processing** (16 hours) - Core functionality
4. **Plan 3: Document Import/Parsing** (15.5 hours) - Builds on Plan 2

### Total Estimated Time
- **Plan 1:** 5.5 hours
- **Plan 2:** 16 hours
- **Plan 3:** 15.5 hours
- **Plan 4:** 14.5 hours
- **Total: ~51.5 hours** (~6.5 working days)

### Dependencies Between Plans
- Plan 1 should be completed first (error handling needed for all)
- Plan 2 and Plan 3 share document parsing utilities (can be developed together)
- Plan 4 is independent (can be done in parallel with Plans 2-3)

### Risk Mitigation
- Start with Plan 1 (smallest, highest impact)
- Test each plan incrementally
- Keep existing functionality working during implementation
- Use feature flags if needed for gradual rollout

---

## Testing Checklist

### Plan 1: Error Handling
- [ ] Toast appears on error
- [ ] Toast auto-dismisses after duration
- [ ] Multiple toasts stack correctly
- [ ] Manual dismiss works
- [ ] Error boundary catches React errors
- [ ] All 4 alert() calls replaced

### Plan 2: File Upload Processing
- [ ] CSV files parse correctly
- [ ] PDF files extract text
- [ ] DOCX files parse correctly
- [ ] Transactions added to state
- [ ] Files added to file list
- [ ] Errors handled gracefully
- [ ] Progress tracking works

### Plan 3: Document Import/Parsing
- [ ] DOCX annexures parse correctly
- [ ] PDF affidavits parse correctly
- [ ] Claims extracted accurately
- [ ] Categories mapped correctly
- [ ] Duplicates handled
- [ ] Validation works

### Plan 4: PDF Viewer
- [ ] PDFs render correctly
- [ ] Page navigation works
- [ ] Zoom controls work
- [ ] Transaction overlay displays
- [ ] Loading states show
- [ ] Errors handled

---

**Document End**

