import { NextRequest } from 'next/server';
import { forwardPostToLivesite } from '@/lib/livesiteForward';

export const dynamic = 'force-dynamic';

/** POST /api/admin/orders/count: handled by the customer site (see livesite/src/app/api/admin/orders/count). */
export async function POST(request: NextRequest) {
  return forwardPostToLivesite(request, '/api/admin/orders/count', 'order-count');
}
