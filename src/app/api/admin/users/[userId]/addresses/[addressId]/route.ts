import { NextRequest, NextResponse } from 'next/server';
import { ObjectId } from 'mongodb';
import { db } from '@/lib/db';
import { verifyAdminRequest } from '@/lib/adminAuth';
import { validateAddressInput } from '@/utils/userAdmin';

/**
 * PUT /api/admin/users/{userId}/addresses/{addressId}
 * Changes a saved address of a customer. Orders already placed keep the address they were placed with.
 */
export async function PUT(request: NextRequest, { params }: { params: Promise<{ userId: string; addressId: string }> }) {
  const auth = verifyAdminRequest(request);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: 401 });

  const { userId, addressId } = await params;
  if (!ObjectId.isValid(userId) || !ObjectId.isValid(addressId)) return NextResponse.json({ error: 'Invalid ID' }, { status: 400 });

  const body = await request.json().catch(() => null);
  const checked = validateAddressInput(body);
  if (!checked.ok) return NextResponse.json({ error: checked.error }, { status: 400 });
  const a = checked.value;

  try {
    const database = await db.getDb();
    const addresses = database.collection('addresses');
    const owner = { $in: [userId, new ObjectId(userId)] };
    // the address must belong to this customer
    const existing = await addresses.findOne({ _id: new ObjectId(addressId), user: owner } as never);
    if (!existing) return NextResponse.json({ error: 'Address not found for this customer' }, { status: 404 });

    // turning default on takes it off the others; the default of a customer cannot simply be switched off here
    const isDefault = a.isDefault || existing.isDefault === true;
    if (isDefault && existing.isDefault !== true) {
      await addresses.updateMany({ user: owner, isDefault: true } as never, { $set: { isDefault: false, updatedAt: new Date() } });
    }

    const set: Record<string, unknown> = {
      name: a.name,
      email: a.email,
      street_address: a.street_address,
      city: a.city,
      postal_code: a.postal_code,
      isDefault,
      updatedAt: new Date(),
    };
    const unset: Record<string, ''> = {};
    for (const [key, value] of [['phone', a.phone], ['apartment', a.apartment], ['floor', a.floor], ['entrance', a.entrance]] as const) {
      if (value) set[key] = value;
      else unset[key] = '';
    }
    await addresses.updateOne({ _id: new ObjectId(addressId) }, { $set: set, ...(Object.keys(unset).length ? { $unset: unset } : {}) });

    return NextResponse.json({ message: 'Address updated' });
  } catch (error) {
    console.error('Error in PUT /api/admin/users/[userId]/addresses/[addressId]:', error);
    return NextResponse.json({ error: 'Could not update the address' }, { status: 500 });
  }
}
