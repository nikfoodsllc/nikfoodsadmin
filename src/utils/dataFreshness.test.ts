import { describe, expect, it } from 'vitest';
import { STALE_AFTER_MS, isStale, updatedAtText } from './dataFreshness';

describe('isStale', () => {
  const t0 = Date.parse('2026-10-12T22:51:00Z');
  it('data that was never loaded is stale', () => {
    expect(isStale(null)).toBe(true);
    expect(isStale(undefined)).toBe(true);
    expect(isStale(Number.NaN)).toBe(true);
  });
  it('fresh until the limit, stale from it on', () => {
    expect(isStale(t0, t0 + STALE_AFTER_MS - 1)).toBe(false);
    expect(isStale(t0, t0 + STALE_AFTER_MS)).toBe(true);
    expect(isStale(new Date(t0), t0 + 5 * 60 * 1000)).toBe(true);
  });
  it('a custom limit', () => expect(isStale(t0, t0 + 5000, 10000)).toBe(false));
});

describe('updatedAtText', () => {
  it('shows the Pacific time', () => {
    expect(updatedAtText(new Date('2026-10-12T22:54:00Z'))).toBe('Updated 3:54 PM'); // PDT = UTC-7
    expect(updatedAtText(Date.parse('2026-12-12T20:05:00Z'))).toBe('Updated 12:05 PM'); // PST = UTC-8
  });
  it('is empty before a load or for a bad date', () => {
    expect(updatedAtText(null)).toBe('');
    expect(updatedAtText(new Date('nope'))).toBe('');
  });
});
