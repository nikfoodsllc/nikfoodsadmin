import { NextRequest, NextResponse } from 'next/server';
import { ObjectId } from 'mongodb';
import { db } from '@/lib/db';
import { jwtHandler } from '@/lib/jwt';
import { adminIdsIn, buildOrderTranscript, type TranscriptOrder } from '@/lib/orderTranscript';

export const dynamic = 'force-dynamic';

/** GET /api/admin/orders/{orderId}/history: the order's transcript, newest first (admins only; read only). */
export async function GET(request: NextRequest, { params }: { params: Promise<{ orderId: string }> }) {
  const header = request.headers.get('authorization');
  const verified = header?.startsWith('Bearer ') ? jwtHandler.verifyToken(header.substring(7)) : null;
  if (!verified?.success || verified.payload?.role !== 'admin') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { orderId: raw } = await params;
  const orderId = decodeURIComponent(raw);
  const found = await db.readOne<TranscriptOrder & { orderId: string }>('orders', { orderId } as never);
  if (!found.success || !found.data) return NextResponse.json({ error: 'No order with that number' }, { status: 404 });

  const ids = adminIdsIn(found.data);
  const names: Record<string, string> = {};
  if (ids.length > 0) {
    const users = await db.read<{ _id: ObjectId; name?: string; email?: string }>('users', { _id: { $in: ids.map((id) => new ObjectId(id)) } } as never);
    for (const u of users.success && users.data ? users.data : []) names[String(u._id)] = u.name || u.email || '';
  }
  return NextResponse.json({ success: true, data: { events: buildOrderTranscript(found.data, names) } });
}
