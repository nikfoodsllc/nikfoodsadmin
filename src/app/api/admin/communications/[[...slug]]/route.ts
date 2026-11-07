import { NextRequest, NextResponse } from 'next/server';
import { jwtHandler } from '@/lib/jwt';

/**
 * Communication tab: the admin screen talks to these routes, which pass the request on to the customer site (where the orders,
 * the email and text services and the keys live) with the admin's own login attached. The site checks that login itself and does
 * all the finding and sending, so nothing here can send anything on its own.
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

const ID = /^[a-f0-9]{24}$/;

/** Maps the admin-side path to the customer site's route, or null when it is not one we pass on. */
function targetFor(slug: string[], method: string): string | null {
  if (slug.length === 0) return method === 'GET' ? '/api/admin/communications' : null;
  if (slug.length === 1) {
    const [first] = slug;
    if (method === 'POST' && (first === 'audience' || first === 'send' || first === 'test')) return `/api/admin/communications/${first}`;
    if (method === 'GET' && first === 'customers') return '/api/admin/communications/customers';
    if (method === 'GET' && ID.test(first)) return `/api/admin/communications/${first}`;
    return null;
  }
  if (slug.length === 2 && method === 'POST' && ID.test(slug[0]) && slug[1] === 'cancel') return `/api/admin/communications/${slug[0]}/cancel`;
  return null;
}

async function forward(request: NextRequest, { params }: { params: Promise<{ slug?: string[] }> }) {
  const auth = verifyAdmin(request);
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { slug = [] } = await params;
  const target = targetFor(slug, request.method);
  if (!target) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const init: RequestInit = { method: request.method, headers: { Authorization: auth, 'Content-Type': 'application/json' }, cache: 'no-store' };
  if (request.method === 'POST') init.body = await request.text();

  try {
    // only the customer search takes a query string (?q=)
    const search = request.method === 'GET' && target.endsWith('/customers') ? new URL(request.url).search : '';
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
    console.error('[communications] could not reach the customer site', error instanceof Error ? error.message : error);
    return NextResponse.json({ success: false, error: 'Could not reach the customer site. Please try again.' }, { status: 502 });
  }
}

export { forward as GET, forward as POST };
