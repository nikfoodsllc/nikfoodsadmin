import { describe, it, expect } from 'vitest';
import { blockTotal, buildKitchenReport, prepCsvRows, stickersCsvRows, toCsvText, type TypeLookup } from './kitchenReport';
import type { KitchenRow } from './kitchenDashboard';

const row = (over: Partial<KitchenRow>): KitchenRow => ({ orderId: 'ORD-1', day: '2026-10-13', name: 'Rajma', quantity: 1, customerName: 'Asha', orderedOn: '2026-10-06', ...over });
const types: Record<string, 'cooked' | 'ready_to_eat'> = { Rajma: 'cooked', 'Kale Chane': 'cooked', Chapati: 'cooked', Pickle: 'ready_to_eat' };
const byName: TypeLookup = ({ name }) => types[name] ?? null;

const combo = {
  name: 'Veg Combo',
  spiceLevel: 'Medium',
  sections: [
    { _id: 's1', title: 'Curry', selectedItems: [{ _id: 'a1', portion: '12Oz', item: { _id: 'f-kale', name: 'Kale Chane' } }] },
    { _id: 's2', title: 'Bread', selectedItems: [{ _id: 'b1', portion: null, item: { _id: 'f-chapati', name: 'Chapati' } }] },
  ],
  comboSelections: { s1: ['a1'], s2: ['b1'] },
};

