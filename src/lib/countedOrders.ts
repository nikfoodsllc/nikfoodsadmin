/**
 * Which orders the kitchen, packing and delivery reports count. One definition, so the Kitchen Dashboard, the Kitchen Report and
 * the Packing Report always agree (they read through kitchenRows.ts and packingRows.ts, which use it inside `$match`).
 * Used together with `status: { $ne: 'cancelled' }`.
 *  1. paid orders,
 *  2. orders handled by hand (for example paid in person) that are already being prepared or delivered,
 *  3. orders an admin entered with "count it before it is paid" (Create Order): they count while they wait for payment.
 * A failed or refunded payment never counts.
 */
export const COUNTED_ORDER_CLAUSES = [
  { paymentStatus: 'paid' },
  { status: { $in: ['preparing', 'ready', 'out_for_delivery', 'partially_delivered', 'delivered'] }, paymentStatus: { $nin: ['failed', 'refunded'] } },
  { countBeforePayment: true, paymentStatus: { $nin: ['failed', 'refunded'] } },
];
