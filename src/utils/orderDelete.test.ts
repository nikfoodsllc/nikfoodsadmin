import { describe, expect, it } from 'vitest';
import { deleteWarnings, MAX_DELETE_AT_ONCE } from './orderDelete';

const row = (over: Record<string, unknown> = {}) => ({ paymentStatus: 'paid', status: 'confirmed', ...over }) as never;

describe('deleteWarnings', () => {
  it('counts card payments, deliveries and the total', () => {
    const w = deleteWarnings([row({ stripePaymentIntentId: 'pi_1' }), row({ status: 'delivered' }), row({ paymentStatus: 'unpaid', stripePaymentIntentId: 'pi_2' })]);
    expect(w).toEqual({ total: 3, paidByCard: 1, delivered: 1, tooMany: false });
  });
  it('a quote or cash order has no card warning', () => {
    expect(deleteWarnings([row({ paymentMethod: 'Quote' })]).paidByCard).toBe(0);
  });
  it('flags too many at once', () => {
    expect(deleteWarnings(Array.from({ length: MAX_DELETE_AT_ONCE + 1 }, () => row())).tooMany).toBe(true);
    expect(deleteWarnings(Array.from({ length: MAX_DELETE_AT_ONCE }, () => row())).tooMany).toBe(false);
  });
});
