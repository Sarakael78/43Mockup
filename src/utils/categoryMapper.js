import { CATEGORY_MATCH_RATIO } from './constants';
import { getDefaultCategories } from '../config/categories';

// Map extracted category names to standard categories
const categoryMap = {
  'accommodation': 'Accommodation/Rent',
  'housing': 'Accommodation/Rent',
  'rent': 'Accommodation/Rent',
  'rental': 'Accommodation/Rent',

  'groceries': 'Groceries/Household',
  'grocery': 'Groceries/Household',
  'household': 'Groceries/Household',
  'food': 'Groceries/Household',
  'personal care': 'Groceries/Household',

  'dining': 'Dining & Entertainment',
  'restaurant': 'Dining & Entertainment',
  'entertainment': 'Entertainment',
  'recreation': 'Entertainment',

  'school fees': 'School Fees',
  'schoolfees': 'School Fees',
  'tuition': 'School Fees',
  'education': 'School Fees',

  'medical': 'Medical',
  'health': 'Medical',
  'doctor': 'Medical',
  'pharmacy': 'Medical',
  'medical aid': 'Medical',
  'medicalaid': 'Medical',

  'utilities': 'Utilities',
  'utility': 'Utilities',
  'electricity': 'Utilities',
  'water': 'Utilities',
  'municipal': 'Utilities',
  'communications': 'Utilities',
  'data': 'Utilities',

  'fuel': 'Transport',
  'petrol': 'Transport',
  'diesel': 'Transport',
  'transport': 'Transport',
  'vehicle': 'Transport',

  'insurance': 'Insurance',
  'life insurance': 'Insurance',

  'bond': 'Bond Repayment',
  'bond repayment': 'Bond Repayment',
  'home loan': 'Bond Repayment',
  'mortgage': 'Bond Repayment',

  'maintenance': 'Maintenance',
  'child maintenance': 'Child Maintenance',

  'legal': 'Legal Fees',
  'legal fees': 'Legal Fees',
  'legal expenses': 'Legal Fees',
  'attorney': 'Legal Fees',

  'clothing': 'Clothing',
  'clothes': 'Clothing',

  'bank charges': 'Bank Charges',
  'charges': 'Bank Charges',

  'cash withdrawal': 'Cash Withdrawals',
  'cash': 'Cash Withdrawals',

  'inter-account': 'Inter-Account',
  'transfer': 'Inter-Account',

  'loans': 'Loans/Debt',
  'debt': 'Loans/Debt',

  'business': 'Business Ops'
};

// Fuzzy matching for similar category names
const fuzzyMatch = (input, target) => {
  const inputLower = input.toLowerCase().trim();
  const targetLower = target.toLowerCase().trim();
  
  // Exact match
  if (inputLower === targetLower) return true;
  
  // Contains match
  if (inputLower.includes(targetLower) || targetLower.includes(inputLower)) return true;
  
  // Word-by-word match (at least 50% words match)
  const inputWords = inputLower.split(/\s+/);
  const targetWords = targetLower.split(/\s+/);
  const commonWords = inputWords.filter(w => targetWords.includes(w));
  const matchRatio = commonWords.length / Math.max(inputWords.length, targetWords.length);
  
  return matchRatio >= CATEGORY_MATCH_RATIO;
};

export const mapCategory = (extractedCategory) => {
  if (!extractedCategory) return 'Uncategorized';
  
  const extractedLower = extractedCategory.toLowerCase().trim();
  
  // Check direct mapping
  if (categoryMap[extractedLower]) {
    return categoryMap[extractedLower];
  }
  
  // Check fuzzy matches
  for (const [key, value] of Object.entries(categoryMap)) {
    if (fuzzyMatch(extractedCategory, key)) {
      return value;
    }
  }
  
  // Check if it matches standard categories (capitalize first letter of each word)
  const standardCategories = getDefaultCategories();
  
  for (const standard of standardCategories) {
    if (fuzzyMatch(extractedCategory, standard)) {
      return standard;
    }
  }
  
  // Default: capitalize and return as-is
  return extractedCategory
    .split(/\s+/)
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
};