describe('buildKitchenReport', () => {
  it('one block per cooked item with the amount, eco count and the orders behind it', () => {
    const r = buildKitchenReport([
      row({ portion: '12Oz', quantity: 2, customerName: 'Beena', isEco: true }),
      row({ orderId: 'ORD-2', portion: '8Oz', quantity: 1, customerName: 'Chitra' }),
    ], byName);
    expect(r.cooked.map((b) => b.name)).toEqual(['Rajma']);
    const b = r.cooked[0];
    expect(b.quantity).toBe(3); expect(b.totalText).toBe('32 oz (2 lb)'); expect(b.eco).toBe(2); expect(b.unsized).toBe(0);
    expect(b.lines.map((l) => [l.customerName, l.portion, l.amountText, l.isEco])).toEqual([['Beena', '12Oz', '24 oz (1.5 lb)', true], ['Chitra', '8Oz', '8 oz (0.5 lb)', false]]);
  });
  it('an item without sizes totals as a number of pieces', () => {
    const r = buildKitchenReport([row({ name: 'Chapati', quantity: 4 }), row({ orderId: 'ORD-2', name: 'Chapati', quantity: 13, customerName: 'Beena' })], byName);
    expect(r.cooked[0].totalText).toBe(''); expect(blockTotal(r.cooked[0])).toBe('17');
  });
  it('mixed sized and unsized units say how many are not in the total', () => {
    const r = buildKitchenReport([row({ portion: '12Oz' }), row({ orderId: 'ORD-2', customerName: 'Beena' })], byName);
    expect(r.cooked[0].unsized).toBe(1); expect(r.cooked[0].totalText).toContain('12 oz');
  });
  it('a combo is split into its parts, each with its size and the combo it came with', () => {
    const r = buildKitchenReport([row({ ...combo, quantity: 2, customerName: 'Dev' })], byName);
    expect(r.cooked.map((b) => b.name)).toEqual(['Chapati', 'Kale Chane']);
    const kale = r.cooked.find((b) => b.name === 'Kale Chane')!;
    expect(kale.quantity).toBe(2); expect(kale.totalText).toBe('24 oz (1.5 lb)');
    expect(kale.lines[0]).toMatchObject({ viaCombo: 'Veg Combo', viaSpice: 'Medium', spice: null, customerName: 'Dev', portion: '12Oz' });
    expect(r.cooked.some((b) => b.name === 'Veg Combo')).toBe(false);
  });
  it('lines go spice mild to hot (none last), biggest size first, then by customer', () => {
    const r = buildKitchenReport([
      row({ orderId: '1', customerName: 'Zed', spiceLevel: 'Hot', portion: '8Oz' }),
      row({ orderId: '2', customerName: 'Amy', spiceLevel: 'Mild', portion: '8Oz' }),
      row({ orderId: '3', customerName: 'Bob', spiceLevel: 'Mild', portion: '16Oz' }),
      row({ orderId: '4', customerName: 'Cat', portion: '12Oz' }),
      row({ orderId: '5', customerName: 'Abe', spiceLevel: 'Mild', portion: '8Oz' }),
    ], byName);
    expect(r.cooked[0].lines.map((l) => l.customerName)).toEqual(['Bob', 'Abe', 'Amy', 'Zed', 'Cat']);
  });
  it('splits cooked, ready to eat and not set yet, and never drops an item', () => {
    const r = buildKitchenReport([row({ name: 'Pickle', customerName: 'Beena' }), row({ name: 'Mystery Dish' }), row({})], byName);
    expect(r.cooked.map((b) => b.name)).toEqual(['Rajma']);
    expect(r.readyToEat.map((b) => b.name)).toEqual(['Pickle']);
    expect(r.notSet.map((b) => b.name)).toEqual(['Mystery Dish']);
  });
  it('looks the type up by the food id when the order has one', () => {
    const byId: TypeLookup = ({ id }) => (id === 'f-1' ? 'ready_to_eat' : id === 'f-2' ? 'cooked' : null);
    const r = buildKitchenReport([row({ name: 'Same Name', foodId: 'f-1' }), row({ orderId: '2', name: 'Same Name', foodId: 'f-2' })], byId);
    expect(r.readyToEat.map((b) => b.name)).toEqual(['Same Name']); expect(r.cooked.map((b) => b.name)).toEqual(['Same Name']);
  });
  it('stickers: only ready to eat, one line per order line, in delivery order then customer', () => {
    const r = buildKitchenReport([
      row({ name: 'Pickle', orderId: '1', customerName: 'Zed', day: '2026-10-14' }),
      row({ name: 'Pickle', orderId: '2', customerName: 'Amy', day: '2026-10-13', deliveredOn: '2026-10-14', portion: '16Oz', isEco: true }),
      row({ name: 'Pickle', orderId: '3', customerName: 'Bob', day: '2026-10-13' }),
      row({}),
    ], byName);
    expect(r.stickers.map((s) => `${s.deliveredOn ?? s.day}:${s.customerName}`)).toEqual(['2026-10-13:Bob', '2026-10-14:Amy', '2026-10-14:Zed']);
    expect(r.stickers[1]).toMatchObject({ item: 'Pickle', portion: '16Oz', isEco: true });
  });
  it('says a delivery is later only when it is', () => {
    const r = buildKitchenReport([row({ deliveredOn: '2026-10-14' }), row({ orderId: '2', deliveredOn: '2026-10-13' }), row({ orderId: '3', deliveredOn: null })], byName);
    const later = r.cooked[0].lines.map((l) => l.deliveredOn);
    expect(later.filter(Boolean)).toEqual(['2026-10-14']);
    expect(later.filter((x) => x === null)).toHaveLength(2);
  });
  it('ignores empty, zero and broken lines', () => {
    const r = buildKitchenReport([row({ quantity: 0 }), row({ quantity: NaN }), row({ name: '  ' }), row({ name: 'Rajma', quantity: 1 })], byName);
    expect(r.cooked).toHaveLength(1); expect(r.cooked[0].quantity).toBe(1);
  });
});

