import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { verifyStaffRequest } from '@/lib/adminAuth';
import { isDayString } from '@/utils/kitchenDashboard';
import { PACKER_ORDER_PROJECTION, toPackerOrder } from '@/utils/packerOrders';

export const dynamic = 'force-dynamic';

const MAX_LIMIT = 100;

/**
 * GET /api/admin/packer-orders?search=&date=YYYY-MM-DD&page=1&limit=25
 *
 * The Orders list for packers (admins may use it too): CONFIRMED orders only, newest first, with the customer's name and
 * delivery details and the items to pack. No money (prices, totals, tips, fees, payments, refunds), no customer email, no
 * email or OptimoRoute tracking: the fields are asked for one by one (PACKER_ORDER_PROJECTION) and copied one by one
 * (toPackerOrder). `date` keeps the orders that have something to deliver that day. Read only.
 */
export async function GET(request: NextRequest) {
  try {
    const auth = verifyStaffRequest(request);
    if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: 401 });

    const params = new URL(request.url).searchParams;
    const search = (params.get('search') ?? '').trim().slice(0, 100);
    const date = params.get('date') ?? '';
    if (date && !isDayString(date)) return NextResponse.json({ error: 'date must be a real day, YYYY-MM-DD' }, { status: 400 });
    const page = Math.max(1, parseInt(params.get('page') ?? '1', 10) || 1);
    const limit = Math.min(MAX_LIMIT, Math.max(1, parseInt(params.get('limit') ?? '25', 10) || 25));

    const filter: Record<string, unknown> = { status: 'confirmed' };
    const and: Record<string, unknown>[] = [];
    if (search) {
      // typed text is matched as plain text: ( + [ and the like must not be read as pattern characters
      const escaped = search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      and.push({ $or: [{ orderId: { $regex: escaped, $options: 'i' } }, { 'customerInfo.name': { $regex: escaped, $options: 'i' } }] });
    }
    if (date) {
      const day = { $regex: `^${date}` };
      // delivered that day: the delivery date when there is one, else the menu day
      and.push({ items: { $elemMatch: { $or: [{ actualDeliveryDate: day }, { actualDeliveryDate: { $in: [null, ''] }, deliveryDate: day }, { actualDeliveryDate: { $exists: false }, deliveryDate: day }] } } });
    }
    if (and.length > 0) filter.$and = and;

    const counted = await db.count('orders', filter);
    if (!counted.success) throw new Error(counted.error || 'Failed to count orders');
    const result = await db.read('orders', filter, { sort: { createdAt: -1 }, skip: (page - 1) * limit, limit, projection: PACKER_ORDER_PROJECTION as unknown as Record<string, 1> });
    if (!result.success) throw new Error(result.error || 'Failed to load orders');

    return NextResponse.json({
      data: { items: (result.data ?? []).map(toPackerOrder), total: counted.count ?? 0, page, pageSize: limit },
      message: 'Orders fetched successfully',
    });
  } catch (error) {
    console.error('Error in GET /api/admin/packer-orders:', error);
    return NextResponse.json({ error: 'Could not load the orders' }, { status: 500 });
  }
}
