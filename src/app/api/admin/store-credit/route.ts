import { NextRequest } from 'next/server';
import { forwardGetToLivesite } from '@/lib/livesiteForward';

export const dynamic = 'force-dynamic';

/** GET: every customer with store credit (handled by the customer site, see livesite/src/app/api/admin/store-credit). */
export async function GET(request: NextRequest) {
  const { search } = new URL(request.url);
  return forwardGetToLivesite(request, `/api/admin/store-credit${search}`, 'store-credit-list');
}
