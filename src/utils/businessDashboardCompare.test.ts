import { describe, expect, it } from 'vitest';
import { compareRangeFor, compareRows, emptyTotals, isCompareMode } from './businessDashboard';

const range = { from: '2026-11-01', to: '2026-11-14' };

describe('compareRangeFor', () => {
  it('prior period = same length right before', () => {
    expect(compareRangeFor('previous', range, null)).toEqual({ from: '2026-10-18', to: '2026-10-31' });
  });
  it('last year = same dates a year earlier', () => {
    expect(compareRangeFor('lastYear', range, null)).toEqual({ from: '2025-11-01', to: '2025-11-14' });
  });
  it('custom = the picked dates, of any length, or null until they are valid', () => {
    expect(compareRangeFor('custom', range, { from: '2026-09-01', to: '2026-09-30' })).toEqual({ from: '2026-09-01', to: '2026-09-30' });
    expect(compareRangeFor('custom', range, null)).toBeNull();
    expect(compareRangeFor('custom', range, { from: '2026-09-30', to: '2026-09-01' })).toBeNull();
    expect(compareRangeFor('custom', range, { from: '', to: '2026-09-01' })).toBeNull();
  });
  it('knows its modes', () => {
    expect(['previous', 'lastYear', 'custom'].every(isCompareMode)).toBe(true);
    expect(isCompareMode('week')).toBe(false);
  });
});

describe('compareRows', () => {
  it('gives the difference and percent change, and null change when there is nothing before', () => {
    const now = { ...emptyTotals(), gross: 1200, net: 1150, orders: 30, averageOrder: 40, refunds: 50, feeNet: 60, feeOnCard: 60, stripeFee: 45, taxNet: 120 };
    const before = { ...emptyTotals(), gross: 1000, net: 1000, orders: 25, averageOrder: 40, refunds: 0, feeNet: 50, feeOnCard: 50, stripeFee: 40, taxNet: 100 };
    const rows = Object.fromEntries(compareRows(now, before).map((r) => [r.key, r]));
    expect(rows.gross).toMatchObject({ diff: 200, change: 20 });
    expect(rows.orders).toMatchObject({ diff: 5, change: 20, kind: 'count' });
    expect(rows.averageOrder).toMatchObject({ diff: 0, change: 0 });
    expect(rows.refunds).toMatchObject({ diff: 50, change: null, lowerIsBetter: true });
    expect(rows.kept).toMatchObject({ now: 15, before: 10, diff: 5, change: 50 });
    expect(rows.stripeFee.lowerIsBetter).toBe(true);
  });
});
