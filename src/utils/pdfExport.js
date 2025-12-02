import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

// --- VISIO DESIGN SYSTEM TOKENS ---
const COLORS = {
  primary: [15, 23, 42],    // Slate 900
  secondary: [100, 116, 139], // Slate 500
  accent: [59, 130, 246],   // Blue 500
  bg: [248, 250, 252],      // Slate 50
  border: [226, 232, 240],  // Slate 200
  success: [22, 163, 74],   // Green 600
  danger: [220, 38, 38],    // Red 600
  warning: [249, 115, 22],  // Orange 500 (Text)
  warningBg: [255, 247, 237], // Orange 50 (Background)
  text: [51, 65, 85]        // Slate 700
};

const STYLES = {
  headerFont: 'helvetica',
  bodyFont: 'helvetica',
  fontSize: {
    title: 22,
    subtitle: 10,
    body: 9,
    small: 8
  }
};

/**
 * Formats amount to match UI display (currency style, no decimals)
 */
const formatAmount = (amount) => {
  if (amount == null || isNaN(amount)) return 'R 0';
  const absAmount = Math.abs(amount);
  const formatted = absAmount.toLocaleString('en-ZA', {
    style: 'currency',
    currency: 'ZAR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  });
  return amount >= 0 ? `+${formatted}` : formatted;
};

/**
 * Formats date with validation
 */
const formatDate = (dateStr) => {
  if (!dateStr) return 'Invalid Date';
  try {
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return 'Invalid Date';
    return date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: '2-digit' });
  } catch (error) {
    return 'Invalid Date';
  }
};

/**
 * Helper: Draws the standard header with branding and metadata
 */
const drawHeader = (doc, title, meta = []) => {
  const pageWidth = doc.internal.pageSize.width;
  
  // Top Accent Line
  doc.setDrawColor(...COLORS.accent);
  doc.setLineWidth(1.5);
  doc.line(14, 15, pageWidth - 14, 15);

  // Title
  doc.setFont(STYLES.headerFont, 'bold');
  doc.setFontSize(STYLES.fontSize.title);
  doc.setTextColor(...COLORS.primary);
  doc.text(title, 14, 25);

  // Metadata (Right Aligned or Below)
  doc.setFont(STYLES.bodyFont, 'normal');
  doc.setFontSize(STYLES.fontSize.subtitle);
  doc.setTextColor(...COLORS.secondary);

  let metaY = 32;
  meta.forEach(item => {
    doc.text(item, 14, metaY);
    metaY += 5;
  });

  return metaY + 5; // Return Y position for next element
};

/**
 * Helper: Draws a summary box with totals
 */
const drawSummaryBox = (doc, startY, transactions) => {
  if (!transactions || transactions.length === 0) return startY;

  const totalIn = transactions.filter(t => t.amount > 0).reduce((acc, t) => acc + t.amount, 0);
  const totalOut = transactions.filter(t => t.amount < 0).reduce((acc, t) => acc + t.amount, 0);
  const count = transactions.length;
  const flaggedCount = transactions.filter(t => t.status === 'flagged').length;

  const pageWidth = doc.internal.pageSize.width;
  const boxHeight = 20;
  
  // Background
  doc.setFillColor(...COLORS.bg);
  doc.setDrawColor(...COLORS.border);
  doc.roundedRect(14, startY, pageWidth - 28, boxHeight, 2, 2, 'FD');

  // Labels & Values
  doc.setFontSize(9);
  
  // Count
  doc.setTextColor(...COLORS.secondary);
  doc.text('ITEMS', 25, startY + 8);
  doc.setFont(undefined, 'bold');
  doc.setTextColor(...COLORS.primary);
  doc.text(count.toString(), 25, startY + 15);

  // Flagged (if any)
  if (flaggedCount > 0) {
    doc.setFont(undefined, 'normal');
    doc.setTextColor(...COLORS.secondary);
    doc.text('FLAGGED', 50, startY + 8);
    doc.setFont(undefined, 'bold');
    doc.setTextColor(...COLORS.warning);
    doc.text(flaggedCount.toString(), 50, startY + 15);
  }

  // Total In
  doc.setFont(undefined, 'normal');
  doc.setTextColor(...COLORS.secondary);
  doc.text('TOTAL CREDITS', 90, startY + 8);
  doc.setFont(undefined, 'bold');
  doc.setTextColor(...COLORS.success);
  doc.text(formatAmount(totalIn), 90, startY + 15);

  // Total Out
  doc.setFont(undefined, 'normal');
  doc.setTextColor(...COLORS.secondary);
  doc.text('TOTAL DEBITS', 150, startY + 8);
  doc.setFont(undefined, 'bold');
  doc.setTextColor(...COLORS.text); 
  doc.text(formatAmount(totalOut), 150, startY + 15);

  return startY + boxHeight + 10;
};

