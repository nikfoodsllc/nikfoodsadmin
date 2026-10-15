import { describe, expect, it } from 'vitest';
import type { PackingRun } from './packingProgress';
import { MIN_COUNTED_MS, buildPackingMetrics, median, packedCustomers, statOf } from './packingMetrics';

// a customer of a run: some time on it, a snapshot, when it was opened
const stop = (name: string, ms: number, units = 1, extra: Record<string, unknown> = {}): PackingRun['stops'] => ({
  [name]: { timeMs: ms, firstOpenedAt: `2026-10-13T10:${String(name.charCodeAt(0) % 60).padStart(2, '0')}:00Z`, meta: { name, units, lines: 1, orderIds: [`ORD-${name}`] }, ...extra },
});
const run = (over: Partial<PackingRun>): PackingRun => ({ date: '2026-10-13', routeKey: 'r1', driverName: 'Belred', startedAt: '2026-10-13T10:00:00Z', finishedAt: '2026-10-13T11:00:00Z', startedBy: 'Ann', stops: {}, ...over });

describe('stats', () => {
  it('median of odd, even and empty', () => {
    expect(median([5, 1, 3])).toBe(3);
    expect(median([1, 2, 3, 10])).toBe(3);
    expect(median([])).toBe(0);
  });
  it('statOf', () => expect(statOf([60000, 120000])).toEqual({ count: 2, totalMs: 180000, averageMs: 90000, medianMs: 90000 }));
});

describe('packedCustomers', () => {
  it('counts customers with a snapshot and at least 10 seconds, and marks the automatic one', () => {
    const r = run({ stops: { ...stop('A', 60000), ...stop('B', MIN_COUNTED_MS), ...stop('C', MIN_COUNTED_MS - 1), ...stop('D', 0), ...stop('E', 70000, 1, { auto: true }), x: { timeMs: 99999 } } });
    const list = packedCustomers(r);
    expect(list.map((c) => c.name).sort()).toEqual(['A', 'B', 'E']);
    expect(list.find((c) => c.name === 'E')?.auto).toBe(true);
    expect(list.find((c) => c.name === 'A')?.auto).toBe(false);
  });
});

describe('buildPackingMetrics', () => {
  const r1 = run({ stops: { ...stop('A', 60000, 4), ...stop('B', 120000, 2), ...stop('C', 5000, 3) } });
  const r2 = run({ date: '2026-10-14', routeKey: 'r2', driverName: 'Kirkland', startedBy: 'Bo', startedAt: '2026-10-14T10:00:00Z', finishedAt: '2026-10-14T10:30:00Z', stops: { ...stop('D', 90000, 3) } });
  const r3 = run({ date: '2026-10-14', routeKey: 'r3', driverName: 'Belred', finishedAt: null, stops: { ...stop('E', 45000, 1) } });
  const m = buildPackingMetrics([r1, r2, r3]);
  it('counts routes', () => expect([m.routesStarted, m.routesFinished, m.routesInProgress]).toEqual([3, 2, 1]));
  it('averages the customers that count (C was only 5 seconds)', () => {
    expect(m.customersPacked).toBe(4); // A B D E
    expect(m.customerMs).toBe(60000 + 120000 + 90000 + 45000);
    expect(m.averageMs).toBe(78750);
    expect(m.units).toBe(4 + 2 + 3 + 1);
    expect(m.customersPerHour).toBe(45.7);
  });
  it('route clock of finished routes only', () => {
    expect(m.routeMs).toBe(3600000 + 1800000);
  });
  it('groups by day and by driver', () => {
    expect(m.days.map((d) => [d.date, d.routes, d.customers])).toEqual([['2026-10-13', 1, 2], ['2026-10-14', 2, 2]]);
    expect(m.drivers.find((d) => d.driver === 'Belred')).toMatchObject({ routes: 2, customers: 3, customerMs: 225000, averageMs: 75000 });
  });
  it('keeps each route with its customers for the detail views', () => {
    expect(m.runs.map((r) => [r.date, r.driver, r.packer, r.customers])).toEqual([['2026-10-13', 'Belred', 'Ann', 2], ['2026-10-14', 'Belred', 'Ann', 1], ['2026-10-14', 'Kirkland', 'Bo', 2 - 1]]);
    const first = m.runs[0];
    expect(first).toMatchObject({ customerMs: 180000, averageMs: 90000, routeMs: 3600000 });
    expect(first.list.map((c) => c.name).sort()).toEqual(['A', 'B']);
    expect(m.runs[1].routeMs).toBe(0); // not finished yet
  });
  it('paused time is not packing time in the route clock', () => {
    const r = run({ pausedMs: 900000, stops: { ...stop('A', 60000) } });
    expect(buildPackingMetrics([r]).routeMs).toBe(3600000 - 900000);
  });
  it('nothing at all', () => {
    const e = buildPackingMetrics([]);
    expect(e).toMatchObject({ routesStarted: 0, customersPacked: 0, averageMs: 0, customersPerHour: 0, days: [], drivers: [], runs: [] });
  });
});
