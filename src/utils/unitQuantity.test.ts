import { describe, expect, it } from 'vitest';
import { cleanUnitQuantity, comboPartIds, scaleRowsByUnitQuantity } from './unitQuantity';

describe('cleanUnitQuantity', () => {
  it('keeps whole numbers from 2 to 99, everything else is 1', () => {
    expect(cleanUnitQuantity(2)).toBe(2);
    expect(cleanUnitQuantity('4')).toBe(4);
    expect(cleanUnitQuantity(99)).toBe(99);
    expect(cleanUnitQuantity(250)).toBe(99);
    for (const bad of [undefined, null, '', 0, 1, -3, 2.5, 'x', NaN, {}]) expect(cleanUnitQuantity(bad)).toBe(1);
  });
});

describe('scaleRowsByUnitQuantity', () => {
  const units = new Map([['roti', 2]]);
  it('multiplies the ordered quantity of that item only', () => {
    const rows = [{ foodId: 'roti', quantity: 3 }, { foodId: 'other', quantity: 3 }, { foodId: null, quantity: 3 }];
    expect(scaleRowsByUnitQuantity(rows, units).map((r) => r.quantity)).toEqual([6, 3, 3]);
  });
  it('leaves combos alone and does not change its input', () => {
    const rows = [{ foodId: 'roti', quantity: 1, sections: [{ title: 'x' }] }];
    const out = scaleRowsByUnitQuantity(rows, units);
    expect(out[0].quantity).toBe(1);
    const plain = [{ foodId: 'roti', quantity: 2 }];
    scaleRowsByUnitQuantity(plain, units);
    expect(plain[0].quantity).toBe(2);
  });
  it('gives a combo line the quantities of the items inside it, and keeps its own quantity', () => {
    const sections = [{ _id: 's1', selectedItems: [{ _id: 'o1', item: { _id: 'roti', name: 'Makki Roti (2Pc)' } }, { _id: 'o2', item: { _id: 'saag', name: 'Sarson Ka Saag' } }] }];
    expect(comboPartIds(sections)).toEqual(['roti', 'saag']);
    const out = scaleRowsByUnitQuantity([{ foodId: 'combo', quantity: 3, sections, partUnits: null as Record<string, number> | null }], units);
    expect(out[0].quantity).toBe(3);
    expect(out[0].partUnits).toEqual({ roti: 2 });
    expect(comboPartIds(null)).toEqual([]);
  });
  it('returns the same list when no item has a quantity', () => {
    const rows = [{ foodId: 'a', quantity: 2 }];
    expect(scaleRowsByUnitQuantity(rows, new Map())).toBe(rows);
  });
});
