import { describe, expect, it } from 'vitest';
import type { PackingRun } from './packingProgress';
import { buildPackingMetrics, median, packedCustomers, statOf } from './packingMetrics';

const stop = (name: string, lines: number, ticked: number, ms: number, units = lines): PackingRun['stops'] => ({
  [name]: { checked: Array.from({ length: ticked }, (_, i) => `l${i}`), timeMs: ms, meta: { name, units, lines, orderIds: [`ORD-${name}`] } },
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
  it('keeps only customers with every line ticked and some time, and skips ones without a snapshot', () => {
    const r = run({ stops: { ...stop('A', 2, 2, 60000), ...stop('B', 3, 1, 30000), ...stop('C', 1, 1, 0), x: { checked: ['l0'], timeMs: 5000 } } });
    expect(packedCustomers(r).map((c) => c.name)).toEqual(['A']);
  });
});

describe('buildPackingMetrics', () => {
  const r1 = run({ stops: { ...stop('A', 2, 2, 60000, 4), ...stop('B', 1, 1, 120000, 2), ...stop('C', 2, 1, 30000, 3) } });
  const r2 = run({ date: '2026-10-14', routeKey: 'r2', driverName: 'Kirkland', startedBy: 'Bo', startedAt: '2026-10-14T10:00:00Z', finishedAt: '2026-10-14T10:30:00Z', stops: { ...stop('D', 1, 1, 90000, 3) } });
  const r3 = run({ date: '2026-10-14', routeKey: 'r3', driverName: 'Belred', finishedAt: null, stops: { ...stop('E', 1, 1, 45000, 1) } });
  const m = buildPackingMetrics([r1, r2, r3]);
  it('counts routes', () => expect([m.routesStarted, m.routesFinished, m.routesInProgress]).toEqual([3, 2, 1]));
  it('averages only packed customers', () => {
    expect(m.customersPacked).toBe(4); // A B D E
    expect(m.customersSkipped).toBe(1); // C
    expect(m.customerMs).toBe(60000 + 120000 + 90000 + 45000);
    expect(m.averageMs).toBe(78750);
    expect(m.medianMs).toBe(75000);
    expect(m.units).toBe(4 + 2 + 3 + 1);
    expect(m.secondsPerUnit).toBe(31.5);
    expect(m.customersPerHour).toBe(45.7);
  });
  it('route clock and time between customers use finished routes only', () => {
    expect(m.routeMs).toBe(3600000 + 1800000);
    // time on customers inside finished routes: A+B+C = 210000, D = 90000
    expect(m.betweenMs).toBe(5400000 - 300000);
  });
  it('groups by day and by driver', () => {
    expect(m.days.map((d) => [d.date, d.routes, d.customers])).toEqual([['2026-10-13', 1, 2], ['2026-10-14', 2, 2]]);
    expect(m.drivers.find((d) => d.driver === 'Belred')).toMatchObject({ routes: 2, customers: 3, customerMs: 225000, averageMs: 75000 });
    expect(m.packers).toEqual([{ name: 'Ann', routes: 2 }, { name: 'Bo', routes: 1 }]);
  });
  it('slowest and fastest', () => {
    expect(m.slowest.map((c) => c.name)).toEqual(['B', 'D', 'A', 'E']);
    expect(m.fastest[0].name).toBe('E');
  });
  it('nothing at all', () => {
    const e = buildPackingMetrics([]);
    expect(e).toMatchObject({ routesStarted: 0, customersPacked: 0, averageMs: 0, medianMs: 0, secondsPerUnit: 0, customersPerHour: 0, days: [], drivers: [] });
  });
});
