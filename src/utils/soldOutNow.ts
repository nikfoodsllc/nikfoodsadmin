import { cleanThreshold, type StockUnit } from '@/utils/stockRules';

/**
 * "Sold out now" on an item's order limit: the new limit is what has already been ordered, so nothing is left. `orderedBase` is the
 * count in the limit's base (units, or ounces for a weight limit). Pounds and ounces round DOWN so the item really is at its limit.
 * Returns null when too little was ordered to be a limit (0 units, under 1 oz or 0.25 lb): the item cannot be stopped this way.
 */
export function soldOutNowLimit(orderedBase: number, unit: StockUnit): number | null {
  const base = Math.max(0, Number(orderedBase) || 0);
  const value = unit === 'lb' ? Math.floor((base / 16) * 100 + 1e-9) / 100 : Math.floor(base + 1e-9);
  return cleanThreshold(value, unit);
}
