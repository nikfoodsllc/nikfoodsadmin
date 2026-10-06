import { describe, expect, it } from 'vitest';
import { DEFAULT_FOOD_ITEM_FILTERS, foodItemFilterParams, hasActiveFilters } from './foodItemFilters';

describe('foodItemFilterParams', () => {
  it('sends nothing when every filter is off', () => {
    expect(foodItemFilterParams(DEFAULT_FOOD_ITEM_FILTERS)).toEqual([]);
    expect(hasActiveFilters(DEFAULT_FOOD_ITEM_FILTERS)).toBe(false);
  });

  it('sends only the filters that are on', () => {
    expect(foodItemFilterParams({ ...DEFAULT_FOOD_ITEM_FILTERS, veg: 'false' })).toEqual([['veg', 'false']]);
    expect(foodItemFilterParams({ ...DEFAULT_FOOD_ITEM_FILTERS, preparation: 'not_set' })).toEqual([['preparationType', 'not_set']]);
    expect(hasActiveFilters({ ...DEFAULT_FOOD_ITEM_FILTERS, available: 'true' })).toBe(true);
  });

  it('sends all four together', () => {
    expect(foodItemFilterParams({ veg: 'true', available: 'false', itemType: 'combo', preparation: 'cooked' })).toEqual([
      ['veg', 'true'],
      ['available', 'false'],
      ['itemType', 'combo'],
      ['preparationType', 'cooked'],
    ]);
  });
});
