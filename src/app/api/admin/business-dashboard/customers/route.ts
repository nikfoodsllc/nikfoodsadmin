import { NextRequest, NextResponse } from 'next/server';
import { verifyAdminRequest } from '@/lib/adminAuth';
import { loadCustomerSplit } from '@/lib/server/customerSplit';
import { resolveGrouping, validateDashboardRange, type DayRange } from '@/utils/businessDashboard';

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

/** GET /api/admin/business-dashboard/customers?from=&to=&group=  ->  paid orders split into new and existing customers */
export async function GET(request: NextRequest) {
  const auth = verifyAdminRequest(request);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: 401 });
  const params = new URL(request.url).searchParams;
  const range: DayRange = { from: params.get('from') ?? '', to: params.get('to') ?? '' };
  const problem = validateDashboardRange(range);
  if (problem) return NextResponse.json({ error: problem }, { status: 400 });
  try {
    const data = await loadCustomerSplit(range, resolveGrouping(params.get('group'), range));
    return NextResponse.json({ data });
  } catch (error) {
    console.error('Error in GET /api/admin/business-dashboard/customers:', error instanceof Error ? error.message : error);
    return NextResponse.json({ error: 'Could not load the customers' }, { status: 500 });
  }
}
