import { describe, expect, it } from 'vitest';
import { canMakeOfflineOrder, offlineOrderHref } from './offlineFollowUp';

describe('canMakeOfflineOrder', () => {
  it('allows an unpaid or failed order that is pending or cancelled', () => {
    expect(canMakeOfflineOrder({ status: 'pending', paymentStatus: 'unpaid' })).toBe(true);
    expect(canMakeOfflineOrder({ status: 'cancelled', paymentStatus: 'failed' })).toBe(true);
    expect(canMakeOfflineOrder({ status: 'cancelled', paymentStatus: 'unpaid' })).toBe(true);
    expect(canMakeOfflineOrder({ status: 'pending', paymentStatus: 'failed' })).toBe(true);
  });
  it('refuses paid and refunded orders', () => {
    expect(canMakeOfflineOrder({ status: 'confirmed', paymentStatus: 'paid' })).toBe(false);
    expect(canMakeOfflineOrder({ status: 'cancelled', paymentStatus: 'refunded' })).toBe(false);
    expect(canMakeOfflineOrder({ status: 'pending', paymentStatus: 'paid' })).toBe(false);
  });
  it('refuses orders that were already prepared or delivered, even when unpaid', () => {
    for (const status of ['confirmed', 'preparing', 'ready', 'out_for_delivery', 'partially_delivered', 'delivered']) {
      expect(canMakeOfflineOrder({ status, paymentStatus: 'unpaid' })).toBe(false);
    }
  });
  it('refuses orders entered in Create Order (they have Edit there)', () => {
    expect(canMakeOfflineOrder({ source: 'admin', status: 'pending', paymentStatus: 'unpaid' })).toBe(false);
  });
  it('refuses an order with missing fields', () => {
    expect(canMakeOfflineOrder({})).toBe(false);
  });
});

describe('offlineOrderHref', () => {
  it('points at Create Order with the order number', () => {
    expect(offlineOrderHref('ORD-1794')).toBe('/admin/create-order?fromOrder=ORD-1794');
  });
});
