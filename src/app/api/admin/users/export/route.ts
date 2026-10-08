import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { verifyAdminRequest } from '@/lib/adminAuth';
import { resolveRegistrationRange, usersToCsv } from '@/utils/userAdmin';

/**
 * GET /api/admin/users/export?from=YYYY-MM-DD&to=YYYY-MM-DD
 * The customers who registered in the range (Pacific days, both included; either end may be left out) as a CSV with
 * First Name, Last Name, Email, Phone. Customers only: admin accounts and deactivated accounts are left out.
 */
export async function GET(request: NextRequest) {
  const auth = verifyAdminRequest(request);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: 401 });

  try {
    const { searchParams } = new URL(request.url);
    const range = resolveRegistrationRange({ from: searchParams.get('from'), to: searchParams.get('to') });
    if ('error' in range) return NextResponse.json({ error: range.error }, { status: 400 });

    const filter: Record<string, unknown> = {
      role: { $nin: ['ADMIN', 'admin'] },
      isActive: { $ne: false },
    };
    if (range.since || range.until) {
      filter.createdAt = { ...(range.since ? { $gte: range.since } : {}), ...(range.until ? { $lt: range.until } : {}) };
    }

    const database = await db.getDb();
    const users = await database
      .collection('users')
      .find(filter, { projection: { name: 1, email: 1, phone: 1 } })
      .sort({ createdAt: 1 })
      .toArray();

    const csv = usersToCsv(users.map((u) => ({ name: u.name as string | undefined, email: u.email as string | undefined, phone: u.phone as string | undefined })));
    const label = range.from || range.to ? `${range.from ?? 'start'}_to_${range.to ?? 'today'}` : 'all';
    return new NextResponse(csv, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="customers-${label}.csv"`,
        'Cache-Control': 'no-store',
        'X-Row-Count': String(users.length),
        'Access-Control-Expose-Headers': 'X-Row-Count, Content-Disposition',
      },
    });
  } catch (error) {
    console.error('Error in GET /api/admin/users/export:', error);
    return NextResponse.json({ error: 'Could not build the export' }, { status: 500 });
  }
}
