import { describe, it, expect } from 'vitest';
import ExcelJS from 'exceljs';
import { buildKitchenReport, type TypeLookup } from './kitchenReport';
import type { KitchenRow } from './kitchenDashboard';
import { buildKitchenDays } from './kitchenDashboard';
import { buildReportSheets, dayTotalsSheet, prepSheet, rowTone, stickersSheet, TONE_COLORS } from './kitchenReportSheets';
import { buildReportWorkbook } from './downloadReportExcel';

const row = (over: Partial<KitchenRow>): KitchenRow => ({ orderId: 'ORD-1', day: '2026-10-13', name: 'Rajma', quantity: 1, customerName: 'Asha', orderedOn: '2026-10-06', ...over });
const types: Record<string, 'cooked' | 'ready_to_eat'> = { Rajma: 'cooked', Chapati: 'cooked', Pickle: 'ready_to_eat' };
const byName: TypeLookup = ({ name }) => types[name] ?? null;

describe('rowTone', () => {
  it('red, white, red ... and ECO is always green', () => {
    expect([0, 1, 2, 3].map((i) => rowTone(i, false))).toEqual(['red', 'white', 'red', 'white']);
    expect([0, 1, 2].map((i) => rowTone(i, true))).toEqual(['eco', 'eco', 'eco']);
  });
});

describe('prep sheet', () => {
  const report = buildKitchenReport([
    row({ orderId: '1', customerName: 'Amy', portion: '12Oz', isEco: true }),
    row({ orderId: '2', customerName: 'Bob', portion: '12Oz' }),
    row({ orderId: '3', customerName: 'Cat', portion: '8Oz', deliveredOn: '2026-10-14' }),
    row({ orderId: '4', name: 'Chapati', quantity: 4, customerName: 'Dev' }),
    row({ orderId: '5', name: 'Mystery', customerName: 'Eve' }),
  ], byName);
  const sheet = prepSheet(report.cooked, report.notSet);
  it('has a header, blocks separated by a blank row, and the total on the first row of a block', () => {
    expect(sheet.rows[0].kind).toBe('header');
    const kinds = sheet.rows.map((r) => r.kind);
    expect(kinds.filter((k) => k === 'blank')).toHaveLength(2); // between the two cooked blocks and before the not-set section
    const rajmaRows = sheet.rows.filter((r) => r.kind === 'data' && r.cells[0] === 'Rajma');
    expect(rajmaRows).toHaveLength(3);
    expect(rajmaRows[0].cells[1]).toBe('32 oz (2 lb)'); expect(rajmaRows[1].cells[1]).toBe('');
    expect(rajmaRows[0].cells[2]).toBe(1); // one eco container
  });
  it('rows alternate red and white inside a block and an ECO row is green', () => {
    const rajma = sheet.rows.filter((r) => r.kind === 'data' && r.cells[0] === 'Rajma');
    // the ECO order sorts by size and customer: Amy (12Oz, ECO), Bob (12Oz), Cat (8Oz)
    expect(rajma.map((r) => [r.cells[3], r.tone])).toEqual([['Amy', 'eco'], ['Bob', 'white'], ['Cat', 'red']]);
    const chapati = sheet.rows.filter((r) => r.kind === 'data' && r.cells[0] === 'Chapati');
    expect(chapati[0].tone).toBe('red'); // every block starts with red
  });
  it('dates are date cells', () => {
    const cat = sheet.rows.find((r) => r.kind === 'data' && r.cells[3] === 'Cat')!;
    expect(cat.cells.slice(10)).toEqual([{ date: '2026-10-06' }, { date: '2026-10-13' }, { date: '2026-10-14' }]);
  });
  it('items without a type are listed under their own heading at the end', () => {
    const i = sheet.rows.findIndex((r) => r.kind === 'section');
    expect(i).toBeGreaterThan(0);
    expect(sheet.rows[i + 1].cells[0]).toBe('Mystery');
  });
});

describe('stickers and day totals', () => {
  const report = buildKitchenReport([row({ name: 'Pickle', orderId: '1', customerName: 'Amy', isEco: true }), row({ name: 'Pickle', orderId: '2', customerName: 'Bob' }), row({ name: 'Pickle', orderId: '3', customerName: 'Cat' })], byName);
  it('stickers alternate and ECO is green', () => {
    expect(stickersSheet(report.stickers).rows.filter((r) => r.kind === 'data').map((r) => r.tone)).toEqual(['eco', 'white', 'red']);
  });
  it('day totals alternate per day, with combos after the items', () => {
    const days = buildKitchenDays([row({ name: 'Rajma', quantity: 3 }), row({ orderId: '2', name: 'Chapati', quantity: 2 })], ['2026-10-13', '2026-10-14']);
    const rows = dayTotalsSheet(days).rows.filter((r) => r.kind === 'data');
    expect(rows.map((r) => [r.cells[1], r.cells[2], r.tone])).toEqual([['Rajma', 3, 'red'], ['Chapati', 2, 'white']]);
  });
});

describe('the Excel file', () => {
  it('has the three sheets with real fills, bold totals, frozen header and date cells', async () => {
    const report = buildKitchenReport([row({ orderId: '1', customerName: 'Amy', portion: '12Oz', isEco: true }), row({ orderId: '2', customerName: 'Bob', portion: '8Oz' }), row({ orderId: '3', name: 'Pickle', customerName: 'Cat' })], byName);
    const days = buildKitchenDays([row({ portion: '12Oz' })], ['2026-10-13']);
    const blob = await buildReportWorkbook(buildReportSheets({ cooked: report.cooked, notSet: report.notSet, stickers: report.stickers, days }), 'test');
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(await blob.arrayBuffer());
    expect(wb.worksheets.map((w) => w.name)).toEqual(['Kitchen Prep', 'Stickers', 'Day totals']);
    const prep = wb.getWorksheet('Kitchen Prep')!;
    expect(prep.views[0]).toMatchObject({ state: 'frozen', ySplit: 1 });
    const fill = (r: number) => (prep.getRow(r).getCell(4).fill as ExcelJS.FillPattern).fgColor?.argb;
    expect(prep.getRow(2).getCell(4).value).toBe('Amy');
    expect(fill(2)).toBe(`FF${TONE_COLORS.eco}`); // ECO row green
    expect(fill(3)).toBe(`FF${TONE_COLORS.white}`); // second row white
    expect(prep.getRow(2).getCell(1).font?.bold).toBe(true); // item name and total bold on the first row
    expect(prep.getRow(2).getCell(2).value).toBe('20 oz (1.25 lb)');
    const orderDate = prep.getRow(2).getCell(11).value as Date;
    expect(orderDate instanceof Date && orderDate.toISOString().slice(0, 10)).toBe('2026-10-06');
    expect((prep.getRow(1).getCell(1).fill as ExcelJS.FillPattern).fgColor?.argb).toBe('FFF89C35');
    expect(wb.getWorksheet('Stickers')!.getRow(2).getCell(2).value).toBe('Cat');
  });
  it('text that looks like a formula stays text', async () => {
    const report = buildKitchenReport([row({ customerName: '=SUM(A1)' })], byName);
    const blob = await buildReportWorkbook(buildReportSheets({ cooked: report.cooked, notSet: [], stickers: [], days: [] }), 'test');
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(await blob.arrayBuffer());
    const cell = wb.getWorksheet('Kitchen Prep')!.getRow(2).getCell(4);
    expect(cell.value).toBe('=SUM(A1)');
    expect(cell.formula).toBeUndefined();
  });
});
