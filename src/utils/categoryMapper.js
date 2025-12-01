// Map extracted category names to standard categories
const categoryMap = {
  'groceries': 'Groceries/Household',
  'grocery': 'Groceries/Household',
  'household': 'Groceries/Household',
  'food': 'Groceries/Household',
  
  'school fees': 'School Fees',
  'schoolfees': 'School Fees',
  'tuition': 'School Fees',
  'education': 'School Fees',
  
  'medical': 'Medical',
  'health': 'Medical',
  'doctor': 'Medical',
  'pharmacy': 'Medical',
  
  'utilities': 'Utilities',
  'electricity': 'Utilities',
  'water': 'Utilities',
  'municipal': 'Utilities',
  
  'fuel': 'Transport',
  'petrol': 'Transport',
  'diesel': 'Transport',
  'transport': 'Transport',
  
  'insurance': 'Insurance',
  'life insurance': 'Insurance',
  'medical aid': 'Medical',
  'medicalaid': 'Medical',
  
  'bond': 'Bond Repayment',
  'bond repayment': 'Bond Repayment',
  'home loan': 'Bond Repayment',
  'mortgage': 'Bond Repayment',
  
  'rent': 'Rent',
  'rental': 'Rent',
  
  'maintenance': 'Maintenance',
  'child maintenance': 'Child Maintenance',
  
  'legal': 'Legal Fees',
  'legal fees': 'Legal Fees',
  'attorney': 'Legal Fees',
  
  'clothing': 'Clothing',
  'clothes': 'Clothing',
  
  'entertainment': 'Entertainment',
  'recreation': 'Entertainment',
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
  
  return matchRatio >= 0.5;
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
  const standardCategories = [
    'Groceries/Household', 'School Fees', 'Medical', 'Utilities', 'Transport',
    'Insurance', 'Bond Repayment', 'Rent', 'Maintenance', 'Child Maintenance',
    'Legal Fees', 'Clothing', 'Entertainment', 'Uncategorized'
  ];
  
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

