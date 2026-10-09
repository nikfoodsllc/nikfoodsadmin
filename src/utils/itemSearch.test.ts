import { describe, it, expect } from 'vitest';
import { nameMatchesSearch } from './itemSearch';

describe('nameMatchesSearch', () => {
  it('matches everything for an empty or blank search', () => {
    expect(nameMatchesSearch('Mango Lemonade (12Oz)', '')).toBe(true);
    expect(nameMatchesSearch('Mango Lemonade (12Oz)', '   ')).toBe(true);
  });
  it('ignores case and matches part of a word', () => {
    expect(nameMatchesSearch('Masala Nimbu Shikanji (12Oz)', 'NIMB')).toBe(true);
  });
  it('needs every word, in any order', () => {
    expect(nameMatchesSearch('Masala Nimbu Shikanji', 'shikanji masala')).toBe(true);
    expect(nameMatchesSearch('Masala Nimbu Shikanji', 'masala chai')).toBe(false);
  });
  it('handles brackets and sizes typed as part of the name', () => {
    expect(nameMatchesSearch('Chikoo Shake (8Oz)', '8oz')).toBe(true);
    expect(nameMatchesSearch('Chikoo Shake (8Oz)', '(8Oz)')).toBe(true);
  });
});
