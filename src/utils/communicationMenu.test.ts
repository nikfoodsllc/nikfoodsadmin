import { describe, expect, it } from 'vitest';
import { buildCategoryItems, buildDayMenus, flatCategoryOptions } from './communicationMenu';

const cats = [
  { id: 'menu', name: 'Food Menu', sequence: 1 },
  { id: 'main', name: 'Mains', sequence: 2, parentId: 'menu' },
  { id: 'app', name: 'Appetizers', sequence: 1, parentId: 'menu' },
  { id: 'old', name: 'Retired', sequence: 3, isDraft: true },
  { id: 'oldsub', name: 'Retired sub', sequence: 1, parentId: 'old' },
];
const foods = [
  { id: 'a', name: 'Samosa' },
  { id: 'b', name: 'Dal Makhani' },
  { id: 'c', name: 'Paneer  Tikka ' },
  { id: 'd', name: 'Sold Out', available: false },
  { id: 'e', name: 'Draft Dish', isDraft: true },
  { id: 'f', name: 'Hidden Dish' },
  { id: 'g', name: 'dal makhani' },
];
const m = (day: string, categoryId: string, foodItemId: string, sequence = 0) => ({ day, categoryId, foodItemId, sequence });

describe('buildDayMenus', () => {
  it('lists a date in menu order and keeps each date apart', () => {
    const out = buildDayMenus(['2026-11-17', '2026-11-18'], [m('2026-11-17', 'main', 'b', 1), m('2026-11-17', 'app', 'a', 0), m('2026-11-17', 'main', 'c', 0), m('2026-11-18', 'app', 'c')], cats, foods);
    expect(out['2026-11-17']).toEqual(['Samosa', 'Paneer Tikka', 'Dal Makhani']);
    expect(out['2026-11-18']).toEqual(['Paneer Tikka']);
  });
  it('leaves out unavailable, draft and hidden-category items, and repeats', () => {
    const out = buildDayMenus(['d'], [m('d', 'app', 'd'), m('d', 'app', 'e'), m('d', 'old', 'f'), m('d', 'oldsub', 'f'), m('d', 'app', 'b'), m('d', 'main', 'g')], cats, foods);
    expect(out.d).toEqual(['Dal Makhani']);
  });
  it('gives an empty list for a date with no menu and ignores other dates', () => {
    expect(buildDayMenus(['x'], [m('y', 'app', 'a')], cats, foods)).toEqual({ x: [] });
  });
});


describe('only some sub-categories', () => {
  // the day lists items under the parent; an item's sub-category is a separate link
  const cats = [{ id: 'menu', name: 'Food Menu', sequence: 1 }];
  const foods = [{ id: 'a', name: 'Samosa' }, { id: 'b', name: 'Dal' }, { id: 'c', name: 'Lassi' }, { id: 'd', name: 'Aloo Paratha' }, { id: 'e', name: 'Unsorted' }];
  const maps = [
    { day: 'd', categoryId: 'menu', foodItemId: 'b', sequence: 0 },
    { day: 'd', categoryId: 'menu', foodItemId: 'a', sequence: 1 },
    { day: 'd', categoryId: 'menu', foodItemId: 'c', sequence: 2 },
    { day: 'd', categoryId: 'menu', foodItemId: 'd', sequence: 3 },
    { day: 'd', categoryId: 'menu', foodItemId: 'e', sequence: 4 },
  ];
  const itemSubs = { a: [{ name: 'Appetizers', sequence: 2 }], b: [{ name: 'Main Course', sequence: 4 }], c: [{ name: 'Beverages', sequence: 1 }], d: [{ name: 'Paranthe Wali Gali', sequence: 3 }] };
  const names = ['Appetizers', 'paranthe wali gali', 'MainCourse'];
  it('keeps only items in the chosen sub-categories, in the menu order of those sub-categories', () => {
    expect(buildDayMenus(['d'], maps, cats, foods, { names, itemSubs }).d).toEqual(['Samosa', 'Aloo Paratha', 'Dal']);
  });
  it('drops items with no sub-category when a filter is on, and keeps everything without a filter', () => {
    expect(buildDayMenus(['d'], maps, cats, foods, { names, itemSubs }).d).not.toContain('Unsorted');
    expect(buildDayMenus(['d'], maps, cats, foods).d).toHaveLength(5);
  });
  it('an item in two sub-categories counts once, at its first wanted one', () => {
    const subs = { ...itemSubs, b: [{ name: 'Beverages', sequence: 1 }, { name: 'Main Course', sequence: 4 }] };
    expect(buildDayMenus(['d'], maps, cats, foods, { names, itemSubs: subs }).d).toEqual(['Samosa', 'Aloo Paratha', 'Dal']);
  });
});

describe('flat categories for the extra boxes', () => {
  const cats = [
    { id: 'sw', name: 'Indian Sweets', sequence: 2, listingType: 'flat' },
    { id: 'ad', name: "Add-On's", sequence: 3, listingType: 'flat' },
    { id: 'fm', name: 'Food Menu', sequence: 1, listingType: 'day-wise' },
    { id: 'fmsub', name: 'Mains', sequence: 1, parentId: 'fm' },
    { id: 'pk', name: 'Pickles', sequence: 1, parentId: 'ad' },
    { id: 'off', name: 'Off', sequence: 4, listingType: 'flat', isDraft: true },
    { id: 'offsub', name: 'Off sub', sequence: 1, parentId: 'off' },
  ];
  it('lists flat categories and their sub-categories, not day-wise or switched-off ones', () => {
    expect(flatCategoryOptions(cats).map((o) => o.label)).toEqual(['Indian Sweets', "Add-On's", "Add-On's > Pickles"]);
  });
  const foods = [{ id: 'a', name: 'Motichoor Ladoo' }, { id: 'b', name: 'Fresh Paneer' }, { id: 'c', name: 'Mango Pickle' }, { id: 'd', name: 'Gone', available: false }, { id: 'e', name: 'Draft', isDraft: true }];
  const maps = [
    { categoryId: 'sw', foodItemId: 'a', sequence: 0 },
    { categoryId: 'ad', foodItemId: 'b', sequence: 1 },
    { categoryId: 'pk', foodItemId: 'c', sequence: 0 },
    { categoryId: 'ad', foodItemId: 'd', sequence: 2 },
    { categoryId: 'ad', foodItemId: 'e', sequence: 3 },
  ];
  it('gives a category its own items then its sub-categories, without unavailable or draft ones', () => {
    expect(buildCategoryItems('sw', maps, cats, foods)).toEqual(['Motichoor Ladoo']);
    expect(buildCategoryItems('ad', maps, cats, foods)).toEqual(['Fresh Paneer', 'Mango Pickle']);
  });
  it('gives nothing for a switched-off or unknown category', () => {
    expect(buildCategoryItems('off', maps, cats, foods)).toEqual([]);
    expect(buildCategoryItems('nope', maps, cats, foods)).toEqual([]);
  });
});
