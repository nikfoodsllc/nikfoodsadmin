import { NextRequest, NextResponse } from 'next/server';
import { ObjectId } from 'mongodb';
import { adminId, orderDrafts, orderDraftFullOf, whoIs, type OrderDraftDoc } from '@/lib/server/createOrderDrafts';
import { parseOrderDraft } from '@/utils/createOrderDraft';

export const dynamic = 'force-dynamic';

const toId = (id: string) => (/^[a-f0-9]{24}$/i.test(id) ? new ObjectId(id) : null);

/** GET /api/admin/create-order-drafts/{id}: one draft to carry on with. */
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!adminId(request)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const oid = toId((await params).id);
  if (!oid) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  const { col } = await orderDrafts();
  const d = await col.findOne({ _id: oid } as never);
  if (!d) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json({ data: orderDraftFullOf(d as OrderDraftDoc) });
}

/** PUT /api/admin/create-order-drafts/{id} { ...draft }: save the latest version (the last save wins). */
export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const me = adminId(request);
  if (!me) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const oid = toId((await params).id);
  if (!oid) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  const content = parseOrderDraft(await request.json().catch(() => ({})));
  try {
    const { database, col } = await orderDrafts();
    const who = await whoIs(database, me);
    const now = new Date();
    const r = await col.updateOne({ _id: oid } as never, { $set: { ...content, updatedBy: who, updatedAt: now } } as never);
    if (r.matchedCount === 0) return NextResponse.json({ error: 'This draft was deleted.' }, { status: 404 });
    return NextResponse.json({ data: { id: String(oid), updatedAt: now.toISOString(), updatedBy: who.name } });
  } catch (error) {
    console.error('Error in PUT /api/admin/create-order-drafts/[id]:', error instanceof Error ? error.message : error);
    return NextResponse.json({ error: 'Could not save the draft' }, { status: 500 });
  }
}

/** DELETE /api/admin/create-order-drafts/{id}: throw a draft away (also done by the screen once the order is created). */
export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!adminId(request)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const oid = toId((await params).id);
  if (!oid) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  try {
    const { col } = await orderDrafts();
    await col.deleteOne({ _id: oid } as never);
    return NextResponse.json({ data: { deleted: true } });
  } catch (error) {
    console.error('Error in DELETE /api/admin/create-order-drafts/[id]:', error instanceof Error ? error.message : error);
    return NextResponse.json({ error: 'Could not delete the draft' }, { status: 500 });
  }
}
