/**
 * Shared file utility functions
 * Used across fileProcessors and documentParsers to avoid duplication
 */

/**
 * Read a file as text
 * @param {File|Blob} file - File or Blob object to read
 * @returns {Promise<string>} File contents as text
 * @throws {Error} If file is invalid or read fails
 */
export const readFileAsText = (file) => {
  return new Promise((resolve, reject) => {
    // Ensure file is a Blob/File object by checking for Blob methods
    if (!file || typeof file.slice !== 'function' || typeof file.stream !== 'function') {
      reject(new Error('Invalid file object: expected Blob or File'));
      return;
    }
    const reader = new FileReader();
    reader.onload = (e) => resolve(e.target.result);
    reader.onerror = (e) => reject(new Error('Failed to read file'));
    reader.readAsText(file);
  });
};

/**
 * Read a file as ArrayBuffer
 * @param {File|Blob} file - File or Blob object to read
 * @returns {Promise<ArrayBuffer>} File contents as ArrayBuffer
 * @throws {Error} If file is invalid or read fails
 */
export const readFileAsArrayBuffer = (file) => {
  return new Promise((resolve, reject) => {
    // Ensure file is a Blob/File object by checking for Blob methods
    if (!file || typeof file.slice !== 'function' || typeof file.stream !== 'function') {
      reject(new Error('Invalid file object: expected Blob or File'));
      return;
    }
    const reader = new FileReader();
    reader.onload = (e) => resolve(e.target.result);
    reader.onerror = (e) => reject(new Error('Failed to read file'));
    reader.readAsArrayBuffer(file);
  });
};

