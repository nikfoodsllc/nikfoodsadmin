import { NextRequest, NextResponse } from 'next/server';
import { jwtHandler } from '@/lib/jwt';
import { db } from '@/lib/db';
import { Order } from '@/types/order';
import { ObjectId } from 'mongodb';
import { toPSTDate } from '@/utils/timezone';

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
 * GET /api/admin/reports/delivery
 * Generate delivery report aggregated by delivery date
 * Query params:
 *   - date (required): Delivery date to filter (ISO format: YYYY-MM-DD)
 *   - startDate (optional): Start date for range filtering (ISO format)
 *   - endDate (optional): End date for range filtering (ISO format)
 *
 * If 'date' is provided, it filters for that specific date.
 * If 'startDate' and 'endDate' are provided, it filters for the date range.
 * If both are provided, 'date' takes precedence.
 *
 * Returns:
 *   - deliveryDate: The delivery date
 *   - orders: Array of orders with customer details, items, and location info
 *   - summary: Total orders and items for the date(s)
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
    const date = searchParams.get('date');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');

    // Build date filter
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const dateFilter: any = {};

    if (date) {
      // Filter for specific date
      // Match the exact date format stored in database (handles both Date and string)
      dateFilter.$eq = date;
    } else if (startDate || endDate) {
      // Filter for date range
      if (startDate) {
        dateFilter.$gte = startDate;
      }
      if (endDate) {
        dateFilter.$lte = endDate;
      }
    } else {
      return NextResponse.json(
        { error: 'Either "date" or "startDate"/"endDate" query parameter is required' },
        { status: 400 }
      );
    }

    // Build aggregation pipeline
    const pipeline = [
      // Match orders with delivery dates in the specified range
      {
        $match: {
          'items.deliveryDate': dateFilter,
        },
      },
      // Preserve full OrderDay[] before unwinding for order-level delivery date columns
      { $addFields: { allOrderDays: '$items' } },
      // Unwind the items array to process each OrderDay separately
      { $unwind: '$items' },
      // Filter OrderDays that match the date filter
      {
        $match: {
          'items.deliveryDate': dateFilter,
        },
      },
      // Sort by delivery date and order creation time
      {
        $sort: {
          'items.deliveryDate': 1,
          createdAt: -1,
        },
      },
      // Project the required fields
      {
        $project: {
          _id: 1,
          orderId: 1,
          orderDate: '$createdAt',
          deliveryDate: '$items.deliveryDate',
          deliveryDay: '$items.day',
          allOrderDays: 1,
          items: '$items.items',
          customerInfo: 1,
          address: 1,
          status: 1,
          paymentStatus: 1,
          paymentMethod: 1,
          totalPaid: 1,
          refundedAmount: 1,
          subtotal: 1,
          deliveryFee: 1,
          tip: 1,
          deliveryMessages: 1,
        },
      },
    ];

    // Execute aggregation
    const result = await db.aggregate<Order>('orders', pipeline);

    if (!result.success) {
      throw new Error(result.error || 'Failed to generate delivery report');
    }

    const orders = result.data || [];

    // Group results by delivery date for better organization
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const groupedByDate: any = {};

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    orders.forEach((order: any) => {
      const deliveryDate = new Date(order.deliveryDate);
      const dateKey = deliveryDate.toISOString().split('T')[0]; // YYYY-MM-DD format

      if (!groupedByDate[dateKey]) {
        groupedByDate[dateKey] = {
          deliveryDate: dateKey,
          orders: [],
          summary: {
            totalOrders: 0,
            totalItems: 0,
            totalRevenue: 0,
          },
        };
      }

      // Count items in this order
      const itemCount = order.items?.reduce((sum: number, item: any) => sum + (item.quantity || 0), 0) || 0;

      groupedByDate[dateKey].orders.push({
        orderId: order.orderId,
        orderDate: order.orderDate,
        customerInfo: order.customerInfo,
        address: order.address,
        allOrderDays: order.allOrderDays,
        items: order.items,
        deliveryDay: order.deliveryDay,
        status: order.status,
        paymentStatus: order.paymentStatus,
        paymentMethod: order.paymentMethod,
        subtotal: order.subtotal,
        deliveryFee: order.deliveryFee,
        tip: order.tip,
        totalPaid: order.totalPaid,
        refundedAmount: order.refundedAmount,
        deliveryMessages: order.deliveryMessages,
      });

      groupedByDate[dateKey].summary.totalOrders += 1;
      groupedByDate[dateKey].summary.totalItems += itemCount;
      groupedByDate[dateKey].summary.totalRevenue += order.totalPaid || 0;
    });

    // Convert to array and sort by date
    const reportData = Object.values(groupedByDate).sort((a: any, b: any) =>
      a.deliveryDate.localeCompare(b.deliveryDate)
    );

    // Calculate overall summary if multiple dates
    let overallSummary = null;
    if (reportData.length > 1) {
      overallSummary = reportData.reduce(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (acc: any, dateData: any) => {
            return {
              totalOrders: acc.totalOrders + dateData.summary.totalOrders,
              totalItems: acc.totalItems + dateData.summary.totalItems,
              totalRevenue: acc.totalRevenue + dateData.summary.totalRevenue,
            };
          },
        { totalOrders: 0, totalItems: 0, totalRevenue: 0 }
      );
    }

    return NextResponse.json({
      data: reportData.length === 1 ? reportData[0] : { dates: reportData, overallSummary },
      message: 'Delivery report generated successfully',
    });
  } catch (error) {
    console.error('Error in GET /api/admin/reports/delivery:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}
