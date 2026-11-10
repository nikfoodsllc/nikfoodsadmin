import { describe, expect, it } from 'vitest';
import { dismissedText, splitClientReports } from './paymentDismissed';

describe('payment screen closed', () => {
  it('separates real errors from the closed-screen reports', () => {
    const r = splitClientReports([
      { stage: 'confirm_payment', at: '2026-11-09T10:00:00Z' },
      { stage: 'dismissed', at: '2026-11-09T10:01:00Z' },
      { stage: 'dismissed', at: '2026-11-09T10:05:00Z' },
    ]);
    expect(r.errors.map((e) => e.stage)).toEqual(['confirm_payment']);
    expect(r.dismissed).toEqual({ count: 2, lastAt: '2026-11-09T10:05:00Z' });
  });
  it('has nothing when there are none', () => {
    expect(splitClientReports(undefined)).toEqual({ errors: [], dismissed: null });
    expect(splitClientReports([{ stage: 'submit_form', at: '2026-11-09T10:00:00Z' }]).dismissed).toBeNull();
  });
  it('says it in plain words (Pacific time)', () => {
    expect(dismissedText({ count: 1, lastAt: '2026-11-10T02:50:00Z' })).toBe('Closed the payment screen without paying (Nov 9, 6:50 PM PT)');
    expect(dismissedText({ count: 3, lastAt: '2026-11-10T02:50:00Z' })).toBe('Closed the payment screen without paying (3 times, last Nov 9, 6:50 PM PT)');
  });
});
