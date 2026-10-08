import { NextRequest, NextResponse } from 'next/server';
import { jwtHandler } from '@/lib/jwt';

/**
 * Passes an admin's request on to the customer site (where the emails, the route planner and the order rules live)
 * with the admin's own login attached. The customer site checks that login itself (admins only).
 */
function livesiteBase(): string {
  return (process.env.LIVESITE_URL || 'http://localhost:3000').replace(/\/$/, '');
}

export function verifyAdminHeader(request: NextRequest): string | null {
  const header = request.headers.get('authorization');
  if (!header || !header.startsWith('Bearer ')) return null;
  const result = jwtHandler.verifyToken(header.substring(7));
  if (!result.success || !result.payload || result.payload.role !== 'admin') return null;
  return header;
}

export async function forwardPostToLivesite(request: NextRequest, path: string, label: string): Promise<NextResponse> {
  const auth = verifyAdminHeader(request);
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  try {
    const response = await fetch(`${livesiteBase()}${path}`, {
      method: 'POST',
      headers: { Authorization: auth, 'Content-Type': 'application/json' },
      body: await request.text(),
      cache: 'no-store',
    });
    const text = await response.text();
    let body: unknown;
    try {
      body = JSON.parse(text);
    } catch {
      body = { success: false, error: 'The customer site did not answer properly. Please try again.' };
    }
    return NextResponse.json(body, { status: response.ok ? 200 : response.status });
  } catch (error) {
    console.error(`[${label}] could not reach the customer site`, error instanceof Error ? error.message : error);
    return NextResponse.json({ success: false, error: 'Could not reach the customer site. Please try again.' }, { status: 502 });
  }
}
