import { describe, expect, it } from 'vitest';
import {
  allowedCutoffRange,
  cutoffStatus,
  defaultCutoffInstant,
  describeCutoff,
  extendCutoff,
  inputValueToInstant,
  instantToInputValue,
  parseCutoff,
  validateCutoff,
} from './orderCutoff';

describe('standard cutoff (1 PM Pacific the day before)', () => {
  it('follows daylight saving', () => {
    expect(defaultCutoffInstant('2026-10-07').toISOString()).toBe('2026-10-06T20:00:00.000Z'); // PDT
    expect(defaultCutoffInstant('2027-01-13').toISOString()).toBe('2027-01-12T21:00:00.000Z'); // PST
    expect(defaultCutoffInstant('2026-11-02').toISOString()).toBe('2026-11-01T21:00:00.000Z'); // day the clocks fell back
    expect(defaultCutoffInstant('2026-03-09').toISOString()).toBe('2026-03-08T20:00:00.000Z'); // day the clocks sprang forward
  });
});

describe('datetime-local conversion (Pacific wall clock)', () => {
  it('round-trips', () => {
    const at = new Date('2026-10-06T20:00:00.000Z');
    expect(instantToInputValue(at)).toBe('2026-10-06T13:00');
    expect(inputValueToInstant('2026-10-06T13:00')?.toISOString()).toBe(at.toISOString());
    expect(inputValueToInstant('2027-01-12T13:00')?.toISOString()).toBe('2027-01-12T21:00:00.000Z');
  });
  it('rejects values that are not a valid date and time', () => {
    for (const bad of ['', 'nope', '2026-10-06', '2026-13-06T10:00', '2026-10-06T25:00', '2026-10-06T10:60']) expect(inputValueToInstant(bad)).toBeNull();
  });
});

describe('status and description', () => {
  const day = '2026-10-07';
  it('standard: open before 1 PM the day before, closed after', () => {
    expect(cutoffStatus(day, null, new Date('2026-10-06T19:59:00.000Z')).isOpen).toBe(true);
    expect(cutoffStatus(day, undefined, new Date('2026-10-06T20:00:00.000Z')).isOpen).toBe(false);
    expect(describeCutoff(day, null, new Date('2026-10-06T10:00:00.000Z'))).toBe('Closes Tue, Oct 6 at 1:00 PM Pacific (standard)');
    expect(describeCutoff(day, null, new Date('2026-10-06T21:00:00.000Z'))).toBe('Closed Tue, Oct 6 at 1:00 PM Pacific (standard)');
  });
  it('custom: reopened when the custom time is later than the standard one', () => {
    const custom = '2026-10-06T23:00:00.000Z'; // 4 PM Pacific
    const afterStandard = new Date('2026-10-06T21:00:00.000Z');
    expect(cutoffStatus(day, custom, afterStandard).isOpen).toBe(true);
    expect(describeCutoff(day, custom, afterStandard)).toBe('Closes Tue, Oct 6 at 4:00 PM Pacific (custom)');
  });
  it('an unreadable stored value counts as the standard cutoff', () => {
    expect(cutoffStatus(day, 'garbage').overridden).toBe(false);
    expect(parseCutoff('')).toBeNull();
  });
});

describe('extendCutoff', () => {
  const day = '2026-10-07';
  it('adds the hours to the current closing time while it is still ahead', () => {
    const now = new Date('2026-10-06T10:00:00.000Z');
    expect(extendCutoff(day, null, 2, now).toISOString()).toBe('2026-10-06T22:00:00.000Z'); // 20:00Z + 2h
  });
  it('counts from now once the closing time has passed (reopens the day)', () => {
    const now = new Date('2026-10-06T21:30:00.000Z');
    expect(extendCutoff(day, null, 2, now).toISOString()).toBe('2026-10-06T23:30:00.000Z');
  });
  it('extends an existing custom cutoff', () => {
    const now = new Date('2026-10-06T21:30:00.000Z');
    expect(extendCutoff(day, '2026-10-06T23:00:00.000Z', 1, now).toISOString()).toBe('2026-10-07T00:00:00.000Z');
  });
});

describe('validateCutoff', () => {
  const day = '2026-10-07';
  it('accepts times from a week before up to the end of the delivery day', () => {
    expect(validateCutoff(day, new Date('2026-10-06T20:00:00.000Z'))).toBeNull();
    expect(validateCutoff(day, new Date('2026-10-07T23:00:00.000Z'))).toBeNull(); // Oct 7 4 PM Pacific
    const { min, max } = allowedCutoffRange(day);
    expect(validateCutoff(day, min)).toBeNull();
    expect(validateCutoff(day, max)).toBeNull();
  });
  it('rejects too early, after the delivery day, and invalid values', () => {
    expect(validateCutoff(day, new Date('2026-09-20T00:00:00.000Z'))).toMatch(/week before/);
    expect(validateCutoff(day, new Date('2026-10-08T12:00:00.000Z'))).toMatch(/after the delivery date/);
    expect(validateCutoff(day, new Date('nope'))).toMatch(/Invalid cutoff/);
    expect(validateCutoff('bad', new Date())).toMatch(/Invalid delivery date/);
  });
});
