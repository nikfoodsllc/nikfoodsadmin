import { comboParts, type KitchenRow } from './kitchenDashboard';

/**
 * Recipe items: hidden extras that go with a menu item (raita with biryani, chutney with kachori). Customers never see them and
 * they are not on any menu, but the kitchen counts, the Kitchen Report and the Packing Report count them so the kitchen knows
 * how much to prepare and pack.
 *
 * Each recipe item says what it is measured in (ounces, pounds, grams, kilograms or pieces). A food item carries `recipeLines`:
 * which recipe item goes with it and how much (a number in that unit), per size of the item (the 16Oz gets 4) with one `amount` for
 * an item without sizes (or for a size nobody listed). The reports add the amounts up in oz / lb / g / pieces.
 */
export interface RecipeLine {
  recipeItemId: string;
  /** Used when the ordered line has no size, or its size has no entry in bySize (a number in the recipe item's unit) */
  amount?: number;
  /** Size label of the item (as ordered) -> amount of the recipe item, e.g. { '16Oz': 4, '12Oz': 3 } */
  bySize?: Record<string, number>;
}

export type RecipeUnit = 'oz' | 'lb' | 'g' | 'kg' | 'pc';
/** The units a recipe item can be measured in, with the label the reports use ("4Oz", "0.5Lb", "100g", "2Kg", "3Pc") */
export const RECIPE_UNITS: Array<{ key: RecipeUnit; label: string; name: string }> = [
  { key: 'oz', label: 'Oz', name: 'Ounces (oz)' },
  { key: 'lb', label: 'Lb', name: 'Pounds (lb)' },
  { key: 'g', label: 'g', name: 'Grams (g)' },
  { key: 'kg', label: 'Kg', name: 'Kilograms (kg)' },
  { key: 'pc', label: 'Pc', name: 'Pieces (pc)' },
];
export const DEFAULT_RECIPE_UNIT: RecipeUnit = 'oz';
export const MAX_RECIPE_AMOUNT = 10000;

export function isRecipeUnit(value: unknown): value is RecipeUnit {
  return RECIPE_UNITS.some((u) => u.key === value);
}
/** The unit to use for a stored value: a recipe item saved before units existed is in ounces. */
export function normalizeRecipeUnit(value: unknown): RecipeUnit {
  return isRecipeUnit(value) ? value : DEFAULT_RECIPE_UNIT;
}
export const recipeUnitLabel = (unit: RecipeUnit): string => RECIPE_UNITS.find((u) => u.key === unit)?.label ?? 'Oz';

/** The size label the reports use for an amount: 4 + oz = "4Oz", 0.5 + lb = "0.5Lb". */
export function amountLabel(amount: number, unit: RecipeUnit): string {
  const rounded = Math.round(amount * 100) / 100;
  return `${rounded}${recipeUnitLabel(unit)}`;
}

export const MAX_RECIPE_LINES = 12;
export const MAX_RECIPE_SIZES = 20;
const ID = /^[0-9a-f]{24}$/i;
const norm = (v: unknown) => String(v ?? '').trim().toLowerCase();

/** An amount the reports can add up: a number above 0 (in the recipe item's unit). Numbers typed as text count too. */
export function isUsableAmount(value: unknown): value is number | string {
  const n = typeof value === 'string' && value.trim() !== '' ? Number(value) : value;
  return typeof n === 'number' && Number.isFinite(n) && n > 0 && n <= MAX_RECIPE_AMOUNT;
}
const toAmount = (value: unknown): number => Math.round(Number(value) * 100) / 100;

/** Whatever was sent or stored, as valid lines (bad ones are dropped, a recipe item is listed once). */
export function cleanRecipeLines(raw: unknown): RecipeLine[] {
  if (!Array.isArray(raw)) return [];
  const out: RecipeLine[] = [];
  for (const entry of raw) {
    const e = (entry ?? {}) as Record<string, unknown>;
    const id = typeof e.recipeItemId === 'string' ? e.recipeItemId.trim().toLowerCase() : '';
    if (!ID.test(id) || out.some((l) => l.recipeItemId === id)) continue;
    const amount = isUsableAmount(e.amount) && toAmount(e.amount) > 0 ? toAmount(e.amount) : undefined;
    const bySize: Record<string, number> = {};
    if (e.bySize && typeof e.bySize === 'object' && !Array.isArray(e.bySize)) {
      for (const [size, value] of Object.entries(e.bySize as Record<string, unknown>)) {
        if (Object.keys(bySize).length >= MAX_RECIPE_SIZES) break;
        if (size.trim() && size.length <= 40 && isUsableAmount(value) && toAmount(value) > 0) bySize[size.trim()] = toAmount(value);
      }
    }
    if (!amount && Object.keys(bySize).length === 0) continue;
    out.push({ recipeItemId: id, ...(amount ? { amount } : {}), ...(Object.keys(bySize).length > 0 ? { bySize } : {}) });
    if (out.length >= MAX_RECIPE_LINES) break;
  }
  return out;
}

/** How much of the recipe item goes with ONE order of the item in this size, or null when nothing is set for it. */
export function amountForLine(line: RecipeLine, portion: string | null | undefined): number | null {
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
export function expandRecipeRows<T extends KitchenRow>(rows: T[], linesByFoodId: Map<string, RecipeLine[]>, recipeById: Map<string, { name: string; unit?: RecipeUnit }>): T[] {
  if (linesByFoodId.size === 0 || recipeById.size === 0) return rows;
  const extra: T[] = [];
  const add = (base: T, foodId: string, parentName: string, portion: string | null | undefined, quantity: number) => {
    for (const line of linesByFoodId.get(foodId) ?? []) {
      const item = recipeById.get(line.recipeItemId);
      const amount = amountForLine(line, portion);
      if (!item || !amount) continue;
      extra.push({ ...base, name: item.name, foodId: line.recipeItemId, quantity, portion: amountLabel(amount, normalizeRecipeUnit(item.unit)), spiceLevel: null, isEco: false, sections: null, comboSelections: null, partUnits: null, notes: null, recipeOf: parentName });
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
      const values = Object.values(line.bySize ?? {}).filter((v) => v !== null && v !== undefined && String(v).trim() !== '');
      if (values.length === 0) return 'Give every recipe item an amount for at least one size.';
      if (values.some((v) => !isUsableAmount(v))) return 'Amounts are numbers above 0, like 4 or 0.5.';
    } else {
      const v = line.amount;
      if (v === undefined || v === null || String(v).trim() === '') return 'Give every recipe item an amount.';
      if (!isUsableAmount(v)) return 'Amounts are numbers above 0, like 4 or 0.5.';
    }
  }
  return null;
}
