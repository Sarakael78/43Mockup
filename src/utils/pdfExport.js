import jsPDF from 'jspdf';
import 'jspdf-autotable';

/**
 * Generates a PDF Review Schedule for the client
 * @param {Array} transactions - List of transactions to include
 * @param {String} caseName - Name of the case/project
 * @param {String} period - Description of the period (e.g., "Last 6 Months")
 */
export const generateReviewPDF = (transactions, caseName = 'Client Review', period = '') => {
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
  
  // Prepare data
  const tableRows = transactions.map(tx => [
    new Date(tx.date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: '2-digit' }),
    tx.clean || tx.desc || 'No description',
    tx.amount >= 0 ? `+${tx.amount.toLocaleString('en-ZA', { minimumFractionDigits: 2 })}` : tx.amount.toLocaleString('en-ZA', { minimumFractionDigits: 2 }),
    tx.cat || 'Uncategorized',
    '', // Verified Column (Placeholder)
    ''  // Notes Column (Placeholder)
  ]);

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
    // Add visual form elements
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

      // Colorize Amounts
      if (data.section === 'body' && data.column.index === 2) {
        const rawAmount = transactions[data.index].amount;
        if (rawAmount >= 0) {
          doc.setTextColor(22, 163, 74); // Green
        } else {
          doc.setTextColor(30, 41, 59); // Slate 800
        }
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

