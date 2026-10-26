/**
 * Puts the Kitchen Dashboard's items and combos in the order of the Food Category page: each category
 * (by its sequence), then its sub-categories, and inside each one the items by their own sequence.
 * Pure helpers; the route reads the categories and mappings.
 */
import { groupCategoriesByParent, type TreeCategory } from './categoryTree';

export interface OrderCategory extends TreeCategory {
  _id?: unknown;
}

export interface OrderMapping {
  foodItemId: unknown;
  categoryId: unknown;
  sequence?: number;
  mappingType?: string;
  /** The menu day of a day-wise mapping, 'YYYY-MM-DD'. */
  day?: string | null;
}

export interface RankMaps {
  /** Rank of each item name on each menu day (day-wise mappings of that day). */
  byDay: Map<string, Map<string, number>>;
  /** Rank of each item name over everything (flat mappings and every day): used for the whole range and as a fallback. */
  overall: Map<string, number>;
}

const idOf = (v: unknown): string => (v === undefined || v === null ? '' : String(v));
const STEP = 10_000_000;

/** Every category in page order: a category, then its sub-categories, then the next category. */
export function categoryOrder(categories: OrderCategory[]): string[] {
  const out: string[] = [];
  for (const group of groupCategoriesByParent(categories)) {
    if (group.parent) out.push(idOf(group.parent._id));
    for (const child of group.children) out.push(idOf(child._id));
  }
  return out;
}

/** `nameById` maps a food item id to its name. Lower rank = earlier. */
export function buildRankMaps(categories: OrderCategory[], mappings: OrderMapping[], nameById: Map<string, string>): RankMaps {
  const index = new Map(categoryOrder(categories).map((id, i) => [id, i]));
  const byDay = new Map<string, Map<string, number>>();
  const overall = new Map<string, number>();
  const lower = (map: Map<string, number>, name: string, rank: number) => {
    const current = map.get(name);
    if (current === undefined || rank < current) map.set(name, rank);
  };
  for (const m of mappings) {
    const name = nameById.get(idOf(m.foodItemId));
    const cat = index.get(idOf(m.categoryId));
    if (!name || cat === undefined) continue;
    const rank = cat * STEP + Math.min(Math.max(Number(m.sequence) || 0, 0), STEP - 1);
    lower(overall, name, rank);
    if (m.mappingType === 'DAY_WISE' && m.day) {
      const dayMap = byDay.get(m.day) ?? new Map<string, number>();
      lower(dayMap, name, rank);
      byDay.set(m.day, dayMap);
    }
  }
  return { byDay, overall };
}

/** Sorts by rank (items with no category last), keeping the existing order among equals. */
export function sortByRank<T extends { name: string }>(list: T[], rankOf: (name: string) => number | undefined): T[] {
  return list
    .map((item, i) => ({ item, i, rank: rankOf(item.name.trim()) ?? Number.MAX_SAFE_INTEGER }))
    .sort((a, b) => a.rank - b.rank || a.i - b.i)
    .map((x) => x.item);
}

/** Orders the items and combos of one menu day (its own mappings first, then the general rank). */
export function orderBlock<T extends { items: Array<{ name: string }>; combos: Array<{ name: string }> }>(block: T, ranks: RankMaps, day?: string): T {
  const dayMap = day ? ranks.byDay.get(day) : undefined;
  const rankOf = (name: string) => dayMap?.get(name) ?? ranks.overall.get(name);
  return { ...block, items: sortByRank(block.items, rankOf), combos: sortByRank(block.combos, rankOf) };
}
