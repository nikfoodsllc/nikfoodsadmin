import { describe, it, expect } from 'vitest';
import { isStickerFilter, isStickerFlag, matchesStickerFilter, normalizeSticker, stickerLabel } from './stickerFlag';

describe('stickerFlag', () => {
  it('only yes and no are values', () => {
    expect(['yes', 'no'].every(isStickerFlag)).toBe(true);
    for (const v of ['Yes', 'true', true, 1, null, undefined, '', 'cooked']) expect(isStickerFlag(v)).toBe(false);
  });
  it('labels and normalizing', () => {
    expect(stickerLabel('yes')).toBe('Yes');
    expect(stickerLabel('no')).toBe('No');
    expect(stickerLabel(undefined)).toBe('(not set yet)');
    expect(normalizeSticker('yes')).toBe('yes');
    expect(normalizeSticker('maybe')).toBeNull();
  });
  it('filters: unset counts as not set', () => {
    expect(isStickerFilter('not_set')).toBe(true);
    expect(isStickerFilter('x')).toBe(false);
    expect(matchesStickerFilter(undefined, 'not_set')).toBe(true);
    expect(matchesStickerFilter('no', 'not_set')).toBe(false);
    expect(matchesStickerFilter('yes', 'yes')).toBe(true);
    expect(matchesStickerFilter('no', 'yes')).toBe(false);
    expect(matchesStickerFilter(undefined, 'all')).toBe(true);
  });
});
