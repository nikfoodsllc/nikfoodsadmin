import type { Collection } from 'mongodb';
import type { PackingRun } from '@/utils/packingProgress';

/**
 * The saved packing runs ("Pack live"): one document per delivery date and route in `packingRuns`. Every change is one small
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

export async function startRun(c: Collection<Doc>, p: { date: string; routeKey: string; driverName: string; firstStopKey: string; by: string }, now: Date): Promise<Doc | null> {
  const existing = await c.findOne({ date: p.date, routeKey: p.routeKey });
  if (existing?.startedAt && !existing.finishedAt) return clean(existing);
  const first = `stops.${p.firstStopKey}`;
  if (existing) {
    // packing again after a finished run: the ticks stay, the clock restarts at this customer
    await c.updateOne(
      { date: p.date, routeKey: p.routeKey },
      { $set: { startedAt: existing.startedAt ?? now.toISOString(), finishedAt: null, currentStopKey: p.firstStopKey, [`${first}.activeSince`]: now.toISOString(), updatedAt: now, driverName: p.driverName } }
    );
  } else {
    await c
      .updateOne(
        { date: p.date, routeKey: p.routeKey },
        { $setOnInsert: { date: p.date, routeKey: p.routeKey, driverName: p.driverName, startedAt: now.toISOString(), startedBy: p.by, finishedAt: null, currentStopKey: p.firstStopKey, stops: { [p.firstStopKey]: { checked: [], timeMs: 0, activeSince: now.toISOString(), firstOpenedAt: now.toISOString() } }, updatedAt: now } },
        { upsert: true }
      )
      .catch(() => undefined); // two taps at once: the other one created it
  }
  return clean(await c.findOne({ date: p.date, routeKey: p.routeKey }));
}

/** Ticks or unticks lines of one customer. False when the run has not been started. */
export async function setChecked(c: Collection<Doc>, p: { date: string; routeKey: string; stopKey: string; lineKeys: string[]; checked: boolean }, now: Date): Promise<Doc | null | false> {
  const filter = { date: p.date, routeKey: p.routeKey, startedAt: { $ne: null } };
  const field = `stops.${p.stopKey}.checked`;
  const update = p.checked ? { $addToSet: { [field]: { $each: p.lineKeys } }, $set: { updatedAt: now } } : { $pull: { [field]: { $in: p.lineKeys } }, $set: { updatedAt: now } };
  const result = await c.updateOne(filter, update as never);
  if (result.matchedCount === 0) return false;
  return clean(await c.findOne({ date: p.date, routeKey: p.routeKey }));
}

/** Moves to another customer: the time of the one being left is saved, the clock of the new one starts. */
export async function goToStop(c: Collection<Doc>, p: { date: string; routeKey: string; toStopKey: string }, now: Date): Promise<Doc | null | false> {
  for (let attempt = 0; attempt < 3; attempt++) {
    const run = await c.findOne({ date: p.date, routeKey: p.routeKey });
    if (!run?.startedAt) return false;
    if (run.finishedAt || run.currentStopKey === p.toStopKey) return clean(run);
    const to = `stops.${p.toStopKey}`;
    const set: Record<string, unknown> = { ...closeCurrent(run, now), currentStopKey: p.toStopKey, [`${to}.activeSince`]: now.toISOString(), updatedAt: now };
    if (!run.stops?.[p.toStopKey]?.firstOpenedAt) set[`${to}.firstOpenedAt`] = now.toISOString();
    const result = await c.updateOne({ date: p.date, routeKey: p.routeKey, currentStopKey: run.currentStopKey ?? null, finishedAt: null }, { $set: set });
    if (result.matchedCount > 0) break; // otherwise someone else moved first: read again
  }
  return clean(await c.findOne({ date: p.date, routeKey: p.routeKey }));
}

export async function finishRun(c: Collection<Doc>, p: { date: string; routeKey: string }, now: Date): Promise<Doc | null | false> {
  for (let attempt = 0; attempt < 3; attempt++) {
    const run = await c.findOne({ date: p.date, routeKey: p.routeKey });
    if (!run?.startedAt) return false;
    if (run.finishedAt) return clean(run);
    const result = await c.updateOne({ date: p.date, routeKey: p.routeKey, currentStopKey: run.currentStopKey ?? null, finishedAt: null }, { $set: { ...closeCurrent(run, now), finishedAt: now.toISOString(), currentStopKey: null, updatedAt: now } });
    if (result.matchedCount > 0) break;
  }
  return clean(await c.findOne({ date: p.date, routeKey: p.routeKey }));
}

export async function resetRun(c: Collection<Doc>, p: { date: string; routeKey: string }): Promise<boolean> {
  const result = await c.deleteOne({ date: p.date, routeKey: p.routeKey });
  return result.deletedCount > 0;
}
