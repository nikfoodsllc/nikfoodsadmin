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
 * GET /api/admin/reports/kitchen
 * Generate kitchen report aggregating orders by food item, spice level, and quantity
 * Query params:
 *   - startDate (optional): Filter from date (ISO format)
 *   - endDate (optional): Filter to date (ISO format)
 *
 * Returns:
 *   - itemSummary: Total quantity grouped by food item and spice level
 *   - orderBreakdown: Order-wise detailed breakdown
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
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');

    // Build filter query
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const filter: any = {};

    // Filter by date range based on delivery dates in OrderDay array
    if (startDate || endDate) {
      const dateFilter: any = {};
      if (startDate) {
        dateFilter.$gte = new Date(startDate);
      }
      if (endDate) {
        const endDateTime = new Date(endDate);
        endDateTime.setHours(23, 59, 59, 999);
        dateFilter.$lte = endDateTime;
      }
      filter['items.deliveryDate'] = dateFilter;
    }

    // Build aggregation pipeline for item-wise summary
    const itemSummaryPipeline = [
      // Match orders based on date filter
      ...(Object.keys(filter).length > 0 ? [{ $match: filter }] : []),
      // Unwind the items array (OrderDay array)
      { $unwind: '$items' },
      // Unwind the items.items array (OrderDayItem array)
      { $unwind: '$items.items' },
      // Group by food item and spice level
      {
        $group: {
          _id: {
            foodItemId: '$items.items.food._id',
            foodName: '$items.items.food.name',
            spiceLevel: { $ifNull: ['$items.items.spiceLevel', 'Not Specified'] },
          },
          totalQuantity: { $sum: '$items.items.quantity' },
          orderCount: { $sum: 1 },
        },
      },
      // Sort by food name and spice level
      {
        $sort: {
          '_id.foodName': 1,
          '_id.spiceLevel': 1,
        },
      },
      // Project to clean up the structure
      {
        $project: {
          _id: 0,
          foodItemId: '$_id.foodItemId',
          foodName: '$_id.foodName',
          spiceLevel: '$_id.spiceLevel',
          totalQuantity: 1,
          orderCount: 1,
        },
      },
    ];

    // Build aggregation pipeline for order-wise breakdown
    const orderBreakdownPipeline = [
      // Match orders based on date filter
      ...(Object.keys(filter).length > 0 ? [{ $match: filter }] : []),
      // Unwind the items array (OrderDay array)
      { $unwind: '$items' },
      // Unwind the items.items array (OrderDayItem array)
      { $unwind: '$items.items' },
      // Group by order and item details
      {
        $group: {
          _id: {
            orderId: '$orderId',
            orderDate: '$createdAt',
            foodItemId: '$items.items.food._id',
            foodName: '$items.items.food.name',
            spiceLevel: { $ifNull: ['$items.items.spiceLevel', 'Not Specified'] },
          },
          quantity: { $first: '$items.items.quantity' },
          deliveryDate: { $first: '$items.deliveryDate' },
          customerName: { $first: '$customerInfo.name' },
          customerPhone: { $first: '$customerInfo.phone' },
        },
      },
      // Sort by order date, then food name
      {
        $sort: {
          '_id.orderDate': -1,
          '_id.foodName': 1,
        },
      },
      // Project to clean up the structure
      {
        $project: {
          _id: 0,
          orderId: '$_id.orderId',
          orderDate: '$_id.orderDate',
          foodItemId: '$_id.foodItemId',
          foodName: '$_id.foodName',
          spiceLevel: '$_id.spiceLevel',
          quantity: 1,
          deliveryDate: 1,
          customerName: 1,
          customerPhone: 1,
        },
      },
    ];

    // Execute aggregations
    const itemSummaryResult = await db.aggregate<Order>('orders', itemSummaryPipeline);
    const orderBreakdownResult = await db.aggregate<Order>('orders', orderBreakdownPipeline);

    if (!itemSummaryResult.success) {
      throw new Error(itemSummaryResult.error || 'Failed to generate item summary');
    }

    if (!orderBreakdownResult.success) {
      throw new Error(orderBreakdownResult.error || 'Failed to generate order breakdown');
    }

    return NextResponse.json({
      data: {
        itemSummary: itemSummaryResult.data || [],
        orderBreakdown: orderBreakdownResult.data || [],
      },
      message: 'Kitchen report generated successfully',
    });
  } catch (error) {
    console.error('Error in GET /api/admin/reports/kitchen:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}
