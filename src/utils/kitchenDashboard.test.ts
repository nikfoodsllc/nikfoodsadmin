import { describe, it, expect } from 'vitest';
import {
  addDays,
  buildItemOrders,
  buildKitchenDays,
  buildKitchenWeek,
  comboChoiceLines,
  comboParts,
  formatAmount,
  sizeRank,
  spiceRank,
  parsePortionAmount,
  enumerateDays,
  formatDayShort,
  formatRangeLabel,
  getPresetRange,
  getWeekRange,
  isDayString,
  weekStartOf,
  toDayString,
  validateRange,
  weekdayName,
  type KitchenRow,
} from './kitchenDashboard';

describe('week math (weeks run Saturday to Friday)', () => {
  it('knows the weekday of a day', () => {
    expect(weekdayName('2026-10-05')).toBe('Monday');
    expect(weekdayName('2026-10-09')).toBe('Friday');
    expect(weekdayName('2026-10-10')).toBe('Saturday');
  });

  it('finds the Saturday that starts the week of any day', () => {
    expect(weekStartOf('2026-10-03')).toBe('2026-10-03'); // Saturday
    expect(weekStartOf('2026-10-04')).toBe('2026-10-03'); // Sunday
    expect(weekStartOf('2026-10-07')).toBe('2026-10-03'); // Wednesday
    expect(weekStartOf('2026-10-09')).toBe('2026-10-03'); // Friday is the LAST day of the week
    expect(weekStartOf('2026-10-10')).toBe('2026-10-10'); // the next Saturday starts a new week
  });

  it('crosses month and year boundaries', () => {
    expect(addDays('2026-10-31', 1)).toBe('2026-11-01');
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(weekStartOf('2027-01-01')).toBe('2026-12-26'); // Friday Jan 1
    expect(getWeekRange('2026-03-01', 0)).toEqual({ startDate: '2026-02-28', endDate: '2026-03-06' });
  });

  it('gives this week, last week and the week before last', () => {
    // today is Wednesday Oct 7, 2026
    expect(getPresetRange('thisWeek', '2026-10-07')).toEqual({ startDate: '2026-10-03', endDate: '2026-10-09' });
    expect(getPresetRange('lastWeek', '2026-10-07')).toEqual({ startDate: '2026-09-26', endDate: '2026-10-02' });
    expect(getPresetRange('weekBeforeLast', '2026-10-07')).toEqual({ startDate: '2026-09-19', endDate: '2026-09-25' });
  });

  it('on a Friday "this week" still ends that Friday, and on the Saturday a new week begins', () => {
    expect(getPresetRange('thisWeek', '2026-10-09')).toEqual({ startDate: '2026-10-03', endDate: '2026-10-09' });
    expect(getPresetRange('thisWeek', '2026-10-10')).toEqual({ startDate: '2026-10-10', endDate: '2026-10-16' });
    expect(getPresetRange('lastWeek', '2026-10-10')).toEqual({ startDate: '2026-10-03', endDate: '2026-10-09' });
  });

  it('every week is seven days from a Saturday to a Friday', () => {
    for (const today of ['2026-10-03', '2026-10-04', '2026-10-05', '2026-10-06', '2026-10-07', '2026-10-08', '2026-10-09']) {
      const r = getWeekRange(today, 0);
      expect(weekdayName(r.startDate)).toBe('Saturday');
      expect(weekdayName(r.endDate)).toBe('Friday');
      expect(enumerateDays(r)).toHaveLength(7);
    }
  });

  it('lists every day of a range', () => {
    expect(enumerateDays({ startDate: '2026-10-03', endDate: '2026-10-09' })).toHaveLength(7);
    expect(enumerateDays({ startDate: '2026-10-05', endDate: '2026-10-05' })).toEqual(['2026-10-05']);
    expect(enumerateDays({ startDate: '2026-10-11', endDate: '2026-10-05' })).toEqual([]);
    expect(enumerateDays({ startDate: 'x', endDate: '2026-10-05' })).toEqual([]);
  });

  it('validates a custom range', () => {
    expect(validateRange({ startDate: '2026-10-03', endDate: '2026-10-09' })).toBeNull();
    expect(validateRange({ startDate: '', endDate: '2026-10-11' })).toMatch(/start and an end/);
    expect(validateRange({ startDate: '2026-10-11', endDate: '2026-10-05' })).toMatch(/not be after/);
    expect(validateRange({ startDate: '2026-01-01', endDate: '2026-12-31' })).toMatch(/at most/);
  });

  it('rejects impossible dates', () => {
    expect(isDayString('2026-02-30')).toBe(false);
    expect(isDayString('2026-10-05')).toBe(true);
    expect(isDayString('10/05/2026')).toBe(false);
  });

  it('formats labels', () => {
    expect(formatDayShort('2026-10-07')).toBe('Wed, Oct 7');
    expect(formatRangeLabel({ startDate: '2026-10-03', endDate: '2026-10-09' })).toBe('Oct 3 – Oct 9, 2026');
    expect(formatRangeLabel({ startDate: '2026-12-28', endDate: '2027-01-03' })).toBe('Dec 28, 2026 – Jan 3, 2027');
  });

  it('turns stored dates into day strings', () => {
    expect(toDayString('2026-10-07')).toBe('2026-10-07');
    expect(toDayString('2026-10-07T00:00:00.000Z')).toBe('2026-10-07');
    expect(toDayString(new Date('2026-10-07T00:00:00Z'))).toBe('2026-10-07');
    expect(toDayString('garbage')).toBeNull();
    expect(toDayString(undefined)).toBeNull();
  });
});

