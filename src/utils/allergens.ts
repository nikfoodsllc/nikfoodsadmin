/**
 * The allergens a food item can carry (Food Items > Allergens). An item with none ticked has none.
 * Keep this list in step with livesite/src/lib/allergens.ts (same keys): the customer site and the app show them.
 */
export type AllergenKey = 'milk' | 'eggs' | 'fish' | 'shellfish' | 'tree_nuts' | 'peanuts' | 'gluten' | 'soy' | 'sesame' | 'mustard';

export interface AllergenInfo {
  key: AllergenKey;
  label: string;
  /** emoji shown next to the name (none for soy, sesame and mustard) */
  emoji?: string;
  /** chip colours */
  color: string;
  bg: string;
}

export const ALLERGENS: readonly AllergenInfo[] = [
  { key: 'milk', label: 'Dairy', emoji: '\u{1F95B}', color: '#1D4ED8', bg: '#DBEAFE' },
  { key: 'eggs', label: 'Eggs', emoji: '\u{1F95A}', color: '#A16207', bg: '#FEF3C7' },
  { key: 'fish', label: 'Fish', emoji: '\u{1F41F}', color: '#0E7490', bg: '#CFFAFE' },
  { key: 'shellfish', label: 'Shellfish', emoji: '\u{1F990}', color: '#B91C1C', bg: '#FEE2E2' },
  { key: 'tree_nuts', label: 'Tree nuts', emoji: '\u{1F330}', color: '#7C2D12', bg: '#FFEDD5' },
  { key: 'peanuts', label: 'Peanuts', emoji: '\u{1F95C}', color: '#92400E', bg: '#FDE68A' },
  { key: 'gluten', label: 'Gluten', emoji: '\u{1F33E}', color: '#B45309', bg: '#FEF3C7' },
  { key: 'soy', label: 'Soy', color: '#15803D', bg: '#DCFCE7' },
  { key: 'sesame', label: 'Sesame', color: '#57534E', bg: '#E7E5E4' },
  { key: 'mustard', label: 'Mustard', color: '#A16207', bg: '#FEF9C3' },
] as const;

const KEYS = new Set<string>(ALLERGENS.map((a) => a.key));

export function isAllergenKey(value: unknown): value is AllergenKey {
  return typeof value === 'string' && KEYS.has(value);
}

/** Only the known allergens of a stored or typed value, once each, in the standard order. */
export function cleanAllergens(value: unknown): AllergenKey[] {
  if (!Array.isArray(value)) return [];
  const have = new Set(value.filter(isAllergenKey));
  return ALLERGENS.filter((a) => have.has(a.key)).map((a) => a.key);
}

export function allergenLabel(key: string): string {
  return ALLERGENS.find((a) => a.key === key)?.label ?? key;
}

/** "Dairy, Gluten" for a list, or "None" when empty. */
export function allergensText(value: unknown): string {
  const list = cleanAllergens(value);
  return list.length === 0 ? 'None' : list.map(allergenLabel).join(', ');
}

/** The list filter above the Food Items table: everything, items containing one allergen, or items with none. */
export type AllergenFilter = 'all' | 'none' | AllergenKey;
export const isAllergenFilter = (value: unknown): value is AllergenFilter => value === 'all' || value === 'none' || isAllergenKey(value);

/** How a bulk update treats the ticked allergens: add them to each item, replace each item's list, or take them off. */
export type AllergenBulkMode = 'add' | 'replace' | 'remove';
export const isAllergenBulkMode = (value: unknown): value is AllergenBulkMode => value === 'add' || value === 'replace' || value === 'remove';

/** The allergen list an item ends up with after a bulk update. */
export function applyAllergenBulk(current: unknown, mode: AllergenBulkMode, picked: unknown): AllergenKey[] {
  const have = cleanAllergens(current);
  const pick = cleanAllergens(picked);
  if (mode === 'replace') return pick;
  if (mode === 'add') return cleanAllergens([...have, ...pick]);
  return have.filter((k) => !pick.includes(k));
}
