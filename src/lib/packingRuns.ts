import type { Collection } from 'mongodb';
import type { PackingRun, StopMeta } from '@/utils/packingProgress';
import { MIN_COUNTED_MS } from '@/utils/packingMetrics';

/**
 * The saved packing runs ("Packing Planner"): one document per delivery date and route in `packingRuns`. Every change is one small
 * atomic update, so two people packing different customers at the same time never overwrite each other.
 */
export const RUNS = 'packingRuns';

type Doc = PackingRun & { _id?: unknown; updatedAt?: Date };

const SAFE_KEY = /^[A-Za-z0-9_-]{1,120}$/;
export const isSafeKey = (v: unknown): v is string => typeof v === 'string' && SAFE_KEY.test(v);

/** Moves the clock of the customer the packer was on into its saved time (a $set fragment). */
function closeCurrent(run: Doc, now: Date): Record<string, unknown> {
  const key = run.currentStopKey;
  if (!key) return {};
  const progress = run.stops?.[key];
  const since = progress?.activeSince ? new Date(progress.activeSince).getTime() : NaN;
  const add = Number.isFinite(since) ? Math.max(0, now.getTime() - since) : 0;
  return { [`stops.${key}.timeMs`]: (Number(progress?.timeMs) || 0) + add, [`stops.${key}.activeSince`]: null };
}

/** Checks what the browser sent as a customer's snapshot; anything odd is dropped (the times are still kept). */
export function cleanMeta(raw: unknown): StopMeta | undefined {
  if (!raw || typeof raw !== 'object') return undefined;
  const m = raw as Record<string, unknown>;
  const num = (v: unknown, max: number) => (typeof v === 'number' && Number.isInteger(v) && v >= 0 && v <= max ? v : null);
  const units = num(m.units, 5000);
  const lines = num(m.lines, 1000);
  if (typeof m.name !== 'string' || units === null || lines === null) return undefined;
  const orderIds = Array.isArray(m.orderIds) ? m.orderIds.filter((x): x is string => typeof x === 'string' && x.length <= 60).slice(0, 10) : [];
  return { name: m.name.replace(/\s+/g, ' ').trim().slice(0, 120), units, lines, orderIds };
}

export function cleanTotals(raw: unknown): { customers: number; units: number } | null {
  if (!raw || typeof raw !== 'object') return null;
  const m = raw as Record<string, unknown>;
  const ok = (v: unknown) => typeof v === 'number' && Number.isInteger(v) && v >= 0 && v <= 20000;
  return ok(m.customers) && ok(m.units) ? { customers: m.customers as number, units: m.units as number } : null;
}

const clean = (run: Doc | null): Doc | null => {
  if (!run) return null;
  const { _id, ...rest } = run;
  void _id;
  return rest;
};

export async function ensureIndex(c: Collection<Doc>) {
  await c.createIndex({ date: 1, routeKey: 1 }, { unique: true }).catch(() => undefined);
}

export async function listRuns(c: Collection<Doc>, date: string): Promise<Doc[]> {
  return (await c.find({ date }).toArray()).map((r) => clean(r) as Doc);
}

export async function listRunsBetween(c: Collection<Doc>, from: string, to: string): Promise<Doc[]> {
  return (await c.find({ date: { $gte: from, $lte: to } }).toArray()).map((r) => clean(r) as Doc);
}

