import { describe, it, expect } from 'vitest';
import {
  addDays,
  buildKitchenDays,
  comboParts,
  formatAmount,
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
  it('shows ounces, and decimal pounds once there are 16 ounces or more', () => {
    expect(formatAmount({ oz: 8, grams: 0, pieces: 0 })).toBe('8 oz');
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
    expect(formatAmount({ oz: 8, grams: 0, pieces: 6 })).toBe('8 oz + 6 pcs');
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