/**
 * Helper: Draws the Sign-off footer on the last page
 */
const drawSignOff = (doc) => {
  const pageHeight = doc.internal.pageSize.height;
  const y = pageHeight - 40;
  
  doc.setDrawColor(200, 200, 200);
  doc.setLineWidth(0.5);
  doc.line(14, y, 100, y); // Signature Line
  doc.line(110, y, 196, y); // Date Line

  doc.setFontSize(8);
  doc.setTextColor(...COLORS.secondary);
  doc.text('Client Signature', 14, y + 5);
  doc.text('Date', 110, y + 5);
};

/**
 * Generates a PDF Review Schedule for the client
 */
export const generateReviewPDF = (transactions, caseName = 'Client Review', period = '') => {
  if (!Array.isArray(transactions)) return;

  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.width;
  const pageHeight = doc.internal.pageSize.height;
  
  // 1. Header
  let currentY = drawHeader(doc, 'Transaction Review Schedule', [
    `Case: ${caseName}`,
    `Date Generated: ${new Date().toLocaleDateString()}`,
    period ? `Period: ${period}` : ''
  ]);

  // 2. Summary stats
  currentY = drawSummaryBox(doc, currentY, transactions);

  // 3. Instructions (Visual Card)
  doc.setDrawColor(...COLORS.accent);
  doc.setLineWidth(0.5);
  doc.setFillColor(239, 246, 255); // Blue 50
  doc.roundedRect(14, currentY, pageWidth - 28, 22, 1, 1, 'F');
  
  // Blue accent bar on left
  doc.setDrawColor(...COLORS.accent);
  doc.setLineWidth(1);
  doc.line(14, currentY, 14, currentY + 22); 

  doc.setFontSize(9);
  doc.setTextColor(...COLORS.accent);
  doc.setFont(undefined, 'bold');
  doc.text('INSTRUCTIONS:', 18, currentY + 6);
  
  doc.setFont(undefined, 'normal');
  doc.setTextColor(...COLORS.text);
  doc.text([
    '• Review the transactions listed below.',
    '• Check the "Verified" box if the item is correct.',
    '• Write any corrections or explanations in the "Client Notes" column.'
  ], 18, currentY + 11);

  currentY += 28;

  // 4. Data Preparation
  const tableRows = transactions.map(tx => [
    formatDate(tx?.date),
    tx?.clean || tx?.desc || 'No description',
    formatAmount(tx?.amount),
    tx?.cat || 'Uncategorized',
    '', // Verified
    ''  // Notes
  ]);

  // 5. Table Generation
  autoTable(doc, {
    startY: currentY,
    head: [['Date', 'Description', 'Amount', 'Category', 'Verified', 'Client Notes']],
    body: tableRows,
    theme: 'striped', 
    styles: {
      fontSize: 8,
      cellPadding: 4, 
      textColor: COLORS.text,
      lineColor: COLORS.border,
      lineWidth: 0.1,
    },
    headStyles: {
      fillColor: COLORS.primary,
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      halign: 'left'
    },
    alternateRowStyles: {
      fillColor: COLORS.bg
    },
    columnStyles: {
      0: { cellWidth: 22 }, // Date
      1: { cellWidth: 60 }, // Description
      2: { cellWidth: 28, halign: 'right', fontStyle: 'bold' }, // Amount
      3: { cellWidth: 35 }, // Category
      4: { cellWidth: 15, halign: 'center' }, // Verified
      5: { cellWidth: 'auto' } // Notes
    },
    // Parse Cell to Apply Row Backgrounds for Flagged items
    didParseCell: (data) => {
      if (data.section === 'body') {
        const tx = transactions[data.row.index];
        if (tx && (tx.flagged === true || tx.status === 'flagged')) {
          // Apply Highlight Color (Amber 50)
          data.cell.styles.fillColor = COLORS.warningBg;
        }
      }
    },
    willDrawCell: (data) => {
      // Colorize Amounts
      if (data.section === 'body' && data.column.index === 2) {
        const tx = transactions[data.row.index];
        if (tx) {
          const rawAmount = tx.amount;
          if (rawAmount >= 0) {
            doc.setTextColor(...COLORS.success);
          } else {
            doc.setTextColor(...COLORS.primary);
          }
        }
      }
    },
    didDrawCell: (data) => {
      // Verified Checkbox (Draw a proper box)
      if (data.section === 'body' && data.column.index === 4) {
        const { x, y, width, height } = data.cell;
        // Darker box for flagged items to ensure visibility? No, keep consistent.
        doc.setDrawColor(200, 200, 200);
        doc.setLineWidth(0.3);
        const boxSize = 5; 
        const xPos = x + (width - boxSize) / 2;
        const yPos = y + (height - boxSize) / 2;
        doc.rect(xPos, yPos, boxSize, boxSize);
      }
      
      // Notes Lines (Dotted line for writing)
      if (data.section === 'body' && data.column.index === 5) {
        const { x, y, width, height } = data.cell;
        doc.setDrawColor(220, 220, 220);
        doc.setLineWidth(0.1);
        doc.line(x + 2, y + height - 3, x + width - 2, y + height - 3);
      }
    },
    didDrawPage: (data) => {
      // Footer: Page Number
      doc.setFontSize(8);
      doc.setTextColor(150, 150, 150);
      doc.text(
        `Page ${doc.internal.getNumberOfPages()}`,
        pageWidth - 14,
        pageHeight - 10,
        { align: 'right' }
      );
    }
  });

  // Add Sign-off block on the last page
  drawSignOff(doc);

  // Save
  const fileName = `Review_Schedule_${caseName.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.pdf`;
  doc.save(fileName);
};

