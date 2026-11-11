import { NextRequest, NextResponse } from 'next/server';
import { ObjectId } from 'mongodb';
import { db } from '@/lib/db';
import { verifyAdminRequest } from '@/lib/adminAuth';
import { postJsonToLivesiteAs } from '@/lib/livesiteForward';
import { setEmailChoice, turnTextsOff } from '@/lib/server/userPreferences';
import { parseBulkRequest, summarize, type BulkResultRow } from '@/utils/bulkUsers';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

interface CustomerRow {
  _id: ObjectId;
  email?: string;
  phone?: string;
  smsConsent?: { optedIn?: boolean; phone?: string };
}

/**
 * POST /api/admin/users/bulk { action, ids, amount?, reason?, batchId? }
 * Changes many CUSTOMERS at once: emails on/off, texts off, the same store credit for each, or deactivating accounts. Admin accounts are
 * never touched. Every customer gets its own result line (no personal details), and one record of the whole update is kept.
 */
export async function POST(request: NextRequest) {
  const auth = verifyAdminRequest(request);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: 401 });
  const body = await request.json().catch(() => ({}));
  const parsed = parseBulkRequest(body);
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });
  const req = parsed.request;

  try {
    const database = await db.getDb();
    const found = (await database
      .collection('users')
      .find({ _id: { $in: req.ids.map((id) => new ObjectId(id)) }, role: { $in: ['USER', 'user'] }, isActive: { $ne: false } }, { projection: { email: 1, phone: 1, smsConsent: 1 } })
      .toArray()) as unknown as CustomerRow[];
    const byId = new Map(found.map((u) => [String(u._id), u]));
    const rows: BulkResultRow[] = [];

    if (req.action === 'credit_add') await database.collection('bulkCreditLog').createIndex({ batchId: 1, userId: 1 }, { unique: true });

    for (const id of req.ids) {
      const user = byId.get(id);
      if (!user) {
        rows.push({ id, outcome: 'skipped', note: 'Not an active customer account' });
        continue;
      }
      try {
        if (req.action === 'emails_on' || req.action === 'emails_off') {
          const email = String(user.email ?? '').trim().toLowerCase();
          if (!email) {
            rows.push({ id, outcome: 'skipped', note: 'No email address' });
            continue;
          }
          await setEmailChoice(database, { userId: id, email, optedOut: req.action === 'emails_off', adminId: auth.userId });
          rows.push({ id, outcome: 'done' });
        } else if (req.action === 'texts_off') {
          const changed = await turnTextsOff(database, user);
          rows.push(changed ? { id, outcome: 'done' } : { id, outcome: 'skipped', note: 'Was not receiving texts' });
        } else if (req.action === 'deactivate') {
          await database.collection('users').updateOne({ _id: user._id }, { $set: { isActive: false, updatedAt: new Date() } });
          rows.push({ id, outcome: 'done' });
        } else if (req.action === 'credit_add') {
          // one credit per customer per batch, even if this request is sent twice
          try {
            await database.collection('bulkCreditLog').insertOne({ batchId: req.batchId, userId: id, amount: req.amount, at: new Date(), by: auth.userId });
          } catch (e) {
            if ((e as { code?: number }).code === 11000) {
              rows.push({ id, outcome: 'skipped', note: 'Already given in this update' });
              continue;
            }
            throw e;
          }
          const r = await postJsonToLivesiteAs(request, `/api/admin/users/${id}/store-credit`, { amount: req.amount, reason: req.reason });
          if (r.ok) rows.push({ id, outcome: 'done' });
          else {
            await database.collection('bulkCreditLog').deleteOne({ batchId: req.batchId, userId: id });
            rows.push({ id, outcome: 'failed', note: r.status === 502 ? 'Could not reach the customer site' : r.error || 'Could not give the credit' });
          }
        }
      } catch (error) {
        console.error('[bulk users] one customer failed', { action: req.action, message: error instanceof Error ? error.message : String(error) });
        rows.push({ id, outcome: 'failed', note: 'Could not save' });
      }
    }

    const summary = summarize(rows);
    await database
      .collection('bulkUserActions')
      .insertOne({ at: new Date(), by: auth.userId, action: req.action, requested: req.ids.length, ...summary, ...(req.action === 'credit_add' ? { amount: req.amount, reason: req.reason, batchId: req.batchId } : {}) })
      .catch(() => undefined);
    return NextResponse.json({ data: { rows, summary } });
  } catch (error) {
    console.error('Error in POST /api/admin/users/bulk:', error instanceof Error ? error.message : error);
    return NextResponse.json({ error: 'Could not save the change' }, { status: 500 });
  }
}
