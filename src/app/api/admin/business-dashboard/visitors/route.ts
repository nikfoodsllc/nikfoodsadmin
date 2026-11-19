import { NextRequest, NextResponse } from 'next/server';
import { verifyAdminRequest } from '@/lib/adminAuth';
import { activeNow, analyticsConfigured, visitorsFor } from '@/lib/googleAnalytics';
import { bucketKeyOf, bucketsFor, resolveGrouping, validateDashboardRange, type DayRange, type Grouping } from '@/utils/businessDashboard';

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

/**
 * GET /api/admin/business-dashboard/visitors?from=&to=&group=week|month   (add &live=1 for only the "on the site now" numbers)
 * Website visitors from Google Analytics (read only). Answers {connected:false} when the admin has no Analytics key yet.
 */
export async function GET(request: NextRequest) {
  const auth = verifyAdminRequest(request);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: 401 });
  if (!analyticsConfigured()) return NextResponse.json({ data: { connected: false } });

  const params = new URL(request.url).searchParams;
  try {
    if (params.get('live') === '1') return NextResponse.json({ data: { connected: true, now: await activeNow() } });

    const range: DayRange = { from: params.get('from') ?? '', to: params.get('to') ?? '' };
    const problem = validateDashboardRange(range);
    if (problem) return NextResponse.json({ error: problem }, { status: 400 });
    const groupParam = params.get('group');
    const grouping: Grouping = resolveGrouping(groupParam, range);

    const [now, period] = await Promise.all([activeNow(), visitorsFor(range.from, range.to)]);
    const buckets = bucketsFor(range, grouping).map((b) => ({ ...b, visitors: 0, visits: 0 }));
    const index = new Map(buckets.map((b, i) => [b.key, i]));
    for (const d of period.days) {
      const i = index.get(bucketKeyOf(d.day, grouping));
      if (i === undefined) continue;
      buckets[i].visitors += d.visitors; // a person who came back in two days counts in both days (Google counts unique people per day)
      buckets[i].visits += d.visits;
    }
    return NextResponse.json({ data: { connected: true, now, totals: period.totals, series: buckets } });
  } catch (error) {
    console.error('Error in GET /api/admin/business-dashboard/visitors:', error instanceof Error ? error.message : error);
    return NextResponse.json({ data: { connected: true, error: 'Google Analytics did not answer. Please try again.' } });
  }
}
