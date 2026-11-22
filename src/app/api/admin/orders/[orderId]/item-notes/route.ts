import { NextRequest, NextResponse } from 'next/server';
import { ObjectId } from 'mongodb';
import { db } from '@/lib/db';
import { verifyAdminRequest } from '@/lib/adminAuth';
import { applyAdminNote, applyItemNote, canEditItemNotes } from '@/utils/itemNotes';

export const dynamic = 'force-dynamic';

interface NoteOrder {
  orderId: string;
  status?: string;
  updatedAt?: Date | string;
  items: Array<{ deliveryDate?: unknown; actualDeliveryDate?: unknown; items: Array<{ food?: { _id?: unknown; name?: string }; notes?: string; adminNote?: string }> }>;
}

const idsOf = (order: NoteOrder) => [...new Set(order.items.flatMap((d) => d.items.map((l) => (l.food?._id ? String(l.food._id) : ''))).filter((id) => ObjectId.isValid(id)))];

/** Food ids of this order whose food item has the Special instructions switch on. */
async function allowedFoodIds(order: NoteOrder): Promise<Set<string>> {
  const ids = idsOf(order);
  if (ids.length === 0) return new Set();
  const found = await db.read<{ _id: ObjectId }>('fooditems', { _id: { $in: ids.map((id) => new ObjectId(id)) }, allowInstructions: true } as never);
  return new Set((found.success && found.data ? found.data : []).map((d) => String(d._id)));
}

async function load(request: NextRequest, params: Promise<{ orderId: string }>) {
  const auth = verifyAdminRequest(request);
  if (!auth.ok) return { error: NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 }) } as const;
  const { orderId: raw } = await params;
  const orderId = decodeURIComponent(raw);
  if (!/^[A-Za-z0-9-]{4,60}$/.test(orderId)) return { error: NextResponse.json({ success: false, error: 'No order with that number' }, { status: 404 }) } as const;
  const found = await db.readOne<NoteOrder>('orders', { orderId } as never);
  if (!found.success || !found.data) return { error: NextResponse.json({ success: false, error: 'No order with that number' }, { status: 404 }) } as const;
  return { order: found.data, adminId: auth.userId } as const;
}

/** GET /api/admin/orders/{orderId}/item-notes -> { allowedFoodIds, editable }: which items of the order take special instructions. */
export async function GET(request: NextRequest, { params }: { params: Promise<{ orderId: string }> }) {
  const loaded = await load(request, params);
  if ('error' in loaded) return loaded.error;
  const allowed = await allowedFoodIds(loaded.order);
  return NextResponse.json({ success: true, data: { allowedFoodIds: [...allowed], editable: canEditItemNotes(loaded.order.status) } });
}

/**
 * POST /api/admin/orders/{orderId}/item-notes { line, item, notes }
 * Sets (empty text removes) the special instructions of one item, and of that day's other lines of the same food. Only for items
 * whose food item takes instructions and orders that are not delivered or cancelled. The change is kept in order.noteChanges.
 *
 * POST { kind: 'admin', line, item, notes }: the admin note of that one item instead (items.N.items.M.adminNote): any item, an
 * internal note for the kitchen and packing reports, never shown to the customer. Same order rule; kept in noteChanges (admin: true).
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ orderId: string }> }) {
  const loaded = await load(request, params);
  if ('error' in loaded) return loaded.error;
  const { order, adminId } = loaded;
  let body: { kind?: unknown; line?: unknown; item?: unknown; notes?: unknown } = {};
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ success: false, error: 'Invalid request.' }, { status: 400 });
  }
  if (!canEditItemNotes(order.status)) return NextResponse.json({ success: false, error: 'Instructions cannot be changed on a delivered or cancelled order.' }, { status: 409 });
  if (body.notes !== undefined && typeof body.notes !== 'string') return NextResponse.json({ success: false, error: 'Invalid request.' }, { status: 400 });

  const line = Number(body.line);
  const item = Number(body.item);
  const now = new Date();
  const day = order.items[line];
  const dayText = (v: unknown) => (typeof v === 'string' ? v.slice(0, 10) : v instanceof Date ? v.toISOString().slice(0, 10) : '');
  // only write when nobody changed the order since it was read
  const unchanged = order.updatedAt ? { updatedAt: order.updatedAt } : { updatedAt: { $exists: false } };

  if (body.kind === 'admin') {
    const admin = applyAdminNote(order.items, line, item, body.notes ?? '');
    if (!admin.ok) return NextResponse.json({ success: false, error: admin.error }, { status: 400 });
    const write = await db.updateOne(
      'orders',
      { orderId: order.orderId, ...unchanged } as never,
      {
        $set: { [`items.${line}.items`]: admin.days[line].items, updatedAt: now },
        $push: { noteChanges: { at: now, by: { id: adminId }, admin: true, name: admin.name, deliveryDate: dayText(day.actualDeliveryDate) || dayText(day.deliveryDate), from: admin.from, to: admin.to } },
      } as never,
    );
    if (!write.success) return NextResponse.json({ success: false, error: 'Could not save. Please try again.' }, { status: 500 });
    if (!write.matchedCount) return NextResponse.json({ success: false, error: 'The order changed while you were editing. Close it, open it again and retry.' }, { status: 409 });
    return NextResponse.json({ success: true, data: { adminNote: admin.to } });
  }

  const result = applyItemNote(order.items, line, item, body.notes ?? '');
  if (!result.ok) return NextResponse.json({ success: false, error: result.error }, { status: 400 });
  const allowed = await allowedFoodIds(order);
  if (!allowed.has(result.foodId)) return NextResponse.json({ success: false, error: 'This item does not take special instructions. Switch it on in Food Items first.' }, { status: 400 });

  const write = await db.updateOne(
    'orders',
    { orderId: order.orderId, ...unchanged } as never,
    {
      $set: { [`items.${line}.items`]: result.days[line].items, updatedAt: now },
      $push: { noteChanges: { at: now, by: { id: adminId }, name: result.name, deliveryDate: dayText(day.actualDeliveryDate) || dayText(day.deliveryDate), from: result.from, to: result.to } },
    } as never,
  );
  if (!write.success) return NextResponse.json({ success: false, error: 'Could not save. Please try again.' }, { status: 500 });
  if (!write.matchedCount) return NextResponse.json({ success: false, error: 'The order changed while you were editing. Close it, open it again and retry.' }, { status: 409 });
  return NextResponse.json({ success: true, data: { notes: result.to, lines: result.lines } });
}
