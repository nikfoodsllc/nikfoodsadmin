import { NextRequest } from 'next/server';
import { forwardPostToLivesite } from '@/lib/livesiteForward';

export const dynamic = 'force-dynamic';

/** POST /api/admin/abandoned-checkouts/remind {paymentIntentId}: handled by the customer site (see livesite/src/app/api/admin/cart-reminder/send), which sends the reminder email. */
export async function POST(request: NextRequest) {
  return forwardPostToLivesite(request, '/api/admin/cart-reminder/send', 'cart-reminder-send');
}
