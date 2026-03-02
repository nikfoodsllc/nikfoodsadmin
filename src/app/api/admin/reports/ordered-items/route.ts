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
 * GET /api/admin/reports/ordered-items
 * Generate ordered items report with detailed breakdown for each order item
 * Query params:
 *   - startDate (optional): Filter from date (ISO format)
 *   - endDate (optional): Filter to date (ISO format)
 *
 * Returns:
 *   - items: Array of ordered items with all details
 *   - startDate: Filter start date
 *   - endDate: Filter end date
 *   - totalRecords: Total number of items
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
    // Use string comparison like other working reports (delivery, kitchen)
    if (startDate || endDate) {
      const dateFilter: any = {};
      if (startDate) {
        dateFilter.$gte = startDate;
      }
      if (endDate) {
        dateFilter.$lte = endDate;
      }
      filter['items.deliveryDate'] = dateFilter;
    }

    // Build aggregation pipeline for ordered items
    const orderedItemsPipeline = [
      // Match orders based on date filter
      ...(Object.keys(filter).length > 0 ? [{ $match: filter }] : []),
      // Unwind the items array (OrderDay array)
      { $unwind: '$items' },
      // Unwind the items.items array (OrderDayItem array)
      { $unwind: '$items.items' },
      // Project all required fields
      {
        $project: {
          _id: {
            $concat: [
              { $toString: '$_id' },
              '-',
              { $toString: '$items.deliveryDate' },
              '-',
              { $toString: '$items.items.food._id' }
            ]
          },
          orderId: '$orderId',
          orderDate: '$createdAt',
          deliveryDate: '$items.deliveryDate',
          customerName: '$customerInfo.name',
          customerPhone: '$customerInfo.phone',
          itemId: '$items.items.food._id',
          itemName: '$items.items.food.name',
          itemDescription: '$items.items.food.description',
          portionQuantity: { $ifNull: ['$items.items.selectedPortion', ''] },
          quantity: '$items.items.quantity',
          spiceLevel: { $ifNull: ['$items.items.spiceLevel', ''] },
          itemPrice: '$items.items.price',
          ecoContainer: { $ifNull: ['$items.items.isEcoFriendlyContainer', false] },
          ecoContainerAvailable: { $ifNull: ['$items.items.food.isEcoFriendlyContainer', false] },
        },
      },
      // Sort by delivery date, then customer name, then item name
      {
        $sort: {
          deliveryDate: -1,
          customerName: 1,
          itemName: 1,
        },
      },
    ];

    // Execute aggregation
    const orderedItemsResult = await db.aggregate<Order>('orders', orderedItemsPipeline);

    if (!orderedItemsResult.success) {
      throw new Error(orderedItemsResult.error || 'Failed to generate ordered items report');
    }

    const items = orderedItemsResult.data || [];

    // Calculate date range for response
    let responseStartDate = startDate;
    let responseEndDate = endDate;

    // If no date filter provided, use the date range from the data
    if (!responseStartDate && !responseEndDate && items.length > 0) {
      const dates = items.map(item => new Date(item.deliveryDate as string)).sort((a, b) => a.getTime() - b.getTime());
      responseStartDate = dates[0].toISOString().split('T')[0];
      responseEndDate = dates[dates.length - 1].toISOString().split('T')[0];
    }

    return NextResponse.json({
      data: {
        items,
        startDate: responseStartDate || '',
        endDate: responseEndDate || '',
        totalRecords: items.length,
      },
      message: 'Ordered items report generated successfully',
    });
  } catch (error) {
    console.error('Error in GET /api/admin/reports/ordered-items:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}