const combo = {
  sections: [
    { _id: 's1', selectedItems: [{ _id: 'a1', portion: '12Oz', item: { name: 'Kale Chane' } }] },
    { _id: 's2', selectedItems: [{ _id: 'b1', portion: '8Oz', item: { name: 'Palak Paneer' } }, { _id: 'b2', portion: '8Oz', item: { name: 'Punjabi Kathal' } }] },
    { _id: 's3', selectedItems: [{ _id: 'c1', portion: '16Oz', item: { name: 'Jeera Rice' } }, { _id: 'c2', portion: '', item: { name: 'Chapati' } }] },
  ],
};

const row = (over: Partial<KitchenRow>): KitchenRow => ({ orderId: 'ORD-1', day: '2026-10-07', name: 'Rajma', quantity: 1, ...over });

describe('comboParts', () => {
  it('lists the picked options with their sizes', () => {
    expect(comboParts({ ...combo, comboSelections: { s1: ['a1'], s2: ['b2'], s3: ['c2'] } })).toEqual([
      { name: 'Kale Chane', portion: '12Oz' },
      { name: 'Punjabi Kathal', portion: '8Oz' },
      { name: 'Chapati', portion: null },
    ]);
  });

  it('skips unknown ids and handles missing data', () => {
    expect(comboParts({ ...combo, comboSelections: { s1: ['nope'] } })).toEqual([]);
    expect(comboParts({ sections: null, comboSelections: null })).toEqual([]);
    expect(comboParts({ ...combo, comboSelections: null })).toEqual([]);
  });
});

