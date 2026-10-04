'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ColumnDef,
  ColumnPrefs,
  EMPTY_COLUMN_PREFS,
  clampWidth,
  loadColumnPrefs,
  resolveWidths,
  saveColumnPrefs,
  totalColumnsWidth,
  visibleColumns,
} from '@/utils/columnPreferences';

/**
 * Resizable / hideable table columns, remembered in this browser.
 *
 * `defs` must be a stable array (define it at module level). Preferences are loaded after the first
 * render (so the server and browser render the same thing), then saved whenever they change.
 */
export function useColumnPreferences<T extends ColumnDef>(storageKey: string, defs: T[]) {
  const [prefs, setPrefs] = useState<ColumnPrefs>(EMPTY_COLUMN_PREFS);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    setPrefs(loadColumnPrefs(storageKey, defs));
    setLoaded(true);
  }, [storageKey, defs]);

  useEffect(() => {
    if (loaded) saveColumnPrefs(storageKey, prefs);
  }, [storageKey, prefs, loaded]);

  const columns = useMemo(() => visibleColumns(defs, prefs) as T[], [defs, prefs]);
  const widths = useMemo(() => resolveWidths(defs, prefs), [defs, prefs]);
  const totalWidth = useMemo(() => totalColumnsWidth(columns, widths), [columns, widths]);
  const hiddenKeys = useMemo(() => new Set(prefs.hidden), [prefs.hidden]);

  const setWidth = useCallback(
    (key: string, width: number) => {
      const def = defs.find((d) => d.key === key);
      if (!def || def.locked) return;
      setPrefs((p) => ({ ...p, widths: { ...p.widths, [key]: clampWidth(width, def) } }));
    },
    [defs]
  );

  const resetWidth = useCallback((key: string) => {
    setPrefs((p) => {
      if (!(key in p.widths)) return p;
      const next = { ...p.widths };
      delete next[key];
      return { ...p, widths: next };
    });
  }, []);

  const toggleColumn = useCallback(
    (key: string) => {
      const def = defs.find((d) => d.key === key);
      if (!def || def.locked) return;
      setPrefs((p) => ({
        ...p,
        hidden: p.hidden.includes(key) ? p.hidden.filter((k) => k !== key) : [...p.hidden, key],
      }));
    },
    [defs]
  );

  const showAll = useCallback(() => setPrefs((p) => ({ ...p, hidden: [] })), []);
  const reset = useCallback(() => setPrefs({ widths: {}, hidden: [] }), []);

  return { columns, widths, totalWidth, hiddenKeys, setWidth, resetWidth, toggleColumn, showAll, reset };
}
