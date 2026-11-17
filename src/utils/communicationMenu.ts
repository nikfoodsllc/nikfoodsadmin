/**
 * The day-wise menu of a date as the New menu email lists it: the items an admin put on that date (Food Items > the day columns),
 * in the order customers see them (category, then its sub-category, then the item's place), without anything a customer cannot
 * order: items marked unavailable or draft, and items only in a category switched to Unavailable.
 */
export interface MenuMapping {
  day: string;
  categoryId: string;
  foodItemId: string;
  sequence?: number;
}
export interface MenuCategory {
  id: string;
  name?: string;
  sequence?: number;
  isDraft?: boolean;
  parentId?: string;
}
export interface MenuFood {
  id: string;
  name: string;
  available?: boolean;
  isDraft?: boolean;
}

const num = (n: unknown, fallback: number) => (typeof n === 'number' && Number.isFinite(n) ? n : fallback);

export function buildDayMenus(dates: string[], mappings: MenuMapping[], categories: MenuCategory[], foods: MenuFood[]): Record<string, string[]> {
  const cat = new Map(categories.map((c) => [c.id, c]));
  const food = new Map(foods.map((f) => [f.id, f]));
  const hidden = (id: string): boolean => {
    const c = cat.get(id);
    if (!c) return false;
    return Boolean(c.isDraft) || (c.parentId ? Boolean(cat.get(c.parentId)?.isDraft) : false);
  };
  // the place of a category in the menu: its top-level category first, then itself
  const place = (id: string): [number, number] => {
    const c = cat.get(id);
    if (!c) return [Number.MAX_SAFE_INTEGER, Number.MAX_SAFE_INTEGER];
    const top = c.parentId ? cat.get(c.parentId) : c;
    return [num(top?.sequence, 1e6), c.parentId ? num(c.sequence, 1e6) : -1];
  };
  const out: Record<string, string[]> = {};
  for (const date of dates) {
    const rows = mappings
      .filter((m) => m.day === date && !hidden(m.categoryId))
      .map((m) => ({ m, f: food.get(m.foodItemId), p: place(m.categoryId) }))
      .filter((r): r is { m: MenuMapping; f: MenuFood; p: [number, number] } => Boolean(r.f) && r.f!.available !== false && !r.f!.isDraft && r.f!.name.trim() !== '')
      .sort((a, b) => a.p[0] - b.p[0] || a.p[1] - b.p[1] || num(a.m.sequence, 1e6) - num(b.m.sequence, 1e6) || a.f.name.localeCompare(b.f.name));
    const seen = new Set<string>();
    out[date] = rows
      .map((r) => r.f.name.replace(/\s+/g, ' ').trim())
      .filter((n) => (seen.has(n.toLowerCase()) ? false : (seen.add(n.toLowerCase()), true)));
  }
  return out;
}
