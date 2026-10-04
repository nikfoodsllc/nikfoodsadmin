'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import {
  ColumnDef,
  ColumnPrefs,
  clampWidth,
  emptyColumnPrefs,
  loadColumnPrefs,
  moveColumnInPrefs,
  orderedColumns,
  resolveWidths,
  sanitizeColumnPrefs,
  saveColumnPrefs,
  totalColumnsWidth,
  userScopedStorageKey,
  visibleColumns,
} from '@/utils/columnPreferences';

/** idle = nothing to save, saving = waiting for / sending a save, saved = in the admin's account, error = only in this browser. */
export type ColumnSyncStatus = 'idle' | 'saving' | 'saved' | 'error';

const SAVE_DELAY_MS = 800;
const API_PATH = '/api/admin/preferences/table';

/**
 * Column order, hidden columns and widths for a table: kept in this browser right away (so the page
 * renders the right layout without waiting) and saved to the logged-in admin's account, so the layout
 * follows them to any computer.
 *
 * - `baseKey` is the browser-storage key; each admin gets their own copy of it.
 * - `serverTable` names the table on the server; leave it out for a browser-only layout.
 * - `defs` must be a stable array (define it at module level).
 *
 * The saved layout wins when it loads. A layout that only exists in this browser (set before layouts
 * were saved to the account) is uploaded the first time.
 */
export function useColumnPreferences<T extends ColumnDef>(baseKey: string, defs: T[], serverTable?: string) {
  const { user, token } = useAuth();
  const userId = user?.id ?? null;
  const storageKey = userScopedStorageKey(baseKey, userId);

  const [prefs, setPrefs] = useState<ColumnPrefs>(emptyColumnPrefs());
  const [ready, setReady] = useState(false);
  const [syncStatus, setSyncStatus] = useState<ColumnSyncStatus>('idle');

  const serverChecked = useRef(false);
  const lastServerJson = useRef<string>(JSON.stringify(emptyColumnPrefs()));
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latest = useRef({ prefs, token, serverTable });
  latest.current = { prefs, token, serverTable };

  // 1) the browser copy for this admin (falling back to a layout saved before admins had their own copy)
  useEffect(() => {
    serverChecked.current = false;
    let local = loadColumnPrefs(storageKey, defs);
    if (userId && JSON.stringify(local) === JSON.stringify(emptyColumnPrefs())) {
      local = loadColumnPrefs(baseKey, defs);
    }
    setPrefs(local);
    setReady(true);
  }, [storageKey, baseKey, userId, defs]);

  // 2) the layout saved in the admin's account
  useEffect(() => {
    if (!ready || !serverTable || !token || !userId || serverChecked.current) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`${API_PATH}?table=${encodeURIComponent(serverTable)}`, { headers: { Authorization: `Bearer ${token}` } });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const body = await res.json();
        if (cancelled) return;
        serverChecked.current = true;
        if (body?.data?.columns) {
          const fromServer = sanitizeColumnPrefs(body.data.columns, defs);
          lastServerJson.current = JSON.stringify(fromServer);
          setPrefs(fromServer);
        } else {
          lastServerJson.current = JSON.stringify(emptyColumnPrefs());
          const local = latest.current.prefs;
          if (JSON.stringify(local) !== lastServerJson.current) {
            // first time: upload the layout that so far only lived in this browser
            const put = await fetch(API_PATH, {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
              body: JSON.stringify({ table: serverTable, columns: local }),
            });
            if (!put.ok) throw new Error(`HTTP ${put.status}`);
            lastServerJson.current = JSON.stringify(local);
          }
        }
        setSyncStatus('saved');
      } catch {
        if (!cancelled) setSyncStatus('error');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [ready, serverTable, token, userId, defs]);

  // 3) keep the browser copy up to date, and save changes to the account shortly after they stop
  const sendToServer = useCallback(async (json: string, keepalive = false) => {
    const { token: t, serverTable: table } = latest.current;
    if (!t || !table) return;
    try {
      const res = await fetch(API_PATH, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${t}` },
        body: JSON.stringify({ table, columns: JSON.parse(json) }),
        keepalive,
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      lastServerJson.current = json;
      setSyncStatus('saved');
    } catch {
      setSyncStatus('error');
    }
  }, []);

  useEffect(() => {
    if (!ready) return;
    saveColumnPrefs(storageKey, prefs);
    if (!serverTable || !serverChecked.current) return;
    const json = JSON.stringify(prefs);
    if (json === lastServerJson.current) return;
    setSyncStatus('saving');
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      saveTimer.current = null;
      void sendToServer(json);
    }, SAVE_DELAY_MS);
  }, [prefs, ready, storageKey, serverTable, sendToServer]);

  // leaving the page within the delay must not lose the change
  useEffect(() => {
    const flush = () => {
      if (!saveTimer.current) return;
      clearTimeout(saveTimer.current);
      saveTimer.current = null;
      void sendToServer(JSON.stringify(latest.current.prefs), true);
    };
    window.addEventListener('pagehide', flush);
    return () => {
      window.removeEventListener('pagehide', flush);
      flush();
    };
  }, [sendToServer]);

  const columns = useMemo(() => visibleColumns(defs, prefs) as T[], [defs, prefs]);
  const allColumns = useMemo(() => orderedColumns(defs, prefs) as T[], [defs, prefs]);
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

  /** Moves an unlocked column to `toIndex` among the unlocked columns. */
  const moveColumn = useCallback((key: string, toIndex: number) => setPrefs((p) => moveColumnInPrefs(defs, p, key, toIndex)), [defs]);

  const showAll = useCallback(() => setPrefs((p) => ({ ...p, hidden: [] })), []);
  const reset = useCallback(() => setPrefs(emptyColumnPrefs()), []);

  return {
    /** Columns to show, in order. */
    columns,
    /** Every column in order, hidden ones included (for the Columns menu). */
    allColumns,
    widths,
    totalWidth,
    hiddenKeys,
    syncStatus,
    setWidth,
    resetWidth,
    toggleColumn,
    moveColumn,
    showAll,
    reset,
  };
}
