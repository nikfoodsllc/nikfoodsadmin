/**
 * Live packing: the helpers behind "Pack live". The team packs one driver's route customer by customer, ticks each item and
 * moves on; the time spent on every customer is kept. Pure functions (no database, no network) so they can be checked alone.
 *
 * A saved run (`packingRuns`, one per delivery date + route) looks like:
 *   { date, routeKey, driverName, startedAt, startedBy, finishedAt, currentStopKey,
 *     stops: { [stopKey]: { checked: lineKey[], timeMs, activeSince, firstOpenedAt } } }
 */
import type { PackLine, PackRoute, PackStop } from './packingReport';

/** The route that holds customers who are on no driver's route */
export const UNROUTED_KEY = 'unrouted';

export interface StopProgress {
  checked?: string[];
  /** Time already spent on this customer when the packer left it (milliseconds) */
  timeMs?: number;
  /** Set while this customer is the one being packed: when the packer arrived (ISO) */
  activeSince?: string | null;
  firstOpenedAt?: string | null;
}

export interface PackingRun {
  date: string;
  routeKey: string;
  driverName?: string;
  startedAt?: string | null;
  startedBy?: string | null;
  finishedAt?: string | null;
  currentStopKey?: string | null;
  stops?: Record<string, StopProgress>;
}

/** What the screen packs for one route: the customers in route order, nothing empty. */
export interface PackableRoute {
  key: string;
  title: string;
  driverName: string;
  stops: PackStop[];
}

const clean = (v: unknown) => String(v ?? '').replace(/\s+/g, ' ').trim();

/** A key that is safe to use as a field name in the database (no dots, no $) and stays the same for the same customer. */
export function stopKeyOf(stop: PackStop): string {
  const base = stop.number > 0 ? `s${stop.number}` : 'u';
  const ids = stop.orderIds.join('_') || clean(stop.customerName);
  return `${base}_${ids}`.replace(/[^A-Za-z0-9_-]/g, '_').slice(0, 120);
}

/** The routes this screen can pack: every driver's route plus one for customers on no route; stops with nothing to pack are left out. */
export function packableRoutes(routes: PackRoute[], unrouted: PackStop[]): PackableRoute[] {
  const list: PackableRoute[] = routes
    .map((r) => ({ key: r.key, title: r.title, driverName: r.driverName, stops: r.stops.filter((s) => !s.empty && s.lines.length > 0) }))
    .filter((r) => r.stops.length > 0);
  const loose = unrouted.filter((s) => s.lines.length > 0);
  if (loose.length > 0) list.push({ key: UNROUTED_KEY, title: 'Not on a route', driverName: '', stops: loose });
  return list;
}

/** The name shown on the driver button: the driver, else "Route 1". */
export function routeLabel(route: { title: string; driverName: string }): string {
  return clean(route.driverName) || route.title;
}

export interface KeyedLine {
  key: string;
  line: PackLine;
}

/** One key per line of a customer: the same line always gets the same key (two identical lines are told apart by a counter). */
export function lineKeys(stop: PackStop): KeyedLine[] {
  const seen = new Map<string, number>();
  return stop.lines.map((line) => {
    const base = [line.orderId, line.day, line.name, line.portion ?? '', line.spice ?? '', line.isEco ? 'eco' : '', line.choices.join('+')].join('|');
    const n = (seen.get(base) ?? 0) + 1;
    seen.set(base, n);
    return { key: n === 1 ? base : `${base}#${n}`, line };
  });
}

export interface DayGroup {
  day: string;
  lines: KeyedLine[];
}

/** A customer's lines grouped by the menu day they were picked for, earliest day first (Tuesday, then Wednesday ...). */
export function groupByDay(stop: PackStop): DayGroup[] {
  const groups = new Map<string, KeyedLine[]>();
  for (const item of lineKeys(stop)) {
    const day = item.line.day || '';
    groups.set(day, [...(groups.get(day) ?? []), item]);
  }
  return [...groups.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([day, lines]) => ({ day, lines }));
}

