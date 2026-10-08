import { sheetToPdfTables, TONE_COLORS, type SheetModel } from './kitchenReportSheets';

type Rgb = [number, number, number];
const rgb = (hex: string): Rgb => [parseInt(hex.slice(0, 2), 16), parseInt(hex.slice(2, 4), 16), parseInt(hex.slice(4, 6), 16)];

const THICK = 1;
const THIN = 0.3;
/** A box with this many rows or fewer is kept on one page; a longer one flows on from where the last box ended, so no page is left half empty. */
const KEEP_TOGETHER_ROWS = 8;

/**
 * The PDF version of the Excel file: the same sheets, drawn as tables with the same boxes (a thick outline round each item),
 * the same red / white / green rows and the same columns, landscape Letter. Boxes are packed one under another; a small box
 * is kept on one page, a long one continues on the next page (with its side edges) instead of leaving a gap.
 * Browser only: the PDF library is loaded when someone presses Print, not with the page.
 */
export async function buildReportPdf(sheets: SheetModel[], title: string): Promise<Blob> {
  const { jsPDF } = await import('jspdf');
  const autoTable = (await import('jspdf-autotable')).default;
  const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'letter' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = { left: 28, right: 28, top: 44, bottom: 36 };
  const usable = pageWidth - margin.left - margin.right;
  const spans: Array<{ name: string; from: number; to: number }> = [];

  sheets.forEach((sheet, si) => {
    if (si > 0) doc.addPage();
    const from = doc.getNumberOfPages();
    const scale = Math.min(usable / sheet.widths.reduce((a, b) => a + b, 0), 5.2);
    const widths = sheet.widths.map((w) => w * scale);
    const last = widths.length - 1;
    let y = margin.top;

    for (const table of sheetToPdfTables(sheet)) {
      const isSection = table.kind === 'section';
      autoTable(doc, {
        startY: y,
        margin,
        tableWidth: widths.reduce((a, b) => a + b, 0),
        theme: 'plain',
        head: table.head ? [table.head] : undefined,
        showHead: 'firstPage',
        body: isSection ? table.rows.map((r) => [{ content: r.cells[0], colSpan: widths.length }]) : table.rows.map((r) => r.cells),
        pageBreak: table.rows.length <= KEEP_TOGETHER_ROWS ? 'avoid' : 'auto',
        rowPageBreak: 'avoid',
        styles: { fontSize: 8, cellPadding: { top: 2.6, bottom: 2.6, left: 3.5, right: 3.5 }, textColor: [17, 24, 39], lineColor: [0, 0, 0], valign: 'top', overflow: 'linebreak' },
        columnStyles: Object.fromEntries(widths.map((w, i) => [i, { cellWidth: w }])),
        didParseCell: (data) => {
          const c = data.column.index;
          if (isSection) {
            data.cell.styles.fillColor = [254, 243, 199];
            data.cell.styles.textColor = [146, 64, 14];
            data.cell.styles.fontStyle = 'bold';
            return;
          }
          if (data.section === 'head') {
            data.cell.styles.fontStyle = 'bold';
            if (table.kind === 'box') {
              // the header is the top of the first box, like in Kunal's sheet
              data.cell.styles.lineWidth = { top: THICK, bottom: 0, left: c === 0 ? THICK : 0, right: c === last ? THICK : 0 };
            } else {
              data.cell.styles.fillColor = rgb('F89C35');
              data.cell.styles.lineWidth = THIN;
              data.cell.styles.lineColor = rgb('E5E7EB');
            }
            if (table.head && (table.rows[0]?.rightCells ?? []).includes(c)) data.cell.styles.halign = 'right';
            return;
          }
          const row = table.rows[data.row.index];
          if (!row) return;
          data.cell.styles.fillColor = rgb(TONE_COLORS[row.tone]);
          if (row.boldCells.includes(c)) data.cell.styles.fontStyle = 'bold';
          if (row.rightCells.includes(c)) data.cell.styles.halign = 'right';
          if (row.box) {
            data.cell.styles.lineWidth = { top: row.box.top ? THICK : 0, bottom: row.box.bottom ? THICK : 0, left: c === 0 ? THICK : 0, right: c === last ? THICK : 0 };
          } else {
            data.cell.styles.lineWidth = THIN;
            data.cell.styles.lineColor = rgb('E5E7EB');
          }
        },
      });
      const finalY = (doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? y;
      // the gap that the blank row is in the sheet
      y = finalY + (table.kind === 'plain' ? 0 : 9);
    }
    spans.push({ name: sheet.name, from, to: doc.getNumberOfPages() });
  });

  // the title on every page and the page numbers
  const total = doc.getNumberOfPages();
  for (const span of spans) {
    for (let p = span.from; p <= span.to; p++) {
      doc.setPage(p);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(11);
      doc.setTextColor(17, 24, 39);
      doc.text(`${span.name}`, margin.left, 24);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8.5);
      doc.setTextColor(75, 85, 99);
      doc.text(title, margin.left + doc.getTextWidth(span.name) + 14, 24);
      doc.text(`Page ${p} of ${total}`, pageWidth - margin.right, doc.internal.pageSize.getHeight() - 16, { align: 'right' });
    }
  }
  return doc.output('blob');
}
