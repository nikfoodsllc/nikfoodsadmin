import { PreparationFilter, isPreparationFilter } from '@/utils/preparationType';
import { StickerFilter, isStickerFilter } from '@/utils/stickerFlag';

/** The column filters above the Food Items table. 'all' means the filter is off. */
export interface FoodItemFilters {
  veg: 'all' | 'true' | 'false';
  available: 'all' | 'true' | 'false';
  itemType: 'all' | 'simple' | 'portions' | 'combo';
  preparation: PreparationFilter;
  sticker: StickerFilter;
  splitSticker: StickerFilter;
}

export const DEFAULT_FOOD_ITEM_FILTERS: FoodItemFilters = {
  veg: 'all',
  available: 'all',
  itemType: 'all',
  preparation: 'all',
  sticker: 'all',
  splitSticker: 'all',
};

/** The query parameters of the food items list API for these filters (filters that are off are left out). */
export function foodItemFilterParams(filters: FoodItemFilters): Array<[string, string]> {
  const params: Array<[string, string]> = [];
  if (filters.veg !== 'all') params.push(['veg', filters.veg]);
  if (filters.available !== 'all') params.push(['available', filters.available]);
  if (filters.itemType !== 'all') params.push(['itemType', filters.itemType]);
  if (filters.preparation !== 'all' && isPreparationFilter(filters.preparation)) {
    params.push(['preparationType', filters.preparation]);
  }
  if (filters.sticker !== 'all' && isStickerFilter(filters.sticker)) params.push(['sticker', filters.sticker]);
  if (filters.splitSticker !== 'all' && isStickerFilter(filters.splitSticker)) params.push(['splitSticker', filters.splitSticker]);
  return params;
}

export function hasActiveFilters(filters: FoodItemFilters): boolean {
  return foodItemFilterParams(filters).length > 0;
}
