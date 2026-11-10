import { NextRequest, NextResponse } from 'next/server';
import { ObjectId } from 'mongodb';
import { db } from '@/lib/db';
import { verifyAdminRequest } from '@/lib/adminAuth';
import { emailStatusFor } from '@/utils/userFilters';

export const dynamic = 'force-dynamic';

const cleanEmail = (v: unknown) => String(v ?? '').trim().toLowerCase();

async function status(userId: string, user: { email?: string }) {
  const database = await db.getDb();
  const email = cleanEmail(user.email);
  const [stopped, subs] = await Promise.all([
    email ? database.collection('emailOptOuts').findOne({ email }) : null,
    database.collection('menu_subscriptions').find({ isActive: true, consentGiven: true, $or: [...(email ? [{ email }] : []), { userId }] }, { projection: { email: 1, userId: 1, subscribedAt: 1 } }).limit(5).toArray(),
  ]);
  const lists = {
    agreedEmails: new Set(subs.map((x) => cleanEmail(x.email)).filter(Boolean)),
    agreedIds: new Set(subs.map((x) => String(x.userId ?? '')).filter(Boolean)),
    stoppedEmails: new Set(stopped ? [email] : []),
  };
  return {
    status: emailStatusFor({ _id: userId, email }, lists),
    stoppedAt: stopped?.createdAt ?? null,
    stoppedHow: stopped ? (stopped.source === 'admin' ? 'An admin turned emails off' : 'Used the unsubscribe link') : '',
    agreedAt: subs[0]?.subscribedAt ?? null,
  };
}

/** GET /api/admin/users/{userId}/email: does the customer get our emails (menu alerts list, unsubscribe list). */
export async function GET(request: NextRequest, { params }: { params: Promise<{ userId: string }> }) {
  const auth = verifyAdminRequest(request);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: 401 });
  const { userId } = await params;
  if (!ObjectId.isValid(userId)) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  try {
    const found = await db.readOne<{ email?: string }>('users', { _id: new ObjectId(userId) } as never);
    if (!found.success || !found.data) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json({ data: await status(userId, found.data) });
  } catch (error) {
    console.error('Error in GET /api/admin/users/[userId]/email:', error);
    return NextResponse.json({ error: 'Could not load the email details' }, { status: 500 });
  }
}

/**
 * PUT /api/admin/users/{userId}/email { optedOut: boolean }
 * true = turn off the emails sent from the Communication tab for this customer (their address goes on the unsubscribe list, the same
 * list the unsubscribe link in the emails uses); false = turn them back on (the address comes off that list AND the customer is subscribed
 * again, so they show as Subscribed). Order emails (confirmation, payment) are never affected.
 */
export async function PUT(request: NextRequest, { params }: { params: Promise<{ userId: string }> }) {
  const auth = verifyAdminRequest(request);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: 401 });
  const { userId } = await params;
  if (!ObjectId.isValid(userId)) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  const body = await request.json().catch(() => ({}));
  if (typeof body?.optedOut !== 'boolean') return NextResponse.json({ error: 'Say whether to turn emails off or on.' }, { status: 400 });
  try {
    const found = await db.readOne<{ email?: string }>('users', { _id: new ObjectId(userId) } as never);
    if (!found.success || !found.data) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    const email = cleanEmail(found.data.email);
    if (!email) return NextResponse.json({ error: 'This customer has no email address.' }, { status: 400 });
    const database = await db.getDb();
    const optOuts = database.collection('emailOptOuts');
    if (body.optedOut) {
      await optOuts.createIndex({ email: 1 }, { unique: true });
      await optOuts.updateOne({ email }, { $setOnInsert: { email, createdAt: new Date(), source: 'admin', by: auth.userId } }, { upsert: true });
    } else {
      await optOuts.deleteOne({ email });
      // turning emails back on makes the customer subscribed again (the subscription may have been switched off by their own unsubscribe)
      const subs = database.collection('menu_subscriptions');
      const now = new Date();
      const existing = await subs.countDocuments({ $or: [{ email }, { userId }] });
      if (existing > 0) {
        await subs.updateMany({ $or: [{ email }, { userId }] }, { $set: { isActive: true, consentGiven: true, updatedAt: now }, $unset: { unsubscribedAt: '' } });
      } else {
        await subs.insertOne({ email, userId, subscribedAt: now, consentGiven: true, isActive: true, source: 'admin', by: auth.userId, createdAt: now, updatedAt: now });
      }
    }
    return NextResponse.json({ data: await status(userId, found.data) });
  } catch (error) {
    console.error('Error in PUT /api/admin/users/[userId]/email:', error);
    return NextResponse.json({ error: 'Could not save the change' }, { status: 500 });
  }
}
