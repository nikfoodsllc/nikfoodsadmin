/**
 * Column order, widths and hidden columns for a data table.
 *
 * Pure helpers, no React: the table hook in src/hooks/useColumnPreferences.ts uses them, and the
 * preferences API route uses `validateColumnPrefsPayload`. Anything read back from storage or from
 * the network is treated as untrusted: unknown columns are dropped, widths are clamped, and locked
 * columns can never be hidden, moved or resized, so a stale or hand-edited value cannot break the page.
 */

export const MIN_COLUMN_WIDTH = 60;
export const MAX_COLUMN_WIDTH = 800;
/** Upper bound on how many columns a stored layout may mention (guards the API against junk). */
export const MAX_STORED_COLUMNS = 60;

const COLUMN_KEY_PATTERN = /^[A-Za-z][A-Za-z0-9_-]{0,39}$/;

export interface ColumnDef {
  key: string;
  label: string;
  defaultWidth: number;
  /** Smallest width a drag can make this column (defaults to MIN_COLUMN_WIDTH). */
  minWidth?: number;
  /** Locked columns are always shown, keep their place and cannot be resized (e.g. select box, View Details). */
  locked?: boolean;
  align?: 'left' | 'right';
}

export interface ColumnPrefs {
  /** Preferred order of the unlocked columns. Empty means the default order. */
  order: string[];
  /** Only columns the user has resized; the rest use their default width. */
  widths: Record<string, number>;
  /** Keys of hidden columns. */
  hidden: string[];
}

export const EMPTY_COLUMN_PREFS: ColumnPrefs = { order: [], widths: {}, hidden: [] };

export const emptyColumnPrefs = (): ColumnPrefs => ({ order: [], widths: {}, hidden: [] });

export function isDefaultColumnPrefs(prefs: ColumnPrefs): boolean {
  return prefs.order.length === 0 && prefs.hidden.length === 0 && Object.keys(prefs.widths).length === 0;
}

export function clampWidth(width: number, def?: Pick<ColumnDef, 'minWidth'>): number {
  const min = def?.minWidth ?? MIN_COLUMN_WIDTH;
  return Math.round(Math.min(MAX_COLUMN_WIDTH, Math.max(min, width)));
}

/**
 * Every column in display order (hidden ones included). Locked columns keep their own slot; the
 * unlocked ones follow the saved order, and any not mentioned (e.g. added in a later release) come
 * after the saved ones in their default order.
 */
export function orderedColumns<T extends ColumnDef>(defs: T[], prefs: Pick<ColumnPrefs, 'order'>): T[] {
  const unlocked = defs.filter((d) => !d.locked);
  const byKey = new Map(unlocked.map((d) => [d.key, d]));
  const seen = new Set<string>();
  const sequence: T[] = [];
  for (const key of prefs.order) {
    const def = byKey.get(key);
    if (def && !seen.has(key)) {
      seen.add(key);
      sequence.push(def);
    }
  }
  for (const def of unlocked) if (!seen.has(def.key)) sequence.push(def);
  let next = 0;
  return defs.map((d) => (d.locked ? d : sequence[next++]));
}

/** Stores the order as [] when it is the default one, so default layouts stay "default". */
function normalizeOrder(defs: ColumnDef[], order: string[]): string[] {
  const defaultOrder = defs.filter((d) => !d.locked).map((d) => d.key);
  const full = orderedColumns(defs, { order })
    .filter((d) => !d.locked)
    .map((d) => d.key);
  return full.every((key, i) => key === defaultOrder[i]) ? [] : full;
}

/** Turns whatever was stored into valid preferences for the given columns. */
export function sanitizeColumnPrefs(raw: unknown, defs: ColumnDef[]): ColumnPrefs {
  if (!raw || typeof raw !== 'object') return emptyColumnPrefs();
  const input = raw as { order?: unknown; widths?: unknown; hidden?: unknown };
  const byKey = new Map(defs.map((d) => [d.key, d]));

  const order: string[] = [];
  if (Array.isArray(input.order)) {
    for (const key of input.order) {
      const def = typeof key === 'string' ? byKey.get(key) : undefined;
      if (def && !def.locked && !order.includes(def.key)) order.push(def.key);
    }
  }

  const widths: Record<string, number> = {};
  if (input.widths && typeof input.widths === 'object') {
    for (const [key, value] of Object.entries(input.widths as Record<string, unknown>)) {
      const def = byKey.get(key);
      if (!def || def.locked) continue;
      if (typeof value !== 'number' || !Number.isFinite(value)) continue;
      widths[key] = clampWidth(value, def);
    }
  }

  const hidden: string[] = [];
  if (Array.isArray(input.hidden)) {
    for (const key of input.hidden) {
      const def = typeof key === 'string' ? byKey.get(key) : undefined;
      if (def && !def.locked && !hidden.includes(def.key)) hidden.push(def.key);
    }
  }

  return { order: normalizeOrder(defs, order), widths, hidden };
}

