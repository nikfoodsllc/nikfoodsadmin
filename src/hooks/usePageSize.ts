'use client';

import { useCallback, useEffect, useState } from 'react';
import { DEFAULT_PAGE_SIZE, PageSize, parsePageSize } from '@/utils/pageSize';

/**
 * Rows-per-page choice for one admin table, remembered in this browser under its own key.
 * The first render always uses the table's default (100 unless the table says otherwise) so server and browser agree;
 * a saved choice is applied right after.
 */
export function usePageSize(tableKey: string, defaultSize: PageSize = DEFAULT_PAGE_SIZE): [PageSize, (size: PageSize) => void] {
  const storageKey = `admin_page_size:${tableKey}`;
  const [pageSize, setPageSizeState] = useState<PageSize>(defaultSize);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved !== null) setPageSizeState(parsePageSize(saved, defaultSize));
    } catch {
      /* storage blocked: the default stays */
    }
  }, [storageKey, defaultSize]);

  const setPageSize = useCallback(
    (size: PageSize) => {
      setPageSizeState(size);
      try {
        localStorage.setItem(storageKey, String(size));
      } catch {
        /* the choice just is not remembered */
      }
    },
    [storageKey]
  );

  return [pageSize, setPageSize];
}
