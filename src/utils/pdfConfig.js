import { pdfjs } from 'react-pdf';
import * as pdfjsLib from 'pdfjs-dist';

// Shared PDF.js worker configuration for both react-pdf and pdfjs-dist
// Use worker from public folder to avoid CORS and Vite module resolution issues
// The worker file is copied to public/ during setup
const WORKER_URL = '/pdf.worker.min.mjs';

// Configure for react-pdf
pdfjs.GlobalWorkerOptions.workerSrc = WORKER_URL;

// Configure for pdfjs-dist (used in documentParsers and fileProcessors)
if (typeof window !== 'undefined') {
  pdfjsLib.GlobalWorkerOptions.workerSrc = WORKER_URL;
}

