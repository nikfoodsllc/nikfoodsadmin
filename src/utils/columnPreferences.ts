/**
 * Column widths and hidden columns for a data table, saved in this browser (localStorage).
 *
 * Pure helpers, no React: the table hook in src/hooks/useColumnPreferences.ts uses them. Anything
 * read back from storage is treated as untrusted: unknown columns are dropped, widths are clamped,
 * and locked columns can never be hidden, so a stale or hand-edited value cannot break the page.
 */

export const MIN_COLUMN_WIDTH = 60;
export const MAX_COLUMN_WIDTH = 800;

export interface ColumnDef {
  key: string;
  label: string;
  defaultWidth: number;
  /** Smallest width a drag can make this column (defaults to MIN_COLUMN_WIDTH). */
  minWidth?: number;
  /** Locked columns are always shown and cannot be resized (e.g. the select box, View Details). */
  locked?: boolean;
  align?: 'left' | 'right';
}

export interface ColumnPrefs {
  /** Only columns the user has resized; the rest use their default width. */
  widths: Record<string, number>;
  /** Keys of hidden columns. */
  hidden: string[];
}

export const EMPTY_COLUMN_PREFS: ColumnPrefs = { widths: {}, hidden: [] };

export function clampWidth(width: number, def?: Pick<ColumnDef, 'minWidth'>): number {
  const min = def?.minWidth ?? MIN_COLUMN_WIDTH;
  return Math.round(Math.min(MAX_COLUMN_WIDTH, Math.max(min, width)));
}

/** Turns whatever was stored into valid preferences for the given columns. */
export function sanitizeColumnPrefs(raw: unknown, defs: ColumnDef[]): ColumnPrefs {
  if (!raw || typeof raw !== 'object') return { widths: {}, hidden: [] };
  const input = raw as { widths?: unknown; hidden?: unknown };
  const byKey = new Map(defs.map((d) => [d.key, d]));

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

  return { widths, hidden };
}

export function parseColumnPrefs(json: string | null, defs: ColumnDef[]): ColumnPrefs {
  if (!json) return { widths: {}, hidden: [] };
  try {
    return sanitizeColumnPrefs(JSON.parse(json), defs);
  } catch {
    return { widths: {}, hidden: [] };
  }
}

export function loadColumnPrefs(storageKey: string, defs: ColumnDef[]): ColumnPrefs {
  try {
    return parseColumnPrefs(window.localStorage.getItem(storageKey), defs);
  } catch {
    return { widths: {}, hidden: [] }; // storage blocked (private mode, site data off)
  }
}

export function saveColumnPrefs(storageKey: string, prefs: ColumnPrefs): void {
  try {
    const isDefault = prefs.hidden.length === 0 && Object.keys(prefs.widths).length === 0;
    if (isDefault) window.localStorage.removeItem(storageKey);
    else window.localStorage.setItem(storageKey, JSON.stringify(prefs));
  } catch {
    // best effort: the layout just won't be remembered
  }
}

/** The columns to show, in their original order. */
export function visibleColumns(defs: ColumnDef[], prefs: ColumnPrefs): ColumnDef[] {
  return defs.filter((d) => d.locked || !prefs.hidden.includes(d.key));
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
