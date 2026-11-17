import { describe, expect, it } from 'vitest';
import { buildDayMenus } from './communicationMenu';

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
