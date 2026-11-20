import { describe, expect, it } from 'vitest';
import { buildMenuEmailHtml, cleanSavedBox, emptyMenuEmail, parseMenuEmail, sameAsSaved, sectionsUntouched, startingSections } from './menuEmail';

describe('cleanSavedBox', () => {
  it('trims, keeps one dish per line and drops blank lines', () => {
    const r = cleanSavedBox({ title: '  Indian Mithai ', subtitle: " Club with any day's delivery ", items: 'Kaju Katli\n\n  Besan Ladoo \n', categoryId: '0123456789abcdef01234567' });
    expect(r).toEqual({ box: { title: 'Indian Mithai', subtitle: "Club with any day's delivery", items: 'Kaju Katli\nBesan Ladoo', categoryId: '0123456789abcdef01234567' } });
  });
  it('needs a title and at least one dish', () => {
    expect(cleanSavedBox({ title: ' ', items: 'A' })).toEqual({ error: 'Give the box a title first.' });
    expect(cleanSavedBox({ title: 'Add-Ons', items: '\n ' })).toEqual({ error: 'Add at least one dish to the box first.' });
    expect(cleanSavedBox(null)).toHaveProperty('error');
  });
  it('drops a category id that is not an id and caps the lengths', () => {
    const r = cleanSavedBox({ title: 'x'.repeat(60), subtitle: 'y'.repeat(90), items: 'A', categoryId: { $ne: 1 } });
    expect('box' in r && r.box).toEqual({ title: 'x'.repeat(40), subtitle: 'y'.repeat(60), items: 'A' });
  });
});

describe('saved boxes in a new email', () => {
  const saved = [{ id: 's1', title: 'Indian Mithai', subtitle: 'Club', items: 'Kaju Katli\nBesan Ladoo', categoryId: '0123456789abcdef01234567' }, { id: 's2', title: "Add-On's", subtitle: '', items: 'Raita' }];
  it('starts with the saved boxes, or the usual two empty boxes when nothing is saved', () => {
    expect(startingSections(saved)).toEqual([
      { title: 'Indian Mithai', subtitle: 'Club', items: 'Kaju Katli\nBesan Ladoo', savedId: 's1', categoryId: '0123456789abcdef01234567' },
      { title: "Add-On's", subtitle: '', items: 'Raita', savedId: 's2' },
    ]);
    expect(startingSections([])).toEqual(emptyMenuEmail().sections);
  });
  it('only an untouched email takes the saved boxes', () => {
    expect(sectionsUntouched(emptyMenuEmail().sections)).toBe(true);
    expect(sectionsUntouched([{ title: 'A', subtitle: '', items: 'x' }])).toBe(false);
    expect(sectionsUntouched([{ title: 'A', subtitle: '', items: '', savedId: 's1' }])).toBe(false);
  });
  it('tells whether a box still matches its saved copy', () => {
    expect(sameAsSaved({ title: 'Indian Mithai ', subtitle: 'Club', items: 'Kaju Katli\n\nBesan Ladoo' }, saved[0])).toBe(true);
    expect(sameAsSaved({ title: 'Indian Mithai', subtitle: 'Club', items: 'Kaju Katli' }, saved[0])).toBe(false);
    expect(sameAsSaved({ title: 'Indian Mithai', subtitle: 'Club', items: 'Kaju Katli' }, undefined)).toBe(false);
  });
  it('keeps the saved link through a saved draft', () => {
    const data = { ...emptyMenuEmail(), sections: startingSections(saved) };
    expect(parseMenuEmail(buildMenuEmailHtml(data))?.sections?.map((x) => x.savedId)).toEqual(['s1', 's2']);
  });
});
