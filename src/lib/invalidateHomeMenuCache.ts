/**
 * Notify Livesite to clear its in-memory home menu cache after admin menu changes.
 * Fire-and-forget: failures are logged but do not block admin saves.
 */
export function invalidateLivesiteHomeMenuCache(): void {
  const livesiteUrl = (process.env.LIVESITE_URL || 'http://localhost:3000').replace(/\/$/, '');
  const secret = process.env.HOME_MENU_CACHE_SECRET || process.env.PRIVATE_KEY;

  if (!secret) {
    console.warn('[home-menu-cache] HOME_MENU_CACHE_SECRET / PRIVATE_KEY not set; skipping invalidation');
    return;
  }

  const url = `${livesiteUrl}/api/internal/invalidate-home-menu`;

  fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${secret}`,
      'Content-Type': 'application/json',
    },
  }).catch((error) => {
    console.warn('[home-menu-cache] Failed to invalidate Livesite home menu cache:', error);
  });
}
