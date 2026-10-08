import { describe, it, expect } from 'vitest';
import { buildKitchenReport, type TypeLookup } from './kitchenReport';
import { buildKitchenDays, type KitchenRow } from './kitchenDashboard';
import { buildReportSheets, cellText, prepSheet, sheetToPdfTables, stickersSheet } from './kitchenReportSheets';
import { buildReportPdf } from './reportPdf';

const row = (over: Partial<KitchenRow>): KitchenRow => ({ orderId: 'ORD-1', day: '2026-10-13', name: 'Rajma', quantity: 1, customerName: 'Asha', orderedOn: '2026-10-06', ...over });
const types: Record<string, 'cooked' | 'ready_to_eat'> = { Rajma: 'cooked', Chapati: 'cooked', Pickle: 'ready_to_eat' };
const lookup: TypeLookup = ({ name }) => types[name] ?? null;

const rows: KitchenRow[] = [
  row({ orderId: '1', customerName: 'Amy', portion: '12Oz', isEco: true, spiceLevel: 'Mild' }),
  row({ orderId: '2', customerName: 'Bob', portion: '8Oz', spiceLevel: 'Hot' }),
  row({ orderId: '3', name: 'Chapati', quantity: 4, customerName: 'Cat' }),
  row({ orderId: '4', name: 'Pickle', customerName: 'Dev', portion: '16Oz' }),
  row({ orderId: '5', name: 'Mystery', customerName: 'Eve' }),
];

describe('cellText', () => {
  it('writes numbers with their unit and dates as day and date', () => {
    expect(cellText({ n: 24, unit: 'oz' })).toBe('24 oz');
    expect(cellText({ n: 1.5, unit: 'lb' })).toBe('1.5 lb');
    expect(cellText({ n: 17, unit: 'units' })).toBe('17 units');
    expect(cellText({ n: 1, unit: 'units' })).toBe('1 unit');
    expect(cellText({ date: '2026-10-13' })).toBe('Tue, Oct 13');
    expect(cellText({ date: null })).toBe('');
    expect(cellText('')).toBe('');
    expect(cellText(8)).toBe('8');
    expect(cellText(undefined)).toBe('');
  });
});

describe('sheetToPdfTables', () => {
  const report = buildKitchenReport(rows, lookup);
  it('one table per box, the header on the first, a band for the not-set section', () => {
    const tables = sheetToPdfTables(prepSheet(report.cooked, report.notSet));
    expect(tables.map((t) => t.kind)).toEqual(['box', 'box', 'section', 'box']);
    expect(tables[0].head?.slice(0, 2)).toEqual(['Item Name', 'Customer Name']);
    expect(tables.slice(1).every((t) => !t.head)).toBe(true);
    expect(tables[0].rows[0].cells[0]).toBe('Chapati');
    expect(tables[1].rows.map((r) => r.cells[1])).toEqual(['Amy', 'Bob']); // Rajma: mild before hot
  });
  it('rows carry their colour, their box edges and the unit text', () => {
    const tables = sheetToPdfTables(prepSheet(report.cooked, report.notSet));
    const rajma = tables[1];
    expect(rajma.rows.map((r) => r.tone)).toEqual(['eco', 'white']);
    expect(rajma.rows[0].box).toEqual({ top: true, bottom: false });
    expect(rajma.rows[rajma.rows.length - 1].box?.bottom).toBe(true);
    expect(rajma.rows[0].cells[3]).toBe('12 oz');
    expect(rajma.rows[0].cells[4]).toBe('1.25 lb'); // 12 + 8 = 20 oz in total
  });
  it('stickers are one plain table', () => {
    const tables = sheetToPdfTables(stickersSheet(report.stickers));
    expect(tables).toHaveLength(1); expect(tables[0].kind).toBe('plain'); expect(tables[0].rows).toHaveLength(1);
  });
});

describe('buildReportPdf', () => {
  const report = buildKitchenReport(rows, lookup);
  const sheets = buildReportSheets({ cooked: report.cooked, notSet: report.notSet, stickers: report.stickers, days: buildKitchenDays(rows, ['2026-10-13']) });
  const text = async (blob: Blob) => Buffer.from(await blob.arrayBuffer()).toString('latin1');

  it('makes a PDF with the three sheets, the item names, the units and page numbers', async () => {
    const blob = await buildReportPdf(sheets, 'Oct 13, 2026');
    const pdf = await text(blob);
    expect(blob.type).toBe('application/pdf');
    expect(pdf.startsWith('%PDF')).toBe(true);
    for (const needle of ['Kitchen Prep', 'Stickers', 'Day totals', 'Rajma', 'Chapati', 'Amy', '12 oz', 'Page 1 of 3', 'Tue, Oct 13']) expect(pdf).toContain(needle);
    expect((pdf.match(/\/Type\s*\/Page[^s]/g) || []).length).toBe(3); // one page per sheet here
  });
  it('a long report runs over several pages and every page has a number', async () => {
    const many: KitchenRow[] = [];
    for (let i = 0; i < 40; i++) for (let j = 0; j < 8; j++) many.push(row({ orderId: `${i}-${j}`, name: `Item ${i}`, customerName: `Customer ${j}`, portion: '12Oz' }));
    const lookupAll: TypeLookup = () => 'cooked';
    const big = buildKitchenReport(many, lookupAll);
    const pdf = await text(await buildReportPdf(buildReportSheets({ cooked: big.cooked, notSet: [], stickers: [], days: [] }), 'long'));
    const pages = (pdf.match(/\/Type\s*\/Page[^s]/g) || []).length;
    expect(pages).toBeGreaterThan(4);
    expect(pdf).toContain(`Page ${pages} of ${pages}`);
  });
  it('small boxes are packed one under another: 40 one-order boxes do not take 40 pages', async () => {
    const singles: KitchenRow[] = [];
    for (let i = 0; i < 40; i++) singles.push(row({ orderId: `s${i}`, name: `Single ${i}`, customerName: `Customer ${i}`, portion: '12Oz' }));
    const small = buildKitchenReport(singles, () => 'cooked');
    const pdf = await text(await buildReportPdf(buildReportSheets({ cooked: small.cooked, notSet: [], stickers: [], days: [] }), 'singles'));
    const pages = (pdf.match(/\/Type\s*\/Page[^s]/g) || []).length;
    // Kitchen Prep (40 boxes of one row), plus one page each for the two empty sheets: a handful of pages, not 40
    expect(pages).toBeLessThanOrEqual(2 + 3);
  });
  it('a long box starts right after the previous one and runs over the page break instead of jumping to a new page', async () => {
    const mixed: KitchenRow[] = [row({ orderId: 'a', name: 'A short item', customerName: 'Amy', portion: '12Oz' })];
    for (let j = 0; j < 45; j++) mixed.push(row({ orderId: `b${j}`, name: 'B long item', customerName: `Customer ${j}`, portion: '12Oz' }));
    const rep = buildKitchenReport(mixed, () => 'cooked');
    const pdf = await text(await buildReportPdf(buildReportSheets({ cooked: rep.cooked, notSet: [], stickers: [], days: [] }), 'mixed'));
    const pages = (pdf.match(/\/Type\s*\/Page[^s]/g) || []).length;
    expect(pages).toBeLessThanOrEqual(2 + 2); // the 46 lines fit on two pages of Kitchen Prep
  });
  it('handles an empty report', async () => {
    const blob = await buildReportPdf(buildReportSheets({ cooked: [], notSet: [], stickers: [], days: [] }), 'empty');
    expect(blob.size).toBeGreaterThan(500);
  });
});