describe('buildKitchenDays', () => {
  const days = ['2026-10-05', '2026-10-06', '2026-10-07'];

  it('returns a block for every day, empty ones included', () => {
    const out = buildKitchenDays([], days);
    expect(out.map((d) => d.weekday)).toEqual(['Monday', 'Tuesday', 'Wednesday']);
    expect(out.every((d) => d.items.length === 0 && d.combos.length === 0 && d.totals.units === 0)).toBe(true);
  });

  it('adds up the same item across orders and splits it by size and spice', () => {
    const out = buildKitchenDays(
      [
        row({ orderId: 'A', quantity: 2, portion: '8Oz', spiceLevel: 'Medium Spice' }),
        row({ orderId: 'B', quantity: 1, portion: '8Oz', spiceLevel: 'Hot' }),
        row({ orderId: 'C', quantity: 3, portion: '16Oz', spiceLevel: 'Hot' }),
      ],
      days
    );
    const wed = out[2];
    expect(wed.items).toHaveLength(1);
    expect(wed.items[0]).toMatchObject({ name: 'Rajma', quantity: 6, inCombos: 0 });
    expect(wed.items[0].portions).toEqual([
      { label: '8Oz', quantity: 3 },
      { label: '16Oz', quantity: 3 },
    ].sort((a, b) => b.quantity - a.quantity || a.label.localeCompare(b.label)));
    expect(wed.items[0].spice).toEqual([
      { label: 'Hot', quantity: 4 },
      { label: 'Medium Spice', quantity: 2 },
    ]);
    expect(wed.totals).toMatchObject({ units: 6, orders: 3 });
  });

  it('keeps items on the day they belong to', () => {
    const out = buildKitchenDays([row({ day: '2026-10-05', name: 'Samosa Pav' }), row({ day: '2026-10-07', name: 'Rajma' })], days);
    expect(out[0].items.map((i) => i.name)).toEqual(['Samosa Pav']);
    expect(out[1].items).toEqual([]);
    expect(out[2].items.map((i) => i.name)).toEqual(['Rajma']);
  });

  it('ignores days outside the list, empty names and zero quantities', () => {
    const out = buildKitchenDays(
      [row({ day: '2026-11-01' }), row({ name: '   ' }), row({ quantity: 0 }), row({ quantity: -2 }), row({ quantity: Number.NaN })],
      days
    );
    expect(out.every((d) => d.items.length === 0)).toBe(true);
  });

  it('a line with no size shows no size breakdown', () => {
    const out = buildKitchenDays([row({ name: 'Samosa Pav', quantity: 4, portion: null })], days);
    expect(out[2].items[0]).toMatchObject({ name: 'Samosa Pav', quantity: 4, portions: [] });
  });

  it('expands combos into their parts and adds them to the same items', () => {
    const out = buildKitchenDays(
      [
        // two combos: Kale Chane + Palak Paneer + Jeera Rice, and Kale Chane + Punjabi Kathal + Chapati
        row({ orderId: 'A', name: 'Veg Combo', quantity: 1, spiceLevel: 'Medium Spice', comboSelections: { s1: ['a1'], s2: ['b1'], s3: ['c1'] }, ...combo }),
        row({ orderId: 'B', name: 'Veg Combo', quantity: 2, spiceLevel: 'Hot', comboSelections: { s1: ['a1'], s2: ['b2'], s3: ['c2'] }, ...combo }),
        // plus Kale Chane ordered on its own
        row({ orderId: 'C', name: 'Kale Chane', quantity: 4, portion: '12Oz', spiceLevel: 'Hot' }),
      ],
      days
    );
    const wed = out[2];
    const kale = wed.items.find((i) => i.name === 'Kale Chane')!;
    expect(kale.quantity).toBe(7); // 4 on its own + 3 inside combos
    expect(kale.inCombos).toBe(3);
    expect(kale.portions).toEqual([{ label: '12Oz', quantity: 7 }]);
    expect(wed.items.find((i) => i.name === 'Chapati')).toMatchObject({ quantity: 2, inCombos: 2, portions: [] });
    expect(wed.items.find((i) => i.name === 'Punjabi Kathal')?.quantity).toBe(2);
    expect(wed.combos).toHaveLength(1);
    expect(wed.combos[0]).toMatchObject({ name: 'Veg Combo', quantity: 3 });
    expect(wed.combos[0].spice).toEqual([
      { label: 'Hot', quantity: 2 },
      { label: 'Medium Spice', quantity: 1 },
    ]);
    expect(wed.combos[0].parts.find((p) => p.name === 'Kale Chane')).toMatchObject({ quantity: 3, portion: '12Oz' });
    // units = what was ordered: 3 combos + 4 Kale Chane (combo parts are not counted twice)
    expect(wed.totals.units).toBe(7);
    expect(wed.totals.orders).toBe(3);
  });

  it('a combo whose choices cannot be read is counted as a plain item', () => {
    const out = buildKitchenDays([row({ name: 'Veg Combo', quantity: 2, comboSelections: { s1: ['gone'] }, ...combo })], days);
    expect(out[2].items[0]).toMatchObject({ name: 'Veg Combo', quantity: 2 });
    expect(out[2].combos).toEqual([]);
  });

  it('counts eco containers by quantity', () => {
    const out = buildKitchenDays([row({ quantity: 2, isEco: true }), row({ quantity: 3, isEco: false }), row({ quantity: 1, isEco: true, name: 'Dal' })], days);
    expect(out[2].totals.ecoContainers).toBe(3);
  });

  it('sorts the biggest production first', () => {
    const out = buildKitchenDays([row({ name: 'A', quantity: 1 }), row({ name: 'B', quantity: 5 }), row({ name: 'C', quantity: 5 })], days);
    expect(out[2].items.map((i) => i.name)).toEqual(['B', 'C', 'A']);
  });
});

describe('parsePortionAmount (sizes in portion labels)', () => {
  it('reads ounces and pounds', () => {
    expect(parsePortionAmount('8Oz')).toEqual({ oz: 8, grams: 0, pieces: 0 });
    expect(parsePortionAmount('12 oz')).toEqual({ oz: 12, grams: 0, pieces: 0 });
    expect(parsePortionAmount('1Lb')).toEqual({ oz: 16, grams: 0, pieces: 0 });
    expect(parsePortionAmount('1/2Lb')).toEqual({ oz: 8, grams: 0, pieces: 0 });
    expect(parsePortionAmount('1/2 Lb')).toEqual({ oz: 8, grams: 0, pieces: 0 });
    expect(parsePortionAmount('1 1/2 lb')).toEqual({ oz: 24, grams: 0, pieces: 0 });
  });
  it('reads grams, kilograms and pieces', () => {
    expect(parsePortionAmount('100gms')).toEqual({ oz: 0, grams: 100, pieces: 0 });
    expect(parsePortionAmount('250 g')).toEqual({ oz: 0, grams: 250, pieces: 0 });
    expect(parsePortionAmount('1kg')).toEqual({ oz: 0, grams: 1000, pieces: 0 });
    expect(parsePortionAmount('6Pcs')).toEqual({ oz: 0, grams: 0, pieces: 6 });
  });
  it('gives null when there is no size', () => {
    expect(parsePortionAmount('Full')).toBeNull();
    expect(parsePortionAmount('Serves 4')).toBeNull();
    expect(parsePortionAmount('')).toBeNull();
    expect(parsePortionAmount(null)).toBeNull();
    expect(parsePortionAmount(undefined)).toBeNull();
    expect(parsePortionAmount('0Oz')).toBeNull();
    expect(parsePortionAmount('1/0Lb')).toBeNull();
  });
});

