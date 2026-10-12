import { NextRequest, NextResponse } from 'next/server';
import { ObjectId } from 'mongodb';
import { db } from '@/lib/db';
import { jwtHandler } from '@/lib/jwt';
import { isDayString } from '@/utils/kitchenDashboard';
import { RUNS, cleanMeta, cleanTotals, ensureIndex, finishRun, goToStop, isSafeKey, listRuns, pauseRun, resetRun, resumeRun, setChecked, startRun } from '@/lib/packingRuns';

export const dynamic = 'force-dynamic';

function verifyAuth(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) return { success: false as const, error: 'Missing or invalid authorization header' };
  const result = jwtHandler.verifyToken(authHeader.substring(7));
  if (!result.success || !result.payload) return { success: false as const, error: result.error || 'Invalid token' };
  if (result.payload.role !== 'admin') return { success: false as const, error: 'Unauthorized: Admin access required' };
  return { success: true as const, userId: String(result.payload.userId ?? '') };
}

async function adminName(userId: string): Promise<string> {
  try {
    if (!ObjectId.isValid(userId)) return '';
    const user = await db.readOne<{ name?: string; email?: string }>('users', { _id: new ObjectId(userId) } as never);
    return user.data?.name || user.data?.email || '';
  } catch {
    return '';
  }
}

/**
 * GET /api/admin/packing-progress?date=YYYY-MM-DD
 * The saved packing runs of a delivery date (who is packing which driver's route, what is ticked, the time on each customer),
 * plus the server's clock so every screen shows the same running timers.
 */
export async function GET(request: NextRequest) {
  try {
    const auth = verifyAuth(request);
    if (!auth.success) return NextResponse.json({ error: auth.error }, { status: 401 });
    const date = new URL(request.url).searchParams.get('date') ?? '';
    if (!isDayString(date)) return NextResponse.json({ error: 'date must be a real day, YYYY-MM-DD' }, { status: 400 });
    const c = (await db.getDb()).collection(RUNS);
    await ensureIndex(c as never);
    return NextResponse.json({ data: { now: new Date().toISOString(), runs: await listRuns(c as never, date) } });
  } catch (error) {
    console.error('packing-progress GET failed', error);
    return NextResponse.json({ error: 'Could not load the packing progress' }, { status: 500 });
  }
}

type Body = { action?: string; date?: string; routeKey?: string; driverName?: unknown; firstStopKey?: string; firstMeta?: unknown; totals?: unknown; meta?: unknown; stopKey?: string; toStopKey?: string; lineKeys?: unknown; checked?: unknown };

/**
 * POST /api/admin/packing-progress  { action, date, routeKey, ... }
 *   start   { driverName, firstStopKey, totals, firstMeta }  begin packing a route (the clock starts on the first customer)
 *   check   { stopKey, lineKeys[], checked }   tick or untick items of one customer
 *   goto    { toStopKey, meta }                next / previous customer (the time spent on the one left is saved)
 *   pause   {}                                 stop packing for now (timers stop, place and ticks are kept)
 *   resume  {}                                 carry on from the same customer
 *   finish  {}                                 the route is packed
 *   reset   {}                                 forget the run (ticks and times) to start again
 */
export async function POST(request: NextRequest) {
  try {
    const auth = verifyAuth(request);
    if (!auth.success) return NextResponse.json({ error: auth.error }, { status: 401 });
    let body: Body = {};
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
    }
    const date = body.date ?? '';
    if (!isDayString(date)) return NextResponse.json({ error: 'date must be a real day, YYYY-MM-DD' }, { status: 400 });
    if (!isSafeKey(body.routeKey)) return NextResponse.json({ error: 'Unknown route' }, { status: 400 });
    const routeKey = body.routeKey;
    const c = (await db.getDb()).collection(RUNS);
    await ensureIndex(c as never);
    const now = new Date();
    const wrap = (run: unknown) => (run === false ? NextResponse.json({ error: 'This route is not being packed right now. Start or resume it first.' }, { status: 409 }) : NextResponse.json({ success: true, data: { now: now.toISOString(), run } }));

    switch (body.action) {
      case 'start': {
        if (!isSafeKey(body.firstStopKey)) return NextResponse.json({ error: 'Unknown customer' }, { status: 400 });
        const by = await adminName(auth.userId);
        const driverName = typeof body.driverName === 'string' ? body.driverName.slice(0, 80) : '';
        return wrap(await startRun(c as never, { date, routeKey, driverName, firstStopKey: body.firstStopKey, by, totals: cleanTotals(body.totals), firstMeta: cleanMeta(body.firstMeta) }, now));
      }
      case 'check': {
        if (!isSafeKey(body.stopKey)) return NextResponse.json({ error: 'Unknown customer' }, { status: 400 });
        const keys = Array.isArray(body.lineKeys) ? body.lineKeys.filter((k): k is string => typeof k === 'string' && k.length > 0 && k.length <= 600) : [];
        if (keys.length === 0 || keys.length > 200 || typeof body.checked !== 'boolean') return NextResponse.json({ error: 'Nothing to tick' }, { status: 400 });
        return wrap(await setChecked(c as never, { date, routeKey, stopKey: body.stopKey, lineKeys: keys, checked: body.checked }, now));
      }
      case 'goto': {
        if (!isSafeKey(body.toStopKey)) return NextResponse.json({ error: 'Unknown customer' }, { status: 400 });
        return wrap(await goToStop(c as never, { date, routeKey, toStopKey: body.toStopKey, meta: cleanMeta(body.meta) }, now));
      }
      case 'pause':
        return wrap(await pauseRun(c as never, { date, routeKey }, now));
      case 'resume':
        return wrap(await resumeRun(c as never, { date, routeKey }, now));
      case 'finish':
        return wrap(await finishRun(c as never, { date, routeKey }, now));
      case 'reset':
        await resetRun(c as never, { date, routeKey });
        return NextResponse.json({ success: true, data: { now: now.toISOString(), run: null } });
      default:
        return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
    }
  } catch (error) {
    console.error('packing-progress POST failed', error);
    return NextResponse.json({ error: 'Could not save that' }, { status: 500 });
  }
}
