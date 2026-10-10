import { db } from '@/lib/db';

/**
 * Fixed-window counters in Mongo (collection authRateLimits) that slow down password
 * guessing on the admin login and on admin password changes. One document per counter:
 * _id = key, count, expiresAt. The increment is one atomic update, so parallel requests
 * cannot slip past the limit. (Same logic as the customer site's lib/server/authRateLimit.ts.)
 */
export interface RateLimit {
  key: string;
  max: number;
  windowSec: number;
}

export type RateResult = { ok: true } | { ok: false; retryAfterSec: number };

const COLLECTION = 'authRateLimits';
type Counter = { _id: string; count: number; expiresAt: Date };

async function counters(collectionName = COLLECTION) {
  return (await db.getDb()).collection<Counter>(collectionName);
}

/** Client address as Vercel reports it (first x-forwarded-for entry). */
export function clientIp(request: { headers: { get(name: string): string | null } }): string {
  const forwarded = (request.headers.get('x-forwarded-for') ?? '').split(',')[0].trim();
  return forwarded || request.headers.get('x-real-ip')?.trim() || 'unknown';
}

async function bump(limit: RateLimit, now: Date, collectionName?: string): Promise<{ count: number; expiresAt: Date }> {
  const col = await counters(collectionName);
  const newExpiry = new Date(now.getTime() + limit.windowSec * 1000);
  const update = [
    {
      $set: {
        count: { $cond: [{ $gt: ['$expiresAt', now] }, { $add: ['$count', 1] }, 1] },
        expiresAt: { $cond: [{ $gt: ['$expiresAt', now] }, '$expiresAt', newExpiry] },
      },
    },
  ];
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const doc = await col.findOneAndUpdate({ _id: limit.key } as never, update as never, {
        upsert: true,
        returnDocument: 'after',
      });
      return { count: doc?.count ?? 1, expiresAt: doc?.expiresAt ?? newExpiry };
    } catch (error) {
      // two requests created the same counter at the same moment: try again
      if ((error as { code?: number }).code !== 11000 || attempt === 2) throw error;
    }
  }
  return { count: 1, expiresAt: newExpiry };
}

/** Old counters are removed now and then so the collection stays small. */
async function sweep(now: Date, collectionName?: string) {
  if (Math.random() > 0.01) return;
  try {
    const col = await counters(collectionName);
    await col.deleteMany({ expiresAt: { $lt: new Date(now.getTime() - 24 * 3600 * 1000) } } as never);
  } catch {
    /* housekeeping only */
  }
}

/** Read-only check: is any of these counters already full? */
export async function isBlocked(limits: RateLimit[], opts: { now?: Date; collectionName?: string } = {}): Promise<RateResult> {
  const now = opts.now ?? new Date();
  const col = await counters(opts.collectionName);
  let retryAfterSec = 0;
  for (const limit of limits) {
    const doc = await col.findOne({ _id: limit.key } as never);
    if (doc && doc.expiresAt > now && doc.count >= limit.max) {
      retryAfterSec = Math.max(retryAfterSec, Math.max(1, Math.ceil((doc.expiresAt.getTime() - now.getTime()) / 1000)));
    }
  }
  return retryAfterSec > 0 ? { ok: false, retryAfterSec } : { ok: true };
}

/** Add one failure to every counter (used after a wrong password). */
export async function recordFailure(limits: RateLimit[], opts: { now?: Date; collectionName?: string } = {}): Promise<void> {
  const now = opts.now ?? new Date();
  for (const limit of limits) await bump(limit, now, opts.collectionName);
  void sweep(now, opts.collectionName);
}

/** Forget a counter (used after a correct password). */
export async function clearCounter(key: string, collectionName?: string): Promise<void> {
  const col = await counters(collectionName);
  await col.deleteOne({ _id: key } as never);
}

export function tooManyMessage(retryAfterSec: number): string {
  const minutes = Math.max(1, Math.ceil(retryAfterSec / 60));
  return minutes <= 1 ? 'Too many tries. Please wait a minute and try again.' : `Too many tries. Please try again in ${minutes} minutes.`;
}