describe('formatAmount', () => {
  it('shows ounces with the pounds beside them, as a decimal', () => {
    expect(formatAmount({ oz: 8, grams: 0, pieces: 0 })).toBe('8 oz (0.5 lb)');
    expect(formatAmount({ oz: 4, grams: 0, pieces: 0 })).toBe('4 oz (0.25 lb)');
    expect(formatAmount({ oz: 12, grams: 0, pieces: 0 })).toBe('12 oz (0.75 lb)');
    expect(formatAmount({ oz: 16, grams: 0, pieces: 0 })).toBe('16 oz (1 lb)');
    expect(formatAmount({ oz: 36, grams: 0, pieces: 0 })).toBe('36 oz (2.25 lb)');
    expect(formatAmount({ oz: 96, grams: 0, pieces: 0 })).toBe('96 oz (6 lb)');
    expect(formatAmount({ oz: 300, grams: 0, pieces: 0 })).toBe('300 oz (18.75 lb)');
    expect(formatAmount({ oz: 20, grams: 0, pieces: 0 })).toBe('20 oz (1.25 lb)');
    expect(formatAmount({ oz: 17, grams: 0, pieces: 0 })).toBe('17 oz (1.06 lb)');
  });
  it('shows grams and pieces and joins mixed units', () => {
    expect(formatAmount({ oz: 0, grams: 300, pieces: 0 })).toBe('300 g');
    expect(formatAmount({ oz: 0, grams: 1500, pieces: 0 })).toBe('1500 g (1.5 kg)');
    expect(formatAmount({ oz: 0, grams: 0, pieces: 12 })).toBe('12 pcs');
    expect(formatAmount({ oz: 8, grams: 0, pieces: 6 })).toBe('8 oz (0.5 lb) + 6 pcs');
    expect(formatAmount({ oz: 0, grams: 0, pieces: 0 })).toBe('');
  });
});

describe('total amount per item', () => {
  const days = ['2026-10-07'];

  it('multiplies each size by its quantity and adds them up', () => {
    const out = buildKitchenDays(
      [row({ quantity: 3, portion: '8Oz' }), row({ orderId: 'B', quantity: 2, portion: '16Oz' })],
      days
    );
    expect(out[0].items[0]).toMatchObject({ quantity: 5, totalText: '56 oz (3.5 lb)', unsized: 0 });
  });

  it('handles pound sizes', () => {
    const out = buildKitchenDays([row({ name: 'Kaju Katli', quantity: 3, portion: '1/2Lb' }), row({ orderId: 'B', name: 'Kaju Katli', quantity: 1, portion: '1Lb' })], days);
    expect(out[0].items[0].totalText).toBe('40 oz (2.5 lb)');
  });

  it('adds the sizes of combo parts to the same item', () => {
    const out = buildKitchenDays(
      [
        row({ orderId: 'A', name: 'Veg Combo', quantity: 3, comboSelections: { s1: ['a1'], s2: ['b1'], s3: ['c2'] }, ...combo }),
        row({ orderId: 'B', name: 'Kale Chane', quantity: 4, portion: '12Oz' }),
      ],
      days
    );
    const kale = out[0].items.find((i) => i.name === 'Kale Chane')!;
    expect(kale.totalText).toBe('84 oz (5.25 lb)'); // 3 in combos + 4 on their own, 12 oz each
    expect(kale.unsized).toBe(0);
    // Chapati has no size: no total, and nothing to flag because no part of it is sized
    const chapati = out[0].items.find((i) => i.name === 'Chapati')!;
    expect(chapati).toMatchObject({ totalText: '', unsized: 0, quantity: 3 });
  });

  it('flags units that have no size when some do', () => {
    const out = buildKitchenDays([row({ quantity: 2, portion: '8Oz' }), row({ orderId: 'B', quantity: 3, portion: null })], days);
    expect(out[0].items[0]).toMatchObject({ quantity: 5, totalText: '16 oz (1 lb)', unsized: 3 });
  });

  it('items without any size show no total', () => {
    const out = buildKitchenDays([row({ name: 'Samosa Pav', quantity: 4, portion: null })], days);
    expect(out[0].items[0]).toMatchObject({ totalText: '', unsized: 0 });
  });
});