describe('csv rows', () => {
  const report = buildKitchenReport([
    row({ portion: '12Oz', isEco: true, customerName: 'Beena' }),
    row({ orderId: '2', name: 'Chapati', quantity: 4, customerName: 'Chitra' }),
    row({ orderId: '3', name: 'Chapati', quantity: 3, customerName: 'Dev', deliveredOn: '2026-10-14' }),
    row({ orderId: '4', name: 'Pickle', customerName: 'Eva', portion: '16Oz' }),
  ], byName);
  it('blocks are separated by a blank row and the total sits on the first row of a block', () => {
    const rows = prepCsvRows(report.cooked);
    expect(rows[0][0]).toBe('Item');
    const chapati = rows.filter((r) => r[0] === 'Chapati'); expect(chapati).toHaveLength(2);
    expect(chapati[0][1]).toBe('7'); expect(chapati[1][1]).toBe('');
    expect(rows.some((r) => r.length === 0)).toBe(true);
    const rajma = rows.find((r) => r[0] === 'Rajma')!; expect(rajma[1]).toBe('12 oz (0.75 lb)'); expect(rajma[2]).toBe('1'); expect(rajma[8]).toBe('ECO');
    expect(rows[0].slice(10)).toEqual(['Order date', 'Kitchen date', 'Delivery date']);
    expect(chapati[1].slice(10)).toEqual(['2026-10-06', '2026-10-13', '2026-10-14']); // ordered Oct 6, cooked Oct 13, delivered Oct 14
    expect(chapati[0].slice(10)).toEqual(['2026-10-06', '2026-10-13', '2026-10-13']); // delivered the same day it is cooked
  });
  it('sticker rows', () => {
    const rows = stickersCsvRows(report.stickers);
    expect(rows[0]).toEqual(['Delivery date', 'Customer', 'Item', 'Size', 'Qty', 'Spice', 'Eco', 'With combo', 'Order', 'Order date', 'Kitchen date']);
    expect(rows[1]).toEqual(['2026-10-13', 'Eva', 'Pickle', '16Oz', '1', '', '', '', '4', '2026-10-06', '2026-10-13']);
  });
});

describe('toCsvText', () => {
  it('quotes cells with commas, quotes and line breaks, and starts with a byte order mark', () => {
    const text = toCsvText([['a', 'b,c', 'say "hi"', 'x\ny'], []]);
    expect(text.startsWith('﻿')).toBe(true);
    expect(text).toContain('a,"b,c","say ""hi""","x\ny"');
    expect(text.split('\r\n')).toHaveLength(3);
  });
  it('never lets a cell start a spreadsheet formula', () => {
    const text = toCsvText([['=SUM(A1)', '+1', '-2', '@x', 'fine']]);
    expect(text).toContain("'=SUM(A1),'+1,'-2,'@x,fine");
  });
});

describe('the three dates of a line', () => {
  it('order date, kitchen date and delivery date are on every line', () => {
    const r = buildKitchenReport([row({ orderedOn: '2026-10-05', day: '2026-10-13', deliveredOn: '2026-10-14' }), row({ orderId: '2', orderedOn: '2026-10-08' })], byName);
    const lines = r.cooked[0].lines;
    expect(lines.map((l) => [l.orderedOn, l.day, l.deliveryDate])).toEqual(expect.arrayContaining([['2026-10-05', '2026-10-13', '2026-10-14'], ['2026-10-08', '2026-10-13', '2026-10-13']]));
  });
  it('a combo part carries the dates of its order, and stickers do too', () => {
    const r = buildKitchenReport([row({ ...combo, orderedOn: '2026-10-09', deliveredOn: '2026-10-15' }), row({ name: 'Pickle', orderedOn: '2026-10-07', deliveredOn: '2026-10-14' })], byName);
    expect(r.cooked.find((b) => b.name === 'Chapati')!.lines[0]).toMatchObject({ orderedOn: '2026-10-09', day: '2026-10-13', deliveryDate: '2026-10-15' });
    expect(r.stickers[0]).toMatchObject({ orderedOn: '2026-10-07', day: '2026-10-13', deliveryDate: '2026-10-14' });
  });
  it('an unknown order date stays empty', () => {
    const r = buildKitchenReport([row({ orderedOn: null })], byName);
    expect(r.cooked[0].lines[0].orderedOn).toBeNull();
    expect(prepCsvRows(r.cooked)[1].slice(10)).toEqual(['', '2026-10-13', '2026-10-13']);
  });
});
