import { comboParts, parsePortionAmount, type KitchenRow } from './kitchenDashboard';

/**
 * Recipe items: hidden extras that go with a menu item (raita with biryani, chutney with kachori). Customers never see them and
 * they are not on any menu, but the kitchen counts, the Kitchen Report and the Packing Report count them so the kitchen knows
 * how much to prepare and pack.
 *
 * A food item carries `recipeLines`: which recipe item goes with it and how much, per size of the item ("16Oz" gets 4Oz) with
 * one `amount` for an item without sizes (or for a size nobody listed). The amount is a size label like the combo options use
 * ("4Oz", "0.5Lb", "2Pc"), so it adds up into oz / lb / pieces in the reports.
 */
export interface RecipeLine {
  recipeItemId: string;
  /** Used when the ordered line has no size, or its size has no entry in bySize */
  amount?: string;
  /** Size label of the item (as ordered) -> amount of the recipe item, e.g. { '16Oz': '4Oz', '12Oz': '3Oz' } */
  bySize?: Record<string, string>;
}

export const MAX_RECIPE_LINES = 12;
export const MAX_RECIPE_SIZES = 20;
const ID = /^[0-9a-f]{24}$/i;
const norm = (v: unknown) => String(v ?? '').trim().toLowerCase();

/** An amount the reports can add up: a size label like "4Oz", "0.5Lb", "100g" or "2Pc". */
export function isUsableAmount(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0 && value.trim().length <= 20 && parsePortionAmount(value.trim()) !== null;
}

/** Whatever was sent or stored, as valid lines (bad ones are dropped, a recipe item is listed once). */
export function cleanRecipeLines(raw: unknown): RecipeLine[] {
  if (!Array.isArray(raw)) return [];
  const out: RecipeLine[] = [];
  for (const entry of raw) {
    const e = (entry ?? {}) as Record<string, unknown>;
    const id = typeof e.recipeItemId === 'string' ? e.recipeItemId.trim().toLowerCase() : '';
    if (!ID.test(id) || out.some((l) => l.recipeItemId === id)) continue;
    const amount = isUsableAmount(e.amount) ? e.amount.trim() : undefined;
    const bySize: Record<string, string> = {};
    if (e.bySize && typeof e.bySize === 'object' && !Array.isArray(e.bySize)) {
      for (const [size, value] of Object.entries(e.bySize as Record<string, unknown>)) {
        if (Object.keys(bySize).length >= MAX_RECIPE_SIZES) break;
        if (size.trim() && size.length <= 40 && isUsableAmount(value)) bySize[size.trim()] = value.trim();
      }
    }
    if (!amount && Object.keys(bySize).length === 0) continue;
    out.push({ recipeItemId: id, ...(amount ? { amount } : {}), ...(Object.keys(bySize).length > 0 ? { bySize } : {}) });
    if (out.length >= MAX_RECIPE_LINES) break;
  }
  return out;
}

/** How much of the recipe item goes with ONE order of the item in this size, or null when nothing is set for it. */
export function amountForLine(line: RecipeLine, portion: string | null | undefined): string | null {
  const size = norm(portion);
  if (size && line.bySize) {
    for (const [label, amount] of Object.entries(line.bySize)) if (norm(label) === size) return amount;
  }
  return line.amount ?? null;
}

/** The food item ids a list of order lines may have recipes for: plain items and the items picked inside combos. */
export function recipeFoodIds(rows: Array<Pick<KitchenRow, 'foodId' | 'sections' | 'comboSelections' | 'partUnits'>>): string[] {
  const ids = new Set<string>();
  for (const row of rows) {
    const parts = comboParts(row);
    if (parts.length > 0) {
      for (const part of parts) if (part.id && ID.test(part.id)) ids.add(part.id);
    } else if (row.foodId && ID.test(row.foodId)) ids.add(row.foodId);
  }
  return [...ids];
}

/**
 * The order lines plus one extra line for every recipe item that goes with them. An extra line is the recipe item as an ordinary
 * item (its own name, its amount as the size, the ordered quantity) marked `recipeOf` with the item it goes with, so every count
 * and list treats it like any other item. Call it BEFORE the "quantity per order" scaling: a recipe amount is per order.
 */
export function expandRecipeRows<T extends KitchenRow>(rows: T[], linesByFoodId: Map<string, RecipeLine[]>, recipeById: Map<string, { name: string }>): T[] {
  if (linesByFoodId.size === 0 || recipeById.size === 0) return rows;
  const extra: T[] = [];
  const add = (base: T, foodId: string, parentName: string, portion: string | null | undefined, quantity: number) => {
    for (const line of linesByFoodId.get(foodId) ?? []) {
      const item = recipeById.get(line.recipeItemId);
      const amount = amountForLine(line, portion);
      if (!item || !amount) continue;
      extra.push({ ...base, name: item.name, foodId: line.recipeItemId, quantity, portion: amount, spiceLevel: null, isEco: false, sections: null, comboSelections: null, partUnits: null, notes: null, recipeOf: parentName });
    }
  };
  for (const row of rows) {
    if (!Number.isFinite(row.quantity) || row.quantity <= 0) continue;
    const parts = comboParts(row);
    if (parts.length > 0) {
      for (const part of parts) if (part.id) add(row, part.id, part.name, part.portion, row.quantity * part.quantity);
    } else if (row.foodId) add(row, row.foodId, String(row.name ?? '').trim(), row.portion, row.quantity);
  }
  return extra.length > 0 ? [...rows, ...extra] : rows;
}

/**
 * What is wrong with the recipe lines being edited, or null when they can be saved. `sized` = the item has sizes: then each line's
 * amounts are per size (an empty size box means nothing goes with that size), otherwise each line has one amount.
 */
export function recipeLinesProblem(lines: RecipeLine[] | null | undefined, sized: boolean): string | null {
  for (const line of lines ?? []) {
    if (sized) {
      const values = Object.values(line.bySize ?? {}).map((v) => String(v ?? '').trim()).filter(Boolean);
      if (values.length === 0) return 'Give every recipe item an amount for at least one size.';
      if (values.some((v) => !isUsableAmount(v))) return 'Use an amount like 4Oz, 0.5Lb, 100g or 2Pc.';
    } else {
      const v = String(line.amount ?? '').trim();
      if (!v) return 'Give every recipe item an amount.';
      if (!isUsableAmount(v)) return 'Use an amount like 4Oz, 0.5Lb, 100g or 2Pc.';
    }
  }
  return null;
}
