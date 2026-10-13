/**
 * How fresh a report on screen is. Reports load once when a page opens, so a page left open misses later orders. These helpers
 * decide when the data is old enough to load again and what the "Updated" line says. Pure functions (no browser, no network).
 */

/** After this long on screen, coming back to the tab loads the report again. */
export const STALE_AFTER_MS = 60 * 1000;

export function isStale(loadedAt: Date | number | null | undefined, now: number = Date.now(), staleAfterMs: number = STALE_AFTER_MS): boolean {
  if (loadedAt === null || loadedAt === undefined) return true;
  const at = loadedAt instanceof Date ? loadedAt.getTime() : loadedAt;
  return !Number.isFinite(at) || now - at >= staleAfterMs;
}

/** "Updated 3:54 PM" in Pacific time (the business runs on Pacific time); empty before the first load. */
export function updatedAtText(loadedAt: Date | number | null | undefined): string {
  if (loadedAt === null || loadedAt === undefined) return '';
  const date = loadedAt instanceof Date ? loadedAt : new Date(loadedAt);
  if (Number.isNaN(date.getTime())) return '';
  const time = new Intl.DateTimeFormat('en-US', { timeZone: 'America/Los_Angeles', hour: 'numeric', minute: '2-digit' }).format(date);
  return `Updated ${time}`;
}
