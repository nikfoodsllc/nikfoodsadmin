import { describe, expect, it } from 'vitest';
import { foodItemListFilters } from './listFilters';

const f = (q: string) => foodItemListFilters(new URLSearchParams(q));

describe('foodItemListFilters', () => {
  it('is empty when nothing is filtered', () => {
    expect(f('')).toEqual({});
    expect(f('search=rajma&page=2&limit=7')).toEqual({});
  });

  it('veg / non-veg (a missing veg flag counts as non-veg, as the table shows)', () => {
    expect(f('veg=true')).toEqual({ veg: true });
    expect(f('veg=false')).toEqual({ veg: { $ne: true } });
    expect(f('veg=maybe')).toEqual({});
  });

  it('available / unavailable', () => {
    expect(f('available=true')).toEqual({ available: true });
    expect(f('available=false')).toEqual({ available: { $ne: true } });
    expect(f('available=')).toEqual({});
  });

  it('type: a missing type counts as simple', () => {
    expect(f('itemType=portions')).toEqual({ itemType: 'portions' });
    expect(f('itemType=combo')).toEqual({ itemType: 'combo' });
    expect(f('itemType=simple')).toEqual({ itemType: { $nin: ['portions', 'combo'] } });
    expect(f('itemType=other')).toEqual({});
  });

  it('preparation type, including "not set yet"', () => {
    expect(f('preparationType=cooked')).toEqual({ preparationType: 'cooked' });
    expect(f('preparationType=ready_to_eat')).toEqual({ preparationType: 'ready_to_eat' });
    expect(f('preparationType=not_set')).toEqual({ preparationType: { $nin: ['cooked', 'ready_to_eat'] } });
    expect(f('preparationType=all')).toEqual({});
  });

  it('splitSticker, including "not set yet"', () => {
    expect(f('splitSticker=yes')).toEqual({ splitSticker: 'yes' });
    expect(f('splitSticker=not_set')).toEqual({ splitSticker: { $nin: ['yes', 'no'] } });
    expect(f('splitSticker=maybe')).toEqual({});
  });
  it("chefs pick: yes is marked, no is anything not marked yes", () => {
    expect(f('stock=has')).toEqual({ stockThreshold: { $gt: 0 } });
    expect(f('stock=none')).toEqual({ $nor: [{ stockThreshold: { $gt: 0 } }] });
    expect(f('stock=low')).toEqual({});
    expect(f('stock=junk')).toEqual({});
    expect(f('chefsPick=yes')).toEqual({ chefsPick: true });
    expect(f('chefsPick=no')).toEqual({ chefsPick: { $ne: true } });
    expect(f('chefsPick=all')).toEqual({});
    expect(f('chefsPick=maybe')).toEqual({});
    expect(f('allowInstructions=yes')).toEqual({ allowInstructions: true });
    expect(f('allowInstructions=no')).toEqual({ allowInstructions: { $ne: true } });
    expect(f('allowInstructions=all')).toEqual({});
    expect(f('allowInstructions=maybe')).toEqual({});
  });
  it('sticker, including "not set yet"', () => {
    expect(f('sticker=yes')).toEqual({ sticker: 'yes' });
    expect(f('sticker=no')).toEqual({ sticker: 'no' });
    expect(f('sticker=not_set')).toEqual({ sticker: { $nin: ['yes', 'no'] } });
    expect(f('sticker=all')).toEqual({});
    expect(f('sticker=maybe')).toEqual({});
  });

  it('filters combine', () => {
    expect(f('veg=false&available=true&itemType=combo&preparationType=cooked')).toEqual({
      veg: { $ne: true },
      available: true,
      itemType: 'combo',
      preparationType: 'cooked',
    });
  });
});
