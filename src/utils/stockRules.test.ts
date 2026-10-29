import { describe, expect, it } from 'vitest';
import { cleanResetTime, cleanStockUnit, cleanThreshold, formatAmount, lastDailyBoundary, limitInBase, lineAmounts, lineUnits, nextDailyBoundary, pacificWallToDate, perUnitAmount, portionOunces, stockSince, stockState, unitsThatFit } from './stockRules';

describe('limit and state', () => {
  it('only a whole number of at least 1 is a limit', () => {
    expect(cleanThreshold(50)).toBe(50);
    expect(cleanThreshold('12')).toBe(12);
    for (const v of [0, -3, 2.5, '', '  ', 'abc', null, undefined, 1e9]) expect(cleanThreshold(v)).toBeNull();
  });
  it('remaining and sold out', () => {
    expect(stockState(10, 4)).toMatchObject({ limit: 10, ordered: 4, remaining: 6, soldOut: false });
    expect(stockState(10, 10).soldOut).toBe(true);
    expect(stockState(10, 14)).toMatchObject({ remaining: 0, soldOut: true });
    expect(stockState(null, 99)).toMatchObject({ limit: null, ordered: 99, remaining: null, soldOut: false });
  });
  it('limits in pounds and ounces are counted in ounces', () => {
    expect(cleanStockUnit('lb')).toBe('lb');
    expect(cleanStockUnit('kg')).toBe('units');
    expect(cleanThreshold(40, 'lb')).toBe(40);
    expect(cleanThreshold('12.5', 'lb')).toBe(12.5);
    expect(cleanThreshold(0.1, 'lb')).toBeNull();
    expect(cleanThreshold(12.5, 'oz')).toBeNull();
    expect(limitInBase(40, 'lb')).toBe(640);
    const s = stockState(40, 8 * 16 + 24, 'lb'); // 152 oz of a 40 lb limit
    expect(s).toMatchObject({ limit: 40, unit: 'lb', ordered: 9.5, remaining: 30.5, soldOut: false });
    expect(stockState(40, 640, 'lb').soldOut).toBe(true);
    expect(stockState(100, 30, 'oz')).toMatchObject({ ordered: 30, remaining: 70 });
    expect(formatAmount(24, 'lb')).toBe('1.5 lb');
    expect(formatAmount(8, 'oz')).toBe('8 oz');
    expect(formatAmount(3, 'units')).toBe('3');
  });
  it('size labels become ounces', () => {
    expect(portionOunces('12Oz')).toBe(12);
    expect(portionOunces('1/2Lb')).toBe(8);
    expect(portionOunces('1/2 Lb')).toBe(8);
    expect(portionOunces('1Lb')).toBe(16);
    expect(portionOunces('2 lbs')).toBe(32);
    expect(portionOunces('1Kg')).toBeCloseTo(35.274, 2);
    expect(portionOunces('100gms')).toBeCloseTo(3.527, 2);
    for (const v of ['6Pcs', 'Full', 'Serves 4', '', null, undefined]) expect(portionOunces(v)).toBeNull();
  });
  it('how many units fit in what is left', () => {
    expect(perUnitAmount('1Lb', 'lb')).toBe(16);
    expect(perUnitAmount('anything', 'units')).toBe(1);
    expect(perUnitAmount('Full', 'oz')).toBe(0);
    expect(unitsThatFit(40, 16)).toBe(2);
    expect(unitsThatFit(15, 16)).toBe(0);
    expect(unitsThatFit(32, 16)).toBe(2);
    expect(unitsThatFit(5, 0)).toBe(Number.POSITIVE_INFINITY);
  });
});

describe('daily reset time (Pacific)', () => {
  it('validates HH:MM', () => {
    expect(cleanResetTime('03:00')).toBe('03:00');
    for (const v of ['3:00', '24:00', '12:60', '', null, 'noon']) expect(cleanResetTime(v)).toBeNull();
  });
  it('Pacific wall time to the right instant, summer (PDT) and winter (PST)', () => {
    expect(pacificWallToDate(2026, 7, 1, 3, 0).toISOString()).toBe('2026-07-01T10:00:00.000Z');
    expect(pacificWallToDate(2026, 12, 1, 3, 0).toISOString()).toBe('2026-12-01T11:00:00.000Z');
  });
  it('the last boundary is today when the time has passed, yesterday when it has not', () => {
    // 2026-10-29 20:00Z = 13:00 PDT: 03:00 PDT today (10:00Z) already passed
    expect(lastDailyBoundary(new Date('2026-10-29T20:00:00Z'), '03:00').toISOString()).toBe('2026-10-29T10:00:00.000Z');
    // 2026-10-29 08:00Z = 01:00 PDT: today's 03:00 has not happened yet, so yesterday's
    expect(lastDailyBoundary(new Date('2026-10-29T08:00:00Z'), '03:00').toISOString()).toBe('2026-10-28T10:00:00.000Z');
  });
  it('works across the daylight saving change (Nov 1, 2026: clocks go back)', () => {
    // Nov 1 05:00Z = Oct 31 22:00 PDT; the 03:00 before that was Oct 31 03:00 PDT = 10:00Z
    expect(lastDailyBoundary(new Date('2026-11-01T05:00:00Z'), '03:00').toISOString()).toBe('2026-10-31T10:00:00.000Z');
    // Nov 2 12:00Z = 04:00 PST: Nov 2 03:00 PST = 11:00Z
    expect(lastDailyBoundary(new Date('2026-11-02T12:00:00Z'), '03:00').toISOString()).toBe('2026-11-02T11:00:00.000Z');
  });
  it('the next boundary is a day after the last', () => {
    expect(nextDailyBoundary(new Date('2026-10-29T20:00:00Z'), '03:00').toISOString()).toBe('2026-10-30T10:00:00.000Z');
  });
});

