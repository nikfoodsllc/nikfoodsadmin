import { describe, it, expect } from 'vitest';
import { COUNTED_ORDER_CLAUSES } from './countedOrders';

describe('COUNTED_ORDER_CLAUSES', () => {
  it('has the three ways an order counts: paid, handled by hand, counted before payment', () => {
    expect(COUNTED_ORDER_CLAUSES).toHaveLength(3);
    expect(COUNTED_ORDER_CLAUSES[0]).toEqual({ paymentStatus: 'paid' });
  });
  it('an order counted before payment never counts once its payment failed or was refunded', () => {
    const early = COUNTED_ORDER_CLAUSES.find((c) => 'countBeforePayment' in c);
    expect(early).toEqual({ countBeforePayment: true, paymentStatus: { $nin: ['failed', 'refunded'] } });
  });
  it('an order handled by hand also leaves out failed and refunded payments', () => {
    const byHand = COUNTED_ORDER_CLAUSES[1] as { paymentStatus: { $nin: string[] } };
    expect(byHand.paymentStatus.$nin).toEqual(['failed', 'refunded']);
  });
});
