import { NextRequest, NextResponse } from 'next/server';
import { verifyAdminRequest } from '@/lib/adminAuth';
import { loadSales, preparationLookup } from '@/lib/server/businessDashboard';
import { pacificToday } from '@/utils/abandonedCheckouts';
import {
  resolveGrouping,
  itemTotals,
  lastYearRange,
  lossOrders,
  moneySeries,
  previousRange,
  quickPairs,
  taxByMonth,
  totalsFor,
  typeSeries,
  validateDashboardRange,
  type DayRange,
  type Grouping,
} from '@/utils/businessDashboard';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/**
 * GET /api/admin/business-dashboard?from=YYYY-MM-DD&to=YYYY-MM-DD&group=week|month
 *
 * The money side of the Reporting > Dashboard: gross and net sales against the period before and the year before, this
 * week/month/year so far, Cooked vs Ready to eat, Platform Fee vs Stripe fee (with the orders where we lost money), tax and the
 * best sellers. Admins only (no packers: it shows money). Rules: see utils/businessDashboard.ts.
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

  try {
    const today = pacificToday();
    const previous = previousRange(range);
    const lastYear = lastYearRange(range);
    const quick = quickPairs(today);
    const allRanges = [range, previous, lastYear, quick.week.current, quick.week.previous, quick.month.current, quick.month.previous, quick.year.current, quick.year.previous];
    const span: DayRange = {
      from: allRanges.reduce((min, r) => (r.from < min ? r.from : min), range.from),
      to: allRanges.reduce((max, r) => (r.to > max ? r.to : max), range.to),
    };

    // money of every order in the whole span (small), item lines only for the chosen range
    const [money, current] = await Promise.all([loadSales(span, false), loadSales(range, true)]);
    const typeOf = await preparationLookup(current.lines);

    const items = itemTotals(current.lines, range, typeOf);
    const pair = (p: { label: string; compareLabel: string; current: DayRange; previous: DayRange }) => ({
      label: p.label,
      compareLabel: p.compareLabel,
      current: { range: p.current, ...totalsFor(money.orders, p.current) },
      previous: { range: p.previous, ...totalsFor(money.orders, p.previous) },
    });

    return NextResponse.json({
      data: {
        today,
        range,
        grouping,
        totals: {
          current: { range, ...totalsFor(money.orders, range) },
          previous: { range: previous, ...totalsFor(money.orders, previous) },
          lastYear: { range: lastYear, ...totalsFor(money.orders, lastYear) },
        },
        quick: { week: pair(quick.week), month: pair(quick.month), year: pair(quick.year) },
        series: moneySeries(money.orders, range, grouping),
        types: typeSeries(current.lines, range, grouping, typeOf),
        losses: lossOrders(money.orders, range),
        taxMonths: taxByMonth(money.orders, range),
        topItems: items.slice(0, 15),
        // every item sold in the range, for the item comparison picker (biggest sellers first)
        itemNames: items.map((i) => ({ name: i.name, revenue: i.revenue, quantity: i.quantity, type: i.type })),
        firstSaleDay: money.orders.reduce<string | null>((min, o) => (min === null || o.day < min ? o.day : min), null),
      },
    });
  } catch (error) {
    console.error('Error in GET /api/admin/business-dashboard:', error);
    return NextResponse.json({ error: 'Could not build the dashboard. Please try again.' }, { status: 500 });
  }
}
