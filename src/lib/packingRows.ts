import { CREDIT_ADJUST_STAGE } from '@/lib/creditAdjust';
import { COUNTED_ORDER_CLAUSES, NOT_MANUALLY_DELIVERED } from '@/lib/countedOrders';
import { db } from '@/lib/db';
import { pacificDayOf, toDayString } from '@/utils/kitchenDashboard';
import type { PackingRow } from '@/utils/packingReport';

/**
 * Every order line that is delivered on one date: an item's DELIVERY date counts (the day it goes out, after any cart
 * combining or an admin's move), not the menu day it was picked for. Only orders that are really going out count: not
 * cancelled, not refunded, not failed, never an unpaid checkout. Same rule as the kitchen's order lines.
 */
export async function fetchPackingRows(date: string): Promise<PackingRow[]> {
  const within = { $gte: date, $lte: `${date}￿` };
  const effective = { $ifNull: ['$items.actualDeliveryDate', '$items.deliveryDate'] };
  const pipeline = [
    {
      $match: {
        status: { $ne: 'cancelled' },
        ...NOT_MANUALLY_DELIVERED,
        $or: COUNTED_ORDER_CLAUSES,
        $and: [{ $or: [{ 'items.actualDeliveryDate': within }, { 'items.deliveryDate': within }] }],
      },
    },
    CREDIT_ADJUST_STAGE,
    { $unwind: '$items' },
    { $match: { $expr: { $and: [{ $gte: [{ $toString: effective }, date] }, { $lt: [{ $toString: effective }, `${date}￿`] }] } } },
    { $unwind: '$items.items' },
    {
      $project: {
        _id: 0,
        orderId: 1,
        orderStatus: '$status',
        orderedAt: '$createdAt',
        customerName: '$customerInfo.name',
        street: '$address.street',
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
        notes: '$items.items.notes',
      },
    },
  ];
  const result = await db.aggregate('orders', pipeline);
  if (!result.success) throw new Error(result.error || 'Failed to read orders');
  const rows: PackingRow[] = [];
  for (const raw of (result.data ?? []) as Array<Record<string, any>>) { // eslint-disable-line @typescript-eslint/no-explicit-any
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
      notes: typeof raw.notes === 'string' && raw.notes.trim() ? raw.notes.trim() : null,
      deliveredOn: toDayString(raw.deliveredOn),
      orderStatus: typeof raw.orderStatus === 'string' ? raw.orderStatus : null,
      orderedOn: pacificDayOf(raw.orderedAt),
      street: typeof raw.street === 'string' ? raw.street : null,
    });
  }
  return rows;
}

/** An order line made on the date's kitchen day that does NOT go out that day. */
export interface HeldRow extends PackingRow {
  /** An admin moved the delivery date (otherwise the day was combined into a later delivery day) */
  movedByAdmin: boolean;
}

/**
 * Every order line whose KITCHEN day (the menu day it was picked for) is this date but whose delivery date is later: the food is
 * made on this day and waits in the fridge until it goes out. Same orders as fetchPackingRows (really going out: not cancelled,
 * refunded, failed or unpaid).
 */
export async function fetchHeldRows(date: string): Promise<HeldRow[]> {
  const within = { $gte: date, $lte: `${date}￿` };
  const pipeline = [
    {
      $match: {
        status: { $ne: 'cancelled' },
        ...NOT_MANUALLY_DELIVERED,
        $or: COUNTED_ORDER_CLAUSES,
        'items.deliveryDate': within,
      },
    },
    CREDIT_ADJUST_STAGE,
    { $unwind: '$items' },
    {
      $match: {
        $expr: {
          $and: [
            { $gte: [{ $toString: '$items.deliveryDate' }, date] },
            { $lt: [{ $toString: '$items.deliveryDate' }, `${date}￿`] },
            { $gt: [{ $toString: { $ifNull: ['$items.actualDeliveryDate', ''] } }, `${date}￿`] },
          ],
        },
      },
    },
    { $unwind: '$items.items' },
    {
      $project: {
        _id: 0,
        orderId: 1,
        orderStatus: '$status',
        orderedAt: '$createdAt',
        customerName: '$customerInfo.name',
        street: '$address.street',
        day: '$items.deliveryDate',
        deliveredOn: '$items.actualDeliveryDate',
        moved: '$items.items.originalDeliveryDate',
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
  const rows: HeldRow[] = [];
  for (const raw of (result.data ?? []) as Array<Record<string, any>>) { // eslint-disable-line @typescript-eslint/no-explicit-any
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
      street: typeof raw.street === 'string' ? raw.street : null,
      movedByAdmin: Boolean(raw.moved),
    });
  }
  return rows;
}
