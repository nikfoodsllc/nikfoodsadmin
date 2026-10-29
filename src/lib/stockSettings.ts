import { cleanResetMode, cleanResetTime, cleanStockUnit, cleanThreshold, type ResetMode, type StockUnit } from '@/utils/stockRules';

/** What the admin sent for an item's order limit (all optional: left out = leave as it is). */
export interface StockInput {
  stockThreshold?: number | null;
  stockUnit?: StockUnit;
  stockResetMode?: ResetMode;
  stockResetTime?: string | null;
}

/** What an item has saved. */
export interface StockSaved {
  stockThreshold?: unknown;
  stockUnit?: unknown;
  stockResetMode?: unknown;
  stockResetTime?: unknown;
}

export interface StockLogEntry {
  kind: 'limit_set' | 'limit_changed' | 'limit_removed' | 'reset_mode_changed' | 'unit_changed';
  from?: string;
  to?: string;
}

const modeText = (mode: unknown, time: unknown): string => (cleanResetMode(mode) === 'daily' && cleanResetTime(time) ? `daily at ${cleanResetTime(time)}` : 'manual');

/** The stock fields of a NEW item: only set when a limit was given. The count starts now. */
export function stockFieldsForCreate(input: StockInput, now: Date): Record<string, unknown> {
  const unit = cleanStockUnit(input.stockUnit);
  const limit = cleanThreshold(input.stockThreshold, unit);
  if (limit === null) return {};
  const mode = cleanResetMode(input.stockResetMode);
  const time = cleanResetTime(input.stockResetTime);
  return { stockThreshold: limit, stockUnit: unit, stockResetAt: now, stockResetMode: mode === 'daily' && time ? 'daily' : 'manual', ...(mode === 'daily' && time ? { stockResetTime: time } : {}) };
}

/**
 * The stock fields to save on an EXISTING item, and what to write in its log. Setting a limit where there was none starts the count
 * now; changing the number or the reset time keeps the count going; removing the limit clears it.
 */
export function stockFieldsForUpdate(saved: StockSaved, input: StockInput, now: Date): { set: Record<string, unknown>; log: StockLogEntry[] } {
  const set: Record<string, unknown> = {};
  const log: StockLogEntry[] = [];
  const savedUnit = cleanStockUnit(saved.stockUnit);
  const before = cleanThreshold(saved.stockThreshold, savedUnit);
  const unit = input.stockUnit !== undefined ? cleanStockUnit(input.stockUnit) : savedUnit;
  const word = (n: number | null, u: StockUnit) => (n === null ? '' : u === 'units' ? String(n) : `${n} ${u}`);

  let after = before;
  if (input.stockThreshold !== undefined || input.stockUnit !== undefined) {
    after = cleanThreshold(input.stockThreshold !== undefined ? input.stockThreshold : saved.stockThreshold, unit);
    set.stockThreshold = after;
    set.stockUnit = unit;
    if (after !== null && before === null) {
      set.stockResetAt = now;
      log.push({ kind: 'limit_set', to: word(after, unit) });
    } else if (after !== null && before !== null && unit !== savedUnit) {
      // a different unit measures from the start again, so the count starts now
      set.stockResetAt = now;
      log.push({ kind: 'unit_changed', from: word(before, savedUnit), to: word(after, unit) });
    } else if (after !== null && before !== null && after !== before) {
      log.push({ kind: 'limit_changed', from: word(before, savedUnit), to: word(after, unit) });
    } else if (after === null && before !== null) {
      log.push({ kind: 'limit_removed', from: word(before, savedUnit) });
    }
  }

  if (input.stockResetMode !== undefined || input.stockResetTime !== undefined) {
    const mode = cleanResetMode(input.stockResetMode ?? saved.stockResetMode);
    const time = cleanResetTime(input.stockResetTime !== undefined ? input.stockResetTime : saved.stockResetTime);
    const effectiveMode = mode === 'daily' && time ? 'daily' : 'manual';
    set.stockResetMode = effectiveMode;
    set.stockResetTime = effectiveMode === 'daily' ? time : null;
    const was = modeText(saved.stockResetMode, saved.stockResetTime);
    const now2 = modeText(effectiveMode, effectiveMode === 'daily' ? time : null);
    if (was !== now2 && after !== null) log.push({ kind: 'reset_mode_changed', from: was, to: now2 });
  }
  return { set, log };
}

/** A limit in pounds or ounces only makes sense for an item with sizes (portions): null when fine, otherwise what to tell the admin. */
export function stockUnitProblem(input: StockInput, hasSizes: boolean): string | null {
  const unit = cleanStockUnit(input.stockUnit);
  if (unit === 'units' || cleanThreshold(input.stockThreshold, unit) === null) return null;
  return hasSizes ? null : 'A limit in pounds or ounces needs an item with sizes. Use units for this item.';
}
