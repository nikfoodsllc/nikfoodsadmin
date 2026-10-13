/**
 * A page that was open while a new version of the admin went live can crash when it asks for a piece of the old version that no
 * longer exists ("Loading chunk ... failed", "Failed to fetch dynamically imported module"). Reloading fixes it, so the error
 * screen does that by itself, once.
 */
export function isStaleVersionError(error: { name?: string; message?: string } | null | undefined): boolean {
  const text = `${error?.name ?? ''} ${error?.message ?? ''}`;
  return /ChunkLoadError|Loading chunk [\w-]+ failed|Loading CSS chunk|Failed to fetch dynamically imported module|error loading dynamically imported module|Importing a module script failed|Unexpected token '<'/i.test(text);
}

const KEY = 'admin_stale_reload_at';
const WINDOW_MS = 60_000;

/** True when the page may reload itself now: at most once a minute, so a real error can never loop. */
export function mayAutoReload(storage: Pick<Storage, 'getItem' | 'setItem'> | null, now: number = Date.now()): boolean {
  try {
    const last = Number(storage?.getItem(KEY) ?? 0);
    if (Number.isFinite(last) && last > 0 && now - last < WINDOW_MS) return false;
    storage?.setItem(KEY, String(now));
    return true;
  } catch {
    return false;
  }
}
