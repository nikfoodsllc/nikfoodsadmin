import { dateCellText, TONE_COLORS, type SheetCell, type SheetModel } from './kitchenReportSheets';

const BORDER = { style: 'thin' as const, color: { argb: 'FFE5E7EB' } };

function cellValue(cell: SheetCell): string | number | Date | null {
  if (typeof cell === 'string' || typeof cell === 'number') return cell === '' ? null : cell;
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
    ws.columns = sheet.widths.map((width) => ({ width }));
    for (const row of sheet.rows) {
      const excelRow = ws.addRow(row.cells.map(cellValue));
      if (row.kind === 'blank') continue;
      if (row.kind === 'section') {
        ws.mergeCells(excelRow.number, 1, excelRow.number, sheet.widths.length);
        excelRow.getCell(1).font = { bold: true, color: { argb: 'FF92400E' } };
        excelRow.getCell(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFEF3C7' } };
        continue;
      }
      const isHeader = row.kind === 'header';
      for (let c = 1; c <= sheet.widths.length; c++) {
        const cell = excelRow.getCell(c);
        const source = row.cells[c - 1];
        cell.border = { top: BORDER, left: BORDER, bottom: BORDER, right: BORDER };
        cell.alignment = { vertical: 'top', wrapText: true };
        if (isHeader) {
          cell.font = { bold: true, color: { argb: 'FF1A1106' } };
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF89C35' } };
        } else {
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: `FF${TONE_COLORS[row.tone ?? 'white']}` } };
          if (row.boldCells?.includes(c - 1)) cell.font = { bold: true };
        }
        if (source && typeof source === 'object') cell.numFmt = 'ddd, mmm d';
        else if (typeof source === 'number') cell.alignment = { vertical: 'top', horizontal: 'center' };
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
