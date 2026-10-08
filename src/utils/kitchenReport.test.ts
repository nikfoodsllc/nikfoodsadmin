import { describe, it, expect } from 'vitest';
import { blockTotal, buildKitchenReport, filterBlocksBySearch, filterStickersBySearch, type TypeLookup } from './kitchenReport';
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
    expect(b.lines.map((l) => [l.customerName, l.portion, l.amountText, l.isEco])).toEqual([['Chitra', '8Oz', '8 oz (0.5 lb)', false], ['Beena', '12Oz', '24 oz (1.5 lb)', true]]);
  });
  it('an item without sizes totals as a number of pieces', () => {
    const r = buildKitchenReport([row({ name: 'Chapati', quantity: 4 }), row({ orderId: 'ORD-2', name: 'Chapati', quantity: 13, customerName: 'Beena' })], byName);
    expect(r.cooked[0].totalText).toBe(''); expect(blockTotal(r.cooked[0])).toBe('17 units');
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
    expect(kale.lines[0]).toMatchObject({ viaCombo: 'Veg Combo', viaSpice: 'Medium', spice: 'Medium', customerName: 'Dev', portion: '12Oz' });
    expect(r.cooked.some((b) => b.name === 'Veg Combo')).toBe(false);
  });
  it('a combo in an eco container marks its curry and rice ECO but never the chapati; the spice goes on the main dish only', () => {
    const full = {
      name: 'Veg Combo',
      spiceLevel: 'Spicy',
      sections: [
        { _id: 'c', title: 'Veg Curry of the Day', selectedItems: [{ _id: 'c1', portion: '12Oz', item: { _id: 'f1', name: 'Kale Chane' } }] },
        { _id: 'v', title: 'Vegetable of the Day', selectedItems: [{ _id: 'v1', portion: '8Oz', item: { _id: 'f2', name: 'Palak Paneer' } }] },
        { _id: 's', title: 'Choice of Staple', selectedItems: [{ _id: 's1', portion: null, item: { _id: 'f3', name: 'Chapati' } }, { _id: 's2', portion: '8Oz', item: { _id: 'f4', name: 'Jeera Rice' } }] },
      ],
    };
    const r = buildKitchenReport([
      row({ ...full, orderId: 'E1', customerName: 'Eco', isEco: true, comboSelections: { c: ['c1'], v: ['v1'], s: ['s1'] } }),
      row({ ...full, orderId: 'E2', customerName: 'Rice', isEco: true, comboSelections: { c: ['c1'], v: ['v1'], s: ['s2'] } }),
      row({ ...full, orderId: 'E3', customerName: 'Plain', isEco: false, comboSelections: { c: ['c1'], v: ['v1'], s: ['s1'] } }),
    ], () => 'cooked');
    const line = (item: string, who: string) => r.cooked.find((b) => b.name === item)!.lines.find((l) => l.customerName === who)!;
    expect([line('Kale Chane', 'Eco').isEco, line('Palak Paneer', 'Eco').isEco, line('Chapati', 'Eco').isEco, line('Jeera Rice', 'Rice').isEco]).toEqual([true, true, false, true]);
    expect([line('Kale Chane', 'Plain').isEco, line('Chapati', 'Plain').isEco]).toEqual([false, false]);
    expect(r.cooked.find((b) => b.name === 'Chapati')!.eco).toBe(0);
    expect([line('Kale Chane', 'Eco').spice, line('Palak Paneer', 'Eco').spice, line('Chapati', 'Eco').spice, line('Jeera Rice', 'Rice').spice]).toEqual(['Spicy', null, null, null]);
  });
  it('a non-veg combo puts the spice on its non-veg dish, and a combo with no curry-like section uses the first section', () => {
    const nonVeg = { name: 'Non-Veg Combo', spiceLevel: 'Hot', sections: [
      { _id: 'a', title: 'Non Veg dish of the day', selectedItems: [{ _id: 'a1', portion: '12Oz', item: { _id: 'g1', name: 'Chicken Rogan Josh' } }] },
      { _id: 'b', title: 'Choice of Staples', selectedItems: [{ _id: 'b1', portion: '8Oz', item: { _id: 'g2', name: 'Jeera Rice' } }] }], comboSelections: { a: ['a1'], b: ['b1'] } };
    const r = buildKitchenReport([row({ ...nonVeg, customerName: 'N' })], () => 'cooked');
    expect(r.cooked.find((b) => b.name === 'Chicken Rogan Josh')!.lines[0].spice).toBe('Hot');
    expect(r.cooked.find((b) => b.name === 'Jeera Rice')!.lines[0].spice).toBeNull();
    const odd = { ...nonVeg, sections: [{ _id: 'x', title: 'Main', selectedItems: [{ _id: 'x1', portion: '8Oz', item: { _id: 'h1', name: 'Mystery Main' } }] }, { _id: 'y', title: 'Side', selectedItems: [{ _id: 'y1', portion: '8Oz', item: { _id: 'h2', name: 'Mystery Side' } }] }], comboSelections: { x: ['x1'], y: ['y1'] } };
    const r2 = buildKitchenReport([row({ ...odd, customerName: 'O' })], () => 'cooked');
    expect(r2.cooked.find((b) => b.name === 'Mystery Main')!.lines[0].spice).toBe('Hot');
    expect(r2.cooked.find((b) => b.name === 'Mystery Side')!.lines[0].spice).toBeNull();
  });
  it('lines go spice mild to hot (none last), smallest size first like Kunal\'s sheet, then by customer', () => {
    const r = buildKitchenReport([
      row({ orderId: '1', customerName: 'Zed', spiceLevel: 'Hot', portion: '8Oz' }),
      row({ orderId: '2', customerName: 'Amy', spiceLevel: 'Mild', portion: '8Oz' }),
      row({ orderId: '3', customerName: 'Bob', spiceLevel: 'Mild', portion: '16Oz' }),
      row({ orderId: '4', customerName: 'Cat', portion: '12Oz' }),
      row({ orderId: '5', customerName: 'Abe', spiceLevel: 'Mild', portion: '8Oz' }),
    ], byName);
    expect(r.cooked[0].lines.map((l) => l.customerName)).toEqual(['Abe', 'Amy', 'Bob', 'Zed', 'Cat']);
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

describe('report search', () => {
  const report = buildKitchenReport([
    row({ orderId: 'ORD-11', customerName: 'Asha Rao', portion: '12Oz', quantity: 2, isEco: true }),
    row({ orderId: 'ORD-22', customerName: 'Beena Shah', portion: '8Oz' }),
    row({ orderId: 'ORD-33', name: 'Pickle', customerName: 'Asha Rao', portion: '16Oz' }),
    row({ orderId: 'ORD-44', ...combo, customerName: 'Dev Patel' }),
  ], byName);
  it('an item name keeps the whole card', () => {
    const out = filterBlocksBySearch(report.cooked, 'rajma');
    expect(out.map((b) => b.name)).toEqual(['Rajma']); expect(out[0].lines).toHaveLength(2); expect(out[0].quantity).toBe(3);
  });
  it('a customer keeps only that customer lines and recounts the card', () => {
    const out = filterBlocksBySearch(report.cooked, 'beena');
    expect(out.map((b) => b.name)).toEqual(['Rajma']);
    expect(out[0].lines.map((l) => l.customerName)).toEqual(['Beena Shah']);
    expect(out[0].quantity).toBe(1); expect(out[0].eco).toBe(0); expect(out[0].totalText).toBe('8 oz (0.5 lb)');
  });
  it('an order number and a combo name find their lines', () => {
    expect(filterBlocksBySearch(report.cooked, 'ord-22')[0].lines).toHaveLength(1);
    expect(filterBlocksBySearch(report.cooked, 'veg combo').map((b) => b.name)).toEqual(['Chapati', 'Kale Chane']);
  });
  it('stickers by item, customer or order; nothing matched is empty; empty search keeps all', () => {
    expect(filterStickersBySearch(report.stickers, 'asha')).toHaveLength(1);
    expect(filterStickersBySearch(report.stickers, 'pickle')).toHaveLength(1);
    expect(filterStickersBySearch(report.stickers, 'nobody')).toEqual([]);
    expect(filterStickersBySearch(report.stickers, '')).toBe(report.stickers);
    expect(filterBlocksBySearch(report.cooked, '')).toBe(report.cooked);
    expect(filterBlocksBySearch(report.cooked, 'zzzz')).toEqual([]);
  });
});