export interface StopCounts {
  total: number;
  done: number;
  complete: boolean;
}

/** How many of a customer's lines are ticked. Ticks of lines that no longer exist (the order changed) are ignored. */
export function stopCounts(stop: PackStop, progress: StopProgress | undefined): StopCounts {
  const keys = lineKeys(stop).map((k) => k.key);
  const checked = new Set(progress?.checked ?? []);
  const done = keys.filter((k) => checked.has(k)).length;
  return { total: keys.length, done, complete: keys.length > 0 && done === keys.length };
}

/** Time spent on a customer so far in milliseconds: what was saved plus the running part when the packer is on it now. */
export function stopElapsedMs(progress: StopProgress | undefined, nowMs: number): number {
  const saved = Math.max(0, Number(progress?.timeMs) || 0);
  const since = progress?.activeSince ? new Date(progress.activeSince).getTime() : NaN;
  return saved + (Number.isFinite(since) ? Math.max(0, nowMs - since) : 0);
}

/** Time since the packing of the route started, stopped at the end time once finished. */
export function runElapsedMs(run: PackingRun | undefined | null, nowMs: number): number {
  const start = run?.startedAt ? new Date(run.startedAt).getTime() : NaN;
  if (!Number.isFinite(start)) return 0;
  const end = run?.finishedAt ? new Date(run.finishedAt).getTime() : nowMs;
  return Math.max(0, end - start);
}

/** 65000 -> "1:05", 3725000 -> "1:02:05" */
export function formatDuration(ms: number): string {
  const total = Math.max(0, Math.floor((Number(ms) || 0) / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const two = (n: number) => String(n).padStart(2, '0');
  return h > 0 ? `${h}:${two(m)}:${two(s)}` : `${m}:${two(s)}`;
}

export type RunStatus = 'not_started' | 'packing' | 'done';

export function runStatus(run: PackingRun | undefined | null): RunStatus {
  if (!run?.startedAt) return 'not_started';
  return run.finishedAt ? 'done' : 'packing';
}

export interface RouteSummary {
  customers: number;
  packed: number;
  /** Customers with every item ticked */
  complete: number;
  units: number;
  totalMs: number;
  averageMs: number;
  slowest: { stopKey: string; ms: number } | null;
}

/** The totals shown for a route: how many customers are fully packed, and how long it took (only customers that were opened count in the average). */
export function summarizeRoute(route: PackableRoute, run: PackingRun | undefined | null, nowMs: number): RouteSummary {
  let complete = 0;
  let packed = 0;
  let units = 0;
  let totalMs = 0;
  let timed = 0;
  let slowest: RouteSummary['slowest'] = null;
  for (const stop of route.stops) {
    const key = stopKeyOf(stop);
    const progress = run?.stops?.[key];
    const counts = stopCounts(stop, progress);
    units += stop.lines.reduce((n, l) => n + l.quantity, 0);
    if (counts.complete) complete += 1;
    if (counts.done > 0) packed += 1;
    const ms = stopElapsedMs(progress, nowMs);
    if (ms > 0) {
      totalMs += ms;
      timed += 1;
      if (!slowest || ms > slowest.ms) slowest = { stopKey: key, ms };
    }
  }
  return { customers: route.stops.length, packed, complete, units, totalMs, averageMs: timed > 0 ? Math.round(totalMs / timed) : 0, slowest };
}

/** Where to start packing: the saved current customer, else the first one not yet complete, else the first. */
export function startIndex(route: PackableRoute, run: PackingRun | undefined | null): number {
  const keys = route.stops.map(stopKeyOf);
  const saved = run?.currentStopKey ? keys.indexOf(run.currentStopKey) : -1;
  if (saved >= 0) return saved;
  const open = route.stops.findIndex((s) => !stopCounts(s, run?.stops?.[stopKeyOf(s)]).complete);
  return open >= 0 ? open : 0;
}
