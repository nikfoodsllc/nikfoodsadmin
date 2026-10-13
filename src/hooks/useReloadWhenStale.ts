'use client';

import { useEffect, useRef } from 'react';
import { isStale } from '@/utils/dataFreshness';

/**
 * Loads a report again when the admin comes back to the tab (or window) and the data on screen is a minute old or more, so a page
 * left open does not show yesterday's orders. `reload` should load quietly (no spinner over what is already on screen).
 */
export function useReloadWhenStale(loadedAt: Date | null, reload: () => void, enabled = true): void {
  const latest = useRef({ loadedAt, reload });
  useEffect(() => {
    latest.current = { loadedAt, reload };
  }, [loadedAt, reload]);

  useEffect(() => {
    if (!enabled) return;
    const check = () => {
      if (document.visibilityState !== 'visible') return;
      if (isStale(latest.current.loadedAt)) latest.current.reload();
    };
    document.addEventListener('visibilitychange', check);
    window.addEventListener('focus', check);
    return () => {
      document.removeEventListener('visibilitychange', check);
      window.removeEventListener('focus', check);
    };
  }, [enabled]);
}
