import { NextRequest, NextResponse } from 'next/server';
import { ObjectId } from 'mongodb';
import { jwtHandler } from '@/lib/jwt';
import { db } from '@/lib/db';

export const dynamic = 'force-dynamic';

function verifyAuth(request: NextRequest) {
  const header = request.headers.get('authorization');
  if (!header || !header.startsWith('Bearer ')) return { success: false, error: 'Missing or invalid authorization header' };
  const result = jwtHandler.verifyToken(header.substring(7));
  if (!result.success || !result.payload) return { success: false, error: result.error || 'Invalid token' };
  if (result.payload.role !== 'admin') return { success: false, error: 'Unauthorized: Admin access required' };
  return { success: true, userId: result.payload.userId as string };
}

async function adminName(userId: string): Promise<string | undefined> {
  try {
    if (!ObjectId.isValid(userId)) return undefined;
    const user = await db.readOne<{ name?: string; email?: string }>('users', { _id: new ObjectId(userId) } as never);
    return user.data?.name || user.data?.email || undefined;
  } catch {
    return undefined;
  }
}

type Action = 'contacted' | 'undo_contacted' | 'dismiss';

/**
 * PATCH /api/admin/abandoned-checkouts/{paymentIntentId}  { action: 'contacted' | 'undo_contacted' | 'dismiss', note? }
 * Applies to every open checkout of the same person, so the list always shows them as one.
 */
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = verifyAuth(request);
    if (!auth.success) return NextResponse.json({ error: auth.error }, { status: 401 });
    const { id } = await params;
    if (!/^pi_[A-Za-z0-9_]{8,80}$/.test(id)) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    let body: { action?: Action; note?: unknown } = {};
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
    }
    const action = body.action;
    if (action !== 'contacted' && action !== 'undo_contacted' && action !== 'dismiss') return NextResponse.json({ error: 'Unknown action' }, { status: 400 });

    const draft = await db.readOne<{ userId: string; status: string }>('checkoutDrafts', { paymentIntentId: id } as never);
    if (!draft.success || !draft.data) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    const collection = (await db.getDb()).collection('checkoutDrafts');
    const filter = { userId: draft.data.userId, status: 'open' };
    const now = new Date();
    if (action === 'contacted') {
      const note = typeof body.note === 'string' ? body.note.trim().slice(0, 200) : '';
      const by = auth.userId ? await adminName(auth.userId) : undefined;
      await collection.updateMany(filter, { $set: { contacted: { at: now, ...(by ? { by } : {}), ...(note ? { note } : {}) }, updatedAt: now } });
    } else if (action === 'undo_contacted') {
      await collection.updateMany(filter, { $unset: { contacted: '' }, $set: { updatedAt: now } });
    } else {
      await collection.updateMany(filter, { $set: { dismissedAt: now, updatedAt: now } });
    }
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('abandoned-checkouts PATCH failed', error);
    return NextResponse.json({ error: 'Could not save that' }, { status: 500 });
  }
}
