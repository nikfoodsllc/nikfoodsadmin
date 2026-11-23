import { cleanThreshold, type StockUnit } from '@/utils/stockRules';

/**
 * "Sold out now" on an item's order limit: the new limit is what has already been ordered, so nothing is left. `orderedBase` is the
 * count in the limit's base (units, or ounces for a weight limit). Pounds and ounces round DOWN so the item really is at its limit.
 * When nothing (or less than the smallest limit, 0.25 lb) was ordered the limit becomes 0: the item shows Out of stock and sells none.
 */
export function soldOutNowLimit(orderedBase: number, unit: StockUnit): number {
  const base = Math.max(0, Number(orderedBase) || 0);
  const value = unit === 'lb' ? Math.floor((base / 16) * 100 + 1e-9) / 100 : Math.floor(base + 1e-9);
  return cleanThreshold(value, unit) ?? 0;
}
