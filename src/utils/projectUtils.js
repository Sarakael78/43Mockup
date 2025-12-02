/**
 * Project import/export utilities
 */

import { FILE_SIZE_LIMIT_BYTES } from './constants';
import { ensureTransactionEntities } from './transactionUtils';
import { defaultCategories } from '../config/categories';

/**
 * Export project data to a downloadable file
 * @param {Object} appData - Application data (accounts, categories, files, etc.)
 * @param {Array} transactions - Array of transactions
 * @param {Array} claims - Array of claims
 * @param {string} caseName - Case name
 * @param {Object} notes - Notes object mapping transaction IDs to notes
 */
export const exportProject = (appData, transactions, claims, caseName, notes = {}) => {
  const projectData = {
    version: '1.0',
    caseName: caseName || 'New Case',
    exportedAt: new Date().toISOString(),
    accounts: appData.accounts,
    categories: appData.categories,
    files: appData.files,
    transactions: transactions,
    claims: claims,
    notes: notes,
    charts: appData.charts,
    alerts: appData.alerts
  };
  
  const blob = new Blob([JSON.stringify(projectData, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  const safeCaseName = (caseName || 'Rademan_v_Rademan').replace(/\s+/g, '_').replace(/[^a-zA-Z0-9_]/g, '');
  const dateStr = new Date().toISOString().split('T')[0];
  a.download = `${safeCaseName}_${dateStr}.r43`;
  
  try {
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  } finally {
    // Always revoke URL to prevent memory leak
    URL.revokeObjectURL(url);
  }
};

/**
 * Load project from file
 * @param {File} file - Project file (.r43 or .json)
 * @param {Function} setAppData - State setter for app data
 * @param {Function} setTransactions - State setter for transactions
 * @param {Function} setClaims - State setter for claims
 * @param {Function} setCaseName - State setter for case name
 * @param {Function} setNotes - State setter for notes
 * @param {Function} showToast - Toast notification function
 * @returns {Function} Cleanup function
 */
export const loadProject = (file, setAppData, setTransactions, setClaims, setCaseName, setNotes, showToast) => {
  // Validate file size (max 10MB)
  if (file.size > FILE_SIZE_LIMIT_BYTES) {
    if (showToast) {
      showToast(`File too large. Maximum size is ${FILE_SIZE_LIMIT_BYTES / 1024 / 1024}MB.`, 'error');
    }
    return () => {}; // Return cleanup function for consistency
  }

  // Validate file type
  if (!file.name.endsWith('.r43') && !file.name.endsWith('.json')) {
    if (showToast) {
      showToast('Invalid file type. Please select a .r43 or .json file.', 'error');
    }
    return () => {};
  }

  const reader = new FileReader();
  let isCancelled = false;
  
  reader.onload = (e) => {
    if (isCancelled) return;
    
    try {
      const projectData = JSON.parse(e.target.result);
      
      // Enhanced schema validation
      if (!projectData || typeof projectData !== 'object') {
        throw new Error('Invalid project file: not a valid JSON object');
      }
      
      if (!projectData.accounts || typeof projectData.accounts !== 'object') {
        throw new Error('Invalid project file: missing or invalid accounts');
      }
      
      if (!Array.isArray(projectData.transactions)) {
        throw new Error('Invalid project file: transactions must be an array');
      }
      
      if (!Array.isArray(projectData.claims)) {
        throw new Error('Invalid project file: claims must be an array');
      }
      
      // Validate transaction structure
      for (const tx of projectData.transactions) {
        if (!tx.id || typeof tx.amount !== 'number' || !tx.date) {
          throw new Error('Invalid project file: transactions must have id, amount, and date');
        }
      }
      
      // Validate claims structure
      for (const claim of projectData.claims) {
        if (!claim.id || typeof claim.claimed !== 'number' || !claim.category) {
          throw new Error('Invalid project file: claims must have id, claimed amount, and category');
        }
      }
      
      const normalizedCategories = Array.isArray(projectData.categories) && projectData.categories.length > 0
        ? projectData.categories
        : defaultCategories;

      setAppData({
        accounts: projectData.accounts,
        categories: normalizedCategories,
        files: Array.isArray(projectData.files) ? projectData.files : [],
        charts: Array.isArray(projectData.charts) ? projectData.charts : [],
        alerts: Array.isArray(projectData.alerts) ? projectData.alerts : []
      });
      const normalizedTransactions = ensureTransactionEntities(projectData.transactions || [], projectData.files || []);
      setTransactions(normalizedTransactions);
      setClaims(projectData.claims || []);
      if (projectData.caseName && typeof projectData.caseName === 'string') {
        setCaseName(projectData.caseName);
      }
      if (projectData.notes && typeof projectData.notes === 'object' && setNotes) {
        setNotes(projectData.notes || {});
      }
      
      // Save to localStorage with error handling
      try {
        localStorage.setItem('r43_project', JSON.stringify(projectData));
      } catch (storageError) {
        // localStorage quota exceeded or disabled
        if (showToast) {
          showToast('Project loaded but could not save to browser storage.', 'warning');
        }
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error loading project';
      if (showToast) {
        showToast(`Error loading project: ${errorMessage}`, 'error');
      }
    }
  };
  
  reader.onerror = () => {
    if (!isCancelled) {
      if (showToast) {
        showToast('Error reading file. Please try again.', 'error');
      }
    }
  };
  
  reader.readAsText(file);
  
  // Return cleanup function
  return () => {
    isCancelled = true;
    if (reader.readyState === FileReader.LOADING) {
      reader.abort();
    }
  };
};

