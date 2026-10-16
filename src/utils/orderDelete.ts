import type { Order } from '@/types/order';

/** Most orders one Delete press handles (they go one after the other, each also updates OptimoRoute) */
export const MAX_DELETE_AT_ONCE = 50;

export interface DeleteWarnings {
  total: number;
  /** Paid by card through Stripe: deleting the order does NOT refund the money */
  paidByCard: number;
  /** Already delivered */
  delivered: number;
  tooMany: boolean;
}

type Row = Pick<Order, 'paymentStatus' | 'status'> & { stripePaymentIntentId?: string };

export function deleteWarnings(orders: Row[]): DeleteWarnings {
  return {
    total: orders.length,
    paidByCard: orders.filter((o) => o.paymentStatus === 'paid' && Boolean(o.stripePaymentIntentId)).length,
    delivered: orders.filter((o) => o.status === 'delivered').length,
    tooMany: orders.length > MAX_DELETE_AT_ONCE,
  };
}
