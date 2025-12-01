# Bank Statement CSV Extraction - Quick Prompt

Extract transaction data from bank statements into CSV format for Rule 43 Financial Intelligence Workspace import.

## Required CSV Format

**Header row (required):**
```csv
Date,Description,Amount
```

**Column name alternatives (case-insensitive):**
- Date: `Date`, `DATE`, `date`, `Transaction Date`, `Posting Date`, `Value Date`
- Description: `Description`, `DESCRIPTION`, `description`, `Details`, `DETAILS`, `Narrative`, `Transaction Description`, `Memo`
- Amount: `Amount`, `AMOUNT`, `amount`, `Transaction Amount`, `Debit`, `Credit`, `Balance`

## Data Format Requirements

### Date
- Format: `DD/MM/YYYY` (preferred) or `YYYY-MM-DD`
- Example: `23/09/2025` or `2025-09-23`
- Must have 4-digit year, pad single digits (e.g., `05/09/2025`)

### Description
- Full transaction text (don't truncate)
- Clean whitespace (multiple spaces → single space)
- Preserve original capitalization and punctuation
- Example: `"IB PAYMENT TO A BOWES RULE 43"` or `"Woolworths"`

### Amount
- Format: `-R 30,000.00` (expenses) or `R 1,140.01` (income)
- Include `R` currency symbol
- Include 2 decimal places
- Use commas for thousands
- **Negative for expenses/debits, positive for income/credits**

## Example Output

```csv
Date,Description,Amount
23/09/2025,"IB PAYMENT TO A BOWES RULE 43",-R 30000.00
29/09/2025,Woolworths,-R 287.96
08/09/2025,"CREDIT TRANSFER D Stunden",R 1140.01
```

## Extraction Rules

1. Extract all transaction rows (exclude headers, footers, summaries)
2. Normalize dates to DD/MM/YYYY or YYYY-MM-DD
3. Preserve full description text
4. Determine amount sign: debits = negative, credits = positive
5. Format amounts with R symbol and 2 decimals
6. Validate: dates parseable, descriptions not empty, amounts numeric

## Quality Checks

- [ ] Header row present
- [ ] All dates valid format with 4-digit years
- [ ] All amounts include R and 2 decimals
- [ ] Negative amounts for expenses, positive for income
- [ ] Descriptions not truncated
- [ ] Valid CSV format (opens in Excel)

**Output:** Provide CSV content ready to save as .csv file, plus brief summary of transactions extracted.

