import { NextRequest, NextResponse } from 'next/server';
import { verifyAdminRequest } from '@/lib/adminAuth';
import { adminName, loadDriverRates, saveDriverRates } from '@/lib/server/driverRates';
import { pacificToday } from '@/utils/abandonedCheckouts';
import { addRateChange, ratesOn, removeRateChange, validateRateChange, type DriverRates } from '@/utils/businessDashboard';

export const dynamic = 'force-dynamic';

/**
 * Driver pay rates (the $ per hour and $ per delivery of the Dashboard's driver pay), shared by all admins.
 *   GET                                         -> { today, current, upcoming[], history[] }
 *   PUT    { hourlyRate, perDelivery, from }    -> new rates from that day on (today or later only, so past days never change)
 *   DELETE ?from=YYYY-MM-DD                      -> cancels a planned change that has not started yet
 */
async function answer(history: DriverRates[]) {
  const today = pacificToday();
  return {
    today,
    current: ratesOn(today, history),
    upcoming: history.filter((r) => r.from > today),
    history: [...history].reverse(),
  };
}

export async function GET(request: NextRequest) {
  const auth = verifyAdminRequest(request);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: 401 });
  try {
    return NextResponse.json({ data: await answer(await loadDriverRates()) });
  } catch (error) {
    console.error('[driver rates] GET failed:', error);
    return NextResponse.json({ error: 'Could not read the driver pay rates.' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  const auth = verifyAdminRequest(request);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: 401 });
  const body = (await request.json().catch(() => null)) as { hourlyRate?: unknown; perDelivery?: unknown; from?: unknown } | null;
  if (!body) return NextResponse.json({ error: 'Send the new rates.' }, { status: 400 });
  const problem = validateRateChange(body, pacificToday());
  if (problem) return NextResponse.json({ error: problem }, { status: 400 });
  try {
    const change: DriverRates = {
      from: body.from as string,
      hourlyRate: body.hourlyRate as number,
      perDelivery: body.perDelivery as number,
      setAt: new Date().toISOString(),
      setBy: await adminName(auth.userId),
    };
    const history = addRateChange(await loadDriverRates(), change);
    await saveDriverRates(history);
    return NextResponse.json({ data: await answer(history) });
  } catch (error) {
    console.error('[driver rates] PUT failed:', error);
    return NextResponse.json({ error: 'Could not save the driver pay rates.' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  const auth = verifyAdminRequest(request);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: 401 });
  const from = new URL(request.url).searchParams.get('from') ?? '';
  try {
    const history = removeRateChange(await loadDriverRates(), from, pacificToday());
    if (!history) return NextResponse.json({ error: 'Only a change that has not started yet can be cancelled.' }, { status: 409 });
    await saveDriverRates(history);
    return NextResponse.json({ data: await answer(history) });
  } catch (error) {
    console.error('[driver rates] DELETE failed:', error);
    return NextResponse.json({ error: 'Could not cancel the change.' }, { status: 500 });
  }
}