/**
 * Generates a comprehensive Client Request Report
 */
export const generateClientReport = ({
  caseName = 'Client Review',
  missingStatements = [],
  unprovenClaims = [], // Kept for signature compatibility, but unused
  transactions = [],
  totalTransactions = null, // Optional: total number of transactions for "X out of Y" display
  confirmedCount = null, // Optional: number of automatically confirmed transactions
  period = 'Last 6 Months'
}) => {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.width;
  const pageHeight = doc.internal.pageSize.height;
  const margin = 14;
  
  // 1. Cover Page / Executive Summary
  let currentY = drawHeader(doc, 'Client Information Request', [
    `Case Reference: ${caseName}`,
    `Date: ${new Date().toLocaleDateString()}`,
    `Period: ${period}`
  ]);

  currentY += 5;
  doc.setFontSize(10);
  doc.setTextColor(...COLORS.text);
  doc.text('Please review the following outstanding items required to complete your financial analysis.', margin, currentY);
  currentY += 15;

  // SECTION 1: MISSING DOCUMENTATION
  if (missingStatements.length > 0) {
    // Red/Danger themed box
    doc.setFillColor(254, 242, 242); // Red 50
    doc.setDrawColor(252, 165, 165); // Red 200
    const boxHeight = 12 + (missingStatements.length * 16);
    doc.roundedRect(margin, currentY, pageWidth - (margin * 2), boxHeight, 2, 2, 'FD');

    // Header inside box
    currentY += 8;
    doc.setFont(undefined, 'bold');
    doc.setTextColor(...COLORS.danger);
    doc.text('1. OUTSTANDING BANK STATEMENTS', margin + 6, currentY);
    currentY += 8;

    doc.setFont(undefined, 'normal');
    doc.setTextColor(...COLORS.primary);
    
    missingStatements.forEach(item => {
      doc.setFont(undefined, 'bold');
      doc.text(`• ${item.account}`, margin + 6, currentY);
      currentY += 5;
      doc.setFont(undefined, 'normal');
      doc.setFontSize(9);
      doc.setTextColor(...COLORS.secondary);
      doc.text(`   Missing: ${item.missing.join(', ')}`, margin + 6, currentY);
      currentY += 9;
      doc.setTextColor(...COLORS.primary); // Reset
      doc.setFontSize(10);
    });
    
    currentY += 10;
  }

  // SECTION 2: TRANSACTION REVIEW (Previously Section 3)
  if (currentY > pageHeight - 80) {
    doc.addPage();
    currentY = 20;
  }

  // Header
  doc.setFontSize(14);
  doc.setFont(undefined, 'bold');
  doc.setTextColor(...COLORS.primary);
  doc.text('2. Detailed Transaction Schedule', margin, currentY);
  currentY += 8;

  // Instructions
  doc.setFontSize(9);
  doc.setFont(undefined, 'normal');
  doc.setTextColor(...COLORS.secondary);
  
  // Build transaction count text
  const unconfirmedCount = transactions.length;
  const countText = totalTransactions !== null && totalTransactions > 0
    ? `${unconfirmedCount} out of ${totalTransactions}`
    : `${unconfirmedCount}`;
  
  // Build confirmed count text
  let confirmedText = '';
  if (confirmedCount !== null && confirmedCount > 0) {
    confirmedText = ` ${confirmedCount} transaction${confirmedCount !== 1 ? 's have' : ' has'} been automatically confirmed and ${unconfirmedCount !== 1 ? 'are' : 'is'} not included in this schedule.`;
  }
  
  const instructions = [
    `The following schedule contains ${countText} transaction${unconfirmedCount !== 1 ? 's' : ''} that have not been automatically confirmed and require your review.${confirmedText}`,
    '• Please review each transaction listed below.',
    '• Items highlighted in orange may need additional clarification, but please verify all transactions.',
    '• If you notice any discrepancies or have additional context, please note them in the "Client Notes" column.'
  ];
  
  instructions.forEach(line => {
    doc.text(line, margin, currentY);
    currentY += 5;
  });
  
  currentY += 5;

  // Sort transactions by account first, then date
  const sortedTransactions = [...transactions].sort((a, b) => {
    const accountA = a.account || '';
    const accountB = b.account || '';
    if (accountA !== accountB) {
      return accountA.localeCompare(accountB);
    }
    return new Date(a.date) - new Date(b.date);
  });

  const tableRows = sortedTransactions.map(tx => [
    formatDate(tx.date),
    tx.clean || tx.desc || 'No description',
    formatAmount(tx.amount),
    tx.cat || 'Uncategorized',
    '', 
    '' 
  ]);

  autoTable(doc, {
    startY: currentY,
    head: [['Date', 'Description', 'Amount', 'Category', 'Verified', 'Client Notes']],
    body: tableRows,
    theme: 'striped',
    styles: {
      fontSize: 8,
      cellPadding: 2, // Reduced padding to give more room for notes
      textColor: COLORS.text,
      lineColor: COLORS.border,
      lineWidth: 0.1,
    },
    headStyles: {
      fillColor: COLORS.primary,
      textColor: [255, 255, 255],
      fontStyle: 'bold',
    },
    columnStyles: {
      0: { cellWidth: 20 }, // Reduced slightly
      1: { cellWidth: 55 }, // Reduced slightly
      2: { cellWidth: 25, halign: 'right', fontStyle: 'bold' }, // Reduced slightly
      3: { cellWidth: 35 },
      4: { cellWidth: 15, halign: 'center' },
      5: { cellWidth: 'auto' } // Maximize space for notes
    },
    // Highlight Flagged Rows
    didParseCell: (data) => {
      if (data.section === 'body') {
        const tx = sortedTransactions[data.row.index];
        if (tx && (tx.flagged === true || tx.status === 'flagged')) {
          data.cell.styles.fillColor = COLORS.warningBg;
        }
      }
    },
    willDrawCell: (data) => {
      if (data.section === 'body' && data.column.index === 2) {
        const tx = sortedTransactions[data.row.index];
        if (tx) {
          const rawAmount = tx.amount;
          doc.setTextColor(rawAmount >= 0 ? 22 : 15, rawAmount >= 0 ? 163 : 23, rawAmount >= 0 ? 74 : 42);
        }
      }
    },
    didDrawCell: (data) => {
      // Checkbox
      if (data.section === 'body' && data.column.index === 4) {
        const { x, y, width, height } = data.cell;
        doc.setDrawColor(200, 200, 200);
        doc.rect(x + (width - 5) / 2, y + (height - 5) / 2, 5, 5);
      }
      // Note Line
      if (data.section === 'body' && data.column.index === 5) {
        const { x, y, width, height } = data.cell;
        doc.setDrawColor(220, 220, 220);
        doc.line(x + 2, y + height - 3, x + width - 2, y + height - 3);
      }
    },
    didDrawPage: (data) => {
        doc.setFontSize(8);
        doc.setTextColor(150, 150, 150);
        doc.text(`Page ${doc.internal.getNumberOfPages()}`, pageWidth - 14, pageHeight - 10, { align: 'right' });
    }
  });

  drawSignOff(doc);

  const fileName = `Client_Request_Report_${caseName.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.pdf`;
  doc.save(fileName);
};
