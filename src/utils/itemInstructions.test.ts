import { describe, expect, it } from 'vitest';
import { allowsInstructions, instructionsLabel, isInstructionsFilter } from './itemInstructions';

describe('item instructions setting', () => {
  it('is off unless it is exactly true', () => {
    expect(allowsInstructions(true)).toBe(true);
    for (const v of [false, undefined, null, 'yes', 1, 'true']) expect(allowsInstructions(v)).toBe(false);
  });
  it('words it Yes / No', () => {
    expect(instructionsLabel(true)).toBe('Yes');
    expect(instructionsLabel(undefined)).toBe('No');
  });
  it('knows its filter values', () => {
    expect(['all', 'yes', 'no'].every(isInstructionsFilter)).toBe(true);
    expect(isInstructionsFilter('maybe')).toBe(false);
  });
});
