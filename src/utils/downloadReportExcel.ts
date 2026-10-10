import { dateCellText, TONE_COLORS, type SheetCell, type SheetModel } from './kitchenReportSheets';

const BORDER = { style: 'thin' as const, color: { argb: 'FFE5E7EB' } };
const THICK = { style: 'medium' as const, color: { argb: 'FF000000' } };
/** The text size of every cell, and the factor that makes the columns wide enough for it (the widths are set for 11 point). */
export const EXCEL_FONT_SIZE = 12;
const WIDTH_FACTOR = 1.15;

function cellValue(cell: SheetCell): string | number | Date | null {
  if (typeof cell === 'string' || typeof cell === 'number') return cell === '' ? null : cell;
  if ('n' in cell) return cell.n;
  if (!cell.date) return null;
  // noon UTC, so the day never shifts whatever the reader's time zone is
  return new Date(`${cell.date}T12:00:00Z`);
}

/** Builds the Excel file (browser only; the library is loaded when someone downloads, not with the page). */
export async function buildReportWorkbook(sheets: SheetModel[], title: string): Promise<Blob> {
  const ExcelJS = (await import('exceljs')).default;
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'NikFoods admin';
  workbook.title = title;
  for (const sheet of sheets) {
    const ws = workbook.addWorksheet(sheet.name, {
      views: [{ state: 'frozen', ySplit: 1 }],
      pageSetup: { orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 0 },
    });
    const margin = sheet.margin ?? 0;
    ws.columns = [...Array.from({ length: margin }, () => ({ width: 2 })), ...sheet.widths.map((width) => ({ width: Math.round(width * WIDTH_FACTOR) }))];
    const first = margin + 1;
    const last = margin + sheet.widths.length;
    for (const row of sheet.rows) {
      const excelRow = ws.addRow([...Array.from({ length: margin }, () => null), ...row.cells.map(cellValue)]);
      if (row.kind === 'blank') continue;
      if (row.kind === 'section') {
        ws.mergeCells(excelRow.number, first, excelRow.number, last);
        excelRow.getCell(first).font = { size: EXCEL_FONT_SIZE, bold: true, color: { argb: 'FF92400E' } };
        excelRow.getCell(first).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFEF3C7' } };
        continue;
      }
      const isHeader = row.kind === 'header';
      for (let c = first; c <= last; c++) {
        const cell = excelRow.getCell(c);
        const source = row.cells[c - first];
        if (row.box) {
          // a thick outline round the whole box, no lines between the rows (like Kunal's sheet)
          cell.border = {
            top: row.box.top ? THICK : undefined,
            bottom: row.box.bottom ? THICK : undefined,
            left: c === first ? THICK : undefined,
            right: c === last ? THICK : undefined,
          };
        } else {
          cell.border = { top: BORDER, left: BORDER, bottom: BORDER, right: BORDER };
        }
        cell.alignment = { vertical: 'top', wrapText: true, ...(row.rightCells?.includes(c - first) ? { horizontal: 'right' as const } : {}) };
        if (isHeader && !row.box) {
          cell.font = { size: EXCEL_FONT_SIZE, bold: true, color: { argb: 'FF1A1106' } };
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF89C35' } };
        } else if (isHeader) {
          cell.font = { size: EXCEL_FONT_SIZE, bold: true };
        } else {
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: `FF${TONE_COLORS[row.tone ?? 'white']}` } };
          cell.font = { size: EXCEL_FONT_SIZE, bold: Boolean(row.boldCells?.includes(c - first)) };
        }
        // the unit is part of the cell's number format, so the cell stays a number and still shows "24 oz" or "1.5 lb"
        if (source && typeof source === 'object') cell.numFmt = 'n' in source ? (source.unit === 'units' ? '[=1]General" unit";General" units"' : `General" ${source.unit}"`) : 'ddd, mmm d';
        else if (typeof source === 'number' && !row.rightCells?.includes(c - first)) cell.alignment = { vertical: 'top', horizontal: 'center' };
      }
    }
  }
  const buffer = await workbook.xlsx.writeBuffer();
  return new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
}

export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.style.display = 'none';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export { dateCellText };
