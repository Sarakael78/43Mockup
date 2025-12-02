import jsPDF from 'jspdf';
import 'jspdf-autotable';

/**
 * Formats amount to match UI display (currency style, no decimals)
 * @param {Number} amount - Transaction amount
 * @returns {String} Formatted amount string
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
 * @param {String|Date} dateStr - Date string or Date object
 * @returns {String} Formatted date string or 'Invalid Date'
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
 * Generates a PDF Review Schedule for the client
 * @param {Array} transactions - List of transactions to include
 * @param {String} caseName - Name of the case/project
 * @param {String} period - Description of the period (e.g., "Last 6 Months")
 */
export const generateReviewPDF = (transactions, caseName = 'Client Review', period = '') => {
  // Error handling: Validate inputs
  if (!Array.isArray(transactions)) {
    console.error('generateReviewPDF: transactions must be an array');
    return;
  }

  if (transactions.length === 0) {
    console.warn('generateReviewPDF: No transactions to export');
    // Still generate PDF with empty table for consistency
  }

  const doc = new jsPDF();
  
  // --- Header ---
  const pageWidth = doc.internal.pageSize.width;
  const pageHeight = doc.internal.pageSize.height;
  
  // Title
  doc.setFontSize(18);
  doc.setTextColor(40, 40, 40);
  doc.text('Transaction Review Schedule', 14, 20);
  
  // Metadata
  doc.setFontSize(10);
  doc.setTextColor(100, 100, 100);
  doc.text(`Case: ${caseName}`, 14, 28);
  doc.text(`Date Generated: ${new Date().toLocaleDateString()}`, 14, 33);
  if (period) {
    doc.text(`Period: ${period}`, 14, 38);
  }

  // Instructions
  doc.setDrawColor(230, 230, 230);
  doc.setFillColor(248, 250, 252);
  doc.rect(14, 45, pageWidth - 28, 24, 'F');
  doc.setDrawColor(200, 200, 200);
  doc.line(14, 45, 14, 69); // Blue accent line (gray for professional print)

  doc.setFontSize(9);
  doc.setTextColor(60, 60, 60);
  doc.setFont(undefined, 'bold');
  doc.text('INSTRUCTIONS:', 18, 52);
  doc.setFont(undefined, 'normal');
  doc.text([
    '1. Please review the transactions listed below.',
    '2. Mark the "Verified" box if the transaction is legitimate and accurate.',
    '3. Provide details in the "Client Notes" column for any unrecognized or disputed items.'
  ], 18, 58);

  // --- Table Content ---
  
  // Prepare data with error handling
  const tableRows = transactions.map(tx => {
    // Validate transaction properties
    const date = formatDate(tx?.date);
    const description = tx?.clean || tx?.desc || 'No description';
    const amount = formatAmount(tx?.amount);
    const category = tx?.cat || 'Uncategorized';
    
    return [
      date,
      description,
      amount,
      category,
      '', // Verified Column (Placeholder)
      ''  // Notes Column (Placeholder)
    ];
  });

  // Generate Table
  doc.autoTable({
    startY: 75,
    head: [['Date', 'Description', 'Amount', 'Category', 'Verified', 'Client Notes']],
    body: tableRows,
    theme: 'plain',
    styles: {
      fontSize: 8,
      cellPadding: 3,
      lineColor: [220, 220, 220],
      lineWidth: 0.1,
    },
    headStyles: {
      fillColor: [241, 245, 249],
      textColor: [71, 85, 105],
      fontStyle: 'bold',
      lineColor: [200, 200, 200],
      lineWidth: 0.1,
    },
    columnStyles: {
      0: { cellWidth: 20 }, // Date
      1: { cellWidth: 50 }, // Description
      2: { cellWidth: 25, halign: 'right', fontStyle: 'bold' }, // Amount
      3: { cellWidth: 35 }, // Category
      4: { cellWidth: 15, halign: 'center' }, // Verified
      5: { cellWidth: 'auto' } // Notes
    },
    // Set text color before drawing cell content
    willDrawCell: (data) => {
      // Colorize Amounts based on positive/negative
      if (data.section === 'body' && data.column.index === 2) {
        // Use data.row.index or data.index depending on autoTable version
        const rowIndex = data.row?.index ?? data.index;
        const tx = transactions[rowIndex];
        if (tx && tx.amount != null && !isNaN(tx.amount)) {
          const rawAmount = tx.amount;
          if (rawAmount >= 0) {
            doc.setTextColor(22, 163, 74); // Green
          } else {
            doc.setTextColor(30, 41, 59); // Slate 800
          }
        } else {
          doc.setTextColor(0, 0, 0); // Default black for invalid amounts
        }
      } else {
        // Reset to default black for all other cells
        doc.setTextColor(0, 0, 0);
      }
    },
    // Add visual form elements after cell is drawn
    didDrawCell: (data) => {
      // Verified Checkbox
      if (data.section === 'body' && data.column.index === 4) {
        const { x, y, width, height } = data.cell;
        doc.setDrawColor(150, 150, 150);
        doc.setLineWidth(0.5);
        // Draw a square checkbox centered in the cell
        const boxSize = 4;
        const xPos = x + (width - boxSize) / 2;
        const yPos = y + (height - boxSize) / 2;
        doc.rect(xPos, yPos, boxSize, boxSize);
      }
      
      // Notes Underline
      if (data.section === 'body' && data.column.index === 5) {
        const { x, y, width, height } = data.cell;
        doc.setDrawColor(200, 200, 200);
        doc.setLineWidth(0.1);
        // Draw a line at the bottom of the cell for writing
        doc.line(x + 2, y + height - 2, x + width - 2, y + height - 2);
      }
    },
    // Footer on each page
    didDrawPage: (data) => {
      doc.setFontSize(8);
      doc.setTextColor(150, 150, 150);
      doc.text(
        `Page ${doc.internal.getNumberOfPages()}`,
        pageWidth - 20,
        pageHeight - 10,
        { align: 'right' }
      );
    }
  });

  // Save
  const fileName = `Review_Schedule_${caseName.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.pdf`;
  doc.save(fileName);
};

