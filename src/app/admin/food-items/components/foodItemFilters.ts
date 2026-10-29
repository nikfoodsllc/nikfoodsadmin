import { PreparationFilter, isPreparationFilter } from '@/utils/preparationType';
import { StickerFilter, isStickerFilter } from '@/utils/stickerFlag';
import { ChefsPickFilter, isChefsPickFilter } from '@/utils/chefsPick';
import { InstructionsFilter, isInstructionsFilter } from '@/utils/itemInstructions';

/** The column filters above the Food Items table. 'all' means the filter is off. */
export interface FoodItemFilters {
  veg: 'all' | 'true' | 'false';
  available: 'all' | 'true' | 'false';
  itemType: 'all' | 'simple' | 'portions' | 'combo';
  preparation: PreparationFilter;
  sticker: StickerFilter;
  splitSticker: StickerFilter;
  chefsPick: ChefsPickFilter;
  allowInstructions: InstructionsFilter;
  /** A top-level category id ('all' = off): items in it or in any of its sub-categories */
  category: string;
  /** A sub-category id ('all' = off): items in that sub-category only */
  subCategory: string;
}

/** The categories as the filter needs them: each top-level category with the ids of its sub-categories. */
export interface CategoryTree {
  children: Map<string, string[]>;
}

export function buildCategoryTree(raw: Array<{ _id?: unknown; parentCategoryId?: unknown }>): CategoryTree {
  const children = new Map<string, string[]>();
  for (const c of raw) {
    const parent = c.parentCategoryId == null ? '' : String(c.parentCategoryId).trim();
    if (!parent) continue;
    const list = children.get(parent) ?? [];
    list.push(String(c._id));
    children.set(parent, list);
  }
  return { children };
}

/** The category ids an item must be in to match: the sub-category when one is picked, else the category with all its sub-categories. */
export function categoryFilterIds(filters: Pick<FoodItemFilters, 'category' | 'subCategory'>, tree?: CategoryTree): string[] {
  if (filters.subCategory !== 'all') return [filters.subCategory];
  if (filters.category !== 'all') return [filters.category, ...(tree?.children.get(filters.category) ?? [])];
  return [];
}

export const DEFAULT_FOOD_ITEM_FILTERS: FoodItemFilters = {
  veg: 'all',
  available: 'all',
  itemType: 'all',
  preparation: 'all',
  sticker: 'all',
  splitSticker: 'all',
  chefsPick: 'all',
  allowInstructions: 'all',
  category: 'all',
  subCategory: 'all',
};

/** The query parameters of the food items list API for these filters (filters that are off are left out). */
export function foodItemFilterParams(filters: FoodItemFilters, tree?: CategoryTree): Array<[string, string]> {
  const params: Array<[string, string]> = [];
  const categoryIds = categoryFilterIds(filters, tree);
  if (categoryIds.length > 0) params.push(['category', categoryIds.join(',')]);
  if (filters.veg !== 'all') params.push(['veg', filters.veg]);
  if (filters.available !== 'all') params.push(['available', filters.available]);
  if (filters.itemType !== 'all') params.push(['itemType', filters.itemType]);
  if (filters.preparation !== 'all' && isPreparationFilter(filters.preparation)) {
    params.push(['preparationType', filters.preparation]);
  }
  if (filters.sticker !== 'all' && isStickerFilter(filters.sticker)) params.push(['sticker', filters.sticker]);
  if (filters.splitSticker !== 'all' && isStickerFilter(filters.splitSticker)) params.push(['splitSticker', filters.splitSticker]);
  if (filters.chefsPick !== 'all' && isChefsPickFilter(filters.chefsPick)) params.push(['chefsPick', filters.chefsPick]);
  if (filters.allowInstructions !== 'all' && isInstructionsFilter(filters.allowInstructions)) params.push(['allowInstructions', filters.allowInstructions]);
  return params;
}

export function hasActiveFilters(filters: FoodItemFilters): boolean {
  return foodItemFilterParams(filters).length > 0;
}
