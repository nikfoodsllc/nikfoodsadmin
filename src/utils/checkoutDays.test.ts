import { describe, expect, it } from 'vitest';
import { layoutCheckoutDays } from './checkoutDays';
import type { DraftItem } from './abandonedCheckouts';

const item = (date: string, lineTotal: number, name = 'Item'): DraftItem => ({ date, name, quantity: 1, unitPrice: lineTotal, lineTotal });

describe('layoutCheckoutDays', () => {
  it('one day that meets the minimum is delivered that day', () => {
    const l = layoutCheckoutDays([item('2026-10-14', 30)], 25);
    expect(l.days).toHaveLength(1);
    expect(l.days[0]).toMatchObject({ date: '2026-10-14', weekday: 'Wednesday', dayTotal: 30, deliveredOn: null });
    expect(l.belowMinimum).toBe(false);
  });
  it('a day under the minimum goes to the last day when another day meets it', () => {
    const l = layoutCheckoutDays([item('2026-10-14', 10), item('2026-10-15', 30), item('2026-10-16', 30)], 25);
    expect(l.days.map((d) => d.deliveredOn)).toEqual(['2026-10-16', null, null]);
  });
  it('days that all meet the minimum keep their own day', () => {
    const l = layoutCheckoutDays([item('2026-10-14', 25), item('2026-10-16', 26)], 25);
    expect(l.days.map((d) => d.deliveredOn)).toEqual([null, null]);
  });
  it('if no day meets it but the whole cart does, everything goes to the last day', () => {
    const l = layoutCheckoutDays([item('2026-10-14', 15), item('2026-10-15', 12)], 25);
    expect(l.days.map((d) => d.deliveredOn)).toEqual(['2026-10-15', null]);
    expect(l.belowMinimum).toBe(false);
  });
  it('a cart under the minimum is flagged and nothing is combined', () => {
    const l = layoutCheckoutDays([item('2026-10-14', 10), item('2026-10-15', 5)], 25);
    expect(l.belowMinimum).toBe(true);
    expect(l.days.map((d) => d.deliveredOn)).toEqual([null, null]);
  });
  it('the zip minimum is used, and a missing one means $25', () => {
    expect(layoutCheckoutDays([item('2026-10-14', 22)], 20).belowMinimum).toBe(false);
    expect(layoutCheckoutDays([item('2026-10-14', 22)], null).belowMinimum).toBe(true);
    expect(layoutCheckoutDays([item('2026-10-14', 22)]).minCartValue).toBe(25);
  });
  it('sorts the days by date and adds up each day', () => {
    const l = layoutCheckoutDays([item('2026-10-16', 10.1), item('2026-10-14', 20.2), item('2026-10-14', 5.05)], 25);
    expect(l.days.map((d) => d.date)).toEqual(['2026-10-14', '2026-10-16']);
    expect(l.days[0].dayTotal).toBe(25.25);
    expect(l.days[0].items).toHaveLength(2);
  });
  it('items without a saved day get their own block at the end and never crash', () => {
    const l = layoutCheckoutDays([{ ...item('', 30), date: '' }, item('2026-10-14', 30)], 25);
    expect(l.days.map((d) => d.date)).toEqual(['2026-10-14', '']);
    expect(layoutCheckoutDays([], 25).days).toEqual([]);
  });
});
