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

/** What happened to the unpaid order after the offline order was made from it (sent back by the customer site). */
export interface FollowedUp {
  orderId: string;
  cancelled: boolean;
  reason?: 'email_not_sent' | 'already_paid' | 'payment_not_closed' | 'not_saved';
  error?: string;
}

/** The sentence shown on the result card. The unpaid order is cancelled only once the customer's email has gone out. */
export function followedUpMessage(f: FollowedUp): string {
  if (f.cancelled) return `The unpaid order ${f.orderId} was cancelled, so the customer only has this one to pay.`;
  if (f.reason === 'email_not_sent') return `The email to the customer did not go out, so the unpaid order ${f.orderId} was left as it is. Send the link again from Recent orders, then cancel ${f.orderId} yourself if you want.`;
  if (f.reason === 'already_paid') return `${f.orderId} was paid in the meantime, so it was not cancelled. The customer now has two orders: check the Orders list.`;
  return `The new order was created, but the unpaid order ${f.orderId} could not be cancelled${f.error ? ` (${f.error})` : ''}. Check the Orders list.`;
}
