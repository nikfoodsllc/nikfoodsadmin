import { describe, expect, it } from 'vitest';
import { averageOfOthers } from './packingRuns';

describe('averageOfOthers (the time the last customer gets)', () => {
  const stops = { a: { timeMs: 60000 }, b: { timeMs: 120000 }, c: { timeMs: 5000 }, d: { timeMs: 0 }, last: { timeMs: 3000 } };
  it('averages the other customers that took at least 10 seconds, never the last one itself', () => {
    expect(averageOfOthers({ stops }, 'last')).toBe(90000);
  });
  it('is 0 when nothing can be averaged (the packer finishes by hand)', () => {
    expect(averageOfOthers({ stops: { last: { timeMs: 50000 } } }, 'last')).toBe(0);
    expect(averageOfOthers({ stops: { a: { timeMs: 2000 }, last: {} } }, 'last')).toBe(0);
    expect(averageOfOthers({}, 'last')).toBe(0);
  });
});
