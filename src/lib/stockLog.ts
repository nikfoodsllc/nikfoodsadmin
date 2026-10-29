import { db } from '@/lib/db';

export interface StockLogRow {
  foodItemId: string;
  kind: 'limit_set' | 'limit_changed' | 'limit_removed' | 'reset_mode_changed' | 'unit_changed' | 'reset';
  from?: string;
  to?: string;
  /** For a manual reset: units that had been ordered, and the limit, at that moment */
  ordered?: number;
  limit?: number | null;
  /** the same with the unit ("32 lb") */
  orderedText?: string;
  limitText?: string;
  byId: string;
  byName?: string;
}

/** The history of an item's order limit: set, changed, removed, reset. Never throws (a log problem must not stop a save). */
export async function writeStockLog(row: StockLogRow): Promise<void> {
  try {
    await db.create('stockLog', { ...row, at: new Date() } as never);
  } catch (error) {
    console.error('Could not write the stock log:', error instanceof Error ? error.message : error);
  }
}

export async function readStockLog(foodItemId: string, limit = 20): Promise<Array<StockLogRow & { at: string }>> {
  const result = await db.read<Record<string, unknown>>('stockLog', { foodItemId }, { sort: { at: -1 }, limit });
  if (!result.success || !result.data) return [];
  return result.data.map((r) => ({
    foodItemId: String(r.foodItemId),
    kind: r.kind as StockLogRow['kind'],
    from: r.from as string | undefined,
    to: r.to as string | undefined,
    ordered: typeof r.ordered === 'number' ? r.ordered : undefined,
    limit: typeof r.limit === 'number' ? r.limit : null,
    orderedText: typeof r.orderedText === 'string' ? r.orderedText : undefined,
    limitText: typeof r.limitText === 'string' ? r.limitText : undefined,
    byId: String(r.byId ?? ''),
    byName: String(r.byName ?? ''),
    at: r.at instanceof Date ? r.at.toISOString() : String(r.at ?? ''),
  }));
}
