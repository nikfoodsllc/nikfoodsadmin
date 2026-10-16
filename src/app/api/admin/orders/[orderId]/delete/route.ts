import { NextRequest } from 'next/server';
import { forwardPostToLivesite } from '@/lib/livesiteForward';

export const dynamic = 'force-dynamic';

/** POST /api/admin/orders/{orderId}/delete: handled by the customer site (it also takes the order off the OptimoRoute plan and closes an unpaid card payment). */
export async function POST(request: NextRequest, { params }: { params: Promise<{ orderId: string }> }) {
  const { orderId } = await params;
  if (!/^[A-Za-z0-9-]{4,60}$/.test(orderId)) return Response.json({ error: 'Not found' }, { status: 404 });
  return forwardPostToLivesite(request, `/api/admin/orders/${encodeURIComponent(orderId)}/delete`, 'order-delete');
}
