import { NextRequest, NextResponse } from 'next/server';
import { jwtHandler } from '@/lib/jwt';
import { db } from '@/lib/db';
import { buildAbandonedRows, resolveRange, summarize, type DraftDoc, type OrderInfo, type PaidOrderRef } from '@/utils/abandonedCheckouts';

export const dynamic = 'force-dynamic';

function verifyAuth(request: NextRequest) {
  const header = request.headers.get('authorization');
  if (!header || !header.startsWith('Bearer ')) return { success: false, error: 'Missing or invalid authorization header' };
  const result = jwtHandler.verifyToken(header.substring(7));
  if (!result.success || !result.payload) return { success: false, error: result.error || 'Invalid token' };
  if (result.payload.role !== 'admin') return { success: false, error: 'Unauthorized: Admin access required' };
  return { success: true, userId: result.payload.userId as string };
}

/**
 * GET /api/admin/abandoned-checkouts?days=14   or   ?from=2026-10-01&to=2026-10-07 (Pacific dates, both included)
 * People who opened checkout in the last `days` days (or between the two dates) and did not pay (one row per person, newest first), split into
 * "to contact" and "contacted". People who have placed an order since are not listed (only counted).
 */
export async function GET(request: NextRequest) {
  try {
    const auth = verifyAuth(request);
    if (!auth.success) return NextResponse.json({ error: auth.error }, { status: 401 });

    const params = new URL(request.url).searchParams;
    const daysParam = params.get('days');
    const range = resolveRange({ days: daysParam === null ? null : Number(daysParam), from: params.get('from'), to: params.get('to') });
    if ('error' in range) return NextResponse.json({ error: range.error }, { status: 400 });
    const since = range.since;

    const draftsResult = await db.read<DraftDoc>('checkoutDrafts', { status: 'open', createdAt: { $gte: since, ...(range.until ? { $lt: range.until } : {}) } } as never, { sort: { lastActivityAt: -1 }, limit: 2000 });
    if (!draftsResult.success) throw new Error(draftsResult.error || 'Could not read the checkouts');
    const drafts = draftsResult.data ?? [];

    const userIds = [...new Set(drafts.map((d) => d.userId).filter(Boolean))];
    let paidOrders: PaidOrderRef[] = [];
    if (userIds.length > 0) {
      const paid = await db.read<PaidOrderRef>('orders', { user: { $in: userIds }, paymentStatus: 'paid', createdAt: { $gte: new Date(since.getTime() - 24 * 3600 * 1000) } } as never, { projection: { user: 1, createdAt: 1 } });
      if (!paid.success) throw new Error(paid.error || 'Could not read the orders');
      paidOrders = paid.data ?? [];
    }

    const orderIds = [...new Set(drafts.map((d) => d.orderId).filter((x): x is string => Boolean(x)))];
    const info = new Map<string, OrderInfo>();
    if (orderIds.length > 0) {
      const orders = await db.read<OrderInfo>('orders', { orderId: { $in: orderIds } } as never, { projection: { orderId: 1, status: 1, paymentStatus: 1, paymentError: 1 } });
      for (const o of orders.data ?? []) info.set(o.orderId, o);
    }

    const built = buildAbandonedRows(drafts, paidOrders, info);
    return NextResponse.json({
      success: true,
      data: { from: range.from, to: range.to, rows: { to_contact: built.to_contact, contacted: built.contacted }, ...summarize(built), orderedSince: built.orderedSince },
    });
  } catch (error) {
    console.error('abandoned-checkouts GET failed', error);
    return NextResponse.json({ error: 'Could not load the abandoned checkouts' }, { status: 500 });
  }
}
