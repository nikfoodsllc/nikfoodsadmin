import { describe, expect, it } from 'vitest';
import type { PackLine, PackRoute, PackStop } from './packingReport';
import { formatDuration, groupByDay, isTicked, stopMetaOf, lineKeys, packableRoutes, routeLabel, runElapsedMs, runStatus, startIndex, stopCounts, stopElapsedMs, stopKeyOf, summarizeRoute } from './packingProgress';

const line = (over: Partial<PackLine> = {}): PackLine => ({ orderId: 'ORD-1', name: 'Dal', quantity: 1, portion: '12Oz', spice: 'Medium', isEco: false, choices: [], pickedFor: null, day: '2026-10-13', ...over });
const stop = (number: number, over: Partial<PackStop> = {}): PackStop => ({ number, customerName: `C${number}`, address: '', scheduledAt: '', orderIds: [`ORD-${number}`], lines: [line({ orderId: `ORD-${number}` })], empty: false, ...over });

describe('keys', () => {
  it('stopKeyOf is stable and safe for a database field name', () => {
    const k = stopKeyOf(stop(3, { orderIds: ['ORD-1.2', 'ORD-$9'] }));
    expect(k).toBe('s3_ORD-1_2_ORD-_9');
    expect(k).not.toMatch(/[.$]/);
    expect(stopKeyOf(stop(0, { orderIds: [], customerName: 'A B' }))).toBe('u_A_B');
  });
  it('lineKeys tells two identical lines apart and keeps the same key every time', () => {
    const s = stop(1, { lines: [line(), line(), line({ name: 'Rice' })] });
    const keys = lineKeys(s).map((k) => k.key);
    expect(new Set(keys).size).toBe(3);
    expect(lineKeys(s).map((k) => k.key)).toEqual(keys);
  });
});

describe('groupByDay', () => {
  it('groups a customer by menu day, earliest first, keeping every line', () => {
    const s = stop(1, { lines: [line({ day: '2026-10-14', name: 'B' }), line({ day: '2026-10-13', name: 'A' }), line({ day: '2026-10-14', name: 'C' })] });
    const g = groupByDay(s);
    expect(g.map((x) => x.day)).toEqual(['2026-10-13', '2026-10-14']);
    expect(g[1].lines.map((l) => l.line.name)).toEqual(['B', 'C']);
  });
});

describe('packableRoutes', () => {
  const route = (key: string, stops: PackStop[]): PackRoute => ({ key, title: `Route ${key}`, driverName: key === '1' ? 'Belred' : '', vehicle: '', stops });
  it('drops empty stops and routes with nothing to pack, and adds the not-on-a-route group', () => {
    const list = packableRoutes([route('1', [stop(1), stop(2, { empty: true, lines: [] })]), route('2', [stop(1, { empty: true, lines: [] })])], [stop(0, { orderIds: ['ORD-9'] })]);
    expect(list.map((r) => [r.key, r.stops.length])).toEqual([['1', 1], ['unrouted', 1]]);
    expect(routeLabel(list[0])).toBe('Belred');
    expect(routeLabel(list[1])).toBe('Not on a route');
  });
});

describe('counts and times', () => {
  const s = stop(1, { lines: [line(), line({ name: 'Rice' })] });
  const keys = lineKeys(s).map((k) => k.key);
  it('counts only ticks of lines that still exist', () => {
    expect(stopCounts(s, { checked: [keys[0], 'old-line'] })).toEqual({ total: 2, done: 1, complete: false });
    expect(stopCounts(s, { checked: keys })).toEqual({ total: 2, done: 2, complete: true });
    expect(stopCounts(s, undefined).done).toBe(0);
  });
  it('adds the running part to the saved time', () => {
    const now = new Date('2026-10-13T10:00:30Z').getTime();
    expect(stopElapsedMs({ timeMs: 10000, activeSince: '2026-10-13T10:00:00Z' }, now)).toBe(40000);
    expect(stopElapsedMs({ timeMs: 10000, activeSince: null }, now)).toBe(10000);
    expect(stopElapsedMs(undefined, now)).toBe(0);
  });
  it('run time stops at the finish', () => {
    const now = new Date('2026-10-13T11:00:00Z').getTime();
    expect(runElapsedMs({ date: 'd', routeKey: 'r', startedAt: '2026-10-13T10:00:00Z' }, now)).toBe(3600000);
    expect(runElapsedMs({ date: 'd', routeKey: 'r', startedAt: '2026-10-13T10:00:00Z', finishedAt: '2026-10-13T10:30:00Z' }, now)).toBe(1800000);
    expect(runElapsedMs(null, now)).toBe(0);
  });
  it('the route clock leaves out paused time, also while paused', () => {
    const now = new Date('2026-10-13T11:00:00Z').getTime();
    const base = { date: 'd', routeKey: 'r', startedAt: '2026-10-13T10:00:00Z' };
    expect(runElapsedMs({ ...base, pausedMs: 600000 }, now)).toBe(3000000);
    expect(runElapsedMs({ ...base, pausedMs: 600000, pausedAt: '2026-10-13T10:50:00Z' }, now)).toBe(3600000 - 600000 - 600000);
    expect(runElapsedMs({ ...base, pausedMs: 600000, finishedAt: '2026-10-13T10:30:00Z' }, now)).toBe(1800000 - 600000);
  });
  it('formats durations', () => {
    expect(formatDuration(0)).toBe('0:00');
    expect(formatDuration(65000)).toBe('1:05');
    expect(formatDuration(3725000)).toBe('1:02:05');
    expect(formatDuration(-5)).toBe('0:00');
  });
  it('status', () => {
    expect(runStatus(null)).toBe('not_started');
    expect(runStatus({ date: 'd', routeKey: 'r', startedAt: 'x' })).toBe('packing');
    expect(runStatus({ date: 'd', routeKey: 'r', startedAt: 'x', finishedAt: 'y' })).toBe('done');
    expect(runStatus({ date: 'd', routeKey: 'r', startedAt: 'x', pausedAt: 'p' })).toBe('paused');
    expect(runStatus({ date: 'd', routeKey: 'r', startedAt: 'x', pausedAt: 'p', finishedAt: 'y' })).toBe('done');
  });
});

