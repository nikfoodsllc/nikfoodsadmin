import { NextRequest, NextResponse } from 'next/server';
import { verifyAdminHeader } from '@/lib/livesiteForward';
import { driverSummaries, routePay, validateDashboardRange, type DayRange, type DriverRoute } from '@/utils/businessDashboard';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/** The driver-pay part reads at most this many days of routes (OptimoRoute is asked one day at a time) */
const MAX_DAYS = 120;

/**
 * GET /api/admin/business-dashboard/drivers?from=&to=
 * Driver pay from the PLANNED routes in OptimoRoute (read through the customer site, which holds the OptimoRoute key): per route
 * the planned time and the number of deliveries, turned into pay with the rule in utils/businessDashboard.ts. Admins only.
 */
export async function GET(request: NextRequest) {
  const auth = verifyAdminHeader(request);
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const params = new URL(request.url).searchParams;
  const range: DayRange = { from: params.get('from') ?? '', to: params.get('to') ?? '' };
  const problem = validateDashboardRange(range);
  if (problem) return NextResponse.json({ error: problem }, { status: 400 });

  // the most recent MAX_DAYS days of the range
  const end = new Date(`${range.to}T00:00:00Z`);
  const earliest = new Date(end.getTime() - (MAX_DAYS - 1) * 86_400_000).toISOString().slice(0, 10);
  const from = range.from < earliest ? earliest : range.from;

  const base = (process.env.LIVESITE_URL || 'http://localhost:3000').replace(/\/$/, '');
  try {
    const response = await fetch(`${base}/api/admin/optimoroute/driver-routes?from=${from}&to=${range.to}`, { headers: { Authorization: auth }, cache: 'no-store' });
    const body = (await response.json().catch(() => null)) as { success?: boolean; error?: string; data?: { routes?: DriverRoute[] } } | null;
    if (!response.ok || !body?.success) {
      return NextResponse.json({ data: { available: false, error: body?.error || 'Could not read the routes from OptimoRoute.' } });
    }
    const routes = (body.data?.routes ?? []).filter((r) => r.deliveries > 0);
    return NextResponse.json({
      data: {
        available: true,
        from,
        to: range.to,
        shortened: from !== range.from,
        ...driverSummaries(routes),
        routes: routes
          .map((r) => ({ ...r, ...routePay(r.plannedMinutes, r.deliveries) }))
          .sort((a, b) => b.date.localeCompare(a.date) || a.driverName.localeCompare(b.driverName)),
      },
    });
  } catch (error) {
    console.error('[business-dashboard drivers] could not reach the customer site', error instanceof Error ? error.message : error);
    return NextResponse.json({ data: { available: false, error: 'Could not reach the customer site. Please try again.' } });
  }
}
