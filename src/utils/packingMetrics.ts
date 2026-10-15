/**
 * Packing time metrics, worked out from the saved packing runs ("Packing Planner"). Pure functions: no database, no network.
 *
 * What counts:
 *  - a customer counts when the packer spent at least 10 seconds on it (a tap through by mistake does not). The checkboxes are gone,
 *    so there is no "fully ticked" any more; the last customer of a route gets the average of the others automatically (marked auto)
 *  - the time of a customer is the time it was on screen (summed over visits), not counting the customer being packed right now
 *  - the ROUTE CLOCK is the time from Start packing to the end of the route (the last customer's average time included)
 */
import type { PackingRun } from './packingProgress';

/** A customer needs at least this much time on it to count (milliseconds). Same value the server uses for the average. */
export const MIN_COUNTED_MS = 10_000;

export interface CustomerTime {
  date: string;
  driver: string;
  name: string;
  orderIds: string[];
  units: number;
  lines: number;
  ms: number;
  /** The time was filled in with the route's average because the last customer is never moved on from */
  auto: boolean;
  /** When the packer first opened this customer (ISO), to list the customers in the order they were packed */
  openedAt: string;
}

export interface Stat {
  count: number;
  totalMs: number;
  averageMs: number;
  medianMs: number;
}

export interface DayMetrics {
  date: string;
  routes: number;
  finishedRoutes: number;
  customers: number;
  units: number;
  customerMs: number;
  averageMs: number;
  /** Route clock of the finished routes */
  routeMs: number;
}

export interface DriverMetrics {
  driver: string;
  routes: number;
  customers: number;
  units: number;
  customerMs: number;
  averageMs: number;
  routeMs: number;
}

/** One route that was packed (one driver on one delivery date), with its customers: what the detail views open. */
export interface RunSummary {
  date: string;
  routeKey: string;
  driver: string;
  packer: string;
  startedAt: string | null;
  finishedAt: string | null;
  customers: number;
  units: number;
  customerMs: number;
  averageMs: number;
  /** Route clock; 0 until the route is finished */
  routeMs: number;
  list: CustomerTime[];
}

export interface PackingMetrics {
  routesStarted: number;
  routesFinished: number;
  routesInProgress: number;
  customersPacked: number;
  units: number;
  customerMs: number;
  averageMs: number;
  customersPerHour: number;
  /** Route clock of finished routes */
  routeMs: number;
  days: DayMetrics[];
  drivers: DriverMetrics[];
  runs: RunSummary[];
}

const num = (v: unknown) => (Number.isFinite(Number(v)) ? Number(v) : 0);

export function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : Math.round((sorted[mid - 1] + sorted[mid]) / 2);
}

export function statOf(values: number[]): Stat {
  const totalMs = values.reduce((n, v) => n + v, 0);
  return { count: values.length, totalMs, averageMs: values.length ? Math.round(totalMs / values.length) : 0, medianMs: median(values) };
}

/** The customers of a run that count: they have a snapshot and at least 10 seconds on them, in the order they were opened. */
export function packedCustomers(run: PackingRun): CustomerTime[] {
  const list: CustomerTime[] = [];
  for (const progress of Object.values(run.stops ?? {})) {
    const meta = progress.meta;
    if (!meta) continue;
    const ms = Math.max(0, num(progress.timeMs));
    if (ms < MIN_COUNTED_MS) continue;
    list.push({ date: run.date, driver: run.driverName || run.routeKey, name: meta.name, orderIds: meta.orderIds ?? [], units: meta.units, lines: meta.lines, ms, auto: Boolean(progress.auto), openedAt: progress.firstOpenedAt ?? '' });
  }
  return list.sort((a, b) => a.openedAt.localeCompare(b.openedAt) || a.name.localeCompare(b.name));
}

const clockMs = (run: PackingRun) => {
  const start = run.startedAt ? new Date(run.startedAt).getTime() : NaN;
  const end = run.finishedAt ? new Date(run.finishedAt).getTime() : NaN;
  // time the route was paused (Stop packing) is not packing time
  return Number.isFinite(start) && Number.isFinite(end) ? Math.max(0, end - start - Math.max(0, num(run.pausedMs))) : 0;
};

/** Everything the packing times page shows for the runs of a date range (the caller passes only the runs inside the range). */
export function buildPackingMetrics(runs: PackingRun[]): PackingMetrics {
  const started = runs.filter((r) => r.startedAt);
  const finished = started.filter((r) => r.finishedAt);
  const all: CustomerTime[] = [];
  const byDay = new Map<string, { runs: PackingRun[]; customers: CustomerTime[] }>();
  const byDriver = new Map<string, { runs: PackingRun[]; customers: CustomerTime[] }>();
  const summaries: RunSummary[] = [];
  for (const run of started) {
    const customers = packedCustomers(run);
    all.push(...customers);
    const day = byDay.get(run.date) ?? { runs: [], customers: [] };
    day.runs.push(run);
    day.customers.push(...customers);
    byDay.set(run.date, day);
    const driverKey = run.driverName || run.routeKey;
    const drv = byDriver.get(driverKey) ?? { runs: [], customers: [] };
    drv.runs.push(run);
    drv.customers.push(...customers);
    byDriver.set(driverKey, drv);
    const customerMs = customers.reduce((n, c) => n + c.ms, 0);
    summaries.push({
      date: run.date,
      routeKey: run.routeKey,
      driver: driverKey,
      packer: run.startedBy ?? '',
      startedAt: run.startedAt ?? null,
      finishedAt: run.finishedAt ?? null,
      customers: customers.length,
      units: customers.reduce((n, c) => n + c.units, 0),
      customerMs,
      averageMs: customers.length ? Math.round(customerMs / customers.length) : 0,
      routeMs: run.finishedAt ? clockMs(run) : 0,
      list: customers,
    });
  }
  const stat = statOf(all.map((c) => c.ms));
  const units = all.reduce((n, c) => n + c.units, 0);
  const hours = stat.totalMs / 3600000;
  const summarize = (list: PackingRun[], customers: CustomerTime[]) => {
    const t = customers.reduce((n, c) => n + c.ms, 0);
    return {
      routes: list.length,
      customers: customers.length,
      units: customers.reduce((n, c) => n + c.units, 0),
      customerMs: t,
      averageMs: customers.length ? Math.round(t / customers.length) : 0,
      routeMs: list.filter((r) => r.finishedAt).reduce((n, r) => n + clockMs(r), 0),
    };
  };
  return {
    routesStarted: started.length,
    routesFinished: finished.length,
    routesInProgress: started.length - finished.length,
    customersPacked: all.length,
    units,
    customerMs: stat.totalMs,
    averageMs: stat.averageMs,
    customersPerHour: hours > 0 ? Math.round((all.length / hours) * 10) / 10 : 0,
    routeMs: finished.reduce((n, r) => n + clockMs(r), 0),
    days: [...byDay.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, v]) => ({ date, ...summarize(v.runs, v.customers), finishedRoutes: v.runs.filter((r) => r.finishedAt).length })),
    drivers: [...byDriver.entries()].map(([driver, v]) => ({ driver, ...summarize(v.runs, v.customers) })).sort((a, b) => a.driver.localeCompare(b.driver, undefined, { numeric: true })),
    runs: summaries.sort((a, b) => a.date.localeCompare(b.date) || a.driver.localeCompare(b.driver, undefined, { numeric: true })),
  };
}
