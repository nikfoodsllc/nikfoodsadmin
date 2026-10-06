import { NextRequest, NextResponse } from 'next/server';
import { jwtHandler } from '@/lib/jwt';
import { fetchKitchenRows } from '@/lib/kitchenRows';
import { buildItemOrders, isDayString, validateRange } from '@/utils/kitchenDashboard';

const MAX_ITEM_NAME_CHARS = 200;
/** A safety cap on the list; an item is never ordered this many times in a range of at most 62 days. */
const MAX_LINES = 3000;

function verifyAuth(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return { success: false as const, error: 'Missing or invalid authorization header' };
  }
  const result = jwtHandler.verifyToken(authHeader.substring(7));
  if (!result.success || !result.payload) {
    return { success: false as const, error: result.error || 'Invalid token' };
  }
  if (result.payload.role !== 'admin') {
    return { success: false as const, error: 'Unauthorized: Admin access required' };
  }
  return { success: true as const };
}

/**
 * GET /api/admin/kitchen-dashboard/item-orders?startDate=&endDate=&item=<name>[&day=YYYY-MM-DD]
 *
 * Who ordered an item: the order lines behind the kitchen count of one item (alone or as a chosen part of a
 * combo), for the whole range or, with `day`, for one menu day. Same orders and same rules as the kitchen
 * dashboard, so the quantities add up to the number the kitchen sees.
 */
export async function GET(request: NextRequest) {
  try {
    const auth = verifyAuth(request);
    if (!auth.success) return NextResponse.json({ error: auth.error }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const range = { startDate: searchParams.get('startDate') ?? '', endDate: searchParams.get('endDate') ?? '' };
    const problem = validateRange(range);
    if (problem) return NextResponse.json({ error: problem }, { status: 400 });

    const item = (searchParams.get('item') ?? '').trim();
    if (!item) return NextResponse.json({ error: 'item is required' }, { status: 400 });
    if (item.length > MAX_ITEM_NAME_CHARS) return NextResponse.json({ error: 'item is too long' }, { status: 400 });

    const day = searchParams.get('day');
    if (day !== null && day !== '') {
      if (!isDayString(day)) return NextResponse.json({ error: 'day must be YYYY-MM-DD' }, { status: 400 });
      if (day < range.startDate || day > range.endDate) {
        return NextResponse.json({ error: 'day must be inside the date range' }, { status: 400 });
      }
    }

    const rows = await fetchKitchenRows(range);
    const all = buildItemOrders(rows, item, day || undefined);
    const lines = all.slice(0, MAX_LINES);

    return NextResponse.json({
      data: {
        item,
        day: day || null,
        lines,
        totals: {
          orders: new Set(all.map((l) => l.orderId)).size,
          units: all.reduce((sum, l) => sum + l.quantity, 0),
          truncated: all.length > lines.length,
        },
      },
      message: 'Item orders generated successfully',
    });
  } catch (error) {
    console.error('Error in GET /api/admin/kitchen-dashboard/item-orders:', error);
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Internal server error' }, { status: 500 });
  }
}
