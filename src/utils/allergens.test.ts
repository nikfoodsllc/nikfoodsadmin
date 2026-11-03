import { describe, expect, it } from 'vitest';
import { allergensText, applyAllergenBulk, cleanAllergens, isAllergenFilter } from './allergens';

describe('allergens', () => {
  it('keeps only known allergens, once each, in the standard order', () => {
    expect(cleanAllergens(['gluten', 'milk', 'milk', 'bogus', 7])).toEqual(['milk', 'gluten']);
    expect(cleanAllergens(undefined)).toEqual([]);
    expect(cleanAllergens('milk')).toEqual([]);
  });

  it('writes the list as text, None when empty', () => {
    expect(allergensText(['tree_nuts', 'milk'])).toBe('Milk, Tree nuts');
    expect(allergensText([])).toBe('None');
    expect(allergensText(null)).toBe('None');
  });

  it('knows the list filter values', () => {
    expect(isAllergenFilter('all')).toBe(true);
    expect(isAllergenFilter('none')).toBe(true);
    expect(isAllergenFilter('soy')).toBe(true);
    expect(isAllergenFilter('wheat')).toBe(false);
  });

  it('applies a bulk update: add, replace, remove', () => {
    expect(applyAllergenBulk(['milk'], 'add', ['gluten', 'milk'])).toEqual(['milk', 'gluten']);
    expect(applyAllergenBulk(['milk', 'eggs'], 'replace', ['soy'])).toEqual(['soy']);
    expect(applyAllergenBulk(['milk', 'eggs'], 'replace', [])).toEqual([]);
    expect(applyAllergenBulk(['milk', 'eggs'], 'remove', ['eggs', 'fish'])).toEqual(['milk']);
    expect(applyAllergenBulk(undefined, 'add', ['sesame'])).toEqual(['sesame']);
  });
});
