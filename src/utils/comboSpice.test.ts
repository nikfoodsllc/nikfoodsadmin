import { describe, it, expect } from 'vitest';
import { sectionTakesSpice } from './comboSpice';
import { spicedPartNames } from './kitchenDashboard';

describe('sectionTakesSpice', () => {
  it('uses the admin setting when there is one', () => {
    expect(sectionTakesSpice({ title: 'Idli', takesSpice: false })).toBe(false);
    expect(sectionTakesSpice({ title: 'Staples', takesSpice: true })).toBe(true);
  });

  it('keeps the old rule for sections without the setting: all but staples and breads', () => {
    expect(sectionTakesSpice({ title: 'Veg Curry of the Day' })).toBe(true);
    expect(sectionTakesSpice({ title: 'Staples (Rice or Chapati)' })).toBe(false);
    expect(sectionTakesSpice({ title: 'Bread' })).toBe(false);
    expect(sectionTakesSpice({ title: '', takesSpice: null })).toBe(true);
    expect(sectionTakesSpice({})).toBe(true);
  });
});

describe('spicedPartNames follows the setting', () => {
  const sections = [
    { _id: 'a', title: 'Sambar', takesSpice: true, selectedItems: [{ _id: 'a1', item: { name: 'Sambar' } }] },
    { _id: 'b', title: 'Idli', takesSpice: false, selectedItems: [{ _id: 'b1', item: { name: 'Idli (2Pc)' } }] },
    { _id: 'c', title: 'Staples', selectedItems: [{ _id: 'c1', item: { name: 'Chapati' } }] },
    { _id: 'd', title: 'Rice', selectedItems: [{ _id: 'd1', item: { name: 'Jeera Rice' } }] },
  ];
  const comboSelections = { a: ['a1'], b: ['b1'], c: ['c1'], d: ['d1'] };

  it('spices a section switched on, skips one switched off, and falls back to the old rule otherwise', () => {
    expect([...spicedPartNames({ sections, comboSelections })].sort()).toEqual(['Jeera Rice', 'Sambar']);
  });

  it('lets an admin turn a staple section on and a normal one off', () => {
    const changed = sections.map((s) => (s._id === 'c' ? { ...s, takesSpice: true } : s._id === 'd' ? { ...s, takesSpice: false } : s));
    expect([...spicedPartNames({ sections: changed, comboSelections })].sort()).toEqual(['Chapati', 'Sambar']);
  });
});
