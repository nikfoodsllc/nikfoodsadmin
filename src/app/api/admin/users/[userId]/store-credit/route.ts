import { NextRequest } from 'next/server';
import { forwardGetToLivesite, forwardPostToLivesite } from '@/lib/livesiteForward';

export const dynamic = 'force-dynamic';

/** GET (balance and history) and POST (manual change) are handled by the customer site (see livesite/src/app/api/admin/users/[userId]/store-credit). */
export async function GET(request: NextRequest, { params }: { params: Promise<{ userId: string }> }) {
  const { userId } = await params;
  if (!/^[a-f0-9]{24}$/i.test(userId)) return Response.json({ error: 'Not found' }, { status: 404 });
  return forwardGetToLivesite(request, `/api/admin/users/${userId}/store-credit`, 'store-credit');
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ userId: string }> }) {
  const { userId } = await params;
  if (!/^[a-f0-9]{24}$/i.test(userId)) return Response.json({ error: 'Not found' }, { status: 404 });
  return forwardPostToLivesite(request, `/api/admin/users/${userId}/store-credit`, 'store-credit');
}
