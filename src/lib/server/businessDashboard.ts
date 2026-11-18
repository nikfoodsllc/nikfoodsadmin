import { ObjectId } from 'mongodb';
import { db } from '@/lib/db';
import { pacificDayStart } from '@/utils/abandonedCheckouts';
import { pacificDayOf } from '@/utils/kitchenDashboard';
import { normalizePreparationType } from '@/utils/preparationType';
import { addDays } from '@/utils/kitchenDashboard';
import { itemKey, type DayRange, type ItemType, type SaleLine, type SaleOrder } from '@/utils/businessDashboard';

/**
 * Reads the paid orders of the business Dashboard from the database. Only the fields the numbers need are read; customer
 * names, emails, phones and addresses are never loaded.
 */
interface RawOrder {
  orderId?: string;
  createdAt?: Date | string;
  subtotal?: number;
  platformFee?: number;
  deliveryFee?: number;
  taxes?: number;
  tip?: number;
  totalPaid?: number;
  paymentStatus?: string;
  refundedAmount?: number;
  creditsIssued?: Array<{ amount?: number }>;
  stripeFee?: number;
  items?: Array<{ items?: Array<{ food?: { _id?: unknown; name?: string; hasCombo?: boolean }; quantity?: number; price?: number }> }>;
}

const MONEY_FIELDS = {
  orderId: 1, createdAt: 1, subtotal: 1, platformFee: 1, deliveryFee: 1, taxes: 1, tip: 1, totalPaid: 1, paymentStatus: 1, refundedAmount: 1,
  'creditsIssued.amount': 1, stripeFee: 1,
} as const;

/** Paid orders (paid, or refunded later) placed within the Pacific days of the span; with their item lines when asked */
export async function loadSales(span: DayRange, withItems: boolean): Promise<{ orders: SaleOrder[]; lines: SaleLine[] }> {
  const query = {
    paymentStatus: { $in: ['paid', 'refunded'] },
    createdAt: { $gte: pacificDayStart(span.from), $lt: pacificDayStart(addDays(span.to, 1)) },
  };
  const projection: Record<string, 0 | 1> = withItems
    ? { ...MONEY_FIELDS, 'items.items.food._id': 1, 'items.items.food.name': 1, 'items.items.food.hasCombo': 1, 'items.items.quantity': 1, 'items.items.price': 1 }
    : { ...MONEY_FIELDS };
  const result = await db.read<RawOrder & { _id?: unknown }>('orders', query as never, { projection });
  if (!result.success) throw new Error(result.error || 'Could not read the orders');
  const orders: SaleOrder[] = [];
  const lines: SaleLine[] = [];
  for (const raw of result.data ?? []) {
    const day = pacificDayOf(raw.createdAt);
    if (!day) continue;
    orders.push({
      orderId: raw.orderId,
      day,
      subtotal: raw.subtotal,
      platformFee: raw.platformFee,
      deliveryFee: raw.deliveryFee,
      taxes: raw.taxes,
      tip: raw.tip,
      totalPaid: raw.totalPaid,
      paymentStatus: raw.paymentStatus,
      refundedAmount: raw.refundedAmount,
      creditsIssued: raw.creditsIssued,
      stripeFee: raw.stripeFee,
    });
    if (!withItems) continue;
    for (const orderDay of raw.items ?? []) {
      for (const item of orderDay.items ?? []) {
        const name = typeof item.food?.name === 'string' ? item.food.name : '';
        if (!name.trim()) continue;
        lines.push({
          day,
          name,
          foodId: item.food?._id ? String(item.food._id) : undefined,
          quantity: typeof item.quantity === 'number' ? item.quantity : 0,
          price: typeof item.price === 'number' ? item.price : 0,
          isCombo: item.food?.hasCombo === true,
        });
      }
    }
  }
  return { orders, lines };
}

/**
 * How each sold item is prepared (Cooked / Ready to eat), from the food item it was ordered as. Falls back to the item's name when the
 * food item no longer exists, but only when every food item with that name agrees.
 */
export async function preparationLookup(lines: SaleLine[]): Promise<(line: Pick<SaleLine, 'foodId' | 'name'>) => ItemType> {
  const ids = [...new Set(lines.map((l) => l.foodId).filter((id): id is string => !!id && ObjectId.isValid(id)))];
  const names = [...new Set(lines.map((l) => l.name.trim()))];
  const byId = new Map<string, ItemType>();
  const byName = new Map<string, Set<ItemType>>();
  if (ids.length > 0 || names.length > 0) {
    const found = await db.read<{ _id: unknown; name?: string; preparationType?: unknown }>(
      'fooditems',
      { $or: [{ _id: { $in: ids.map((id) => new ObjectId(id)) } }, { name: { $in: names } }] } as never,
      { projection: { name: 1, preparationType: 1 } }
    );
    for (const item of found.success ? found.data ?? [] : []) {
      const type: ItemType = normalizePreparationType(item.preparationType) ?? 'not_set';
      byId.set(String(item._id), type);
      if (item.name) {
        const key = itemKey(item.name);
        byName.set(key, (byName.get(key) ?? new Set()).add(type));
      }
    }
  }
  return (line) => {
    const viaId = line.foodId ? byId.get(line.foodId) : undefined;
    if (viaId && viaId !== 'not_set') return viaId;
    const set = byName.get(itemKey(line.name));
    if (set && set.size === 1) return [...set][0];
    return viaId ?? 'not_set';
  };
}
