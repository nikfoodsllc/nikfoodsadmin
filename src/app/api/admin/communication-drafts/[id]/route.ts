import { NextRequest, NextResponse } from 'next/server';
import { ObjectId } from 'mongodb';
import { adminId, drafts, fullOf, whoIs, type DraftDoc } from '@/lib/server/communicationDrafts';
import { parseDraftContent } from '@/utils/communicationDraft';

export const dynamic = 'force-dynamic';

const toId = (id: string) => (ObjectId.isValid(id) && /^[a-f0-9]{24}$/i.test(id) ? new ObjectId(id) : null);

/** GET /api/admin/communication-drafts/{id}: one draft to carry on with. */
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!adminId(request)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const oid = toId((await params).id);
  if (!oid) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  const { col } = await drafts();
  const d = await col.findOne({ _id: oid } as never);
  if (!d) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json({ data: fullOf(d as DraftDoc) });
}

/** PUT /api/admin/communication-drafts/{id} { ...draft }: save the latest text (the last save wins). */
export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const me = adminId(request);
  if (!me) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const oid = toId((await params).id);
  if (!oid) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  const content = parseDraftContent(await request.json().catch(() => ({})));
  try {
    const { database, col } = await drafts();
    const who = await whoIs(database, me);
    const now = new Date();
    const r = await col.updateOne({ _id: oid } as never, { $set: { ...content, updatedBy: who, updatedAt: now } } as never);
    if (r.matchedCount === 0) return NextResponse.json({ error: 'This draft was deleted.' }, { status: 404 });
    return NextResponse.json({ data: { id: String(oid), updatedAt: now.toISOString(), updatedBy: who.name } });
  } catch (error) {
    console.error('Error in PUT /api/admin/communication-drafts/[id]:', error instanceof Error ? error.message : error);
    return NextResponse.json({ error: 'Could not save the draft' }, { status: 500 });
  }
}

/** DELETE /api/admin/communication-drafts/{id}: throw a draft away (also done by the screen once the message is sent). */
export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!adminId(request)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const oid = toId((await params).id);
  if (!oid) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  try {
    const { col } = await drafts();
    await col.deleteOne({ _id: oid } as never);
    return NextResponse.json({ data: { deleted: true } });
  } catch (error) {
    console.error('Error in DELETE /api/admin/communication-drafts/[id]:', error instanceof Error ? error.message : error);
    return NextResponse.json({ error: 'Could not delete the draft' }, { status: 500 });
  }
}
