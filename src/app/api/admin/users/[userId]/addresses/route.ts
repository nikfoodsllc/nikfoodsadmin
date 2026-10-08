import { NextRequest, NextResponse } from 'next/server';
import { ObjectId } from 'mongodb';
import { db } from '@/lib/db';
import { verifyAdminRequest } from '@/lib/adminAuth';
import { validateAddressInput } from '@/utils/userAdmin';

/**
 * POST /api/admin/users/{userId}/addresses
 * Adds an address to a customer, the same shape the customer site saves (addresses collection with the user id as text,
 * and the address id added to the user's list). Delivery area rules are not applied here: an admin may enter any address.
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ userId: string }> }) {
  const auth = verifyAdminRequest(request);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: 401 });

  const { userId } = await params;
  if (!ObjectId.isValid(userId)) return NextResponse.json({ error: 'Invalid user ID' }, { status: 400 });

  const body = await request.json().catch(() => null);
  const checked = validateAddressInput(body);
  if (!checked.ok) return NextResponse.json({ error: checked.error }, { status: 400 });
  const a = checked.value;

  try {
    const database = await db.getDb();
    const users = database.collection('users');
    const addresses = database.collection('addresses');
    const user = await users.findOne({ _id: new ObjectId(userId) }, { projection: { _id: 1, addresses: 1 } });
    if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });

    // the first address of a customer is their default
    const hasAny = (await addresses.countDocuments({ user: { $in: [userId, new ObjectId(userId)] } } as never, { limit: 1 })) > 0;
    const makeDefault = a.isDefault || !hasAny;
    if (makeDefault) {
      await addresses.updateMany({ user: { $in: [userId, new ObjectId(userId)] }, isDefault: true } as never, { $set: { isDefault: false, updatedAt: new Date() } });
    }

    const now = new Date();
    const created = await addresses.insertOne({
      user: userId,
      name: a.name,
      email: a.email,
      phone: a.phone || undefined,
      street_address: a.street_address,
      city: a.city,
      postal_code: a.postal_code,
      apartment: a.apartment || undefined,
      floor: a.floor || undefined,
      entrance: a.entrance || undefined,
      province: '',
      isDefault: makeDefault,
      createdAt: now,
      updatedAt: now,
    });
    await users.updateOne({ _id: new ObjectId(userId) }, { $set: { isCompleted: true, updatedAt: now }, $push: { addresses: created.insertedId } } as never);

    return NextResponse.json({ data: { _id: created.insertedId.toString() }, message: 'Address added' }, { status: 201 });
  } catch (error) {
    console.error('Error in POST /api/admin/users/[userId]/addresses:', error);
    return NextResponse.json({ error: 'Could not add the address' }, { status: 500 });
  }
}