/**
 * Generates a comprehensive Client Request Report
 * Includes:
 * 1. Missing Documentation (Statements)
 * 2. Unproven Expenses Summary
 * 3. Interactive Transaction Review Schedule
 */
export const generateClientReport = ({
  caseName = 'Client Review',
  missingStatements = [],
  unprovenClaims = [],
  transactions = [],
  period = 'Last 6 Months'
}) => {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.width;
  const pageHeight = doc.internal.pageSize.height;
  const margin = 14;
  
  let currentY = 20;

  // --- PAGE 1: EXECUTIVE SUMMARY & REQUESTS ---

  // Title
  doc.setFontSize(22);
  doc.setTextColor(30, 41, 59); // Slate 800
  doc.text('Client Information Request', margin, currentY);
  currentY += 10;
  
  // Metadata
  doc.setFontSize(10);
  doc.setTextColor(100, 116, 139); // Slate 500
  doc.text(`Case Reference: ${caseName}`, margin, currentY);
  doc.text(`Date: ${new Date().toLocaleDateString()}`, margin, currentY + 5);
  currentY += 15;

  // Intro Text
  doc.setFontSize(10);
  doc.setTextColor(51, 65, 85); // Slate 700
  doc.text('Please review the following outstanding items required to complete your financial analysis.', margin, currentY);
  currentY += 15;

  // SECTION 1: MISSING DOCUMENTATION
  if (missingStatements.length > 0) {
    doc.setFillColor(254, 242, 242); // Red 50
    doc.setDrawColor(252, 165, 165); // Red 300
    doc.rect(margin, currentY, pageWidth - (margin * 2), 10 + (missingStatements.length * 14), 'F');
    doc.line(margin, currentY, margin, currentY + 10 + (missingStatements.length * 14)); // Accent line

    currentY += 8;
    doc.setFont(undefined, 'bold');
    doc.setTextColor(185, 28, 28); // Red 700
    doc.text('1. OUTSTANDING DOCUMENTATION', margin + 4, currentY);
    currentY += 8;

    doc.setFont(undefined, 'normal');
    doc.setTextColor(30, 41, 59); // Slate 800
    
    missingStatements.forEach(item => {
      doc.setFont(undefined, 'bold');
      doc.text(item.account, margin + 4, currentY);
      currentY += 5;
      doc.setFont(undefined, 'normal');
      doc.setFontSize(9);
      doc.text(`Missing Periods: ${item.missing.join(', ')}`, margin + 4, currentY);
      currentY += 9;
    });
    
    currentY += 10;
  }

  // SECTION 2: UNPROVEN EXPENSES
  if (unprovenClaims.length > 0) {
    // Check if we need a new page
    if (currentY > pageHeight - 60) {
      doc.addPage();
      currentY = 20;
    }

    doc.setFontSize(11);
    doc.setFont(undefined, 'bold');
    doc.setTextColor(30, 41, 59);
    doc.text('2. UNPROVEN EXPENSES', margin, currentY);
    currentY += 8;

    doc.setFontSize(10);
    doc.setFont(undefined, 'normal');
    doc.text('The following expense categories are currently not fully supported by the bank statements provided. Please provide receipts or identify additional accounts used for these items.', margin, currentY, { maxWidth: pageWidth - (margin * 2) });
    currentY += 10;

    const claimRows = unprovenClaims.slice(0, 10).map(c => [
      c.category,
      `R ${c.claimed.toLocaleString()}`,
      `R ${Math.round(c.proven).toLocaleString()}`,
      `R ${Math.round(c.shortfall).toLocaleString()}`
    ]);

    doc.autoTable({
      startY: currentY,
      head: [['Category', 'Claimed', 'Proven (Avg)', 'Shortfall']],
      body: claimRows,
      theme: 'grid',
      styles: { fontSize: 9, cellPadding: 3 },
      headStyles: { fillColor: [245, 158, 11], textColor: [255, 255, 255] }, // Amber head
      columnStyles: {
        1: { halign: 'right' },
        2: { halign: 'right' },
        3: { halign: 'right', fontStyle: 'bold', textColor: [180, 83, 9] }
      },
      margin: { left: margin, right: margin }
    });

    currentY = doc.lastAutoTable.finalY + 15;
    if (unprovenClaims.length > 10) {
      doc.setFontSize(9);
      doc.text(`...and ${unprovenClaims.length - 10} other categories.`, margin, currentY - 5);
    }
  }

  // SECTION 3: INSTRUCTIONS FOR SCHEDULE
  if (currentY > pageHeight - 50) {
    doc.addPage();
    currentY = 20;
  }

  doc.setFontSize(11);
  doc.setFont(undefined, 'bold');
  doc.setTextColor(30, 41, 59);
  doc.text('3. TRANSACTION REVIEW SCHEDULE', margin, currentY);
  currentY += 8;

  doc.setFontSize(10);
  doc.setFont(undefined, 'normal');
  doc.text([
    'Please review the attached schedule of transactions on the following pages.',
    '- Mark "Verified" if the transaction is legitimate and accurate.',
    '- Provide details in the "Client Notes" column for any unrecognized or personal items.'
  ], margin, currentY);

  // --- PAGE 2+: TRANSACTION SCHEDULE ---
  doc.addPage();
  
  // Table Content
  const tableRows = transactions.map(tx => [
    new Date(tx.date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: '2-digit' }),
    tx.clean || tx.desc || 'No description',
    tx.amount >= 0 ? `+${tx.amount.toLocaleString('en-ZA', { minimumFractionDigits: 2 })}` : tx.amount.toLocaleString('en-ZA', { minimumFractionDigits: 2 }),
    tx.cat || 'Uncategorized',
    '', // Verified Box
    ''  // Notes Line
  ]);

  doc.autoTable({
    startY: 20,
    head: [['Date', 'Description', 'Amount', 'Category', 'Verified', 'Client Notes']],
    body: tableRows,
    theme: 'plain',
    styles: {
      fontSize: 8,
      cellPadding: 3,
      lineColor: [226, 232, 240], // Slate 200
      lineWidth: 0.1,
    },
    headStyles: {
      fillColor: [241, 245, 249], // Slate 100
      textColor: [71, 85, 105], // Slate 600
      fontStyle: 'bold',
      lineColor: [203, 213, 225],
      lineWidth: 0.1,
    },
    columnStyles: {
      0: { cellWidth: 20 },
      1: { cellWidth: 50 },
      2: { cellWidth: 25, halign: 'right', fontStyle: 'bold' },
      3: { cellWidth: 35 },
      4: { cellWidth: 15, halign: 'center' },
      5: { cellWidth: 'auto' }
    },
    didDrawCell: (data) => {
      // Checkbox
      if (data.section === 'body' && data.column.index === 4) {
        const { x, y, width, height } = data.cell;
        doc.setDrawColor(148, 163, 184); // Slate 400
        const boxSize = 4;
        doc.rect(x + (width - boxSize) / 2, y + (height - boxSize) / 2, boxSize, boxSize);
      }
      // Note Line
      if (data.section === 'body' && data.column.index === 5) {
        const { x, y, width, height } = data.cell;
        doc.setDrawColor(203, 213, 225); // Slate 300
        doc.line(x + 2, y + height - 3, x + width - 2, y + height - 3);
      }
      // Colorize Amount
      if (data.section === 'body' && data.column.index === 2) {
        const rawAmount = transactions[data.index].amount;
        doc.setTextColor(rawAmount >= 0 ? 22 : 30, rawAmount >= 0 ? 163 : 41, rawAmount >= 0 ? 74 : 59);
      }
    },
    didDrawPage: (data) => {
      doc.setFontSize(8);
      doc.setTextColor(148, 163, 184);
      doc.text(`Page ${doc.internal.getNumberOfPages()}`, pageWidth - 20, pageHeight - 10, { align: 'right' });
    }
  });

  const fileName = `Client_Request_Report_${caseName.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.pdf`;
  doc.save(fileName);
};

