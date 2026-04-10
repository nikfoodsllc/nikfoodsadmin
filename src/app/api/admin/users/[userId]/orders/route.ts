import { NextRequest, NextResponse } from 'next/server';
import { jwtHandler } from '@/lib/jwt';
import { db } from '@/lib/db';
import { Order } from '@/types/order';
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
 * GET /api/admin/users/[userId]/orders
 * Get all orders for a specific user
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  try {
    // Verify authentication
    const authResult = verifyAuth(request);
    if (!authResult.success) {
      return NextResponse.json({ error: authResult.error }, { status: 401 });
    }

    // Await params (Next.js 15+ requirement)
    const { userId } = await params;

    if (!userId) {
      return NextResponse.json({ error: 'User ID is required' }, { status: 400 });
    }

    console.log('Fetching orders for user ID:', userId);

    // Validate if userId is a valid ObjectId format
    if (!ObjectId.isValid(userId)) {
      return NextResponse.json({ error: 'Invalid user ID format' }, { status: 400 });
    }

    // Fetch all orders for this user
    // Handle both string and ObjectId formats in the database
    const result = await db.read<Order>('orders', {
      $or: [
        { user: userId },
        { user: new ObjectId(userId) }
      ]
    } as Record<string, unknown>, {
      sort: { createdAt: -1 }, // Latest first
    });

    if (!result.success) {
      throw new Error(result.error || 'Failed to fetch user orders');
    }

    const orders = result.data || [];

    console.log(`Found ${orders.length} orders for user ${userId}`);

    // Calculate summary
    const totalOrders = orders.length;
    const totalSpent = orders.reduce((sum, order) => sum + (order.totalPaid || 0), 0);

    return NextResponse.json({
      data: {
        orders,
        summary: {
          totalOrders,
          totalSpent,
        },
      },
      message: 'User orders fetched successfully',
    });
  } catch (error) {
    console.error('Error in GET /api/admin/users/[userId]/orders:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}
