import { db } from '@/lib/db';
import { pacificDayOf, toDayString, type DayRange, type KitchenRow } from '@/utils/kitchenDashboard';

/**
 * The order lines the kitchen has to produce within a date range, one per ordered item, flattened for
 * counting. An item belongs to the menu day it was picked for (the order day's `deliveryDate`), not to the
 * day it is finally delivered. Only orders that are really going to be cooked count: not cancelled, not
 * refunded, not failed and not a checkout that was never paid. The kitchen counts and the "who ordered it"
 * list both read through this, so they always agree.
 */
export async function fetchKitchenRows(range: DayRange): Promise<KitchenRow[]> {
  const within = { $gte: range.startDate, $lte: `${range.endDate}￿` };
  const pipeline = [
    {
      $match: {
        status: { $ne: 'cancelled' },
        $or: [
          { paymentStatus: 'paid' },
          // handled by hand (for example paid in person): already being prepared or delivered
          { status: { $in: ['preparing', 'ready', 'out_for_delivery', 'delivered'] }, paymentStatus: { $nin: ['failed', 'refunded'] } },
        ],
        'items.deliveryDate': within,
      },
    },
    { $unwind: '$items' },
    { $match: { 'items.deliveryDate': within } },
    { $unwind: '$items.items' },
    {
      $project: {
        _id: 0,
        orderId: 1,
        orderStatus: '$status',
        orderedAt: '$createdAt',
        customerName: '$customerInfo.name',
        day: '$items.deliveryDate',
        deliveredOn: '$items.actualDeliveryDate',
        name: '$items.items.food.name',
        foodId: '$items.items.food._id',
        quantity: '$items.items.quantity',
        portion: '$items.items.selectedPortion',
        spiceLevel: '$items.items.spiceLevel',
        isEco: '$items.items.isEcoFriendlyContainer',
        sections: '$items.items.food.sections',
        comboSelections: '$items.items.comboSelections',
      },
    },
  ];

  const result = await db.aggregate('orders', pipeline);
  if (!result.success) {
    throw new Error(result.error || 'Failed to read orders');
  }

  const rows: KitchenRow[] = [];
  for (const raw of result.data ?? []) {
    const day = toDayString(raw.day);
    if (!day) continue;
    rows.push({
      orderId: String(raw.orderId ?? ''),
      day,
      name: String(raw.name ?? ''),
      foodId: raw.foodId ? String(raw.foodId) : null,
      quantity: Number(raw.quantity),
      portion: raw.portion ?? null,
      spiceLevel: raw.spiceLevel ?? null,
      isEco: Boolean(raw.isEco),
      sections: Array.isArray(raw.sections) ? raw.sections : null,
      comboSelections: raw.comboSelections && typeof raw.comboSelections === 'object' ? raw.comboSelections : null,
      customerName: typeof raw.customerName === 'string' ? raw.customerName : null,
      deliveredOn: toDayString(raw.deliveredOn),
      orderStatus: typeof raw.orderStatus === 'string' ? raw.orderStatus : null,
      orderedOn: pacificDayOf(raw.orderedAt),
    });
  }
  return rows;
}
