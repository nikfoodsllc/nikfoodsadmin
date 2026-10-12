import { NextRequest, NextResponse } from 'next/server';
import { ObjectId } from 'mongodb';
import { db } from '@/lib/db';
import { jwtHandler } from '@/lib/jwt';
import { comboItemQuantity } from '@/utils/comboQuantity';
import { isDayString, pacificDayOf } from '@/utils/kitchenDashboard';
import { planOrderChanges, summarizeChanges, type CurrentCombo, type OrderLike, type PlannedChange } from '@/utils/comboQuantityBackfill';

export const dynamic = 'force-dynamic';

function verifyAuth(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) return { success: false as const, error: 'Missing or invalid authorization header' };
  const result = jwtHandler.verifyToken(authHeader.substring(7));
  if (!result.success || !result.payload) return { success: false as const, error: result.error || 'Invalid token' };
  if (result.payload.role !== 'admin') return { success: false as const, error: 'Unauthorized: Admin access required' };
  return { success: true as const, userId: String(result.payload.userId ?? '') };
}

const MAX_ORDERS = 3000;

/**
 * POST /api/admin/orders/combo-quantity-backfill   { dryRun?: boolean (default true), fromDate?: 'YYYY-MM-DD' (default today, Pacific) }
 *
 * Copies the CURRENT quantity of each combo item (Chapati x 4, set in the combo editor) onto the frozen combo copy of orders that are
 * placed but not yet delivered (delivery day = fromDate or later; cancelled, failed, refunded and delivered orders are skipped).
 * Options an order already has a quantity for are left alone, prices and customer details are never touched, and it is safe to run twice.
 * A dry run (the default) only reports what would change: counts per combo and order numbers, no customer data.
 */
export async function POST(request: NextRequest) {
  try {
    const auth = verifyAuth(request);
    if (!auth.success) return NextResponse.json({ error: auth.error }, { status: 401 });

    let body: { dryRun?: unknown; fromDate?: unknown } = {};
    try {
      body = await request.json();
    } catch {
      body = {};
    }
    const dryRun = body.dryRun !== false; // only an explicit false writes
    const fromDate = typeof body.fromDate === 'string' ? body.fromDate : pacificDayOf(new Date()) ?? '';
    if (!isDayString(fromDate)) return NextResponse.json({ error: 'fromDate must be a real day, YYYY-MM-DD' }, { status: 400 });

    const conn = await db.getDb();
    const orders = conn.collection('orders');
    const found = await orders
      .find(
        {
          'items.items.food.hasCombo': true,
          status: { $nin: ['cancelled', 'canceled', 'delivered', 'failed'] },
          paymentStatus: { $nin: ['failed', 'refunded'] },
          $or: [{ 'items.deliveryDate': { $gte: fromDate } }, { 'items.actualDeliveryDate': { $gte: fromDate } }],
        },
        { projection: { _id: 0, orderId: 1, status: 1, paymentStatus: 1, 'items.deliveryDate': 1, 'items.actualDeliveryDate': 1, 'items.items.food._id': 1, 'items.items.food.name': 1, 'items.items.food.hasCombo': 1, 'items.items.food.sections': 1 } }
      )
      .sort({ createdAt: -1 })
      .limit(MAX_ORDERS + 1)
      .toArray();
    if (found.length > MAX_ORDERS) return NextResponse.json({ error: `More than ${MAX_ORDERS} orders match; pick a later fromDate.` }, { status: 400 });
    const list = found as unknown as OrderLike[];

    // the combos as they are now
    const ids = new Set<string>();
    for (const o of list) for (const day of o.items ?? []) for (const line of day.items ?? []) if (line.food?.hasCombo && line.food._id) ids.add(String(line.food._id));
    const objectIds = [...ids].filter((id) => /^[0-9a-fA-F]{24}$/.test(id)).map((id) => new ObjectId(id));
    const docs = objectIds.length ? await conn.collection('fooditems').find({ _id: { $in: objectIds } }, { projection: { sections: 1 } }).toArray() : [];
    const combosById = new Map<string, CurrentCombo>();
    for (const d of docs) {
      const sections = Array.isArray(d.sections) ? d.sections : [];
      combosById.set(String(d._id), {
        id: String(d._id),
        sections: sections.map((s: { _id?: unknown; title?: string; selectedItems?: Array<{ item?: unknown; quantity?: unknown }> }) => ({
          _id: s._id === undefined ? undefined : String(s._id),
          title: s.title,
          options: (s.selectedItems ?? []).map((o) => ({ itemId: String(o.item ?? ''), quantity: comboItemQuantity(o.quantity) })),
        })),
      });
    }

    const changes: PlannedChange[] = list.flatMap((o) => planOrderChanges(o, combosById, fromDate));
    const summary = summarizeChanges(changes, list.length);
    if (dryRun) return NextResponse.json({ success: true, data: { dryRun: true, fromDate, ...summary } });

    // write: one update per order; each option is only written where the same food item is still in that place
    const byOrder = new Map<string, PlannedChange[]>();
    for (const c of changes) byOrder.set(c.orderId, [...(byOrder.get(c.orderId) ?? []), c]);
    let updatedOrders = 0;
    let updatedOptions = 0;
    const skipped: string[] = [];
    for (const [orderId, list2] of byOrder) {
      const filter: Record<string, unknown> = { orderId };
      const set: Record<string, unknown> = {};
      for (const c of list2) {
        filter[c.guardPath] = /^[0-9a-fA-F]{24}$/.test(c.guardId) ? { $in: [c.guardId, new ObjectId(c.guardId)] } : c.guardId;
        set[c.path] = c.quantity;
      }
      const result = await orders.updateOne(filter, { $set: set });
      if (result.modifiedCount > 0) {
        updatedOrders += 1;
        updatedOptions += list2.length;
      } else skipped.push(orderId);
    }
    await conn.collection('comboQuantityBackfills').insertOne({ at: new Date(), by: auth.userId, fromDate, orders: updatedOrders, options: updatedOptions, orderIds: summary.orderIds, skipped });
    return NextResponse.json({ success: true, data: { dryRun: false, fromDate, ...summary, applied: { orders: updatedOrders, options: updatedOptions, skipped } } });
  } catch (error) {
    console.error('combo-quantity-backfill failed', error);
    return NextResponse.json({ error: 'Could not run the combo quantity backfill' }, { status: 500 });
  }
}
