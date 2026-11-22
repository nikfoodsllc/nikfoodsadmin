import { ObjectId } from 'mongodb';
import { db } from '@/lib/db';
import { pacificDayStart } from '@/utils/abandonedCheckouts';
import { addDays, pacificDayOf } from '@/utils/kitchenDashboard';
import { bucketsFor, type DayRange, type Grouping } from '@/utils/businessDashboard';
import { customerKeyOf, splitNewExisting, type CustomerSplit, type SplitOrder } from '@/utils/customerSplit';

const PAID = { $in: ['paid', 'refunded'] };

interface RawOrder {
  orderId?: string;
  createdAt?: Date | string;
  user?: unknown;
  customerInfo?: { name?: string; email?: string };
  totalPaid?: number;
}

/** Paid orders of the range split into new customers (first paid order ever) and existing ones */
export async function loadCustomerSplit(range: DayRange, grouping: Grouping): Promise<CustomerSplit> {
  const database = await db.getDb();
  const orders = database.collection('orders');
  const raw = (await orders
    .find(
      { paymentStatus: PAID, createdAt: { $gte: pacificDayStart(range.from), $lt: pacificDayStart(addDays(range.to, 1)) } },
      { projection: { orderId: 1, createdAt: 1, user: 1, 'customerInfo.name': 1, 'customerInfo.email': 1, totalPaid: 1 } }
    )
    .toArray()) as RawOrder[];

  const list: SplitOrder[] = [];
  const userIds = new Set<string>();
  const emails = new Set<string>();
  for (const r of raw) {
    const day = pacificDayOf(r.createdAt);
    if (!day || !r.orderId) continue;
    const key = customerKeyOf(r.user, r.customerInfo?.email);
    if (key?.startsWith('u:')) userIds.add(key.slice(2));
    else if (key?.startsWith('e:')) emails.add(key.slice(2));
    list.push({ orderId: r.orderId, day, customerKey: key, name: r.customerInfo?.name?.trim() || 'No name', total: typeof r.totalPaid === 'number' ? r.totalPaid : 0 });
  }

  // each customer's first paid order ever (the user field may be text or an ObjectId)
  const firstOrderOf = new Map<string, string>();
  if (userIds.size > 0) {
    const ids = [...userIds];
    const forms: unknown[] = [...ids, ...ids.filter((id) => ObjectId.isValid(id) && id.length === 24).map((id) => new ObjectId(id))];
    const rows = await orders
      .aggregate<{ _id: string; orderId: string }>([
        { $match: { paymentStatus: PAID, user: { $in: forms } } },
        { $sort: { createdAt: 1, orderId: 1 } },
        { $group: { _id: { $toString: '$user' }, orderId: { $first: '$orderId' } } },
      ])
      .toArray();
    for (const row of rows) firstOrderOf.set(`u:${row._id}`, row.orderId);
  }
  if (emails.size > 0) {
    // orders without an account: matched by email (any case)
    const rows = await orders
      .aggregate<{ _id: string; orderId: string }>([
        { $match: { paymentStatus: PAID, $or: [{ user: { $exists: false } }, { user: null }, { user: '' }], 'customerInfo.email': { $exists: true } } },
        { $project: { orderId: 1, createdAt: 1, email: { $toLower: { $trim: { input: '$customerInfo.email' } } } } },
        { $match: { email: { $in: [...emails] } } },
        { $sort: { createdAt: 1, orderId: 1 } },
        { $group: { _id: '$email', orderId: { $first: '$orderId' } } },
      ])
      .toArray();
    for (const row of rows) firstOrderOf.set(`e:${row._id}`, row.orderId);
  }

  return splitNewExisting(list, firstOrderOf, bucketsFor(range, grouping), grouping);
}
