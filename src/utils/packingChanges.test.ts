import { describe, expect, it } from 'vitest';
import type { PackLine, PackStop, PackingReport } from './packingReport';
import { comparePackingReports, describeChanges } from './packingChanges';

const line = (orderId: string, quantity = 1): PackLine => ({ orderId, name: 'Dal', quantity, portion: null, spice: null, isEco: false, choices: [], pickedFor: null, day: '2026-10-15' });
const stop = (number: number, orderIds: string[], quantities: number[] = []): PackStop => ({ number, customerName: `C${number}`, address: '', scheduledAt: '', orderIds, lines: orderIds.map((id, i) => line(id, quantities[i] ?? 1)), empty: false });
const report = (routes: PackStop[][], unrouted: PackStop[] = []): PackingReport => ({
  date: '2026-10-15',
  routes: routes.map((stops, i) => ({ key: `r${i}`, title: `Route ${i + 1}`, driverName: `D${i}`, vehicle: '', stops })),
  unrouted,
  totals: [],
  stats: { stops: 0, orders: 0, units: 0, eco: 0, unroutedStops: 0 },
});

describe('comparePackingReports', () => {
  const base = report([[stop(1, ['A']), stop(2, ['B'])]]);
  it('the same list is the same', () => {
    expect(comparePackingReports(base, report([[stop(1, ['A']), stop(2, ['B'])]])).same).toBe(true);
  });
  it('a new order (a new customer left over, or added to a stop) is found', () => {
    const c = comparePackingReports(base, report([[stop(1, ['A']), stop(2, ['B'])]], [stop(0, ['C'])]));
    expect(c.newOrders).toEqual(['C']);
    expect(c.same).toBe(false);
    expect(describeChanges(c)).toBe('1 new order');
  });
  it('an order whose items changed is found, and one that went away', () => {
    const c = comparePackingReports(base, report([[stop(1, ['A'], [3])]]));
    expect(c.changedOrders).toEqual(['A']);
    expect(c.removedOrders).toEqual(['B']);
    expect(describeChanges(c)).toBe('1 changed order, 1 cancelled or moved order');
  });
  it('a customer who gets a second order changes the stop, so both are seen', () => {
    const c = comparePackingReports(base, report([[stop(1, ['A', 'A2']), stop(2, ['B'])]]));
    expect(c.newOrders).toEqual(['A2']);
  });
  it('the same orders under different drivers is a layout change only', () => {
    const c = comparePackingReports(base, report([[stop(1, ['B']), stop(2, ['A'])]]));
    expect(c.newOrders).toEqual([]);
    expect(c.layoutChanged).toBe(true);
    expect(c.same).toBe(false);
    expect(describeChanges(c)).toBe('The routes were rearranged');
  });
  it('several orders are counted in the plural', () => {
    expect(describeChanges(comparePackingReports(base, report([[stop(1, ['A']), stop(2, ['B'])]], [stop(0, ['C']), stop(0, ['D'])])))).toBe('2 new orders');
  });
});
