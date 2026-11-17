import { NextRequest, NextResponse } from 'next/server';
import { adminId, orderDrafts, orderDraftSummaryOf, whoIs, type OrderDraftDoc } from '@/lib/server/createOrderDrafts';
import { parseOrderDraft } from '@/utils/createOrderDraft';

export const dynamic = 'force-dynamic';

/** GET /api/admin/create-order-drafts: every draft, newest first (shared by all admins). */
export async function GET(request: NextRequest) {
  if (!adminId(request)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  try {
    const { col } = await orderDrafts();
    const rows = await col.find({}).sort({ updatedAt: -1 }).limit(100).toArray();
    return NextResponse.json({ data: { drafts: rows.map((d) => orderDraftSummaryOf(d as OrderDraftDoc)) } });
  } catch (error) {
    console.error('Error in GET /api/admin/create-order-drafts:', error instanceof Error ? error.message : error);
    return NextResponse.json({ error: 'Could not load the drafts' }, { status: 500 });
  }
}

/** POST /api/admin/create-order-drafts { ...draft }: start a new draft. */
export async function POST(request: NextRequest) {
  const me = adminId(request);
  if (!me) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const content = parseOrderDraft(await request.json().catch(() => ({})));
  try {
    const { database, col } = await orderDrafts();
    const who = await whoIs(database, me);
    const now = new Date();
    const r = await col.insertOne({ ...content, createdBy: who, updatedBy: who, createdAt: now, updatedAt: now } as never);
    return NextResponse.json({ data: { id: String(r.insertedId), updatedAt: now.toISOString(), updatedBy: who.name } });
  } catch (error) {
    console.error('Error in POST /api/admin/create-order-drafts:', error instanceof Error ? error.message : error);
    return NextResponse.json({ error: 'Could not save the draft' }, { status: 500 });
  }
}
