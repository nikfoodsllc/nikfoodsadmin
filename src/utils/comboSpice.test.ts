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

// ---------------------------------------------------------------------------------------------
// Per-item spice (spiceMode 'inherit' | 'combo')
// ---------------------------------------------------------------------------------------------
import {
  comboSpiceMode,
  getOptionSpice,
  isPerItemSpice,
  optionSpiceKey,
  optionSpiceLevels,
  optionsMissingSpice,
  pickedSpiceOptions,
  pruneComboSpice,
  spiceForOption,
  withOptionSpice,
} from './comboSpice';

const LEVELS = ['Mild (Kid Friendly)', 'Normal', 'Medium Spice', 'Spicy'];
const curry = { _id: 'o1', item: { _id: 'f1', name: 'Kale Chane', hasSpiceLevel: true, spiceLevel: ['Mild', 'Spicy'] }, price: 0, portion: '12Oz' };
const sabzi = { _id: 'o2', item: { _id: 'f2', name: 'Palak Paneer', hasSpiceLevel: true, spiceLevel: ['Normal', 'Hot'] }, price: 0 };
const rice = { _id: 'o3', item: { _id: 'f3', name: 'Jeera Rice', hasSpiceLevel: false, spiceLevel: [] }, price: 0 };
const sections = [
  { _id: 's1', title: 'Curries', selectedItems: [curry, sabzi] },
  { _id: 's2', title: 'Rice', selectedItems: [rice] },
];
const inherit = { hasSpiceLevel: true, spiceMode: 'inherit' as const, spiceLevel: [] as string[], sections };
const combo = { hasSpiceLevel: true, spiceMode: 'combo' as const, spiceLevel: LEVELS, sections };
const legacy = { hasSpiceLevel: true, spiceLevel: LEVELS, sections };

describe('comboSpiceMode', () => {
  it('tells the modes apart; a combo without a mode keeps the older behaviour', () => {
    expect(comboSpiceMode({ hasSpiceLevel: false, spiceMode: 'inherit' })).toBe('none');
    expect(comboSpiceMode(inherit)).toBe('inherit');
    expect(comboSpiceMode(combo)).toBe('combo');
    expect(comboSpiceMode(legacy)).toBe('legacy');
    expect(isPerItemSpice(legacy)).toBe(false);
    expect(isPerItemSpice(inherit)).toBe(true);
  });
  it('per-item combos never ask the one combo-wide level or the per-section level', () => {
    expect(comboNeedsOverallSpice(inherit)).toBe(false);
    expect(comboNeedsOverallSpice(combo)).toBe(false);
    expect(comboNeedsOverallSpice(legacy)).toBe(true);
    expect(sectionsMissingSpice(combo, { s1: ['o1'] })).toEqual([]);
  });
});

describe('optionSpiceLevels', () => {
  it('inherit uses the item\'s own levels; combo uses the combo\'s; an item without spice never has any', () => {
    expect(optionSpiceLevels(inherit, curry)).toEqual(['Mild', 'Spicy']);
    expect(optionSpiceLevels(combo, curry)).toEqual(LEVELS);
    expect(optionSpiceLevels(inherit, rice)).toEqual([]);
    expect(optionSpiceLevels(combo, rice)).toEqual([]);
    expect(optionSpiceLevels(legacy, curry)).toEqual([]);
  });
});

describe('picked items that need spice', () => {
  it('asks for each picked item that can have spice, and never for rice', () => {
    const picks = { s1: ['o1', 'o2'], s2: ['o3'] };
    expect(pickedSpiceOptions(inherit, picks).map((p) => p.option._id)).toEqual(['o1', 'o2']);
    expect(optionsMissingSpice(inherit, picks)).toHaveLength(2);
    const one = withOptionSpice(picks, 's1', 'o1', 'Spicy');
    expect(getOptionSpice(one, 's1', 'o1')).toBe('Spicy');
    expect(optionsMissingSpice(inherit, one).map((p) => p.option._id)).toEqual(['o2']);
    const both = withOptionSpice(one, 's1', 'o2', 'Hot');
    expect(optionsMissingSpice(inherit, both)).toEqual([]);
  });
  it('a level that is not on offer counts as missing', () => {
    const picks = withOptionSpice({ s1: ['o1'] }, 's1', 'o1', 'Hot');
    expect(optionsMissingSpice(inherit, picks)).toHaveLength(1);
  });
  it('an item that is not picked is not asked', () => {
    expect(pickedSpiceOptions(inherit, { s1: ['o2'] }).map((p) => p.option._id)).toEqual(['o2']);
    expect(pickedSpiceOptions(inherit, {})).toEqual([]);
  });
  it('nothing to ask for older combos or combos without spice', () => {
    expect(pickedSpiceOptions(legacy, { s1: ['o1'] })).toEqual([]);
    expect(pickedSpiceOptions({ ...inherit, hasSpiceLevel: false }, { s1: ['o1'] })).toEqual([]);
  });
});

