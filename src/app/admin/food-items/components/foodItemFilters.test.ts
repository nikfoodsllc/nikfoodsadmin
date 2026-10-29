import { describe, expect, it } from 'vitest';
import { DEFAULT_FOOD_ITEM_FILTERS, buildCategoryTree, categoryFilterIds, foodItemFilterParams, hasActiveFilters } from './foodItemFilters';

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

  it('sends the split sticker filter', () => {
    expect(foodItemFilterParams({ ...DEFAULT_FOOD_ITEM_FILTERS, splitSticker: 'no' })).toEqual([['splitSticker', 'no']]);
  });
  it('sends the chefs pick filter', () => {
    expect(foodItemFilterParams({ ...DEFAULT_FOOD_ITEM_FILTERS, chefsPick: 'yes' })).toEqual([['chefsPick', 'yes']]);
    expect(foodItemFilterParams({ ...DEFAULT_FOOD_ITEM_FILTERS, chefsPick: 'no' })).toEqual([['chefsPick', 'no']]);
  });
  it('sends the special instructions filter', () => {
    expect(foodItemFilterParams({ ...DEFAULT_FOOD_ITEM_FILTERS, allowInstructions: 'yes' })).toEqual([['allowInstructions', 'yes']]);
    expect(foodItemFilterParams({ ...DEFAULT_FOOD_ITEM_FILTERS, allowInstructions: 'no' })).toEqual([['allowInstructions', 'no']]);
  });
  it('sends the sticker filter', () => {
    expect(foodItemFilterParams({ ...DEFAULT_FOOD_ITEM_FILTERS, sticker: 'yes' })).toEqual([['sticker', 'yes']]);
  });

  it('sends all four together', () => {
    expect(foodItemFilterParams({ veg: 'true', available: 'false', itemType: 'combo', preparation: 'cooked', sticker: 'all', splitSticker: 'all', chefsPick: 'all', allowInstructions: 'all', category: 'all', subCategory: 'all' })).toEqual([
      ['veg', 'true'],
      ['available', 'false'],
      ['itemType', 'combo'],
      ['preparationType', 'cooked'],
    ]);
  });
});

describe('category filters', () => {
  const tree = buildCategoryTree([
    { _id: 'app' },
    { _id: 'veg-app', parentCategoryId: 'app' },
    { _id: 'nonveg-app', parentCategoryId: 'app' },
    { _id: 'sweets' },
  ]);
  it('a category matches itself and all its sub-categories', () => {
    expect(categoryFilterIds({ category: 'app', subCategory: 'all' }, tree)).toEqual(['app', 'veg-app', 'nonveg-app']);
    expect(foodItemFilterParams({ ...DEFAULT_FOOD_ITEM_FILTERS, category: 'app' }, tree)).toEqual([['category', 'app,veg-app,nonveg-app']]);
    expect(foodItemFilterParams({ ...DEFAULT_FOOD_ITEM_FILTERS, category: 'sweets' }, tree)).toEqual([['category', 'sweets']]);
  });
  it('a sub-category matches only itself, even with its category picked', () => {
    expect(foodItemFilterParams({ ...DEFAULT_FOOD_ITEM_FILTERS, category: 'app', subCategory: 'veg-app' }, tree)).toEqual([['category', 'veg-app']]);
    expect(hasActiveFilters({ ...DEFAULT_FOOD_ITEM_FILTERS, subCategory: 'veg-app' })).toBe(true);
  });
  it('with both off nothing is sent', () => {
    expect(categoryFilterIds(DEFAULT_FOOD_ITEM_FILTERS, tree)).toEqual([]);
  });
});
