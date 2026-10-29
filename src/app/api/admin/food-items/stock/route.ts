import { NextRequest, NextResponse } from 'next/server';
import { ObjectId } from 'mongodb';
import { jwtHandler } from '@/lib/jwt';
import { db } from '@/lib/db';
import { invalidateLivesiteHomeMenuCacheAndWait } from '@/lib/invalidateHomeMenuCache';
import { stockOf, type StockDoc } from '@/lib/stockCounts';
import { readStockLog, writeStockLog } from '@/lib/stockLog';
import { cleanResetMode, cleanResetTime, cleanStockUnit, cleanThreshold, nextDailyBoundary } from '@/utils/stockRules';

export const dynamic = 'force-dynamic';

function verifyAuth(request: NextRequest) {
  const header = request.headers.get('authorization');
  if (!header || !header.startsWith('Bearer ')) return { success: false as const, error: 'Missing or invalid authorization header' };
  const result = jwtHandler.verifyToken(header.substring(7));
  if (!result.success || !result.payload) return { success: false as const, error: result.error || 'Invalid token' };
  if (result.payload.role !== 'admin') return { success: false as const, error: 'Unauthorized: Admin access required' };
  const p = result.payload as unknown as { userId?: string; name?: string; email?: string };
  return { success: true as const, userId: String(p.userId ?? ''), name: String(p.name || p.email || '').slice(0, 60) };
}

async function readItem(id: string): Promise<(StockDoc & { name?: string }) | null> {
  if (!ObjectId.isValid(id)) return null;
  const r = await db.readOne<Record<string, unknown>>('fooditems', { _id: new ObjectId(id) });
  return r.success && r.data ? (r.data as unknown as StockDoc & { name?: string }) : null;
}

/** What the admin sees for one item: the limit, how many were ordered, how many are left, when the count started, when it resets next. */
async function describe(doc: StockDoc) {
  const stock = (await stockOf([doc])).get(String(doc._id));
  if (!stock) return { limit: null as number | null };
  const mode = cleanResetMode(doc.stockResetMode);
  const time = cleanResetTime(doc.stockResetTime);
  return { ...stock, mode, time, nextReset: mode === 'daily' && time ? nextDailyBoundary(new Date(), time).toISOString() : null };
}

/**
 * GET /api/admin/food-items/stock?id=<food item id>: the live count of one item, and its history (set / changed / reset).
 * GET /api/admin/food-items/stock?ids=a,b,c: the live counts of several items (only the ones that have a limit).
 */
export async function GET(request: NextRequest) {
  const auth = verifyAuth(request);
  if (!auth.success) return NextResponse.json({ error: auth.error }, { status: 401 });
  try {
    const params = new URL(request.url).searchParams;
    const id = params.get('id');
    if (id) {
      const doc = await readItem(id);
      if (!doc) return NextResponse.json({ error: 'Food item not found' }, { status: 404 });
      return NextResponse.json({ data: { ...(await describe(doc)), log: await readStockLog(id) } });
    }
    const ids = (params.get('ids') ?? '').split(',').map((s) => s.trim()).filter((s) => ObjectId.isValid(s)).slice(0, 200);
    if (ids.length === 0) return NextResponse.json({ data: {} });
    const found = await db.read<Record<string, unknown>>('fooditems', { _id: { $in: ids.map((s) => new ObjectId(s)) } });
    const docs = (found.success && found.data ? found.data : []) as unknown as StockDoc[];
    const map = await stockOf(docs);
    return NextResponse.json({ data: Object.fromEntries(map) });
  } catch (error) {
    console.error('Error in GET /api/admin/food-items/stock:', error);
    return NextResponse.json({ error: 'Could not read the stock' }, { status: 500 });
  }
}

/** POST { id }: reset the count of an item to 0 now (the units already ordered stop counting). The reset is written in the item's log. */
export async function POST(request: NextRequest) {
  const auth = verifyAuth(request);
  if (!auth.success) return NextResponse.json({ error: auth.error }, { status: 401 });
  try {
    const body = (await request.json().catch(() => ({}))) as { id?: unknown };
    const id = typeof body.id === 'string' ? body.id : '';
    const doc = await readItem(id);
    if (!doc) return NextResponse.json({ error: 'Food item not found' }, { status: 404 });
    const unit = cleanStockUnit(doc.stockUnit);
    if (cleanThreshold(doc.stockThreshold, unit) === null) return NextResponse.json({ error: 'This item has no order limit' }, { status: 409 });
    const before = (await stockOf([doc])).get(String(doc._id));
    const now = new Date();
    const updated = await db.update('fooditems', { _id: new ObjectId(id) }, { $set: { stockResetAt: now, updatedAt: now } } as never);
    if (!updated.success) return NextResponse.json({ error: 'Could not reset the count' }, { status: 500 });
    const asText = (n: number | null | undefined) => (n === null || n === undefined ? undefined : unit === 'units' ? String(n) : `${n} ${unit}`);
    await writeStockLog({ foodItemId: id, kind: 'reset', ordered: before?.ordered ?? 0, limit: before?.limit ?? null, orderedText: asText(before?.ordered), limitText: asText(before?.limit), byId: auth.userId, byName: auth.name });
    // the item may have been sold out: the website and the app show it again straight away
    const livesiteNotified = await invalidateLivesiteHomeMenuCacheAndWait();
    const fresh = await readItem(id);
    return NextResponse.json({ data: { ...(fresh ? await describe(fresh) : {}), livesiteNotified, log: await readStockLog(id) } });
  } catch (error) {
    console.error('Error in POST /api/admin/food-items/stock:', error);
    return NextResponse.json({ error: 'Could not reset the count' }, { status: 500 });
  }
}
