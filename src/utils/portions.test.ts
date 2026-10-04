import { describe, expect, it } from 'vitest';
import { getItemPortionLabel } from './portions';

describe('getItemPortionLabel', () => {
  it('uses the stored portion name', () => {
    expect(getItemPortionLabel({ selectedPortion: 'Half' })).toBe('Half');
    expect(getItemPortionLabel({ selectedPortion: ' Full ', portions: 1, food: { portions: ['A', 'B'] } })).toBe('Full');
  });

  it('shows nothing when the item has no portion (the "#null" case)', () => {
    expect(getItemPortionLabel({})).toBeNull();
    expect(getItemPortionLabel({ portions: null })).toBeNull();
    expect(getItemPortionLabel({ portions: undefined })).toBeNull();
    expect(getItemPortionLabel({ selectedPortion: '', portions: null })).toBeNull();
    expect(getItemPortionLabel({ selectedPortion: '   ', portions: null, food: { portions: [] } })).toBeNull();
    expect(getItemPortionLabel({ selectedPortion: null, portions: null, food: { portions: ['Full', 'Half'] } })).toBeNull();
  });

  it('looks an old index up in the food item list', () => {
    expect(getItemPortionLabel({ portions: 1, food: { portions: ['Full', 'Half'] } })).toBe('Half');
    expect(getItemPortionLabel({ portions: 0, food: { portions: ['Full', 'Half'] } })).toBe('Full');
  });

  it('keeps showing #index for an old index it cannot look up', () => {
    expect(getItemPortionLabel({ portions: 2, food: { portions: ['Full', 'Half'] } })).toBe('#2');
    expect(getItemPortionLabel({ portions: 0, food: { portions: [] } })).toBe('#0');
    expect(getItemPortionLabel({ portions: 1 })).toBe('#1');
  });

  it('ignores a non-numeric index', () => {
    expect(getItemPortionLabel({ portions: NaN })).toBeNull();
    expect(getItemPortionLabel({ portions: '1' as unknown as number })).toBeNull();
  });
});