describe('buildKitchenWeek (the whole range as one block)', () => {
  const days = ['2026-10-06', '2026-10-07', '2026-10-08'];
  const rows: KitchenRow[] = [
    row({ orderId: 'A', day: '2026-10-06', name: 'Dosa Batter', quantity: 2, portion: '32Oz' }),
    row({ orderId: 'B', day: '2026-10-07', name: 'Dosa Batter', quantity: 3, portion: '32Oz' }),
    row({ orderId: 'C', day: '2026-10-08', name: 'Dosa Batter', quantity: 1, portion: '16Oz' }),
    row({ orderId: 'C', day: '2026-10-08', name: 'Rajma', quantity: 4, spiceLevel: 'Hot', isEco: true }),
    row({ orderId: 'D', day: '2026-10-07', name: 'Veg Combo', quantity: 2, spiceLevel: 'Medium', ...combo, comboSelections: { s1: ['a1'], s2: ['b1'], s3: ['c2'] } }),
    row({ orderId: 'E', day: '2026-10-06', name: 'Kale Chane', quantity: 1, portion: '12Oz' }),
  ];

  it('adds an item up across all days, whatever its menu day', () => {
    const week = buildKitchenWeek(rows);
    const dosa = week.items.find((i) => i.name === 'Dosa Batter')!;
    expect(dosa.quantity).toBe(6);
    expect(dosa.portions).toEqual([
      { label: '32Oz', quantity: 5 },
      { label: '16Oz', quantity: 1 },
    ]);
    expect(dosa.totalText).toBe('176 oz (11 lb)'); // 5 x 32 + 1 x 16
  });

  it('equals the sum of the days for every item, its sizes, spice and total amount', () => {
    const week = buildKitchenWeek(rows);
    const perDay = buildKitchenDays(rows, days);
    for (const item of week.items) {
      const daily = perDay.flatMap((d) => d.items.filter((i) => i.name === item.name));
      expect(daily.reduce((s, i) => s + i.quantity, 0)).toBe(item.quantity);
      expect(daily.reduce((s, i) => s + i.inCombos, 0)).toBe(item.inCombos);
    }
    expect(week.totals.units).toBe(perDay.reduce((s, d) => s + d.totals.units, 0));
    expect(week.totals.ecoContainers).toBe(perDay.reduce((s, d) => s + d.totals.ecoContainers, 0));
  });

  it('counts combos and their parts like a day does, and counts an order once even when it spans days', () => {
    const week = buildKitchenWeek(rows);
    expect(week.combos.map((c) => [c.name, c.quantity])).toEqual([['Veg Combo', 2]]);
    const kale = week.items.find((i) => i.name === 'Kale Chane')!;
    expect(kale.quantity).toBe(3); // 1 on its own + 2 inside the combos
    expect(kale.inCombos).toBe(2);
    expect(week.totals.orders).toBe(5); // A, B, C, D, E (C has two lines but is one order)
  });

  it('skips unusable lines and gives an empty block for no lines', () => {
    expect(buildKitchenWeek([])).toEqual({ items: [], combos: [], totals: { units: 0, orders: 0, ecoContainers: 0 } });
    expect(buildKitchenWeek([row({ quantity: 0 }), row({ name: '  ' }), row({ quantity: NaN })]).items).toEqual([]);
  });
});

describe('buildItemOrders (who ordered an item)', () => {
  const traced = (over: Partial<KitchenRow>) => row({ customerName: 'Asha', deliveredOn: '2026-10-09', orderStatus: 'confirmed', ...over });
  const rows: KitchenRow[] = [
    traced({ orderId: 'ORD-2', day: '2026-10-07', name: 'Rajma', quantity: 2, portion: '8Oz', spiceLevel: 'Hot', isEco: true, customerName: 'Ben' }),
    traced({ orderId: 'ORD-1', day: '2026-10-07', name: 'Rajma', quantity: 1, portion: '12Oz' }),
    traced({ orderId: 'ORD-3', day: '2026-10-08', name: 'Rajma', quantity: 3, portion: '8Oz', customerName: 'Asha' }),
    traced({ orderId: 'ORD-4', day: '2026-10-08', name: 'Veg Combo', quantity: 2, spiceLevel: 'Medium', customerName: 'Cara', ...combo, comboSelections: { s1: ['a1'], s2: ['b1'], s3: ['c2'] } }),
    traced({ orderId: 'ORD-5', day: '2026-10-08', name: 'Kale Chane', quantity: 1, portion: '12Oz', customerName: 'Dev' }),
  ];

  it('lists every order that contains the item, with its size, spice and eco container', () => {
    const lines = buildItemOrders(rows, 'Rajma');
    expect(lines.map((l) => [l.orderId, l.customerName, l.day, l.quantity, l.portion, l.spice, l.isEco])).toEqual([
      // spice first (Hot before no spice), then the size (12Oz before 8Oz)
      ['ORD-2', 'Ben', '2026-10-07', 2, '8Oz', 'Hot', true],
      ['ORD-1', 'Asha', '2026-10-07', 1, '12Oz', null, false],
      ['ORD-3', 'Asha', '2026-10-08', 3, '8Oz', null, false],
    ]);
  });

  it('only one menu day when a day is given (an item listed under a specific day)', () => {
    expect(buildItemOrders(rows, 'Rajma', '2026-10-07').map((l) => l.orderId)).toEqual(['ORD-2', 'ORD-1']);
    expect(buildItemOrders(rows, 'Rajma', '2026-10-08').map((l) => l.orderId)).toEqual(['ORD-3']);
    expect(buildItemOrders(rows, 'Rajma', '2026-10-09')).toEqual([]);
  });

  it('finds an item that was chosen as a part of a combo, and says which combo', () => {
    const lines = buildItemOrders(rows, 'Kale Chane');
    expect(lines.map((l) => [l.orderId, l.quantity, l.portion, l.viaCombo])).toEqual([
      ['ORD-4', 2, '12Oz', 'Veg Combo'],
      ['ORD-5', 1, '12Oz', null],
    ]);
  });

  it('traces a combo itself', () => {
    const lines = buildItemOrders(rows, 'Veg Combo');
    expect(lines).toHaveLength(1);
    expect(lines[0]).toMatchObject({ orderId: 'ORD-4', customerName: 'Cara', quantity: 2, spice: 'Medium', viaCombo: null });
  });

  it('adds up to the quantity the kitchen counts show, per day and for the week', () => {
    const week = buildKitchenWeek(rows);
    for (const item of week.items) {
      expect(buildItemOrders(rows, item.name).reduce((s, l) => s + l.quantity, 0)).toBe(item.quantity);
    }
    const day = buildKitchenDays(rows, ['2026-10-07', '2026-10-08']);
    for (const d of day) {
      for (const item of d.items) {
        expect(buildItemOrders(rows, item.name, d.day).reduce((s, l) => s + l.quantity, 0)).toBe(item.quantity);
      }
    }
  });

  it('keeps the delivery day and status, falls back for a missing customer name, and ignores unusable input', () => {
    const lines = buildItemOrders([traced({ orderId: 'ORD-9', customerName: null, deliveredOn: '2026-10-09', orderStatus: 'preparing' })], 'Rajma');
    expect(lines[0]).toMatchObject({ customerName: 'Unknown customer', deliveredOn: '2026-10-09', orderStatus: 'preparing' });
    expect(buildItemOrders(rows, '')).toEqual([]);
    expect(buildItemOrders(rows, 'Nothing like this')).toEqual([]);
    expect(buildItemOrders([row({ quantity: 0 })], 'Rajma')).toEqual([]);
  });
});

