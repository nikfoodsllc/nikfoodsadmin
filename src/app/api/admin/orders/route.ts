import { NextRequest, NextResponse } from 'next/server';
import { jwtHandler } from '@/lib/jwt';
import { db } from '@/lib/db';
import { Order, OrderStatus } from '@/types/order';
import { ObjectId } from 'mongodb';
import { optimoFilterFor } from '@/utils/orderOptimoView';

const VALID_ORDER_STATUSES: OrderStatus[] = [
  'pending',
  'confirmed',
  'preparing',
  'ready',
  'out_for_delivery',
  'delivered',
  'cancelled',
];

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
 * GET /api/admin/orders
 * List orders with filters and pagination
 * Query params:
 *   - search (order ID, customer name, email)
 *   - status (order status or 'all')
 *   - paymentStatus ('paid', 'unpaid', 'failed', 'refunded', 'partially_refunded', or 'all')
 *   - paymentMethod ('Credit Card', 'Apple Pay', 'Google Pay', 'Bank', 'Link', 'Klarna', 'Other', 'Cash on Delivery', or 'all')
 *   - startDate (filter from date)
 *   - endDate (filter to date)
 *   - sortBy (date_desc, date_asc, amount_desc, amount_asc)
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
    const status = searchParams.get('status') || 'all';
    const paymentStatus = searchParams.get('paymentStatus') || 'all';
    const paymentMethod = searchParams.get('paymentMethod') || 'all';
    const optimo = searchParams.get('optimo') || 'all';
    const startDate = searchParams.get('startDate') || '';
    const endDate = searchParams.get('endDate') || '';
    const sortBy = searchParams.get('sortBy') || 'date_desc';
    const page = parseInt(searchParams.get('page') || '1', 10);
    const limit = parseInt(searchParams.get('limit') || '10', 10);
    const skip = (page - 1) * limit;

    // Build filter query
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const filter: any = {};

    // Search by order ID, customer name, or email
    if (search) {
      filter.$or = [
        { orderId: { $regex: search, $options: 'i' } },
        { 'customerInfo.name': { $regex: search, $options: 'i' } },
        { 'customerInfo.email': { $regex: search, $options: 'i' } },
      ];
    }

    // Filter by order status
    if (status && status !== 'all') {
      filter.status = status;
    }

    // Filter by payment status
    if (paymentStatus === 'partially_refunded') {
      // Not a stored status: a paid order with part of its total refunded
      filter.paymentStatus = 'paid';
      filter.refundedAmount = { $gt: 0 };
    } else if (paymentStatus && paymentStatus !== 'all') {
      filter.paymentStatus = paymentStatus;
    }

    // Filter by payment method
    if (paymentMethod && paymentMethod !== 'all') {
      filter.paymentMethod = paymentMethod;
    }

    // Filter by OptimoRoute (In OptimoRoute, Failed, Removed, Not sent)
    const optimoFilter = optimoFilterFor(optimo);
    if (optimoFilter) Object.assign(filter, optimoFilter);

    // Filter by date range
    if (startDate || endDate) {
      filter.createdAt = {};
      if (startDate) {
        filter.createdAt.$gte = new Date(startDate);
      }
      if (endDate) {
        // Set to end of day
        const endDateTime = new Date(endDate);
        endDateTime.setHours(23, 59, 59, 999);
        filter.createdAt.$lte = endDateTime;
      }
    }

    // Determine sort order
    let sort: Record<string, 1 | -1> = { createdAt: -1 }; // Default: latest first
    switch (sortBy) {
      case 'date_asc':
        sort = { createdAt: 1 };
        break;
      case 'date_desc':
        sort = { createdAt: -1 };
        break;
      case 'amount_asc':
        sort = { totalPaid: 1 };
        break;
      case 'amount_desc':
        sort = { totalPaid: -1 };
        break;
    }

    // Get total count for pagination
    const countResult = await db.read<Order>('orders', filter);
    const total = countResult.data?.length || 0;

    // Fetch paginated orders
    const result = await db.read<Order>('orders', filter, {
      sort,
      skip,
      limit,
    });

    if (!result.success) {
      throw new Error(result.error || 'Failed to fetch orders');
    }

    // Sort each order's items array by delivery date in ascending order
    const sortedOrders = (result.data || []).map((order) => {
      if (order.items && order.items.length > 0) {
        const sortedItems = [...order.items].sort((a, b) => {
          const dateA = a.actualDeliveryDate || a.deliveryDate;
          const dateB = b.actualDeliveryDate || b.deliveryDate;
          return new Date(dateA).getTime() - new Date(dateB).getTime();
        });
        return { ...order, items: sortedItems };
      }
      return order;
    });

    return NextResponse.json({
      data: {
        items: result.data || [],
        total,
        page,
        pageSize: limit,
      },
      message: 'Orders fetched successfully',
    });
  } catch (error) {
    console.error('Error in GET /api/admin/orders:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/admin/orders
 * Update order status
 */
export async function PUT(request: NextRequest) {
  try {
    // Verify authentication
    const authResult = verifyAuth(request);
    if (!authResult.success) {
      return NextResponse.json({ error: authResult.error }, { status: 401 });
    }

    // Parse request body
    const body = await request.json();
    const { _id, ids, status } = body as {
      _id?: string;
      ids?: string[];
      status?: OrderStatus;
    };

    // Validate required status field
    if (!status) {
      return NextResponse.json({ error: 'Status is required' }, { status: 400 });
    }

    // Validate status value
    if (!VALID_ORDER_STATUSES.includes(status)) {
      return NextResponse.json({ error: 'Invalid status value' }, { status: 400 });
    }

    // Reject ambiguous payload
    if (_id && Array.isArray(ids)) {
      return NextResponse.json(
        { error: 'Provide either _id or ids, not both' },
        { status: 400 }
      );
    }

    // Single order update
    if (_id) {
      let objectId: ObjectId;
      try {
        objectId = new ObjectId(_id);
      } catch {
        return NextResponse.json({ error: 'Invalid Order ID format' }, { status: 400 });
      }

      const updateResult = await db.updateOne<Order>(
        'orders',
        { _id: objectId } as Record<string, unknown>,
        { $set: { status, updatedAt: new Date() } }
      );

      if (!updateResult.success) {
        throw new Error(updateResult.error || 'Failed to update order status');
      }

      if (!updateResult.matchedCount) {
        return NextResponse.json({ error: 'Order not found' }, { status: 404 });
      }

      // Fetch updated order
      const updatedOrder = await db.readOne<Order>('orders', {
        _id: objectId,
      } as Record<string, unknown>);

      return NextResponse.json({
        data: updatedOrder.data,
        message: 'Order status updated successfully',
      });
    }

    // Bulk order update
    if (!Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json(
        { error: 'Either _id or a non-empty ids array is required' },
        { status: 400 }
      );
    }

    if (ids.length > 100) {
      return NextResponse.json(
        { error: 'Maximum 100 orders can be updated in a single request' },
        { status: 400 }
      );
    }

    const uniqueIds = Array.from(new Set(ids));
    let objectIds: ObjectId[];
    try {
      objectIds = uniqueIds.map((id) => new ObjectId(id));
    } catch {
      return NextResponse.json({ error: 'One or more order IDs are invalid' }, { status: 400 });
    }

    const countResult = await db.count<Order>(
      'orders',
      { _id: { $in: objectIds } } as Record<string, unknown>
    );

    if (!countResult.success) {
      throw new Error(countResult.error || 'Failed to count matching orders');
    }

    const updateResult = await db.update<Order>(
      'orders',
      { _id: { $in: objectIds } } as Record<string, unknown>,
      { $set: { status, updatedAt: new Date() } }
    );

    if (!updateResult.success) {
      throw new Error(updateResult.error || 'Failed to update order statuses');
    }

    return NextResponse.json({
      data: {
        requestedCount: uniqueIds.length,
        matchedCount: countResult.count || 0,
        modifiedCount: updateResult.modifiedCount || 0,
      },
      message: 'Order statuses updated successfully',
    });
  } catch (error) {
    console.error('Error in PUT /api/admin/orders:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}
