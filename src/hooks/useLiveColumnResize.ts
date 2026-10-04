'use client';

import { RefObject, useCallback } from 'react';

/**
 * While a column edge is being dragged, change that column's <col> and the table width directly
 * instead of re-rendering every cell on each mouse move; the final width is committed once, on release.
 * The table must render a <colgroup> with `<col data-col={key}>` for each column.
 */
export function useLiveColumnResize(
  tableRef: RefObject<HTMLTableElement | null>,
  widths: Record<string, number>,
  totalWidth: number
) {
  return useCallback(
    (key: string, width: number) => {
      const table = tableRef.current;
      if (!table) return;
      const col = table.querySelector<HTMLElement>(`col[data-col="${key}"]`);
      if (col) col.style.width = `${width}px`;
      table.style.width = `${totalWidth - (widths[key] ?? width) + width}px`;
    },
    [tableRef, widths, totalWidth]
  );
}