describe('eco containers per item', () => {
  const days = ['2026-10-07'];
  it('counts the eco units of an item next to its spice, and none when no one asked', () => {
    const out = buildKitchenDays(
      [
        row({ orderId: 'A', name: 'Rajma', quantity: 2, spiceLevel: 'Medium', isEco: true }),
        row({ orderId: 'B', name: 'Rajma', quantity: 3, spiceLevel: 'Normal' }),
        row({ orderId: 'C', name: 'Samosa Pav', quantity: 4 }),
      ],
      days
    );
    const items = Object.fromEntries(out[0].items.map((i) => [i.name, i]));
    expect(items['Rajma'].eco).toBe(2);
    expect(items['Rajma'].quantity).toBe(5);
    expect(items['Samosa Pav'].eco).toBe(0);
    expect(out[0].totals.ecoContainers).toBe(2);
  });
});

describe('who ordered: sorted by spice level, then size, then name', () => {
  const r = (over: Partial<KitchenRow>): KitchenRow => ({ orderId: 'A', day: '2026-10-07', name: 'Matar Paneer Bhurji', quantity: 1, portion: '8Oz', spiceLevel: 'Normal', customerName: 'X', ...over });
  const order = (rows: KitchenRow[]) => buildItemOrders(rows, 'Matar Paneer Bhurji').map((l) => `${l.spice ?? 'none'}:${l.quantity}:${l.orderId}`);
  it('mild, normal, medium, spicy, hot, then no spice', () => {
    const rows = [
      r({ orderId: 'a', spiceLevel: 'Spicy', quantity: 1 }),
      r({ orderId: 'b', spiceLevel: null, quantity: 9 }),
      r({ orderId: 'c', spiceLevel: 'Normal', quantity: 1 }),
      r({ orderId: 'd', spiceLevel: 'Mild (Kid Friendly)', quantity: 1 }),
      r({ orderId: 'e', spiceLevel: 'Normal', quantity: 3 }),
      r({ orderId: 'f', spiceLevel: 'Medium Spice', quantity: 2 }),
      r({ orderId: 'g', spiceLevel: 'Mild (Kid Friendly)', quantity: 4 }),
      r({ orderId: 'h', spiceLevel: 'Hot', quantity: 1 }),
    ];
    expect(order(rows)).toEqual(['Mild (Kid Friendly):4:g', 'Mild (Kid Friendly):1:d', 'Normal:3:e', 'Normal:1:c', 'Medium Spice:2:f', 'Spicy:1:a', 'Hot:1:h', 'none:9:b']);
  });
  it('inside a spice level: biggest size first (16Oz, 12Oz, 8Oz), then by customer name', () => {
    const rows = [
      r({ orderId: 'a', portion: '12Oz', customerName: 'Kavita' }),
      r({ orderId: 'b', portion: '16Oz', customerName: 'Hiral' }),
      r({ orderId: 'c', portion: '8Oz', customerName: 'Pooja', quantity: 5 }),
      r({ orderId: 'd', portion: '16Oz', customerName: 'Meher', quantity: 2 }),
      r({ orderId: 'e', portion: '12Oz', customerName: 'Anand', quantity: 3 }),
      r({ orderId: 'f', portion: null, customerName: 'Zed', quantity: 9 }),
      r({ orderId: 'g', portion: '1Lb', customerName: 'Gita' }),
    ];
    // 1Lb and 16Oz are the same size: Gita, Hiral, Meher; then 12Oz: Anand, Kavita; then 8Oz; no size last
    expect(buildItemOrders(rows, 'Matar Paneer Bhurji').map((l) => l.orderId)).toEqual(['g', 'b', 'd', 'e', 'a', 'c', 'f']);
  });
  it('a person with several orders of it: every order is listed and they sit together', () => {
    const rows = [
      r({ orderId: 'z1', portion: '16Oz', customerName: 'Zed' }),
      r({ orderId: 'a-late', day: '2026-10-08', portion: '16Oz', customerName: 'Asha' }),
      r({ orderId: 'm1', portion: '16Oz', customerName: 'Mira' }),
      r({ orderId: 'a-big', portion: '16Oz', customerName: 'Asha', quantity: 2 }),
      r({ orderId: 'a-small', portion: '12Oz', customerName: 'Asha' }),
      r({ orderId: 'a-early', day: '2026-10-06', portion: '16Oz', customerName: 'Asha' }),
    ];
    const lines = buildItemOrders(rows, 'Matar Paneer Bhurji');
    expect(lines).toHaveLength(6); // nothing merged or dropped
    // 16Oz: Asha's four orders together (biggest quantity first, then by day), Mira, Zed; then the 12Oz
    expect(lines.map((l) => l.orderId)).toEqual(['a-big', 'a-early', 'a-late', 'm1', 'z1', 'a-small'].map((id) => (id === 'a-big' ? 'a-big' : id)));
  });
  it('names are compared without regard to case', () => {
    const rows = [r({ orderId: '1', customerName: 'hiral jagani' }), r({ orderId: '2', customerName: 'ANAND GHOTGE' }), r({ orderId: '3', customerName: 'Bhavya Sethi' })];
    expect(buildItemOrders(rows, 'Matar Paneer Bhurji').map((l) => l.orderId)).toEqual(['2', '3', '1']);
  });
  it('the size sort sits inside the spice sort: a small mild order still comes before a big spicy one', () => {
    const rows = [r({ orderId: 'big-spicy', spiceLevel: 'Spicy', portion: '16Oz' }), r({ orderId: 'small-mild', spiceLevel: 'Mild (Kid Friendly)', portion: '8Oz' })];
    expect(buildItemOrders(rows, 'Matar Paneer Bhurji').map((l) => l.orderId)).toEqual(['small-mild', 'big-spicy']);
  });
  it('sizes are compared as amounts: 1Lb is bigger than 12Oz, 1/2Lb equals 8Oz', () => {
    expect(sizeRank('1Lb')).toBeGreaterThan(sizeRank('12Oz'));
    expect(sizeRank('1/2Lb')).toBe(sizeRank('8Oz'));
    expect(sizeRank('Full')).toBeLessThan(sizeRank('1Oz'));
    expect(sizeRank(null)).toBe(sizeRank('Serves 4'));
  });
  it('same spice, size and name: biggest quantity, then day', () => {
    const rows = [r({ orderId: 'z', customerName: 'Zed' }), r({ orderId: 'y', customerName: 'Zed', quantity: 3 }), r({ orderId: 'x', day: '2026-10-06', customerName: 'Zed' })];
    expect(buildItemOrders(rows, 'Matar Paneer Bhurji').map((l) => l.orderId)).toEqual(['y', 'x', 'z']);
  });
  it('an unknown spice name sits after the known levels and before no spice', () => {
    expect(spiceRank('Mild (Kid Friendly)')).toBeLessThan(spiceRank('Normal'));
    expect(spiceRank('Normal')).toBeLessThan(spiceRank('Medium Spice'));
    expect(spiceRank('Medium Spice')).toBeLessThan(spiceRank('Spicy'));
    expect(spiceRank('Spicy')).toBeLessThan(spiceRank('Hot'));
    expect(spiceRank('Hot')).toBeLessThan(spiceRank('Extra Hot'));
    expect(spiceRank('Extra Hot')).toBeLessThan(spiceRank('Surprise me'));
    expect(spiceRank('Surprise me')).toBeLessThan(spiceRank(null));
    expect(spiceRank('')).toBe(spiceRank(undefined));
  });
});

