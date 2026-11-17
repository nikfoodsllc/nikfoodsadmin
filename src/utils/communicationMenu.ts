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

/** The sub-categories the New menu email's day boxes fill from (the rest of the day's menu is left out of the email). */
export const MENU_EMAIL_SUBCATEGORIES = ['Appetizers', 'Paranthe Wali Gali', 'Main Course'];
const nameKey = (t: string | undefined) => String(t ?? '').toLowerCase().replace(/[^a-z0-9]/g, '');

/** Which sub-categories each item is in (an item sits under the day's parent category; its sub-category is a separate link). */
export type ItemSubCategories = Record<string, Array<{ name: string; sequence?: number }>>;

/**
 * `only` keeps just the items in the named sub-categories (by name, ignoring case and spacing), listed in the order of those
 * sub-categories on the menu and then by the item's place in the day.
 */
export function buildDayMenus(dates: string[], mappings: MenuMapping[], categories: MenuCategory[], foods: MenuFood[], only?: { names: string[]; itemSubs: ItemSubCategories }): Record<string, string[]> {
  const wanted = only ? new Set(only.names.map(nameKey)) : null;
  /** the place of the item's first matching sub-category (null = not in any wanted one) */
  const subPlace = (foodId: string): number | null => {
    if (!wanted || !only) return 0;
    const hits = (only.itemSubs[foodId] ?? []).filter((x) => wanted.has(nameKey(x.name)));
    return hits.length ? Math.min(...hits.map((h) => num(h.sequence, 1e6))) : null;
  };
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
      .filter((m) => m.day === date && !hidden(m.categoryId) && subPlace(m.foodItemId) !== null)
      .map((m) => ({ m, f: food.get(m.foodItemId), p: place(m.categoryId), sp: subPlace(m.foodItemId) ?? 0 }))
      .filter((r): r is { m: MenuMapping; f: MenuFood; p: [number, number]; sp: number } => Boolean(r.f) && r.f!.available !== false && !r.f!.isDraft && r.f!.name.trim() !== '')
      .sort((a, b) => a.p[0] - b.p[0] || a.p[1] - b.p[1] || a.sp - b.sp || num(a.m.sequence, 1e6) - num(b.m.sequence, 1e6) || a.f.name.localeCompare(b.f.name));
    const seen = new Set<string>();
    out[date] = rows
      .map((r) => r.f.name.replace(/\s+/g, ' ').trim())
      .filter((n) => (seen.has(n.toLowerCase()) ? false : (seen.add(n.toLowerCase()), true)));
  }
  return out;
}

export interface FlatCategoryOption {
  id: string;
  /** "Indian Sweets" or "Food Menu > Mains" for a sub-category */
  label: string;
}

/** The categories an extra box can be filled from: flat categories and their sub-categories that customers can see, in menu order. */
export function flatCategoryOptions(categories: Array<MenuCategory & { listingType?: string }>): FlatCategoryOption[] {
  const byId = new Map(categories.map((c) => [c.id, c]));
  const hiddenCat = (c: MenuCategory) => Boolean(c.isDraft) || (c.parentId ? Boolean(byId.get(c.parentId)?.isDraft) : false);
  const isFlat = (c: MenuCategory & { listingType?: string }) => (c.parentId ? (byId.get(c.parentId) as { listingType?: string } | undefined)?.listingType : c.listingType) !== 'day-wise';
  return categories
    .filter((c) => !hiddenCat(c) && isFlat(c) && (c.name ?? '').trim() !== '')
    .sort((a, b) => num(a.parentId ? byId.get(a.parentId)?.sequence : a.sequence, 1e6) - num(b.parentId ? byId.get(b.parentId)?.sequence : b.sequence, 1e6) || (a.parentId ? 1 : 0) - (b.parentId ? 1 : 0) || num(a.sequence, 1e6) - num(b.sequence, 1e6))
    .map((c) => ({ id: c.id, label: c.parentId && byId.get(c.parentId)?.name ? `${byId.get(c.parentId)!.name} > ${c.name}` : String(c.name) }));
}

/** The items of a flat category (its own, then each sub-category's), as dish names in menu order, without anything customers cannot order. */
export function buildCategoryItems(rootId: string, mappings: Array<{ categoryId: string; foodItemId: string; sequence?: number }>, categories: MenuCategory[], foods: MenuFood[]): string[] {
  const cat = new Map(categories.map((c) => [c.id, c]));
  const root = cat.get(rootId);
  if (!root || root.isDraft || (root.parentId && cat.get(root.parentId)?.isDraft)) return [];
  const food = new Map(foods.map((f) => [f.id, f]));
  const kids = categories.filter((c) => c.parentId === rootId && !c.isDraft).sort((a, b) => num(a.sequence, 1e6) - num(b.sequence, 1e6));
  const seen = new Set<string>();
  const out: string[] = [];
  for (const id of [rootId, ...kids.map((k) => k.id)]) {
    const rows = mappings
      .filter((m) => m.categoryId === id)
      .map((m) => ({ m, f: food.get(m.foodItemId) }))
      .filter((r): r is { m: { categoryId: string; foodItemId: string; sequence?: number }; f: MenuFood } => Boolean(r.f) && r.f!.available !== false && !r.f!.isDraft && r.f!.name.trim() !== '')
      .sort((a, b) => num(a.m.sequence, 1e6) - num(b.m.sequence, 1e6) || a.f.name.localeCompare(b.f.name));
    for (const r of rows) {
      const n = r.f.name.replace(/\s+/g, ' ').trim();
      if (!seen.has(n.toLowerCase())) {
        seen.add(n.toLowerCase());
        out.push(n);
      }
    }
  }
  return out;
}
