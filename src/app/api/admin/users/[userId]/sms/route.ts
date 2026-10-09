import { NextRequest, NextResponse } from 'next/server';
import { ObjectId } from 'mongodb';
import { db } from '@/lib/db';
import { verifyAdminRequest } from '@/lib/adminAuth';
import { smsConsentView, type SmsConsentRecord, type SmsSubscriberRecord } from '@/utils/smsConsentView';

export const dynamic = 'force-dynamic';

/**
 * GET /api/admin/users/{userId}/sms
 * The customer's text-message agreement (what they ticked, where, when, which wording, whether they stopped) and the last
 * texts we sent them. Read only.
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ userId: string }> }) {
  const auth = verifyAdminRequest(request);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: 401 });
  const { userId } = await params;
  if (!ObjectId.isValid(userId)) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  try {
    const found = await db.readOne<{ phone?: string; smsConsent?: SmsConsentRecord }>('users', { _id: new ObjectId(userId) } as never);
    if (!found.success || !found.data) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    const phone = String(found.data.phone ?? '').replace(/\D/g, '').slice(-10);

    let subscriber: SmsSubscriberRecord | null = null;
    if (phone.length === 10) {
      const sub = await db.readOne<SmsSubscriberRecord>('smsSubscribers', { phone } as never);
      subscriber = sub.success ? sub.data ?? null : null;
    }

    const texts = await db.read<{ kind?: string; status?: string; createdAt?: Date; mode?: string }>(
      'smsMessages',
      { userId } as never,
      { sort: { createdAt: -1 }, limit: 5, projection: { kind: 1, status: 1, createdAt: 1, mode: 1 } } as never
    );

    return NextResponse.json({
      data: {
        consent: smsConsentView(found.data.smsConsent, subscriber, found.data.phone),
        texts: (texts.success ? texts.data ?? [] : []).map((t) => ({ kind: t.kind ?? '', status: t.status ?? '', mode: t.mode ?? '', at: t.createdAt ?? null })),
      },
    });
  } catch (error) {
    console.error('Error in GET /api/admin/users/[userId]/sms:', error);
    return NextResponse.json({ error: 'Could not load the text-message details' }, { status: 500 });
  }
}
