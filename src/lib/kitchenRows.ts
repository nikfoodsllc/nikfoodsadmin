import { db } from '@/lib/db';
import { pacificDayOf, toDayString, type DayRange, type KitchenRow } from '@/utils/kitchenDashboard';

/**
 * The order lines the kitchen has to produce within a date range, one per ordered item, flattened for
 * counting. An item belongs to the menu day it was picked for (the order day's `deliveryDate`), not to the
 * day it is finally delivered. Only orders that are really going to be cooked count: not cancelled, not
 * refunded, not failed and not a checkout that was never paid. The kitchen counts and the "who ordered it"
 * list both read through this, so they always agree.
 */
export async function fetchKitchenRows(range: DayRange, options: { report?: boolean } = {}): Promise<KitchenRow[]> {
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
    // the Kitchen Report cooks an item moved EARLIER by an admin on its new date, so it leaves its old kitchen day
    ...(options.report
      ? [{ $match: { $expr: { $not: [{ $and: [{ $ne: [{ $ifNull: ['$items.items.originalDeliveryDate', ''] }, ''] }, { $lt: [{ $ifNull: ['$items.actualDeliveryDate', '$items.deliveryDate'] }, '$items.deliveryDate'] }] }] } } }]
      : []),
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
  rows.push(...mapRows(result.data ?? []));
  return rows;
}

function mapRows(data: Array<Record<string, unknown>>, movedFrom?: boolean): KitchenRow[] {
  const rows: KitchenRow[] = [];
  for (const raw of data as Array<any>) { // eslint-disable-line @typescript-eslint/no-explicit-any
    const kitchenDay = toDayString(raw.day);
    if (!kitchenDay) continue;
    // an item an admin moved to another date is cooked for the date it is delivered on
    const day = movedFrom ? toDayString(raw.deliveredOn) || kitchenDay : kitchenDay;
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
      movedFrom: movedFrom ? kitchenDay : null,
    });
  }
  return rows;
}

/**
 * Items an admin moved to another delivery date, placed on the date they are delivered on, for the Kitchen Report.
 * Moved earlier: they leave their old kitchen day (fetchKitchenRows with `report` drops them) and are cooked on the new date.
 * Moved later: they stay on their kitchen day too; they are added on the new date only when that kitchen day is outside the range.
 */
export async function fetchMovedKitchenRows(range: DayRange, options: { earlierOnly?: boolean } = {}): Promise<KitchenRow[]> {
  const within = { $gte: range.startDate, $lte: `${range.endDate}\uffff` };
  const pipeline = [
    {
      $match: {
        status: { $ne: 'cancelled' },
        $or: [
          { paymentStatus: 'paid' },
          { status: { $in: ['preparing', 'ready', 'out_for_delivery', 'delivered'] }, paymentStatus: { $nin: ['failed', 'refunded'] } },
        ],
        'items.actualDeliveryDate': within,
      },
    },
    { $unwind: '$items' },
    { $match: { 'items.actualDeliveryDate': within } },
    { $unwind: '$items.items' },
    { $match: { 'items.items.originalDeliveryDate': { $exists: true, $ne: null } } },
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
  if (!result.success) throw new Error(result.error || 'Failed to read orders');
  const keep = (result.data ?? []).filter((raw: Record<string, unknown>) => {
    const kitchen = toDayString(raw.day);
    const delivered = toDayString(raw.deliveredOn);
    if (!kitchen || !delivered || kitchen === delivered) return false;
    if (delivered < kitchen) return true; // moved earlier
    if (options.earlierOnly) return false;
    return kitchen < range.startDate || kitchen > range.endDate; // moved later: only when its kitchen day is not in the range
  });
  return mapRows(keep, true);
}

/**
 * The rows the Kitchen Dashboard counts: like fetchKitchenRows, but an item an admin moved to a delivery date
 * EARLIER than its kitchen day is cooked on that earlier date, so it leaves its old day and is counted on the
 * new one. Items moved later and cart-clubbed items stay on their kitchen day (the day card notes the delivery).
 */
export async function fetchDashboardRows(range: DayRange): Promise<KitchenRow[]> {
  const [base, movedEarlier] = await Promise.all([
    fetchKitchenRows(range, { report: true }),
    fetchMovedKitchenRows(range, { earlierOnly: true }),
  ]);
  return [...base, ...movedEarlier];
}
