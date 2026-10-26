import { describe, expect, it } from 'vitest';
import { buildRankMaps, categoryOrder, orderBlock, sortByRank } from './kitchenOrder';

const cats = [
  { _id: 'menu', name: 'Food Menu', sequence: 1 },
  { _id: 'sweets', name: 'Indian Sweets', sequence: 2 },
  { _id: 'curry', name: 'Curries', sequence: 2, parentCategoryId: 'menu' },
  { _id: 'bread', name: 'Breads', sequence: 1, parentCategoryId: 'menu' },
];
const names = new Map([['1', 'Naan'], ['2', 'Dal'], ['3', 'Paneer'], ['4', 'Halwa'], ['5', 'Rajma'], ['6', 'Lonely']]);

describe('kitchen dashboard category order', () => {
  it('category, then its sub-categories, then the next category', () => {
    expect(categoryOrder(cats)).toEqual(['menu', 'bread', 'curry', 'sweets']);
  });

  it('orders by category, sub-category, then item sequence, with the day-wise mapping of that day first', () => {
    const maps = buildRankMaps(
      cats,
      [
        { foodItemId: '1', categoryId: 'bread', sequence: 1, mappingType: 'DAY_WISE', day: '2026-10-26' },
        { foodItemId: '3', categoryId: 'curry', sequence: 1, mappingType: 'DAY_WISE', day: '2026-10-26' },
        { foodItemId: '2', categoryId: 'curry', sequence: 2, mappingType: 'DAY_WISE', day: '2026-10-26' },
        { foodItemId: '5', categoryId: 'curry', sequence: 1, mappingType: 'DAY_WISE', day: '2026-10-27' },
        { foodItemId: '2', categoryId: 'curry', sequence: 2, mappingType: 'DAY_WISE', day: '2026-10-27' },
        { foodItemId: '4', categoryId: 'sweets', sequence: 1, mappingType: 'FLAT' },
      ],
      names
    );
    const block = { items: ['Halwa', 'Dal', 'Lonely', 'Paneer', 'Naan'].map((name) => ({ name })), combos: [] };
    expect(orderBlock(block, maps, '2026-10-26').items.map((i) => i.name)).toEqual(['Naan', 'Paneer', 'Dal', 'Halwa', 'Lonely']);
    // another day: Dal has its own place there; without a day the best rank over all days is used
    expect(orderBlock({ items: [{ name: 'Dal' }, { name: 'Rajma' }], combos: [] }, maps, '2026-10-27').items.map((i) => i.name)).toEqual(['Rajma', 'Dal']);
    expect(orderBlock(block, maps).items.map((i) => i.name)).toEqual(['Naan', 'Paneer', 'Dal', 'Halwa', 'Lonely']);
  });

  it('keeps the existing order for items without a category and does not change the input', () => {
    const list = [{ name: 'B' }, { name: 'A' }];
    expect(sortByRank(list, () => undefined).map((i) => i.name)).toEqual(['B', 'A']);
    expect(list.map((i) => i.name)).toEqual(['B', 'A']);
  });
});
