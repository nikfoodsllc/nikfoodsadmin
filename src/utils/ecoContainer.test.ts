import { describe, expect, it } from 'vitest';
import { ecoChargeError, ECO_CHARGE_REQUIRED } from './ecoContainer';

describe('ecoChargeError', () => {
  it('needs nothing when the eco container is off', () => {
    expect(ecoChargeError(false, 0)).toBeNull();
    expect(ecoChargeError(undefined, undefined)).toBeNull();
  });
  it('asks for a charge when the toggle is on and the box is empty, zero or bad', () => {
    for (const v of [0, undefined, null, -1, Number.NaN, '0.75']) expect(ecoChargeError(true, v)).toBe(ECO_CHARGE_REQUIRED);
  });
  it('accepts any positive charge', () => {
    expect(ecoChargeError(true, 0.75)).toBeNull();
    expect(ecoChargeError(true, 0.1)).toBeNull();
  });
});
