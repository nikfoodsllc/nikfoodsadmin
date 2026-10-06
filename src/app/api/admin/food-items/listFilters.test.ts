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

  it('filters combine', () => {
    expect(f('veg=false&available=true&itemType=combo&preparationType=cooked')).toEqual({
      veg: { $ne: true },
      available: true,
      itemType: 'combo',
      preparationType: 'cooked',
    });
  });
});
