import { NextRequest, NextResponse } from 'next/server';
import { verifyAdminRequest } from '@/lib/adminAuth';
import { loadSales } from '@/lib/server/businessDashboard';
import { resolveGrouping, itemSeries, validateDashboardRange, type DayRange, type Grouping } from '@/utils/businessDashboard';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const MAX_ITEMS = 6;

/**
 * GET /api/admin/business-dashboard/items?from=&to=&group=week|month&names=["Aloo Parantha","Gobhi Parantha"]
 * Quantity and sales of up to 6 items per week or month (item comparison on the Dashboard). Admins only.
 */
export async function GET(request: NextRequest) {
  const auth = verifyAdminRequest(request);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: 401 });

  const params = new URL(request.url).searchParams;
  const range: DayRange = { from: params.get('from') ?? '', to: params.get('to') ?? '' };
  const problem = validateDashboardRange(range);
  if (problem) return NextResponse.json({ error: problem }, { status: 400 });
  const groupParam = params.get('group');
  const grouping: Grouping = resolveGrouping(groupParam, range);

  let names: string[] = [];
  try {
    const parsed: unknown = JSON.parse(params.get('names') ?? '[]');
    if (Array.isArray(parsed)) names = parsed.filter((n): n is string => typeof n === 'string' && n.trim().length > 0 && n.length <= 200);
  } catch {
    return NextResponse.json({ error: 'names must be a list of item names' }, { status: 400 });
  }
  names = [...new Set(names)].slice(0, MAX_ITEMS);
  if (names.length === 0) return NextResponse.json({ error: 'Pick at least one item' }, { status: 400 });

  try {
    const { lines } = await loadSales(range, true);
    return NextResponse.json({ data: { range, grouping, ...itemSeries(lines, range, grouping, names) } });
  } catch (error) {
    console.error('Error in GET /api/admin/business-dashboard/items:', error);
    return NextResponse.json({ error: 'Could not read the item sales. Please try again.' }, { status: 500 });
  }
}
