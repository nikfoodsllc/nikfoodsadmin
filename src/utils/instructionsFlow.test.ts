import { describe, expect, it } from 'vitest';
import { buildKitchenReport, type StickerLookup, type TypeLookup } from './kitchenReport';
import { buildItemOrders, type KitchenRow } from './kitchenDashboard';
import { buildPackingReport, toLine, type PackingRow } from './packingReport';
import { buildReportSheets } from './kitchenReportSheets';

const row = (over: Partial<KitchenRow>): KitchenRow => ({ orderId: 'ORD-1', day: '2026-10-13', name: 'Rajma', quantity: 1, customerName: 'Asha', orderedOn: '2026-10-06', ...over });
const cooked: TypeLookup = () => 'cooked';
const stickersYes: StickerLookup = () => 'yes';
const NOTE = 'Less salt please';

describe('special instructions travel to the kitchen and packing screens', () => {
  it('the Kitchen Dashboard order lines carry them', () => {
    const lines = buildItemOrders([row({ notes: NOTE }), row({ orderId: 'ORD-2', customerName: 'Ben' })], 'Rajma');
    expect(lines.find((l) => l.orderId === 'ORD-1')?.note).toBe(NOTE);
    expect(lines.find((l) => l.orderId === 'ORD-2')?.note).toBeNull();
  });
  it('the Kitchen Report prep lines and stickers carry them, and the sheets have an Instructions column', () => {
    const report = buildKitchenReport([row({ notes: NOTE }), row({ orderId: 'ORD-2', customerName: 'Ben' })], cooked, stickersYes);
    const lines = report.cooked[0].lines;
    expect(lines.find((l) => l.orderId === 'ORD-1')?.note).toBe(NOTE);
    expect(lines.find((l) => l.orderId === 'ORD-2')?.note).toBeNull();
    expect(report.stickers.find((s) => s.orderId === 'ORD-1')?.note).toBe(NOTE);
    const sheets = buildReportSheets({ cooked: report.cooked, notSet: [], stickers: report.stickers });
    const prep = sheets.find((s) => s.key === 'prep')!;
    const iPrep = prep.columnKeys!.indexOf('instructions');
    expect(iPrep).toBeGreaterThan(-1);
    expect(prep.rows.filter((r) => r.kind === 'data').map((r) => r.cells[iPrep])).toContain(NOTE);
    const st = sheets.find((s) => s.key === 'stickers')!;
    const iSt = st.columnKeys!.indexOf('instructions');
    expect(st.rows[0].cells[iSt]).toBe('Instructions');
    expect(st.rows.filter((r) => r.kind === 'data').map((r) => r.cells[iSt])).toContain(NOTE);
  });
  it('with no instructions anywhere the sheets look exactly as before (no Instructions column)', () => {
    const report = buildKitchenReport([row({}), row({ orderId: 'ORD-2', customerName: 'Ben' })], cooked, stickersYes);
    const sheets = buildReportSheets({ cooked: report.cooked, notSet: [], stickers: report.stickers });
    for (const sheet of sheets) expect(sheet.columnKeys).not.toContain('instructions');
  });
  it('a combo part keeps the note of the combo order', () => {
    const comboRow = row({
      name: 'Veg Combo', spiceLevel: 'Medium', notes: NOTE,
      sections: [{ _id: 's1', title: 'Curry', selectedItems: [{ _id: 'a1', portion: '12Oz', item: { _id: 'f-kale', name: 'Kale Chane' } }] }],
      comboSelections: { s1: ['a1'] },
    });
    const report = buildKitchenReport([comboRow], cooked);
    expect(report.cooked.find((b) => b.name === 'Kale Chane')?.lines[0].note).toBe(NOTE);
  });
  it('the Packing Report line carries it', () => {
    const packingRow: PackingRow = { ...row({ notes: NOTE }), street: '1 A St' };
    expect(toLine(packingRow, '2026-10-13').note).toBe(NOTE);
    expect(toLine({ ...packingRow, notes: null }, '2026-10-13').note).toBeNull();
    const report = buildPackingReport('2026-10-13', [packingRow], [], []);
    const all = [...report.unrouted, ...report.routes.flatMap((r) => r.stops)].flatMap((s) => s.lines);
    expect(all.map((l) => l.note)).toContain(NOTE);
  });
});
