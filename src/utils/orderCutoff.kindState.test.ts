import { describe, expect, it } from 'vitest';
import { kindState } from './orderCutoff';

// Thu Oct 8 2026 is the delivery date. Standard cutoffs (Pacific): flat Wed Oct 7 5:00 PM = 00:00Z Oct 8; day-wise Wed Oct 7 1:00 PM = 20:00Z Oct 7.
const date = '2026-10-08';
const on = { flatCategoryEnabled: true, dayWiseCategoryEnabled: true };
const at = (iso: string) => new Date(iso);

describe('where a kind of item stands on a date', () => {
  it('switched off is off, whatever the time', () => {
    expect(kindState(date, { flatCategoryEnabled: false, dayWiseCategoryEnabled: false }, 'flat', at('2026-10-07T10:00:00Z'))).toBe('off');
    expect(kindState(date, undefined, 'day-wise', at('2026-10-07T10:00:00Z'))).toBe('off');
    expect(kindState(date, null, 'flat')).toBe('off');
  });
  it('on and before the cutoff is open', () => {
    expect(kindState(date, on, 'flat', at('2026-10-07T21:00:00Z'))).toBe('open'); // 2 PM Pacific, flat closes at 5
    expect(kindState(date, on, 'day-wise', at('2026-10-07T19:59:00Z'))).toBe('open');
  });
  it('on but after the cutoff is closed: the case of the screenshot (day-wise closed at 1 PM, flat still open)', () => {
    const now = at('2026-10-07T21:30:00Z'); // 2:30 PM Pacific
    expect(kindState(date, on, 'day-wise', now)).toBe('closed');
    expect(kindState(date, on, 'flat', now)).toBe('open');
    expect(kindState(date, on, 'flat', at('2026-10-08T00:01:00Z'))).toBe('closed');
  });
  it('each kind has its own switch', () => {
    const now = at('2026-10-07T21:30:00Z');
    expect(kindState(date, { flatCategoryEnabled: true, dayWiseCategoryEnabled: false }, 'day-wise', now)).toBe('off');
    expect(kindState(date, { flatCategoryEnabled: true, dayWiseCategoryEnabled: false }, 'flat', now)).toBe('open');
  });
  it('a custom cutoff decides: extended reopens a closed day, an earlier one closes it', () => {
    const now = at('2026-10-07T21:30:00Z');
    expect(kindState(date, { ...on, dayWiseCutoffAt: '2026-10-08T01:00:00.000Z' }, 'day-wise', now)).toBe('open');
    expect(kindState(date, { ...on, flatCutoffAt: '2026-10-07T18:00:00.000Z' }, 'flat', now)).toBe('closed');
  });
  it('the older single cutoff still applies to both kinds', () => {
    const now = at('2026-10-07T21:30:00Z');
    expect(kindState(date, { ...on, cutoffAt: '2026-10-07T21:00:00.000Z' }, 'flat', now)).toBe('closed');
    expect(kindState(date, { ...on, cutoffAt: '2026-10-07T21:00:00.000Z' }, 'day-wise', now)).toBe('closed');
  });
  it('a date in the past with both kinds enabled is closed', () => {
    expect(kindState('2026-10-01', on, 'flat', at('2026-10-07T21:30:00Z'))).toBe('closed');
    expect(kindState('2026-10-01', on, 'day-wise', at('2026-10-07T21:30:00Z'))).toBe('closed');
  });
});
