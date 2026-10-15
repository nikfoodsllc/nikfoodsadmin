import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { jwtHandler } from '@/lib/jwt';
import { RUNS, listRunsBetween } from '@/lib/packingRuns';
import { isDayString, validateRange } from '@/utils/kitchenDashboard';
import { buildPackingMetrics } from '@/utils/packingMetrics';

export const dynamic = 'force-dynamic';

function verifyAuth(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) return { success: false as const, error: 'Missing or invalid authorization header' };
  const result = jwtHandler.verifyToken(authHeader.substring(7));
  if (!result.success || !result.payload) return { success: false as const, error: result.error || 'Invalid token' };
  if (result.payload.role !== 'admin') return { success: false as const, error: 'Unauthorized: Admin access required' };
  return { success: true as const };
}

/**
 * GET /api/admin/packing-metrics?from=YYYY-MM-DD&to=YYYY-MM-DD   (DELIVERY dates, both included, at most 62 days)
 * How long the packing took: totals, averages, per day, per driver and the slowest and fastest customers, from the saved
 * packing runs (Packing Planner). Read only.
 */
export async function GET(request: NextRequest) {
  try {
    const auth = verifyAuth(request);
    if (!auth.success) return NextResponse.json({ error: auth.error }, { status: 401 });
    const params = new URL(request.url).searchParams;
    const from = params.get('from') ?? '';
    const to = params.get('to') ?? '';
    if (!isDayString(from) || !isDayString(to)) return NextResponse.json({ error: 'Pick a start and an end date.' }, { status: 400 });
    const problem = validateRange({ startDate: from, endDate: to });
    if (problem) return NextResponse.json({ error: problem }, { status: 400 });
    const c = (await db.getDb()).collection(RUNS);
    const runs = await listRunsBetween(c as never, from, to);
    return NextResponse.json({ data: { from, to, ...buildPackingMetrics(runs) } });
  } catch (error) {
    console.error('packing-metrics GET failed', error);
    return NextResponse.json({ error: 'Could not load the packing times' }, { status: 500 });
  }
}
