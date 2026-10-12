import { describe, it, expect } from 'vitest';
import ExcelJS from 'exceljs';
import { buildPackingReport, type PackingRow, type RosterRouteInput } from './packingReport';
import { buildPackingSheets, packingListSheet, packTotalsSheet, PACKING_COLUMNS } from './packingReportSheets';
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

describe('packingListSheet', () => {
  const sheet = packingListSheet(report);
  it('a band per route, a box per stop, customers without a route last', () => {
    const bands = sheet.rows.filter((r) => r.kind === 'section').map((r) => r.cells[0]);
    expect(bands).toEqual(['Route 1 · Driver A · V1 · 2 stops', 'Route 2 · Driver B · V2 · 1 stop', 'Not on a route yet · 1 customer']);
    expect(sheet.rows[0].kind).toBe('header');
    expect(sheet.rows[0].cells).toEqual(PACKING_COLUMNS.map((c) => c.label));
  });
  it('every row of a stop repeats route, stop number, time and customer; the box edges mark the stop', () => {
    const asha = sheet.rows.filter((r) => r.kind === 'data' && r.cells[3] === 'Asha Rao');
    expect(asha).toHaveLength(2);
    expect(asha.map((r) => [r.cells[0], r.cells[1], r.cells[2]])).toEqual([[1, 1, '13:26'], [1, 1, '13:26']]);
    expect(asha.map((r) => r.box)).toEqual([{ top: true, bottom: false }, { top: false, bottom: true }]);
    expect(asha[0].tone).toBe('eco');
  });
  it('quantity is a number, size and spice are text, combos picks are one cell', () => {
    const rajma = sheet.rows.find((r) => r.kind === 'data' && r.cells[5] === 'Rajma')!;
    expect(rajma.cells[6]).toBe('12Oz');
    expect(rajma.cells[7]).toBe(1);
    expect(rajma.cells[8]).toBe('Hot');
    expect(rajma.cells[9]).toBe('ECO');
  });
  it('an item picked for another menu day says which', () => {
    const pickle = sheet.rows.find((r) => r.kind === 'data' && r.cells[5] === 'Pickle')!;
    expect(String(pickle.cells[11])).toContain('Oct 7');
  });
  it('a stop with nothing to pack still has a row, so it is not forgotten', () => {
    const empty = sheet.rows.find((r) => r.kind === 'data' && r.cells[3] === 'Empty Stop')!;
    expect(String(empty.cells[5])).toContain('nothing to pack');
  });
  it('column choice removes columns from every row', () => {
    const [cut] = applyColumnChoice([sheet], { packing: ['order', 'picks', 'pickedFor', 'time'] });
    expect(cut.columnKeys).not.toContain('order');
    const row0 = cut.rows.find((r) => r.kind === 'data')!;
    expect(row0.cells).toHaveLength(cut.columnKeys.length);
    expect(row0.rightCells).toEqual([cut.columnKeys.indexOf('qty')]);
  });
  it('the PDF tables: bands and one box per stop', () => {
    const kinds = sheetToPdfTables(sheet).map((t) => t.kind);
    expect(kinds.filter((k) => k === 'section')).toHaveLength(3);
    expect(kinds.filter((k) => k === 'box')).toHaveLength(4);
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
  it('Excel: two sheets, size 12', async () => {
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(await (await buildReportWorkbook(buildPackingSheets(report), 'test')).arrayBuffer());
    expect(wb.worksheets.map((w) => w.name)).toEqual(['Packing List', 'Item totals']);
    expect(wb.getWorksheet('Packing List')!.getRow(1).getCell(3).font?.size).toBe(12);
  });
  it('PDF: made, with both sheets', async () => {
    const blob = await buildReportPdf(buildPackingSheets(report), 'Oct 13, 2026');
    const text = Buffer.from(await blob.arrayBuffer()).toString('latin1');
    expect(text.startsWith('%PDF')).toBe(true);
    expect(text).toContain('Packing List');
  });
});
