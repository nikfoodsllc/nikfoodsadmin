import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { verifyAdminRequest } from '@/lib/adminAuth';
import { csvCell, resolveRegistrationRange } from '@/utils/userAdmin';

/**
 * GET /api/admin/users/unsubscribed?from=YYYY-MM-DD&to=YYYY-MM-DD
 * Everyone who used the customer site's /unsubscribe page (the Wix menu emails), newest first, as a CSV with Email and
 * Unsubscribed at (Pacific). The dates (Pacific days, both included, either may be left out) limit it. The team removes these people from the Wix mailing list.
 */
export async function GET(request: NextRequest) {
  const auth = verifyAdminRequest(request);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: 401 });

  try {
    const { searchParams } = new URL(request.url);
    const range = resolveRegistrationRange({ from: searchParams.get('from'), to: searchParams.get('to') });
    if ('error' in range) return NextResponse.json({ error: range.error }, { status: 400 });
    const filter: Record<string, unknown> = {};
    if (range.since || range.until) filter.createdAt = { ...(range.since ? { $gte: range.since } : {}), ...(range.until ? { $lt: range.until } : {}) };

    const database = await db.getDb();
    const rows = await database.collection('emailOptOuts').find(filter, { projection: { email: 1, createdAt: 1 } }).sort({ createdAt: -1 }).limit(20000).toArray();
    const pacific = new Intl.DateTimeFormat('en-US', { timeZone: 'America/Los_Angeles', year: 'numeric', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
    const lines = ['Email,Unsubscribed at', ...rows.map((r) => [r.email, r.createdAt ? pacific.format(new Date(r.createdAt)) : ''].map(csvCell).join(','))];
    return new NextResponse('﻿' + lines.join('\r\n') + '\r\n', {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="unsubscribed-${range.from || range.to ? `${range.from ?? 'start'}_to_${range.to ?? 'today'}` : 'all'}.csv"`,
        'Cache-Control': 'no-store',
        'X-Row-Count': String(rows.length),
        'Access-Control-Expose-Headers': 'X-Row-Count, Content-Disposition',
      },
    });
  } catch (error) {
    console.error('Error in GET /api/admin/users/unsubscribed:', error);
    return NextResponse.json({ error: 'Could not build the list' }, { status: 500 });
  }
}
