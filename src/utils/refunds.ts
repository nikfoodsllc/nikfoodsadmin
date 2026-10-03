import type { PaymentStatus } from '@/types/order';

/** What the payment status badge can show: the stored status, plus a derived "partially refunded". */
export type DisplayPaymentStatus = PaymentStatus | 'partially_refunded';

interface RefundableOrder {
  paymentStatus: PaymentStatus;
  totalPaid: number;
  refundedAmount?: number;
}

const round2 = (n: number) => Math.round(n * 100) / 100;

/**
 * How much of the order has been refunded, in dollars.
 * A fully refunded order counts as refunded in full, including older ones refunded before the
 * refunded amount was recorded.
 */
export function getRefundedAmount(order: RefundableOrder): number {
  if (order.paymentStatus === 'refunded') return round2(order.totalPaid || 0);
  const refunded = order.refundedAmount;
  if (typeof refunded !== 'number' || !(refunded > 0)) return 0;
  return round2(Math.min(refunded, order.totalPaid || 0));
}

/** The order total after refunds: 0 for a full refund, never negative. */
export function getNetTotal(order: RefundableOrder): number {
  return round2(Math.max(0, (order.totalPaid || 0) - getRefundedAmount(order)));
}

/** A paid order with part of its total refunded shows "Partially refunded" instead of "Paid". */
export function getDisplayPaymentStatus(order: RefundableOrder): DisplayPaymentStatus {
  if (order.paymentStatus === 'paid' && getRefundedAmount(order) > 0) return 'partially_refunded';
  return order.paymentStatus;
}
