import { pdfjs } from 'react-pdf';
import * as pdfjsLib from 'pdfjs-dist';

// Shared PDF.js worker configuration for both react-pdf and pdfjs-dist
// Worker path respects custom Vite base URLs to avoid 404s behind reverse proxies
const getWorkerUrl = () => {
  const base =
    typeof import.meta !== 'undefined' &&
    import.meta.env &&
    typeof import.meta.env.BASE_URL === 'string'
      ? import.meta.env.BASE_URL
      : '/';
  const normalizedBase = base.endsWith('/') ? base : `${base}/`;
  return `${normalizedBase}pdf.worker.min.mjs`;
};

const WORKER_URL = getWorkerUrl();

// Configure for react-pdf
pdfjs.GlobalWorkerOptions.workerSrc = WORKER_URL;

// Configure for pdfjs-dist (used in documentParsers and fileProcessors)
if (typeof window !== 'undefined') {
  pdfjsLib.GlobalWorkerOptions.workerSrc = WORKER_URL;
}

