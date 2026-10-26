import { NextRequest, NextResponse } from 'next/server';
import { jwtHandler } from '@/lib/jwt';
import { db } from '@/lib/db';
import { UserDocument, Address } from '@/types/user';
import { ObjectId } from 'mongodb';
import { smsConsentView, type SmsConsentRecord, type SmsSubscriberRecord } from '@/utils/smsConsentView';
import { parseTextFilter, parseUserSort, textFilterClause, userSortSpec } from '@/utils/userFilters';

/**
 * Verify JWT token and check admin role
 */
function verifyAuth(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return { success: false, error: 'Missing or invalid authorization header' };
  }

  const token = authHeader.substring(7);
  const verificationResult = jwtHandler.verifyToken(token);

  if (!verificationResult.success || !verificationResult.payload) {
    return { success: false, error: verificationResult.error || 'Invalid token' };
  }

  if (verificationResult.payload.role !== 'admin') {
    return { success: false, error: 'Unauthorized: Admin access required' };
  }

  return { success: true, userId: verificationResult.payload.userId };
}

/**
 * GET /api/admin/users
 * List users with search and pagination
 * Query params:
 *   - search (name, email, or phone)
 *   - page (default: 1)
 *   - limit (default: 10)
 */
export async function GET(request: NextRequest) {
  try {
    // Verify authentication
    const authResult = verifyAuth(request);
    if (!authResult.success) {
      return NextResponse.json({ error: authResult.error }, { status: 401 });
    }

    // Parse query parameters
    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search') || '';
    const page = parseInt(searchParams.get('page') || '1', 10);
    const limit = Math.min(100000, Math.max(1, parseInt(searchParams.get('limit') || '10', 10) || 10));
    const skip = (page - 1) * limit;
    const textFilter = parseTextFilter(searchParams.get('texts'));
    const sort = parseUserSort(searchParams.get('sort'));

    // Build filter query
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const filter: any = {
      $or: [{ isActive: true }, { isActive: { $exists: false } }],
    };

    // Search by name, email, or phone (typed text, so special characters like ( or + are matched as they are)
    if (search) {
      const escaped = search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      filter.$and = [
        { $or: [{ isActive: true }, { isActive: { $exists: false } }] },
        {
          $or: [
            { name: { $regex: escaped, $options: 'i' } },
            { email: { $regex: escaped, $options: 'i' } },
            { phone: { $regex: escaped, $options: 'i' } },
          ],
        },
      ];
      delete filter.$or;
    }

    const database = await db.getDb();

    // Text-message choice: the public Text Updates page keeps its own record per phone number
    if (textFilter !== 'all') {
      const subs = await database.collection('smsSubscribers').find({}, { projection: { phone: 1, optedIn: 1, optedOutAt: 1 } }).toArray();
      const tenDigits = (v: unknown) => String(v ?? '').replace(/\D/g, '').slice(-10);
      const clause = textFilterClause(textFilter, {
        agreed: subs.filter((x) => x.optedIn).map((x) => tenDigits(x.phone)).filter((x) => x.length === 10),
        stopped: subs.filter((x) => !x.optedIn && x.optedOutAt).map((x) => tenDigits(x.phone)).filter((x) => x.length === 10),
      });
      if (clause) filter.$and = [...(filter.$and || []), clause];
    }

    // Get total count for pagination
    const total = await database.collection('users').countDocuments(filter);

    // Fetch paginated users (exclude password)
    // (case-insensitive collation so name sorting ignores capital letters)
    const users = (await database
      .collection<UserDocument>('users')
      .find(filter, { projection: { password: 0 } })
      .collation({ locale: 'en', strength: 2 })
      .sort(userSortSpec(sort))
      .skip(skip)
      .limit(limit)
      .toArray()) as unknown as UserDocument[];

    // Text-message status for the Texts column (the same rules as the customer dialog)
    const pagePhones = users.map((u) => String(u.phone ?? '').replace(/\D/g, '').slice(-10)).filter((x) => x.length === 10);
    const pageSubs = pagePhones.length
      ? await database.collection('smsSubscribers').find({ phone: { $in: pagePhones } }).toArray()
      : [];
    const subByPhone = new Map(pageSubs.map((x) => [String(x.phone), x as unknown as SmsSubscriberRecord]));

    // Fetch addresses for each user
    const usersWithAddresses = await Promise.all(
      users.map(async (user) => {
        const phone10 = String(user.phone ?? '').replace(/\D/g, '').slice(-10);
        const textStatus = smsConsentView(
          (user as unknown as { smsConsent?: SmsConsentRecord }).smsConsent,
          subByPhone.get(phone10) ?? null,
          user.phone
        ).status;
        if (user.addresses && user.addresses.length > 0) {
          // Convert ObjectId[] to filter
          const addressIds = user.addresses.map(id =>
            typeof id === 'string' ? new ObjectId(id) : id
          );

          const addressResult = await db.read<Address>('addresses', {
            _id: { $in: addressIds },
          });

          return {
            ...user,
            textStatus,
            addresses: addressResult.data || [],
          };
        }

        return {
          ...user,
          textStatus,
          addresses: [],
        };
      })
    );

    return NextResponse.json({
      data: {
        items: usersWithAddresses,
        total,
        page,
        pageSize: limit,
      },
      message: 'Users fetched successfully',
    });
  } catch (error) {
    console.error('Error in GET /api/admin/users:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}
