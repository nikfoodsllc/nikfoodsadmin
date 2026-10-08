import { NextRequest } from 'next/server';
import { forwardPostToLivesite } from '@/lib/livesiteForward';

export const dynamic = 'force-dynamic';

/** POST /api/admin/orders/{orderId}/reschedule: handled by the customer site (see livesite/src/app/api/admin/orders/[orderId]/reschedule). */
export async function POST(request: NextRequest, { params }: { params: Promise<{ orderId: string }> }) {
  const { orderId } = await params;
  if (!/^[A-Za-z0-9-]{4,60}$/.test(orderId)) return Response.json({ error: 'Not found' }, { status: 404 });
  return forwardPostToLivesite(request, `/api/admin/orders/${encodeURIComponent(orderId)}/reschedule`, 'reschedule');
}