export async function startRun(c: Collection<Doc>, p: { date: string; routeKey: string; driverName: string; firstStopKey: string; by: string; totals?: { customers: number; units: number } | null; firstMeta?: StopMeta }, now: Date): Promise<Doc | null> {
  const existing = await c.findOne({ date: p.date, routeKey: p.routeKey });
  if (existing?.startedAt && !existing.finishedAt) return clean(existing);
  const first = `stops.${p.firstStopKey}`;
  const metaSet: Record<string, unknown> = { ...(p.firstMeta ? { [`${first}.meta`]: p.firstMeta } : {}), ...(p.totals ? { totals: p.totals } : {}) };
  if (existing) {
    // packing again after a finished run: the ticks stay, the clock restarts at this customer
    await c.updateOne(
      { date: p.date, routeKey: p.routeKey },
      { $set: { startedAt: existing.startedAt ?? now.toISOString(), finishedAt: null, pausedAt: null, currentStopKey: p.firstStopKey, [`${first}.activeSince`]: now.toISOString(), updatedAt: now, driverName: p.driverName, ...metaSet } }
    );
  } else {
    await c
      .updateOne(
        { date: p.date, routeKey: p.routeKey },
        { $setOnInsert: { date: p.date, routeKey: p.routeKey, driverName: p.driverName, startedAt: now.toISOString(), startedBy: p.by, finishedAt: null, currentStopKey: p.firstStopKey, stops: { [p.firstStopKey]: { checked: [], timeMs: 0, activeSince: now.toISOString(), firstOpenedAt: now.toISOString(), ...(p.firstMeta ? { meta: p.firstMeta } : {}) } }, totals: p.totals ?? null, updatedAt: now } },
        { upsert: true }
      )
      .catch(() => undefined); // two taps at once: the other one created it
  }
  return clean(await c.findOne({ date: p.date, routeKey: p.routeKey }));
}

/** Ticks or unticks lines of one customer. False when the run has not been started. */
export async function setChecked(c: Collection<Doc>, p: { date: string; routeKey: string; stopKey: string; lineKeys: string[]; checked: boolean }, now: Date): Promise<Doc | null | false> {
  // not while paused: Resume first
  const filter = { date: p.date, routeKey: p.routeKey, startedAt: { $ne: null }, finishedAt: null, pausedAt: null };
  const field = `stops.${p.stopKey}.checked`;
  const update = p.checked ? { $addToSet: { [field]: { $each: p.lineKeys } }, $set: { updatedAt: now } } : { $pull: { [field]: { $in: p.lineKeys } }, $set: { updatedAt: now } };
  const result = await c.updateOne(filter, update as never);
  if (result.matchedCount === 0) return false;
  return clean(await c.findOne({ date: p.date, routeKey: p.routeKey }));
}


/**
 * The time the LAST customer is given when the packers never press Finish: the average of the other customers that were timed.
 * 0 when there is nothing to average (then the route is left for the packer to finish by hand).
 */
export function averageOfOthers(run: Pick<Doc, 'stops'>, lastStopKey: string): number {
  const times = Object.entries(run.stops ?? {})
    .filter(([key]) => key !== lastStopKey)
    .map(([, progress]) => Math.max(0, Number(progress?.timeMs) || 0))
    .filter((ms) => ms >= MIN_COUNTED_MS);
  return times.length > 0 ? Math.round(times.reduce((n, ms) => n + ms, 0) / times.length) : 0;
}

/**
 * Moves to another customer: the time of the one being left is saved, the clock of the new one starts.
 * `finishIfLast`: the new customer is the last of the route. Nobody presses Finish for it, so it gets the average time of the other
 * customers, its clock stops, and the route is finished with that time added (the route's end is the arrival plus that average).
 * Without any timed customer to average the route stays open and the packer finishes it by hand.
 */
export async function goToStop(c: Collection<Doc>, p: { date: string; routeKey: string; toStopKey: string; meta?: StopMeta; finishIfLast?: boolean }, now: Date): Promise<Doc | null | false> {
  for (let attempt = 0; attempt < 3; attempt++) {
    const run = await c.findOne({ date: p.date, routeKey: p.routeKey });
    if (!run?.startedAt) return false;
    if (run.finishedAt || run.pausedAt || run.currentStopKey === p.toStopKey) return clean(run);
    const to = `stops.${p.toStopKey}`;
    const set: Record<string, unknown> = { ...closeCurrent(run, now), currentStopKey: p.toStopKey, [`${to}.activeSince`]: now.toISOString(), updatedAt: now };
    if (!run.stops?.[p.toStopKey]?.firstOpenedAt) set[`${to}.firstOpenedAt`] = now.toISOString();
    if (p.meta) set[`${to}.meta`] = p.meta;
    const result = await c.updateOne({ date: p.date, routeKey: p.routeKey, currentStopKey: run.currentStopKey ?? null, finishedAt: null }, { $set: set });
    if (result.matchedCount > 0) break; // otherwise someone else moved first: read again
  }
  if (p.finishIfLast) {
    const run = await c.findOne({ date: p.date, routeKey: p.routeKey });
    if (run?.startedAt && !run.finishedAt && !run.pausedAt && run.currentStopKey === p.toStopKey) {
      const average = averageOfOthers(run, p.toStopKey);
      if (average > 0) {
        const to = `stops.${p.toStopKey}`;
        await c.updateOne(
          { date: p.date, routeKey: p.routeKey, currentStopKey: p.toStopKey, finishedAt: null },
          { $set: { [`${to}.timeMs`]: average, [`${to}.activeSince`]: null, [`${to}.auto`]: true, finishedAt: new Date(now.getTime() + average).toISOString(), currentStopKey: null, pausedAt: null, updatedAt: now } }
        );
      }
    }
  }
  return clean(await c.findOne({ date: p.date, routeKey: p.routeKey }));
}

