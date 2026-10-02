import { db } from '@/lib/db';

/**
 * Tell Livesite the home menu changed, after admin menu changes.
 *
 * 1. Bump the menu version (`menuMeta` document `homeMenu`). Every Livesite server instance compares
 *    it with the version its cached menu was built from, so all of them rebuild within seconds. This
 *    needs no settings and is awaited, so it finishes before the admin request ends.
 * 2. Also nudge Livesite directly to clear its cache right away (needs LIVESITE_URL and
 *    HOME_MENU_CACHE_SECRET). Fire-and-forget: it only speeds things up on one instance.
 *
 * Failures are logged and never block admin saves.
 */
export async function invalidateLivesiteHomeMenuCache(): Promise<void> {
  try {
    const database = await db.getDb();
    await database.collection('menuMeta').updateOne(
      { _id: 'homeMenu' } as never,
      { $inc: { version: 1 }, $set: { updatedAt: new Date() } },
      { upsert: true }
    );
  } catch (error) {
    console.warn('[home-menu-cache] Failed to bump the menu version:', error);
  }

  const livesiteUrl = (process.env.LIVESITE_URL || 'http://localhost:3000').replace(/\/$/, '');
  const secret = process.env.HOME_MENU_CACHE_SECRET || process.env.PRIVATE_KEY;

  if (!secret) {
    console.warn('[home-menu-cache] HOME_MENU_CACHE_SECRET / PRIVATE_KEY not set; skipping direct invalidation');
    return;
  }

  fetch(`${livesiteUrl}/api/internal/invalidate-home-menu`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${secret}`,
      'Content-Type': 'application/json',
    },
  }).catch((error) => {
    console.warn('[home-menu-cache] Failed to invalidate Livesite home menu cache:', error);
  });
}