describe('pruneComboSpice', () => {
  it('drops picks of items no longer picked or levels no longer on offer, keeps the rest', () => {
    const sel = { s1: ['o1'], [optionSpiceKey('s1', 'o1')]: ['Mild'], [optionSpiceKey('s1', 'o2')]: ['Normal'], [optionSpiceKey('s2', 'o3')]: ['Mild'] };
    expect(pruneComboSpice(inherit, sel)).toEqual({ s1: ['o1'], [optionSpiceKey('s1', 'o1')]: ['Mild'] });
    expect(pruneComboSpice(inherit, { s1: ['o1'], [optionSpiceKey('s1', 'o1')]: ['Hot'] })).toEqual({ s1: ['o1'] });
  });
});

describe('spiceForOption', () => {
  it('per-item combos give each item its own level; older combos use the section / combo level', () => {
    const sel = withOptionSpice({ s1: ['o1', 'o2'] }, 's1', 'o1', 'Spicy');
    expect(spiceForOption(inherit, sections[0], curry, sel, '')).toBe('Spicy');
    expect(spiceForOption(inherit, sections[0], sabzi, sel, '')).toBe('');
    expect(spiceForOption(legacy, sections[0], curry, { s1: ['o1'] }, 'Normal')).toBe('Normal');
  });
});

describe('kitchen: the level of each picked part', () => {
  const picks = withOptionSpice(withOptionSpice({ s1: ['o1', 'o2'], s2: ['o3'] }, 's1', 'o1', 'Spicy'), 's1', 'o2', 'Hot');
  const row = { sections, comboSelections: picks, spiceLevel: null };
  it('each part gets its own level and rice gets none', () => {
    const map = partSpices(row);
    expect(map.get('Kale Chane')).toBe('Spicy');
    expect(map.get('Palak Paneer')).toBe('Hot');
    expect(map.has('Jeera Rice')).toBe(false);
  });
  it('the choice lines show each item\'s level', () => {
    expect(comboChoiceLines(row)).toEqual(['Curries: Kale Chane (12Oz) · Spicy, Palak Paneer · Hot', 'Rice: Jeera Rice']);
  });
  it('older orders (one combo level) still read as before', () => {
    const map = partSpices({ sections: [{ _id: 's1', title: 'Curries', selectedItems: [curry] }], comboSelections: { s1: ['o1'] }, spiceLevel: 'Normal' });
    expect(map.get('Kale Chane')).toBe('Normal');
  });
});

describe('Create Order for a per-item combo', () => {
  const menu = { _id: 'c1', name: 'Veg Combo', price: 20, hasCombo: true, hasSpiceLevel: true, spiceMode: 'inherit', spiceLevel: [], sections: [
    { _id: 's1', title: 'Curries', isRequired: true, minSelection: 1, maxSelection: 2, selectedItems: [curry, sabzi] },
    { _id: 's2', title: 'Rice', isRequired: true, minSelection: 1, maxSelection: 1, selectedItems: [rice] },
  ] } as unknown as MenuItem;
  it('asks for the item that is missing its level, never for rice', () => {
    expect(pickProblem(menu, { comboSelections: { s1: ['o1'], s2: ['o3'] } })).toBe('Choose a spice level for Kale Chane');
    expect(pickProblem(menu, { comboSelections: withOptionSpice({ s1: ['o1'], s2: ['o3'] }, 's1', 'o1', 'Spicy') })).toBeNull();
  });
  it('the line tags show the level next to the item', () => {
    const sel = withOptionSpice({ s1: ['o1'], s2: ['o3'] }, 's1', 'o1', 'Spicy');
    expect(lineTags(menu, { comboSelections: sel })).toEqual(['Curries: Kale Chane (12Oz) · Spicy', 'Rice: Jeera Rice']);
  });
});
