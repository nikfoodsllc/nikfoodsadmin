import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { verifyAdminRequest } from '@/lib/adminAuth';
import { csvCell } from '@/utils/userAdmin';

/**
 * GET /api/admin/users/unsubscribed
 * Everyone who used the customer site's /unsubscribe page (the Wix menu emails), newest first, as a CSV with Email and
 * Unsubscribed at (Pacific). The team removes these people from the Wix mailing list.
 */
export async function GET(request: NextRequest) {
  const auth = verifyAdminRequest(request);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: 401 });

  try {
    const database = await db.getDb();
    const rows = await database.collection('emailOptOuts').find({}, { projection: { email: 1, createdAt: 1 } }).sort({ createdAt: -1 }).limit(20000).toArray();
    const pacific = new Intl.DateTimeFormat('en-US', { timeZone: 'America/Los_Angeles', year: 'numeric', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
    const lines = ['Email,Unsubscribed at', ...rows.map((r) => [r.email, r.createdAt ? pacific.format(new Date(r.createdAt)) : ''].map(csvCell).join(','))];
    return new NextResponse('﻿' + lines.join('\r\n') + '\r\n', {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': 'attachment; filename="unsubscribed.csv"',
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
