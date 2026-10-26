/**
 * Which orders the kitchen, packing and delivery reports count. One definition, so the Kitchen Dashboard, the Kitchen Report and
 * the Packing Report always agree (they read through kitchenRows.ts and packingRows.ts, which use it inside `$match`).
 * Used together with `status: { $ne: 'cancelled' }`.
 *  1. paid orders,
 *  2. orders handled by hand (for example paid in person) that are already being prepared or delivered,
 *  3. orders an admin entered with "count it before it is paid" (Create Order): they count while they wait for payment.
 * A failed or refunded payment never counts.
 */
/**
 * An order an admin marked Delivered by hand (for example a pickup) is finished: the Packing and Delivery reports leave it out.
 * Orders OptimoRoute marked Delivered after the route was driven (deliveredBy 'optimoroute') stay in those reports as the day's record.
 * The Kitchen reports are not affected (the food was still made). Use inside `$match`.
 */
export const NOT_MANUALLY_DELIVERED = { $nor: [{ status: 'delivered', deliveredBy: { $ne: 'optimoroute' } }] };

export const COUNTED_ORDER_CLAUSES = [
  { paymentStatus: 'paid' },
  { status: { $in: ['preparing', 'ready', 'out_for_delivery', 'partially_delivered', 'delivered'] }, paymentStatus: { $nin: ['failed', 'refunded'] } },
  { countBeforePayment: true, paymentStatus: { $nin: ['failed', 'refunded'] } },
];
