/** One line of an item's order-limit history, in plain words. */
export interface StockLogLine {
  kind: string;
  from?: string;
  to?: string;
  ordered?: number;
  limit?: number | null;
  /** the same with the unit ("32 lb") */
  orderedText?: string;
  limitText?: string;
}

export function stockLogText(row: StockLogLine): string {
  switch (row.kind) {
    case 'limit_set':
      return `Limit set to ${row.to}`;
    case 'limit_changed':
      return `Limit changed from ${row.from} to ${row.to}`;
    case 'limit_removed':
      return `Limit removed (it was ${row.from})`;
    case 'unit_changed':
      return `Limit changed from ${row.from} to ${row.to}; the count started again`;
    case 'alert_changed':
      return `Low-stock alert changed from ${row.from} to ${row.to}`;
    case 'reset_mode_changed':
      return `Reset changed from ${row.from} to ${row.to}`;
    case 'reset':
      return row.limit ? `Count reset (${row.orderedText ?? row.ordered ?? 0} of ${row.limitText ?? row.limit} had been ordered)` : `Count reset (${row.orderedText ?? row.ordered ?? 0} had been ordered)`;
    default:
      return 'Changed';
  }
}

/** "12 / 50" for the table; 'Sold out' once the limit is reached; '' when there is no limit. */
export function stockCellText(stock?: { limit: number | null; ordered: number; soldOut: boolean; unit?: string } | null): string {
  if (!stock || stock.limit === null) return '';
  const u = stock.unit && stock.unit !== 'units' ? ` ${stock.unit}` : '';
  return stock.soldOut ? 'Sold out' : `${stock.ordered} / ${stock.limit}${u}`;
}
