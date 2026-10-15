import { NextRequest, NextResponse } from 'next/server';
import { verifyAdminRequest } from '@/lib/adminAuth';
import { db } from '@/lib/db';
import { orderDraftLines, type DraftCartLine } from '@/utils/checkoutOrderDraft';

export const dynamic = 'force-dynamic';

/**
 * GET /api/admin/abandoned-checkouts/{paymentIntentId}/order-draft
 * What the person left in that checkout, as the picks of the Create Order form (so an admin can make the order for them), plus who
 * they are. Older checkouts were saved without the cart: then `lines` is empty and `noCart` is true.
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = verifyAdminRequest(request);
  if (!auth.ok) return NextResponse.json({ success: false, error: auth.error }, { status: 401 });
  const { id } = await params;
  if (!/^pi_[A-Za-z0-9_]{8,80}$/.test(id)) return NextResponse.json({ success: false, error: 'Not found' }, { status: 404 });
  try {
    const found = await db.readOne<{ customer?: { name?: string; email?: string; phone?: string }; cartLines?: DraftCartLine[] }>(
      'checkoutDrafts',
      { paymentIntentId: id } as never
    );
    if (!found.success || !found.data) return NextResponse.json({ success: false, error: 'That checkout was not found' }, { status: 404 });
    const lines = orderDraftLines(found.data.cartLines);
    const c = found.data.customer ?? {};
    return NextResponse.json({
      success: true,
      data: { customer: { name: c.name ?? '', email: c.email ?? '', phone: c.phone ?? '' }, lines, noCart: lines.length === 0 },
    });
  } catch (error) {
    console.error('order-draft failed', error);
    return NextResponse.json({ success: false, error: 'Could not read that checkout' }, { status: 500 });
  }
}
