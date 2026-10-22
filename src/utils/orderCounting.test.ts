import { describe, expect, it } from 'vitest';
import { countBlockedReason, countSummary, isCountedEarly } from './orderCounting';

describe('countBlockedReason', () => {
  it('lets an unpaid, live order be counted', () => {
    expect(countBlockedReason({ status: 'pending', paymentStatus: 'pending' })).toBeNull();
    expect(countBlockedReason({ status: 'confirmed' })).toBeNull();
  });
  it('blocks cancelled, paid, failed and refunded orders (cancelled first)', () => {
    expect(countBlockedReason({ status: 'cancelled', paymentStatus: 'paid' })).toBe('cancelled');
    expect(countBlockedReason({ status: 'delivered', paymentStatus: 'paid' })).toBe('paid');
    expect(countBlockedReason({ status: 'pending', paymentStatus: 'failed' })).toBe('failed');
    expect(countBlockedReason({ status: 'pending', paymentStatus: 'refunded' })).toBe('refunded');
  });
});

describe('isCountedEarly', () => {
  it('shows only while the order is unpaid and the flag is on', () => {
    expect(isCountedEarly({ status: 'pending', paymentStatus: 'pending', countBeforePayment: true })).toBe(true);
    expect(isCountedEarly({ status: 'pending', paymentStatus: 'pending' })).toBe(false);
    expect(isCountedEarly({ status: 'confirmed', paymentStatus: 'paid', countBeforePayment: true })).toBe(false);
    expect(isCountedEarly({ status: 'cancelled', paymentStatus: 'pending', countBeforePayment: true })).toBe(false);
  });
});

describe('countSummary', () => {
  it('reports changed orders', () => {
    expect(countSummary([{ orderId: 'a', ok: true }, { orderId: 'b', ok: true }], true)).toEqual({ text: 'Counting 2 orders', severity: 'success' });
    expect(countSummary([{ orderId: 'a', ok: true }], false).text).toBe('No longer counting 1 order');
  });
  it('mixes changed, unchanged and skipped, with the reasons once each', () => {
    const r = countSummary(
      [
        { orderId: 'a', ok: true },
        { orderId: 'b', ok: true, unchanged: true },
        { orderId: 'c', ok: false, reason: 'it is cancelled' },
        { orderId: 'd', ok: false, reason: 'it is cancelled' },
        { orderId: 'e', ok: false, reason: 'its payment failed' },
      ],
      true
    );
    expect(r.text).toBe('Counting 1 order. 1 already counted. 3 skipped (it is cancelled; its payment failed)');
    expect(r.severity).toBe('warning');
  });
  it('is an error when nothing worked', () => {
    expect(countSummary([{ orderId: 'a', ok: false, reason: 'order not found' }], true)).toEqual({ text: '1 skipped (order not found)', severity: 'error' });
  });
  it('handles an empty answer', () => {
    expect(countSummary([], true).text).toBe('Nothing to do');
  });
});
