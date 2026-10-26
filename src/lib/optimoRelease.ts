import type { NextRequest } from 'next/server';

/**
 * Right after an admin marks orders Delivered by hand, asks the customer site to take them off the OptimoRoute route (it removes
 * their stops for today and later; a stop shared with another live order stays). The customer site does the work and checks the
 * admin's own login. Best effort: it never throws and never fails the status change, because the site's 30-minute check does the
 * same job if this call does not go through. At most 20 orders are sent here (the limit of that call); the check handles the rest.
 */
export async function releaseFromRoute(request: NextRequest, orderIds: string[]): Promise<void> {
  const auth = request.headers.get('authorization');
  const ids = orderIds.filter((id) => typeof id === 'string' && /^[A-Za-z0-9-]{4,60}$/.test(id)).slice(0, 20);
  if (!auth || ids.length === 0) return;
  try {
    const base = (process.env.LIVESITE_URL || 'http://localhost:3000').replace(/\/$/, '');
    await fetch(`${base}/api/admin/optimoroute`, {
      method: 'POST',
      headers: { Authorization: auth, 'Content-Type': 'application/json' },
      body: JSON.stringify({ orderIds: ids }),
      cache: 'no-store',
      signal: AbortSignal.timeout(25000),
    });
  } catch (error) {
    console.error('[optimoroute] could not take the delivered orders off the route', error instanceof Error ? error.message : error);
  }
}
