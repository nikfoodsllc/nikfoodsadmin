/**
 * Packing time metrics, worked out from the saved packing runs ("Pack live"). Pure functions: no database, no network.
 *
 * What counts:
 *  - a customer is PACKED when every item line was ticked; only packed customers go into the averages, so a customer who was
 *    just skipped through in a second does not make the team look fast
 *  - the time of a customer is the time it was on screen (summed over visits), not counting the customer being packed right now
 *  - the ROUTE CLOCK is the time from Start packing to Finish packing; what is not spent on a customer is "between customers"
 *    (breaks, waiting, walking to the shelf)
 */
import type { PackingRun } from './packingProgress';

export interface CustomerTime {
  date: string;
  driver: string;
  name: string;
  orderIds: string[];
  units: number;
  lines: number;
  ms: number;
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

export interface PackingMetrics {
  routesStarted: number;
  routesFinished: number;
  routesInProgress: number;
  /** Customers with every item ticked */
  customersPacked: number;
  /** Customers opened but not fully ticked */
  customersSkipped: number;
  units: number;
  customerMs: number;
  averageMs: number;
  medianMs: number;
  /** Seconds per unit (item quantity) over packed customers; 0 when unknown */
  secondsPerUnit: number;
  customersPerHour: number;
  /** Route clock of finished routes */
  routeMs: number;
  /** Route clock of finished routes minus the time on customers: breaks, waiting, walking */
  betweenMs: number;
  days: DayMetrics[];
  drivers: DriverMetrics[];
  packers: Array<{ name: string; routes: number }>;
  slowest: CustomerTime[];
  fastest: CustomerTime[];
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

/** The packed customers of a run (every line ticked, with a snapshot and some time on them). */
export function packedCustomers(run: PackingRun): CustomerTime[] {
  const list: CustomerTime[] = [];
  for (const progress of Object.values(run.stops ?? {})) {
    const meta = progress.meta;
    if (!meta || meta.lines <= 0) continue;
    const ms = Math.max(0, num(progress.timeMs));
    if ((progress.checked?.length ?? 0) < meta.lines || ms <= 0) continue;
    list.push({ date: run.date, driver: run.driverName || run.routeKey, name: meta.name, orderIds: meta.orderIds ?? [], units: meta.units, lines: meta.lines, ms });
  }
  return list;
}

/** Customers that were opened (time spent or something ticked) but not fully ticked. */
function skippedCount(run: PackingRun): number {
  let n = 0;
  for (const progress of Object.values(run.stops ?? {})) {
    const meta = progress.meta;
    if (!meta || meta.lines <= 0) continue;
    const opened = num(progress.timeMs) > 0 || (progress.checked?.length ?? 0) > 0;
    if (opened && (progress.checked?.length ?? 0) < meta.lines) n += 1;
  }
  return n;
}

const clockMs = (run: PackingRun) => {
  const start = run.startedAt ? new Date(run.startedAt).getTime() : NaN;
  const end = run.finishedAt ? new Date(run.finishedAt).getTime() : NaN;
  return Number.isFinite(start) && Number.isFinite(end) ? Math.max(0, end - start) : 0;
};

/** Everything the metrics page shows for the runs of a date range (the caller passes only the runs inside the range). */
export function buildPackingMetrics(runs: PackingRun[], topCount = 10): PackingMetrics {
  const started = runs.filter((r) => r.startedAt);
  const finished = started.filter((r) => r.finishedAt);
  const all: CustomerTime[] = [];
  const byDay = new Map<string, { runs: PackingRun[]; customers: CustomerTime[] }>();
  const byDriver = new Map<string, { runs: PackingRun[]; customers: CustomerTime[] }>();
  const packers = new Map<string, number>();
  let skipped = 0;
  for (const run of started) {
    const customers = packedCustomers(run);
    all.push(...customers);
    skipped += skippedCount(run);
    const day = byDay.get(run.date) ?? { runs: [], customers: [] };
    day.runs.push(run);
    day.customers.push(...customers);
    byDay.set(run.date, day);
    const driverKey = run.driverName || run.routeKey;
    const drv = byDriver.get(driverKey) ?? { runs: [], customers: [] };
    drv.runs.push(run);
    drv.customers.push(...customers);
    byDriver.set(driverKey, drv);
    if (run.startedBy) packers.set(run.startedBy, (packers.get(run.startedBy) ?? 0) + 1);
  }
  const times = all.map((c) => c.ms);
  const stat = statOf(times);
  const units = all.reduce((n, c) => n + c.units, 0);
  const routeMs = finished.reduce((n, r) => n + clockMs(r), 0);
  // the time on customers inside finished routes only, so the comparison with the route clock is fair
  const finishedCustomerMs = finished.reduce((n, r) => n + Object.values(r.stops ?? {}).reduce((m, p) => m + Math.max(0, num(p.timeMs)), 0), 0);
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
    customersSkipped: skipped,
    units,
    customerMs: stat.totalMs,
    averageMs: stat.averageMs,
    medianMs: stat.medianMs,
    secondsPerUnit: units > 0 ? Math.round((stat.totalMs / units / 1000) * 10) / 10 : 0,
    customersPerHour: hours > 0 ? Math.round((all.length / hours) * 10) / 10 : 0,
    routeMs,
    betweenMs: Math.max(0, routeMs - finishedCustomerMs),
    days: [...byDay.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, v]) => ({ date, ...summarize(v.runs, v.customers), finishedRoutes: v.runs.filter((r) => r.finishedAt).length })),
    drivers: [...byDriver.entries()].map(([driver, v]) => ({ driver, ...summarize(v.runs, v.customers) })).sort((a, b) => a.driver.localeCompare(b.driver, undefined, { numeric: true })),
    packers: [...packers.entries()].map(([name, routes]) => ({ name, routes })).sort((a, b) => b.routes - a.routes || a.name.localeCompare(b.name)),
    slowest: [...all].sort((a, b) => b.ms - a.ms).slice(0, topCount),
    fastest: [...all].sort((a, b) => a.ms - b.ms).slice(0, topCount),
  };
}
