import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { verifyAdminRequest } from '@/lib/adminAuth';

export const dynamic = 'force-dynamic';

const ORDER_ID = /^ORD-\d{10,20}$/;

/**
 * POST /api/admin/abandoned-checkouts/cleanup { beforeOrderId: 'ORD-...', dryRun?: boolean }
 *
 * Removes the saved checkouts (the data behind the Abandoned Checkout page) that were opened BEFORE the given order was placed.
 * A dry run (the default: only an explicit dryRun: false deletes) counts what would go and changes nothing. Orders, customers
 * and payments are never touched. Every real run is written to `abandonedCheckoutCleanups` (when, by whom, the cutoff, how many).
 */
export async function POST(request: NextRequest) {
  try {
    const auth = verifyAdminRequest(request);
    if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: 401 });

    let body: { beforeOrderId?: unknown; dryRun?: unknown } = {};
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
    }
    const orderId = typeof body.beforeOrderId === 'string' ? body.beforeOrderId.trim() : '';
    if (!ORDER_ID.test(orderId)) return NextResponse.json({ error: 'beforeOrderId must look like ORD-1234567890123456' }, { status: 400 });
    const dryRun = body.dryRun !== false;

    const order = await db.readOne<{ orderId: string; createdAt?: Date | string }>('orders', { orderId } as never);
    const cutoff = order.success && order.data?.createdAt ? new Date(order.data.createdAt) : null;
    if (!cutoff || Number.isNaN(cutoff.getTime())) return NextResponse.json({ error: 'That order was not found' }, { status: 404 });

    const filter = { createdAt: { $lt: cutoff } } as never;
    const [matching, contacted, withReminder] = await Promise.all([
      db.count('checkoutDrafts', filter),
      db.count('checkoutDrafts', { createdAt: { $lt: cutoff }, contacted: { $exists: true } } as never),
      db.count('checkoutDrafts', { createdAt: { $lt: cutoff }, reminderEmail: { $exists: true } } as never),
    ]);
    if (!matching.success) throw new Error(matching.error || 'Could not count the checkouts');
    const summary = { cutoff: cutoff.toISOString(), matching: matching.count ?? 0, contacted: contacted.count ?? 0, withReminder: withReminder.count ?? 0 };

    if (dryRun) return NextResponse.json({ success: true, dryRun: true, data: summary });

    const removed = await db.delete('checkoutDrafts', filter);
    if (!removed.success) throw new Error(removed.error || 'Could not delete the checkouts');
    const deleted = removed.deletedCount ?? 0;
    await db.create('abandonedCheckoutCleanups', { at: new Date(), by: auth.userId, beforeOrderId: orderId, ...summary, deleted } as never);
    return NextResponse.json({ success: true, dryRun: false, data: { ...summary, deleted } });
  } catch (error) {
    console.error('abandoned-checkouts cleanup failed', error);
    return NextResponse.json({ error: 'Could not clean up the abandoned checkouts' }, { status: 500 });
  }
}
