// Application constants
export const FILE_SIZE_LIMIT_MB = 10;
export const FILE_SIZE_LIMIT_BYTES = FILE_SIZE_LIMIT_MB * 1024 * 1024;
export const CSV_MAX_ROWS = 100000;
export const CSV_PREVIEW_ROWS = 1000;
export const NOTE_MAX_LENGTH = 1000;
export const CASE_NAME_MAX_LENGTH = 100;
export const AUTO_SAVE_DEBOUNCE_MS = 1000;
export const SAVED_INDICATOR_DURATION_MS = 3000;
export const PDF_ZOOM_MIN = 0.5;
export const PDF_ZOOM_MAX = 2.0;
export const PDF_ZOOM_STEP = 0.25;
export const PDF_A4_WIDTH = 595; // A4 width in points

// Business logic constants
export const MIN_AMOUNT_THRESHOLD = 100; // Minimum amount to consider for claims
export const MAX_AMOUNT_THRESHOLD = 1000000; // Maximum amount threshold
export const MIN_LINE_LENGTH = 10; // Minimum line length for parsing
export const CATEGORY_MATCH_RATIO = 0.5; // Minimum match ratio for fuzzy category matching
export const TOAST_DELAY_MS = 100; // Delay before showing toast to ensure state updates complete

// Shared utility: Generate unique ID
export const generateId = () => `${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;

