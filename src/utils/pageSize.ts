/**
 * Rows per page for the admin tables: 10, 50, 100 or all records. 100 unless the admin chose
 * otherwise (the choice is remembered in the browser, per table).
 */
export type PageSize = 10 | 50 | 100 | 'all';

export const PAGE_SIZE_OPTIONS: PageSize[] = [10, 50, 100, 'all'];
export const DEFAULT_PAGE_SIZE: PageSize = 100;

/** What the list APIs get as `limit` when "All" is chosen (more than any table holds). */
export const ALL_RECORDS_LIMIT = 100000;

export function parsePageSize(raw: unknown): PageSize {
  if (raw === 'all') return 'all';
  const n = typeof raw === 'string' ? Number(raw) : raw;
  return n === 10 || n === 50 || n === 100 ? n : DEFAULT_PAGE_SIZE;
}

export function pageSizeToLimit(size: PageSize): number {
  return size === 'all' ? ALL_RECORDS_LIMIT : size;
}

export function pageSizeLabel(size: PageSize): string {
  return size === 'all' ? 'All' : String(size);
}

export function totalPagesFor(total: number, size: PageSize): number {
  if (size === 'all') return 1;
  return Math.max(1, Math.ceil(total / size));
}

/** "1–100 of 5,310" (or "0 records"). */
export function rangeText(page: number, size: PageSize, total: number): string {
  if (total <= 0) return '0 records';
  const fmt = (n: number) => n.toLocaleString('en-US');
  if (size === 'all') return `1–${fmt(total)} of ${fmt(total)}`;
  const from = (page - 1) * size + 1;
  const to = Math.min(total, page * size);
  return `${fmt(from)}–${fmt(to)} of ${fmt(total)}`;
}
