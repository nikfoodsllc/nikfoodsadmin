import { describe, expect, it } from 'vitest';
import { soldOutNowLimit } from './soldOutNow';
import { stockState } from './stockRules';

describe('soldOutNowLimit', () => {
  it('units: the limit becomes what was ordered, and the item is sold out', () => {
    expect(soldOutNowLimit(44, 'units')).toBe(44);
    expect(stockState(44, 44, 'units').soldOut).toBe(true);
  });
  it('pounds round down so the item really is sold out', () => {
    expect(soldOutNowLimit(50, 'lb')).toBe(3.12); // 50 oz = 3.125 lb
    expect(stockState(3.12, 50, 'lb').soldOut).toBe(true);
    expect(soldOutNowLimit(48, 'lb')).toBe(3);
  });
  it('ounces round down to whole ounces', () => {
    expect(soldOutNowLimit(70.5, 'oz')).toBe(70);
    expect(stockState(70, 70.5, 'oz').soldOut).toBe(true);
  });
  it('nothing (or too little) ordered: the limit becomes 0, which is sold out', () => {
    expect(soldOutNowLimit(0, 'units')).toBe(0);
    expect(soldOutNowLimit(3, 'lb')).toBe(0); // 0.18 lb is under the 0.25 lb minimum
    expect(soldOutNowLimit(0.5, 'oz')).toBe(0);
    expect(soldOutNowLimit(Number.NaN, 'units')).toBe(0);
    expect(stockState(0, 0, 'units').soldOut).toBe(true);
    expect(stockState(0, 3, 'lb').soldOut).toBe(true);
  });
});