describe('where the count starts', () => {
  const now = new Date('2026-10-29T20:00:00Z');
  it('manual: since the limit was set or last reset; without a reset since the item was created', () => {
    expect(stockSince({ stockResetAt: '2026-10-20T00:00:00Z', stockResetMode: 'manual' }, now).toISOString()).toBe('2026-10-20T00:00:00.000Z');
    expect(stockSince({ createdAt: '2026-09-01T00:00:00Z' }, now).toISOString()).toBe('2026-09-01T00:00:00.000Z');
  });
  it('daily: the later of the manual start and the last daily reset', () => {
    const doc = { stockResetAt: '2026-10-20T00:00:00Z', stockResetMode: 'daily', stockResetTime: '03:00' };
    expect(stockSince(doc, now).toISOString()).toBe('2026-10-29T10:00:00.000Z');
    // a manual reset after today's daily reset wins
    expect(stockSince({ ...doc, stockResetAt: '2026-10-29T15:00:00Z' }, now).toISOString()).toBe('2026-10-29T15:00:00.000Z');
    // daily without a valid time behaves as manual
    expect(stockSince({ ...doc, stockResetTime: 'x' }, now).toISOString()).toBe('2026-10-20T00:00:00.000Z');
  });
});

describe('units a line uses up', () => {
  const combo = {
    _id: 'combo1',
    sections: [
      { _id: 's1', selectedItems: [{ _id: 'o1', quantity: 1, item: { _id: 'kale' } }, { _id: 'o2', quantity: 1, item: { _id: 'chole' } }] },
      { _id: 's2', selectedItems: [{ _id: 'o3', quantity: 4, item: { _id: 'chapati' } }] },
    ],
  };
  it('a plain item is its own quantity', () => {
    expect([...lineUnits({ food: { _id: 'x' }, quantity: 3 })]).toEqual([['x', 3]]);
  });
  it('a combo counts itself and every picked option, times the quantity and the pieces per combo', () => {
    const u = lineUnits({ food: combo, quantity: 2, comboSelections: { s1: ['o1'], s2: ['o3'] } });
    expect(Object.fromEntries(u)).toEqual({ combo1: 2, kale: 2, chapati: 8 });
  });
  it('options that were not picked do not count, and a cart line (foodItem) works the same', () => {
    const u = lineUnits({ foodItem: combo, quantity: 1, comboSelections: { s1: ['o2'] } });
    expect(Object.fromEntries(u)).toEqual({ combo1: 1, chole: 1 });
  });
  it('weight: a line weighs its size times the quantity; combo parts weigh their own size', () => {
    const kalakand = lineAmounts({ food: { _id: 'k' }, quantity: 2, selectedPortion: '1Lb' }).get('k');
    expect(kalakand).toEqual({ units: 2, ounces: 32 });
    const withSizes = { _id: 'c', sections: [{ _id: 's1', selectedItems: [{ _id: 'o1', quantity: 1, portion: '12Oz', item: { _id: 'kale' } }] }] };
    const parts = lineAmounts({ food: withSizes, quantity: 3, comboSelections: { s1: ['o1'] } });
    expect(parts.get('kale')).toEqual({ units: 3, ounces: 36 });
    expect(lineAmounts({ food: { _id: 'x' }, quantity: 1, selectedPortion: 'Full' }).get('x')).toEqual({ units: 1, ounces: 0 });
  });
  it('ignores a bad quantity', () => {
    expect(lineUnits({ food: { _id: 'x' }, quantity: 0 }).size).toBe(0);
    expect(lineUnits({ food: { _id: 'x' }, quantity: 'two' }).size).toBe(0);
  });
});

describe('low-stock alert level', async () => {
  const { cleanAlertPercent, stockLevel, DEFAULT_ALERT_PERCENT } = await import('./stockRules');
  const level = (limit: number, ordered: number, pct?: unknown, unit: 'units' | 'lb' | 'oz' = 'units') => stockLevel(stockState(limit, ordered, unit), pct);
  it('the alert share is a whole number from 1 to 99, otherwise 10', () => {
    expect(DEFAULT_ALERT_PERCENT).toBe(10);
    expect(cleanAlertPercent(25)).toBe(25);
    expect(cleanAlertPercent('30')).toBe(30);
    for (const v of [0, 100, -5, 12.5, '', 'abc', null, undefined]) expect(cleanAlertPercent(v)).toBe(10);
  });
  it('ok above the share, low at or under it, out at the limit, none without a limit', () => {
    expect(level(20, 17)).toBe('ok'); // 3 left = 15%
    expect(level(20, 18)).toBe('low'); // 2 left = exactly 10%
    expect(level(20, 19)).toBe('low');
    expect(level(20, 20)).toBe('out');
    expect(level(20, 0)).toBe('ok');
    expect(level(10, 5, 50)).toBe('low');
    expect(level(10, 4, 50)).toBe('ok');
    expect(level(2, 1)).toBe('ok'); // 1 of 2 left = 50%
    expect(stockLevel(stockState(null, 0), 10)).toBe('none');
  });
  it('works for weight limits (counted in ounces)', () => {
    // 5 lb = 80 oz; 10% = 8 oz
    expect(level(5, 72, undefined, 'lb')).toBe('low');
    expect(level(5, 71, undefined, 'lb')).toBe('ok');
    expect(level(5, 80, undefined, 'lb')).toBe('out');
  });
});
