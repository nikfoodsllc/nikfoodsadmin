import { describe, it, expect } from 'vitest';
import ExcelJS from 'exceljs';
import { buildPackingReport, type PackingRow, type RosterRouteInput } from './packingReport';
import { buildPackingSheets, packingRouteSheets, packTotalsSheet, PACKING_COLUMNS, safeSheetName } from './packingReportSheets';
import { applyColumnChoice, sheetToPdfTables } from './kitchenReportSheets';
import { buildReportWorkbook } from './downloadReportExcel';
import { buildReportPdf } from './reportPdf';

const DATE = '2026-10-13';
const row = (o: Partial<PackingRow>): PackingRow => ({ orderId: 'ORD-1', day: DATE, name: 'Rajma', quantity: 1, customerName: 'Asha Rao', street: '1 A St', ...o });
const rows = [
  row({ orderId: 'ORD-1', portion: '12Oz', isEco: true, spiceLevel: 'Hot' }),
  row({ orderId: 'ORD-1', name: 'Chapati', quantity: 4 }),
  row({ orderId: 'ORD-2', customerName: 'Bob Smith', name: 'Pickle', day: '2026-10-07' }),
  row({ orderId: 'ORD-3', customerName: 'Late One', name: 'Samosa', street: '3 C St' }),
];
const roster: RosterRouteInput[] = [
  { driverSerial: '001', driverName: 'Driver A', vehicle: 'V1', stops: [{ number: 1, id: 'a', orderNo: '', name: 'Asha Rao', address: '', scheduledAt: '13:26' }, { number: 2, id: 'b', orderNo: '', name: 'Bob Smith', address: '', scheduledAt: '13:40' }] },
  { driverSerial: '002', driverName: 'Driver B', vehicle: 'V2', stops: [{ number: 1, id: 'c', orderNo: '', name: 'Empty Stop', address: '', scheduledAt: '' }] },
];
const report = buildPackingReport(DATE, rows, roster, [{ orderIds: ['ORD-1'], optimoId: 'a' }]);

describe('packingRouteSheets (one sheet per route)', () => {
  const sheets = packingRouteSheets(report);
  const all = sheets.flatMap((s) => s.rows);
  it('one sheet per route in route order, then one for the customers without a route', () => {
    expect(sheets.map((s) => s.name)).toEqual(['Route 1 - Driver A', 'Route 2 - Driver B', 'Not on a route yet']);
    expect(sheets.map((s) => s.rows.find((r) => r.kind === 'section')!.cells[0])).toEqual(['Route 1 · Driver A · V1 · 2 stops', 'Route 2 · Driver B · V2 · 1 stop', 'Not on a route yet · 1 customer']);
    for (const sheet of sheets) {
      expect(sheet.rows[0].kind).toBe('header');
      expect(sheet.rows[0].cells).toEqual(PACKING_COLUMNS.map((c) => c.label));
      expect(sheet.key).toBe('packing');
    }
  });
  it('each sheet holds only its own stops', () => {
    const customers = (i: number) => [...new Set(sheets[i].rows.filter((r) => r.kind === 'data').map((r) => r.cells[3]))];
    expect(customers(0)).toEqual(['Asha Rao', 'Bob Smith']);
    expect(customers(1)).toEqual(['Empty Stop']);
    expect(customers(2)).toEqual(['Late One']);
  });
  it('every row of a stop repeats route, stop number, time and customer; the box edges mark the stop', () => {
    const asha = all.filter((r) => r.kind === 'data' && r.cells[3] === 'Asha Rao');
    expect(asha).toHaveLength(2);
    expect(asha.map((r) => [r.cells[0], r.cells[1], r.cells[2]])).toEqual([[1, 1, '13:26'], [1, 1, '13:26']]);
    expect(asha.map((r) => r.box)).toEqual([{ top: true, bottom: false }, { top: false, bottom: true }]);
    expect(asha[0].tone).toBe('eco');
  });
  it('quantity is a number, size and spice are text', () => {
    const rajma = all.find((r) => r.kind === 'data' && r.cells[5] === 'Rajma')!;
    expect(rajma.cells[6]).toBe('12Oz');
    expect(rajma.cells[7]).toBe(1);
    expect(rajma.cells[8]).toBe('Hot');
    expect(rajma.cells[9]).toBe('ECO');
  });
  it('an item picked for another menu day says which', () => {
    const pickle = all.find((r) => r.kind === 'data' && r.cells[5] === 'Pickle')!;
    expect(String(pickle.cells[11])).toContain('Oct 7');
  });
  it('a stop with nothing to pack still has a row, so it is not forgotten', () => {
    const empty = all.find((r) => r.kind === 'data' && r.cells[3] === 'Empty Stop')!;
    expect(String(empty.cells[5])).toContain('nothing to pack');
  });
  it('the column choice applies to every route sheet', () => {
    const cut = applyColumnChoice(sheets, { packing: ['order', 'picks', 'pickedFor', 'time'] });
    for (const sheet of cut) {
      expect(sheet.columnKeys).not.toContain('order');
      expect(sheet.rows.find((r) => r.kind === 'data')!.cells).toHaveLength(sheet.columnKeys.length);
    }
  });
  it('the PDF tables: a band and a box per stop on each sheet', () => {
    const kinds = sheets.map((s) => sheetToPdfTables(s).map((t) => t.kind));
    expect(kinds).toEqual([['section', 'box', 'box'], ['section', 'box'], ['section', 'box']]);
  });
});

describe('safeSheetName', () => {
  it('drops characters Excel refuses, cuts at 31 and keeps names unique', () => {
    const taken = new Set<string>();
    expect(safeSheetName('Route 1 - A/B: [x]?*', taken)).toBe('Route 1 - A B x');
    expect(safeSheetName('Route 1 - A B x', taken)).toBe('Route 1 - A B x 2');
    expect(safeSheetName('x'.repeat(50), taken)).toHaveLength(31);
    expect(safeSheetName('', taken)).toBe('Sheet');
  });
});

describe('packTotalsSheet', () => {
  it('one row per item with sizes, quantity and eco', () => {
    const sheet = packTotalsSheet(report);
    const rajma = sheet.rows.find((r) => r.kind === 'data' && r.cells[0] === 'Rajma')!;
    expect(rajma.cells).toEqual(['Rajma', '12Oz x 1', 1, 1]);
    expect(sheet.name).toBe('Item totals');
  });
});

describe('files', () => {
  it('Excel: one sheet per route plus the totals, size 12', async () => {
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(await (await buildReportWorkbook(buildPackingSheets(report), 'test')).arrayBuffer());
    expect(wb.worksheets.map((w) => w.name)).toEqual(['Route 1 - Driver A', 'Route 2 - Driver B', 'Not on a route yet', 'Item totals']);
    expect(wb.getWorksheet('Route 1 - Driver A')!.getRow(1).getCell(3).font?.size).toBe(12);
  });
  it('PDF: made, a section per sheet', async () => {
    const blob = await buildReportPdf(buildPackingSheets(report), 'Oct 13, 2026');
    const text = Buffer.from(await blob.arrayBuffer()).toString('latin1');
    expect(text.startsWith('%PDF')).toBe(true);
    expect(text).toContain('Route 1 - Driver A');
  });
});
