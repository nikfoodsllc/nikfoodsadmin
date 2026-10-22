import { describe, expect, it } from 'vitest';
import { deleteVerdict, nameMatches } from './categoryDelete';

const empty = { subCategories: [], dayWiseItems: 0, dayWiseDays: 0, flatItems: 0, lockedItems: 0 };

describe('deleteVerdict', () => {
  it('allows an empty category with no typing', () => {
    expect(deleteVerdict(empty)).toEqual({ allowed: true, needsName: false, warnings: [] });
  });
  it('blocks a category that still has sub-categories, whatever else it has', () => {
    const v = deleteVerdict({ ...empty, subCategories: ['Beverages', 'Main Course'], dayWiseItems: 5 });
    expect(v.allowed).toBe(false);
    expect(v.blockedReason).toContain('2 sub-categories');
    expect(v.blockedReason).toContain('Beverages, Main Course');
  });
  it('uses the singular for one sub-category and trims a long list', () => {
    expect(deleteVerdict({ ...empty, subCategories: ['A'] }).blockedReason).toContain('1 sub-category (A). Move or delete it first');
    const many = deleteVerdict({ ...empty, subCategories: ['a', 'b', 'c', 'd', 'e', 'f'] });
    expect(many.blockedReason).toContain('a, b, c, d, e, ...');
  });
  it('asks for the name when day-wise items, flat items or locks would be lost', () => {
    const v = deleteVerdict({ ...empty, dayWiseItems: 142, dayWiseDays: 4, flatItems: 1, lockedItems: 36 });
    expect(v.allowed).toBe(true);
    expect(v.needsName).toBe(true);
    expect(v.warnings).toEqual([
      '142 day-wise items across 4 days will stop showing on the menu.',
      '1 item will stop showing under it.',
      '36 locked rows will be lost.',
    ]);
  });
  it('asks for the name for locks alone', () => {
    expect(deleteVerdict({ ...empty, lockedItems: 1 }).needsName).toBe(true);
  });
});

describe('nameMatches', () => {
  it('needs the exact name, ignoring surrounding spaces', () => {
    expect(nameMatches(' Food Menu ', 'Food Menu')).toBe(true);
    expect(nameMatches('food menu', 'Food Menu')).toBe(false);
    expect(nameMatches('', 'Food Menu')).toBe(false);
    expect(nameMatches(null, 'Food Menu')).toBe(false);
    expect(nameMatches('', '')).toBe(false);
  });
});
