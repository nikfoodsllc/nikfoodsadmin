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

import { comboNeedsOverallSpice, getSectionSpice, itemSelectionsOnly, pruneSectionSpice, sectionOwnsSpice, sectionsMissingSpice, spiceForSection, withSectionSpice } from './comboSpice';
import { comboChoiceLines, partSpices } from './kitchenDashboard';
import { pickProblem, lineTags, type MenuItem } from './createOrder';

describe('a section the customer picks spice for', () => {
  const secs = [
    { _id: 'a', title: 'Sambar', takesSpice: true, ownSpice: true, selectedItems: [{ _id: 'a1', item: { name: 'Sambar' } }] },
    { _id: 'b', title: 'Idli', takesSpice: false, selectedItems: [{ _id: 'b1', item: { name: 'Idli (2Pc)' } }] },
    { _id: 'c', title: 'Curry', selectedItems: [{ _id: 'c1', item: { name: 'Kale Chane' } }] },
  ];
  const food = { hasSpiceLevel: true, spiceLevel: ['Mild', 'Medium'], sections: secs };

  it('asks for one overall level only while some spiced section still shares it', () => {
    expect(comboNeedsOverallSpice({ ...food, sections: secs.slice(0, 2) })).toBe(false);
    expect(comboNeedsOverallSpice(food)).toBe(true);
    expect(comboNeedsOverallSpice({ hasSpiceLevel: true, sections: [{ _id: 'x', title: 'Staples' }] })).toBe(true);
    expect(comboNeedsOverallSpice({ hasSpiceLevel: false, sections: secs })).toBe(false);
  });

  it('only counts own spice on a section that takes spice', () => {
    expect(sectionOwnsSpice({ title: 'Staples', ownSpice: true })).toBe(false);
    expect(sectionOwnsSpice({ title: 'Curry', ownSpice: true })).toBe(true);
  });

  it('stores the level next to the picks and removes it again', () => {
    const w = withSectionSpice({ a: ['a1'] }, 'a', ' Medium ');
    expect(w).toEqual({ a: ['a1'], 'spice:a': ['Medium'] });
    expect(getSectionSpice(w, 'a')).toBe('Medium');
    expect(itemSelectionsOnly(w)).toEqual({ a: ['a1'] });
    expect(withSectionSpice(w, 'a', null)).toEqual({ a: ['a1'] });
  });

  it('lists the sections that still need a level and prunes stale ones', () => {
    expect(sectionsMissingSpice(food, { a: ['a1'] }).map((s) => s._id)).toEqual(['a']);
    expect(sectionsMissingSpice(food, { a: ['a1'], 'spice:a': ['Mild'] })).toEqual([]);
    expect(sectionsMissingSpice(food, {})).toEqual([]);
    expect(pruneSectionSpice(secs, { a: [], 'spice:a': ['Mild'] })).toEqual({ a: [] });
    expect(pruneSectionSpice(secs, { a: ['a1'], 'spice:a': ['Mild'], 'spice:gone': ['Mild'] })).toEqual({ a: ['a1'], 'spice:a': ['Mild'] });
  });

  it('gives each section its level', () => {
    expect(spiceForSection(secs[0], { 'spice:a': ['Mild'] }, 'Hot')).toBe('Mild');
    expect(spiceForSection(secs[0], {}, 'Hot')).toBe('Hot');
    expect(spiceForSection(secs[1], {}, 'Hot')).toBe('');
    expect(spiceForSection(secs[2], {}, 'Hot')).toBe('Hot');
  });

  it('puts the right level on each part in the reports and shows it on the choice line', () => {
    const row = { sections: secs, comboSelections: { a: ['a1'], b: ['b1'], c: ['c1'], 'spice:a': ['Mild'] }, spiceLevel: 'Hot' };
    expect([...partSpices(row)].sort()).toEqual([['Kale Chane', 'Hot'], ['Sambar', 'Mild']]);
    expect(comboChoiceLines(row)).toEqual(['Sambar: Sambar · Mild', 'Idli: Idli (2Pc)', 'Curry: Kale Chane']);
    // no overall level on the line: only the section with its own pick is spiced
    expect([...partSpices({ ...row, spiceLevel: '' })]).toEqual([['Sambar', 'Mild']]);
  });

  const item: MenuItem = {
    _id: 'f', name: 'Combo', price: 10, hasCombo: true, hasSpiceLevel: true, spiceLevel: ['Mild', 'Medium'],
    sections: secs.slice(0, 2).map((s) => ({ ...s, isRequired: true, minSelection: 1, maxSelection: 1, price: 0 })) as unknown as MenuItem['sections'],
  } as MenuItem;

  it('Create Order asks for the section level, not an overall one', () => {
    expect(pickProblem(item, { comboSelections: { a: ['a1'], b: ['b1'] } })).toBe('Choose a spice level for Sambar');
    expect(pickProblem(item, { comboSelections: { a: ['a1'], b: ['b1'], 'spice:a': ['Mild'] } })).toBeNull();
    expect(lineTags(item, { comboSelections: { a: ['a1'], b: ['b1'], 'spice:a': ['Mild'] } })).toEqual(['Sambar: Sambar · Mild', 'Idli: Idli (2Pc)']);
  });
});
