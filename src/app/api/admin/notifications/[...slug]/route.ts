import { NextRequest, NextResponse } from 'next/server';
import { jwtHandler } from '@/lib/jwt';
import { notificationsTarget } from '@/lib/notificationsRoutes';

export const dynamic = 'force-dynamic';

/**
 * The admin's Notifications page talks to the customer site (which holds the phones, the texts and the sending) through here,
 * with the admin's own login attached. The customer site checks it again (admins only).
 */
function livesiteBase(): string {
  return (process.env.LIVESITE_URL || 'http://localhost:3000').replace(/\/$/, '');
}

function adminOf(request: NextRequest): { header: string; name: string } | null {
  const header = request.headers.get('authorization');
  if (!header || !header.startsWith('Bearer ')) return null;
  const result = jwtHandler.verifyToken(header.substring(7));
  if (!result.success || !result.payload || result.payload.role !== 'admin') return null;
  const p = result.payload as unknown as { name?: string; email?: string };
  return { header, name: String(p.name || p.email || '').slice(0, 60) };
}

async function forward(request: NextRequest, { params }: { params: Promise<{ slug: string[] }> }) {
  const admin = adminOf(request);
  if (!admin) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  const { slug } = await params;
  const target = notificationsTarget(slug, request.method);
  if (!target) return NextResponse.json({ success: false, error: 'Not found' }, { status: 404 });

  const init: RequestInit = { method: request.method, headers: { Authorization: admin.header, 'Content-Type': 'application/json' }, cache: 'no-store' };
  if (request.method === 'POST' || request.method === 'PUT') {
    let body: Record<string, unknown> = {};
    try {
      body = JSON.parse(await request.text());
    } catch {
      return NextResponse.json({ success: false, error: 'Invalid request' }, { status: 400 });
    }
    // the history shows who pressed Send
    init.body = JSON.stringify(slug[0] === 'send-menu' || slug[0] === 'app-update' ? { ...body, adminName: admin.name } : body);
  }
  try {
    const response = await fetch(`${livesiteBase()}${target}`, init);
    const text = await response.text();
    let json: unknown;
    try {
      json = JSON.parse(text);
    } catch {
      json = { success: false, error: 'The customer site did not answer properly. Please try again.' };
    }
    return NextResponse.json(json, { status: response.ok ? 200 : response.status });
  } catch (error) {
    console.error('[notifications] could not reach the customer site', error instanceof Error ? error.message : error);
    return NextResponse.json({ success: false, error: 'Could not reach the customer site. Please try again.' }, { status: 502 });
  }
}

export { forward as GET, forward as POST, forward as PUT, forward as DELETE };
