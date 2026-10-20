import { describe, it, expect } from 'vitest';
import { isAnnouncedStatus } from './pushStatus';

describe('isAnnouncedStatus', () => {
  it('only the two customer-facing statuses', () => {
    expect(isAnnouncedStatus('delivered')).toBe(true);
    expect(isAnnouncedStatus('out_for_delivery')).toBe(true);
    expect(isAnnouncedStatus('confirmed')).toBe(false);
    expect(isAnnouncedStatus('cancelled')).toBe(false);
    expect(isAnnouncedStatus(undefined)).toBe(false);
  });
});
