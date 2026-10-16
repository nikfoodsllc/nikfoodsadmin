import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { jwtHandler } from '@/lib/jwt';
import { isDayString } from '@/utils/kitchenDashboard';
import { PACKER_ORDER_PROJECTION, toPackerOrder, type PackerItem } from '@/utils/packerOrders';

export const dynamic = 'force-dynamic';

const MAX_ORDERS = 10;

function verifyAuth(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) return { success: false as const, error: 'Missing or invalid authorization header' };
  const result = jwtHandler.verifyToken(authHeader.substring(7));
  if (!result.success || !result.payload) return { success: false as const, error: result.error || 'Invalid token' };
  if (result.payload.role !== 'admin') return { success: false as const, error: 'Unauthorized: Admin access required' };
  return { success: true as const };
}

/**
 * GET /api/admin/packing-metrics/order?date=YYYY-MM-DD&orderIds=ORD-1,ORD-2   (the DELIVERY date and the orders of one packed customer)
 * What that customer's stop contained on that day, so the packing time can be read next to the size of the order. Items only:
 * no prices, no address, no phone. Read only.
 */
export async function GET(request: NextRequest) {
  try {
    const auth = verifyAuth(request);
    if (!auth.success) return NextResponse.json({ error: auth.error }, { status: 401 });
    const params = new URL(request.url).searchParams;
    const date = params.get('date') ?? '';
    if (!isDayString(date)) return NextResponse.json({ error: 'date must be a real day, YYYY-MM-DD' }, { status: 400 });
    const orderIds = (params.get('orderIds') ?? '').split(',').map((s) => s.trim()).filter(Boolean).slice(0, MAX_ORDERS);
    if (orderIds.length === 0) return NextResponse.json({ error: 'orderIds is needed' }, { status: 400 });
    const result = await db.read('orders', { orderId: { $in: orderIds } }, { projection: PACKER_ORDER_PROJECTION as unknown as Record<string, 1> });
    if (!result.success) throw new Error(result.error || 'Failed to load orders');
    const orders = (result.data ?? []).map(toPackerOrder).map((o) => {
      const items: PackerItem[] = o.days.filter((d) => d.deliveryDate === date).flatMap((d) => d.items);
      return { orderId: o.orderId, items };
    });
    return NextResponse.json({ data: { date, orders } });
  } catch (error) {
    console.error('packing-metrics order GET failed', error);
    return NextResponse.json({ error: 'Could not load the order' }, { status: 500 });
  }
}