export async function finishRun(c: Collection<Doc>, p: { date: string; routeKey: string }, now: Date): Promise<Doc | null | false> {
  for (let attempt = 0; attempt < 3; attempt++) {
    const run = await c.findOne({ date: p.date, routeKey: p.routeKey });
    if (!run?.startedAt) return false;
    if (run.finishedAt) return clean(run);
    const set: Record<string, unknown> = { ...closeCurrent(run, now), finishedAt: now.toISOString(), currentStopKey: null, pausedAt: null, updatedAt: now };
    if (run.pausedAt) set.pausedMs = (Number(run.pausedMs) || 0) + pausedFor(run, now); // finishing while paused: the pause ends here
    const result = await c.updateOne({ date: p.date, routeKey: p.routeKey, currentStopKey: run.currentStopKey ?? null, finishedAt: null }, { $set: set });
    if (result.matchedCount > 0) break;
  }
  return clean(await c.findOne({ date: p.date, routeKey: p.routeKey }));
}

/** How long the run has been paused up to `now` (milliseconds; 0 when it is not paused). */
function pausedFor(run: Doc, now: Date): number {
  const since = run.pausedAt ? new Date(run.pausedAt).getTime() : NaN;
  return Number.isFinite(since) ? Math.max(0, now.getTime() - since) : 0;
}

/** Stop packing for now: the clock of the customer on screen stops and the route clock stops; ticks and the place are kept. */
export async function pauseRun(c: Collection<Doc>, p: { date: string; routeKey: string }, now: Date): Promise<Doc | null | false> {
  for (let attempt = 0; attempt < 3; attempt++) {
    const run = await c.findOne({ date: p.date, routeKey: p.routeKey });
    if (!run?.startedAt) return false;
    if (run.finishedAt || run.pausedAt) return clean(run);
    const result = await c.updateOne({ date: p.date, routeKey: p.routeKey, currentStopKey: run.currentStopKey ?? null, finishedAt: null, pausedAt: null }, { $set: { ...closeCurrent(run, now), pausedAt: now.toISOString(), updatedAt: now } });
    if (result.matchedCount > 0) break;
  }
  return clean(await c.findOne({ date: p.date, routeKey: p.routeKey }));
}

/** Carry on after a pause: the pause is added to the paused time and the clock of the same customer starts again. */
export async function resumeRun(c: Collection<Doc>, p: { date: string; routeKey: string }, now: Date): Promise<Doc | null | false> {
  for (let attempt = 0; attempt < 3; attempt++) {
    const run = await c.findOne({ date: p.date, routeKey: p.routeKey });
    if (!run?.startedAt) return false;
    if (run.finishedAt || !run.pausedAt) return clean(run);
    const set: Record<string, unknown> = { pausedAt: null, pausedMs: (Number(run.pausedMs) || 0) + pausedFor(run, now), updatedAt: now };
    if (run.currentStopKey) set[`stops.${run.currentStopKey}.activeSince`] = now.toISOString();
    const result = await c.updateOne({ date: p.date, routeKey: p.routeKey, pausedAt: run.pausedAt, finishedAt: null }, { $set: set });
    if (result.matchedCount > 0) break;
  }
  return clean(await c.findOne({ date: p.date, routeKey: p.routeKey }));
}

export async function resetRun(c: Collection<Doc>, p: { date: string; routeKey: string }): Promise<boolean> {
  const result = await c.deleteOne({ date: p.date, routeKey: p.routeKey });
  return result.deletedCount > 0;
}
