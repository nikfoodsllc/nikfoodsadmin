import { NextRequest, NextResponse } from 'next/server';
import { jwtHandler } from '@/lib/jwt';

/**
 * Create Order (BETA): the admin screen talks to these routes, which pass the request on to the customer
 * site (where the menu, prices, accounts, Stripe and emails live) with the admin's own login attached. The site
 * checks that login itself (admins only) and does all the pricing, so nothing here can set a price.
 */


function livesiteBase(): string {
  return (process.env.LIVESITE_URL || 'http://localhost:3000').replace(/\/$/, '');
}

function verifyAdmin(request: NextRequest): string | null {
  const header = request.headers.get('authorization');
  if (!header || !header.startsWith('Bearer ')) return null;
  const result = jwtHandler.verifyToken(header.substring(7));
  if (!result.success || !result.payload || result.payload.role !== 'admin') return null;
  return header;
}

/** Maps the admin-side path to the customer site's route, or null when it is not one we pass on. */
function targetFor(slug: string[], method: string): string | null {
  const [first, second] = slug;
  if (slug.length === 1) {
    if (first === 'menu' && method === 'GET') return '/api/admin/offline-orders/menu';
    if (first === 'catalog' && method === 'GET') return '/api/admin/offline-orders/catalog';
    if (first === 'customers' && method === 'GET') return '/api/admin/offline-orders/customers';
    if (first === 'preview' && method === 'POST') return '/api/admin/offline-orders/preview';
    if (first === 'create' && method === 'POST') return '/api/admin/offline-orders';
    if (first === 'orders' && method === 'GET') return '/api/admin/offline-orders';
    return null;
  }
  if (slug.length === 3 && first === 'orders' && /^[A-Za-z0-9-]{4,60}$/.test(second) && method === 'POST') {
    const action = slug[2];
    if (action === 'resend' || action === 'mark-paid') return `/api/admin/offline-orders/${encodeURIComponent(second)}/${action}`;
  }
  return null;
}

async function forward(request: NextRequest, { params }: { params: Promise<{ slug: string[] }> }) {
  const auth = verifyAdmin(request);
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { slug } = await params;
  const target = targetFor(slug, request.method);
  if (!target) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const search = request.method === 'GET' ? new URL(request.url).search : '';
  const init: RequestInit = { method: request.method, headers: { Authorization: auth, 'Content-Type': 'application/json' }, cache: 'no-store' };
  if (request.method === 'POST') init.body = await request.text();

  try {
    const response = await fetch(`${livesiteBase()}${target}${search}`, init);
    const text = await response.text();
    let body: unknown;
    try {
      body = JSON.parse(text);
    } catch {
      body = { success: false, error: 'The customer site did not answer properly. Please try again.' };
    }
    return NextResponse.json(body, { status: response.ok ? 200 : response.status });
  } catch (error) {
    console.error('[create-order] could not reach the customer site', error instanceof Error ? error.message : error);
    return NextResponse.json({ success: false, error: 'Could not reach the customer site. Please try again.' }, { status: 502 });
  }
}

export { forward as GET, forward as POST };
