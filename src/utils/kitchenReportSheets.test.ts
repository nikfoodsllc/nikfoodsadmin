import { describe, it, expect } from 'vitest';
import ExcelJS from 'exceljs';
import { buildKitchenReport, type TypeLookup } from './kitchenReport';
import type { KitchenRow } from './kitchenDashboard';
import { buildKitchenDays } from './kitchenDashboard';
import { buildReportSheets, dayTotalsSheet, prepSheet, rowTone, stickersSheet, TONE_COLORS } from './kitchenReportSheets';
import { sheetAmounts } from './kitchenReport';
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

describe('prep sheet (Kunal\'s layout)', () => {
  const report = buildKitchenReport([
    row({ orderId: '1', customerName: 'Amy', portion: '12Oz', isEco: true }),
    row({ orderId: '2', customerName: 'Bob', portion: '12Oz' }),
    row({ orderId: '3', customerName: 'Cat', portion: '8Oz', deliveredOn: '2026-10-14' }),
    row({ orderId: '4', name: 'Chapati', quantity: 4, customerName: 'Dev' }),
    row({ orderId: '5', name: 'Mystery', customerName: 'Eve' }),
  ], byName);
  const sheet = prepSheet(report.cooked, report.notSet);
  const rajma = () => sheet.rows.filter((r) => r.kind === 'data' && r.cells[0] === 'Rajma');
  it('two margin columns, Kunal\'s five columns first, then the dates', () => {
    expect(sheet.margin).toBe(2);
    expect(sheet.rows[0].cells.slice(0, 5)).toEqual(['Item Name', 'Customer Name', 'Spice Level', 'Total Ordered Qty', 'Total / ECO']);
    expect(sheet.rows[0].cells.slice(5, 8)).toEqual(['Order date', 'Kitchen date', 'Delivery date']);
  });
  it('one box per item: blocks separated by a blank row, header joined to the first box', () => {
    const kinds = sheet.rows.map((r) => r.kind);
    expect(kinds.filter((k) => k === 'blank')).toHaveLength(2);
    expect(sheet.rows[0].box).toEqual({ top: true, bottom: false });
    const first = sheet.rows[1]; expect(first.box?.top).toBe(false); // continues the header, like his sheet
    const chapati = sheet.rows.filter((r) => r.kind === 'data' && r.cells[0] === 'Chapati');
    expect(chapati[0].box).toEqual({ top: false, bottom: true }); // Chapati is the first box (alphabetical): it continues the header, one line so it also closes
    // the next box carries its own top edge, and only its last row carries the bottom edge
    expect(rajma().map((r) => r.box)).toEqual([{ top: true, bottom: false }, { top: false, bottom: false }, { top: false, bottom: true }]);
  });
  it('amounts are numbers: the ounces of each line and the item total in pounds on the first row', () => {
    // smallest first: Cat 8Oz, then Amy and Bob 12Oz
    expect(rajma().map((r) => [r.cells[1], r.cells[3]])).toEqual([['Cat', 8], ['Amy', 12], ['Bob', 12]]);
    expect(rajma()[0].cells[4]).toBe(2); // 32 oz = 2 lb
    expect(rajma()[0].boldCells).toContain(4);
  });
  it('an item without sizes totals in pieces, and the eco rows say ECO in the last column', () => {
    const chapati = sheet.rows.find((r) => r.kind === 'data' && r.cells[0] === 'Chapati')!;
    expect(chapati.cells[3]).toBe(4); expect(chapati.cells[4]).toBe(4);
    expect(rajma()[1].cells[4]).toBe('ECO'); // Amy's eco row (not the first row)
  });
  it('rows are red and white in turn inside a box, an ECO row is green, and every box starts with red', () => {
    expect(rajma().map((r) => [r.cells[1], r.tone])).toEqual([['Cat', 'red'], ['Amy', 'eco'], ['Bob', 'red']]);
    expect(sheet.rows.find((r) => r.kind === 'data' && r.cells[0] === 'Chapati')!.tone).toBe('red');
  });
  it('dates are date cells', () => {
    const cat = rajma()[0];
    expect(cat.cells.slice(5, 8)).toEqual([{ date: '2026-10-06' }, { date: '2026-10-13' }, { date: '2026-10-14' }]);
  });
  it('items without a type are listed under their own heading, each in its own box', () => {
    const i = sheet.rows.findIndex((r) => r.kind === 'section');
    expect(i).toBeGreaterThan(0);
    expect(sheet.rows[i + 1].cells[0]).toBe('Mystery'); expect(sheet.rows[i + 1].box).toEqual({ top: true, bottom: true });
  });
});

describe('sheetAmounts', () => {
  const line = (portion: string | null, quantity: number) => ({ portion, quantity, amountText: portion ? `${portion}x${quantity}` : '' });
  it('ounces and pounds become numbers', () => {
    expect(sheetAmounts({ lines: [line('12Oz', 2), line('1Lb', 1)] as never, totalText: '', quantity: 3 })).toEqual({ values: [24, 16], total: 2.5 });
  });
  it('no sizes at all: pieces', () => {
    expect(sheetAmounts({ lines: [line(null, 4), line(null, 13)] as never, totalText: '', quantity: 17 })).toEqual({ values: [4, 13], total: 17 });
  });
  it('mixed units fall back to text', () => {
    const r = sheetAmounts({ lines: [line('12Oz', 1), line(null, 1)] as never, totalText: '12 oz (0.75 lb)', quantity: 2 });
    expect(r.values).toEqual(['12Ozx1', 1]); expect(r.total).toBe('12 oz (0.75 lb)');
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
    // columns: A and B are the empty margin, C = Item Name, D = Customer, E = Spice, F = Total Ordered Qty, G = Total / ECO, H..J = dates
    const fill = (r: number, c = 4) => (prep.getRow(r).getCell(c).fill as ExcelJS.FillPattern).fgColor?.argb;
    expect(prep.getRow(2).getCell(3).value).toBe('Rajma');
    expect(prep.getRow(2).getCell(4).value).toBe('Bob'); // 8Oz sorts before Amy's 12Oz? no: Bob is 8Oz, Amy 12Oz
    expect(prep.getRow(2).getCell(6).value).toBe(8);
    expect(prep.getRow(2).getCell(7).value).toBe(1.25); // 20 oz = 1.25 lb, bold on the first row
    expect(prep.getRow(2).getCell(7).font?.bold).toBe(true);
    expect(fill(2)).toBe(`FF${TONE_COLORS.red}`); // first row of the box red
    expect(prep.getRow(3).getCell(4).value).toBe('Amy');
    expect(fill(3)).toBe(`FF${TONE_COLORS.eco}`); // ECO row green
    expect(prep.getRow(3).getCell(7).value).toBe('ECO');
    const orderDate = prep.getRow(2).getCell(8).value as Date;
    expect(orderDate instanceof Date && orderDate.toISOString().slice(0, 10)).toBe('2026-10-06');
    // the outline: thick left edge on C, thick right edge on the last column, thick bottom on the last row of the box
    expect(prep.getRow(2).getCell(3).border?.left?.style).toBe('medium');
    expect(prep.getRow(3).getCell(3).border?.bottom?.style).toBe('medium');
    expect(prep.getRow(2).getCell(11).border?.right?.style).toBe('medium');
    expect(prep.getRow(2).getCell(3).border?.bottom).toBeUndefined();
    expect(prep.getRow(1).getCell(3).border?.top?.style).toBe('medium');
    expect(prep.getRow(1).getCell(3).value).toBe('Item Name');
    expect(prep.getColumn(1).width).toBe(2);
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