describe('summarizeRoute and startIndex', () => {
  const s1 = stop(1);
  const s2 = stop(2);
  const route = { key: '1', title: 'Route 1', driverName: 'Belred', stops: [s1, s2] };
  const k1 = stopKeyOf(s1);
  const k2 = stopKeyOf(s2);
  it('counts packed customers and averages only the customers that took time', () => {
    const run = { date: 'd', routeKey: '1', startedAt: 'x', stops: { [k1]: { checked: lineKeys(s1).map((k) => k.key), timeMs: 120000 }, [k2]: { checked: [], timeMs: 0 } } };
    const sum = summarizeRoute(route, run, Date.now());
    expect(sum).toMatchObject({ customers: 2, complete: 1, packed: 1, units: 2, totalMs: 120000, averageMs: 120000 });
    expect(sum.slowest?.stopKey).toBe(k1);
  });
  it('starts on the saved customer, else the first one not finished', () => {
    expect(startIndex(route, { date: 'd', routeKey: '1', currentStopKey: k2 })).toBe(1);
    expect(startIndex(route, { date: 'd', routeKey: '1', stops: { [k1]: { checked: lineKeys(s1).map((k) => k.key) } } })).toBe(1);
    expect(startIndex(route, null)).toBe(0);
  });
});

describe('combos are split into their own items', () => {
  const combo = line({ name: 'Veg Combo', quantity: 2, portion: null, spice: 'Medium', isEco: true, choices: ['Curry: Kale Chane (12Oz)'], parts: [
    { name: 'Kale Chane', portion: '12Oz', spice: 'Medium', isEco: true },
    { name: 'Chapati', portion: null, spice: null, isEco: false },
  ] });
  const s = stop(1, { lines: [line({ name: 'Rajma' }), combo] });
  it('each option is an item with the combo quantity, keyed under the combo', () => {
    const items = lineKeys(s);
    expect(items.map((i) => i.line.name)).toEqual(['Rajma', 'Kale Chane', 'Chapati']);
    expect(items[1]).toMatchObject({ viaCombo: 'Veg Combo', line: { quantity: 2, portion: '12Oz', spice: 'Medium', isEco: true } });
    expect(items[2].line).toMatchObject({ quantity: 2, spice: null, isEco: false });
    expect(items[1].parentKey).toBeDefined();
    expect(items[1].key.startsWith(items[1].parentKey!)).toBe(true);
    expect(new Set(items.map((i) => i.key)).size).toBe(3);
  });
  it('counts, units and snapshot use the split items', () => {
    expect(stopCounts(s, undefined)).toEqual({ total: 3, done: 0, complete: false });
    expect(stopMetaOf(s)).toMatchObject({ lines: 3, units: 1 + 2 + 2 });
  });
  it('a combo ticked as one line before the split counts its options as ticked', () => {
    const items = lineKeys(s);
    const oldKey = items[1].parentKey!;
    expect(stopCounts(s, { checked: [oldKey] }).done).toBe(2);
    expect(isTicked(items[2], new Set([oldKey]))).toBe(true);
    expect(isTicked(items[0], new Set([oldKey]))).toBe(false);
  });
  it('a combo with no parts saved stays one item', () => {
    const plain = stop(1, { lines: [line({ name: 'Veg Combo', choices: ['x'] })] });
    expect(lineKeys(plain).length).toBe(1);
  });
});