/**
 * Checks a layout sent to the server, which does not know the column list: keys must look like
 * column keys, widths must be sane numbers, and nothing may be oversized. Returns null if the value
 * is not an object. The client later sanitises it against the real columns.
 */
export function validateColumnPrefsPayload(raw: unknown): ColumnPrefs | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const input = raw as { order?: unknown; widths?: unknown; hidden?: unknown };
  const isKey = (k: unknown): k is string => typeof k === 'string' && COLUMN_KEY_PATTERN.test(k);

  const keyList = (value: unknown): string[] => {
    const out: string[] = [];
    if (Array.isArray(value)) {
      for (const k of value) {
        if (isKey(k) && !out.includes(k)) out.push(k);
        if (out.length >= MAX_STORED_COLUMNS) break;
      }
    }
    return out;
  };

  const widths: Record<string, number> = {};
  if (input.widths && typeof input.widths === 'object' && !Array.isArray(input.widths)) {
    for (const [k, v] of Object.entries(input.widths as Record<string, unknown>)) {
      if (Object.keys(widths).length >= MAX_STORED_COLUMNS) break;
      if (isKey(k) && typeof v === 'number' && Number.isFinite(v)) widths[k] = clampWidth(v);
    }
  }

  return { order: keyList(input.order), widths, hidden: keyList(input.hidden) };
}

export function parseColumnPrefs(json: string | null, defs: ColumnDef[]): ColumnPrefs {
  if (!json) return emptyColumnPrefs();
  try {
    return sanitizeColumnPrefs(JSON.parse(json), defs);
  } catch {
    return emptyColumnPrefs();
  }
}

/** Each admin gets their own browser copy, so two admins on one computer never see each other's layout. */
export function userScopedStorageKey(baseKey: string, userId?: string | null): string {
  return userId ? `${baseKey}:${userId}` : baseKey;
}

export function loadColumnPrefs(storageKey: string, defs: ColumnDef[]): ColumnPrefs {
  try {
    return parseColumnPrefs(window.localStorage.getItem(storageKey), defs);
  } catch {
    return emptyColumnPrefs(); // storage blocked (private mode, site data off)
  }
}

export function saveColumnPrefs(storageKey: string, prefs: ColumnPrefs): void {
  try {
    if (isDefaultColumnPrefs(prefs)) window.localStorage.removeItem(storageKey);
    else window.localStorage.setItem(storageKey, JSON.stringify(prefs));
  } catch {
    // best effort: the layout just won't be remembered in this browser
  }
}

/** The columns to show, in display order. */
export function visibleColumns<T extends ColumnDef>(defs: T[], prefs: ColumnPrefs): T[] {
  return orderedColumns(defs, prefs).filter((d) => d.locked || !prefs.hidden.includes(d.key));
}

/** Width of every column: the saved one if the user resized it, otherwise the default. */
export function resolveWidths(defs: ColumnDef[], prefs: ColumnPrefs): Record<string, number> {
  const out: Record<string, number> = {};
  for (const d of defs) out[d.key] = d.locked ? d.defaultWidth : clampWidth(prefs.widths[d.key] ?? d.defaultWidth, d);
  return out;
}

export function totalColumnsWidth(columns: ColumnDef[], widths: Record<string, number>): number {
  return columns.reduce((sum, c) => sum + (widths[c.key] ?? c.defaultWidth), 0);
}

/** Moves an unlocked column to `toIndex` among the unlocked columns (0 = first). */
export function moveColumnInPrefs(defs: ColumnDef[], prefs: ColumnPrefs, key: string, toIndex: number): ColumnPrefs {
  const unlocked = orderedColumns(defs, prefs)
    .filter((d) => !d.locked)
    .map((d) => d.key);
  const from = unlocked.indexOf(key);
  if (from < 0) return prefs;
  const next = unlocked.slice();
  next.splice(from, 1);
  next.splice(Math.max(0, Math.min(next.length, toIndex)), 0, key);
  return { ...prefs, order: normalizeOrder(defs, next) };
}