describe('combo breakdown per order', () => {
  const sections = [
    { _id: 's1', title: 'Veg Curry of the Day', selectedItems: [{ _id: 'o1', portion: '12Oz', item: { name: 'Kale Chane' } }, { _id: 'o2', portion: '12Oz', item: { name: 'Rajma' } }] },
    { _id: 's2', title: 'Choice of Staple', selectedItems: [{ _id: 'o3', portion: '', item: { name: 'Chapati' } }, { _id: 'o4', portion: '16Oz', item: { name: 'Jeera Rice' } }] },
    { _id: 's3', title: 'Sides', selectedItems: [{ _id: 'o5', portion: '4Oz', item: { name: 'Raita' } }, { _id: 'o6', portion: '4Oz', item: { name: 'Salad' } }] },
  ];
  const combo = (orderId: string, picks: Record<string, string[]>, over: Partial<KitchenRow> = {}): KitchenRow => ({ orderId, day: '2026-10-07', name: 'Veg Combo', quantity: 1, spiceLevel: 'Normal', customerName: orderId, sections, comboSelections: picks, ...over });
  it('one line per section with the size in brackets, no brackets when there is no size', () => {
    expect(comboChoiceLines(combo('A', { s1: ['o1'], s2: ['o3'] }))).toEqual(['Veg Curry of the Day: Kale Chane (12Oz)', 'Choice of Staple: Chapati']);
  });
  it('two picks in a section are joined; a section with no pick is left out', () => {
    expect(comboChoiceLines(combo('A', { s3: ['o5', 'o6'] }))).toEqual(['Sides: Raita (4Oz), Salad (4Oz)']);
  });
  it('unknown ids, missing data and a missing title are handled', () => {
    expect(comboChoiceLines(combo('A', { s1: ['nope'] }))).toEqual([]);
    expect(comboChoiceLines({ sections: null, comboSelections: null })).toEqual([]);
    expect(comboChoiceLines({ sections: [{ _id: 's9', selectedItems: [{ _id: 'q', item: { name: 'X' } }] }], comboSelections: { s9: ['q'] } })).toEqual(['Choice: X']);
  });
  it('tracing the combo gives each order its own breakdown; tracing a part gives none', () => {
    const rows = [combo('A', { s1: ['o1'], s2: ['o4'] }), combo('B', { s1: ['o2'], s2: ['o3'] }, { spiceLevel: 'Spicy' })];
    const lines = buildItemOrders(rows, 'Veg Combo');
    expect(lines.map((l) => [l.orderId, l.choices])).toEqual([
      ['A', ['Veg Curry of the Day: Kale Chane (12Oz)', 'Choice of Staple: Jeera Rice (16Oz)']],
      ['B', ['Veg Curry of the Day: Rajma (12Oz)', 'Choice of Staple: Chapati']],
    ]);
    const part = buildItemOrders(rows, 'Kale Chane');
    expect(part).toHaveLength(1);
    expect(part[0]).toMatchObject({ viaCombo: 'Veg Combo', choices: [] });
  });
});

