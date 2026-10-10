import { NextRequest, NextResponse } from 'next/server';
import { jwtHandler } from '@/lib/jwt';
import { db } from '@/lib/db';
import { UserDocument, Address } from '@/types/user';
import { ObjectId } from 'mongodb';

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

    // Get total count for pagination
    const database = await db.getDb();
    const total = await database.collection('users').countDocuments(filter);

    // Fetch paginated users (exclude password)
    const result = await db.read<UserDocument>('users', filter, {
      sort: { createdAt: -1 },
      skip,
      limit,
      projection: { password: 0 }, // Exclude password field
    });

    if (!result.success) {
      throw new Error(result.error || 'Failed to fetch users');
    }

    const users = result.data || [];

    // Fetch addresses for each user
    const usersWithAddresses = await Promise.all(
      users.map(async (user) => {
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
            addresses: addressResult.data || [],
          };
        }

        return {
          ...user,
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
