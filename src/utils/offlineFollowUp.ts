/**
 * "Make offline order" on the Orders screen: an unpaid or failed order that the customer placed on the website or the app can be
 * turned into an offline order (a payment link emailed to the same customer). Orders entered in Create Order use Edit there instead.
 */

export interface FollowUpOrder {
  source?: string;
  status?: string;
  paymentStatus?: string;
}

/** The orders an offline order can be started from: placed by the customer, never paid, and still pending or cancelled. */
export function canMakeOfflineOrder(order: FollowUpOrder): boolean {
  if (order.source === 'admin') return false;
  if (order.paymentStatus !== 'unpaid' && order.paymentStatus !== 'failed') return false;
  return order.status === 'pending' || order.status === 'cancelled';
}

/** The Create Order address that starts from this order. */
export function offlineOrderHref(orderId: string): string {
  return `/admin/create-order?fromOrder=${encodeURIComponent(orderId)}`;
}