describe('eco containers by size', () => {
  const days = ['2026-10-07'];
  const r = (over: Partial<KitchenRow>): KitchenRow => ({ orderId: 'A', day: '2026-10-07', name: 'Rajma', quantity: 1, portion: '16Oz', isEco: true, ...over });
  it('counts eco containers per size, biggest first', () => {
    const out = buildKitchenDays([r({ quantity: 3 }), r({ orderId: 'B', quantity: 1, portion: '12Oz' }), r({ orderId: 'C', quantity: 1, portion: '12Oz' }), r({ orderId: 'D', quantity: 5, isEco: false })], days);
    const item = out[0].items[0];
    expect(item.eco).toBe(5);
    expect(item.ecoBySize).toEqual([{ label: '16Oz', quantity: 3 }, { label: '12Oz', quantity: 2 }]);
  });
  it('sizes read biggest first (16Oz, 12Oz, 8Oz) whatever the counts, and unsized last', () => {
    const out = buildKitchenDays([r({ portion: '8Oz', quantity: 5 }), r({ orderId: 'B', portion: '16Oz', quantity: 1 }), r({ orderId: 'C', portion: '12Oz', quantity: 2 }), r({ orderId: 'D', portion: null, quantity: 9 })], days);
    expect(out[0].items[0].ecoBySize.map((l) => `${l.label}:${l.quantity}`)).toEqual(['16Oz:1', '12Oz:2', '8Oz:5', 'No size:9']);
  });
  it('an eco item without a size is counted under No size', () => {
    const out = buildKitchenDays([r({ portion: null, quantity: 2 })], days);
    expect(out[0].items[0].ecoBySize).toEqual([{ label: 'No size', quantity: 2 }]);
  });
  it('no eco gives an empty list, and the by-size numbers add up to the eco total', () => {
    const none = buildKitchenDays([r({ isEco: false })], days);
    expect(none[0].items[0].ecoBySize).toEqual([]);
    const mixed = buildKitchenDays([r({ quantity: 4 }), r({ orderId: 'B', portion: null, quantity: 1 }), r({ orderId: 'C', portion: '8Oz', quantity: 2 })], days);
    const item = mixed[0].items[0];
    expect(item.ecoBySize.reduce((s, l) => s + l.quantity, 0)).toBe(item.eco);
  });
  it('eco inside a combo stays on the combo, not on its parts', () => {
    const parts = [{ _id: 's1', title: 'Curry', selectedItems: [{ _id: 'o1', portion: '12Oz', item: { name: 'Kale Chane' } }] }];
    const out = buildKitchenDays([{ orderId: 'A', day: '2026-10-07', name: 'Veg Combo', quantity: 2, isEco: true, sections: parts, comboSelections: { s1: ['o1'] } }], days);
    expect(out[0].combos[0].eco).toBe(2);
    expect(out[0].items.find((i) => i.name === 'Kale Chane')?.ecoBySize).toEqual([]);
  });
});
