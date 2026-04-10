import { NextRequest, NextResponse } from 'next/server';
import { jwtHandler } from '@/lib/jwt';
import { db } from '@/lib/db';

/**
 * Validates if a string is a valid ISO date string
 */
function isValidISODateString(dateString: string): boolean {
  if (!dateString || typeof dateString !== 'string') {
    return false;
  }

  // Check for valid ISO 8601 format
  const isoDateRegex = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{3})?Z?$/;
  if (!isoDateRegex.test(dateString)) {
    return false;
  }

  const date = new Date(dateString);
  return !isNaN(date.getTime()) && dateString === date.toISOString();
}

/**
 * Validates if a Date object is valid
 */
function isValidDate(date: Date): boolean {
  return date instanceof Date && !isNaN(date.getTime());
}

/**
 * Validates date range logic
 */
function isValidDateRange(startDate: Date, endDate: Date): boolean {
  return isValidDate(startDate) && isValidDate(endDate) && startDate <= endDate;
}

/**
 * Creates a validated date from input string with fallback
 */
function createValidDate(dateString: string, fallback: Date): Date {
  if (!dateString) {
    console.log('⚠️ Date parameter missing, using fallback');
    return fallback;
  }

  // Trim whitespace from input
  const trimmedDate = dateString.trim();

  const date = new Date(trimmedDate);
  if (!isValidDate(date)) {
    console.log(`⚠️ Invalid date parameter: "${dateString}", using fallback`);
    return fallback;
  }

  // Additional validation: check for reasonable date ranges
  const currentYear = new Date().getFullYear();
  const dateYear = date.getFullYear();

  // Reject dates that are too far in the past or future
  if (dateYear < 2000 || dateYear > currentYear + 10) {
    console.log(`⚠️ Date parameter out of reasonable range: "${dateString}" (year: ${dateYear}), using fallback`);
    return fallback;
  }

  return date;
}

/**
 * Error response for invalid date parameters
 */
function createDateValidationError(message: string): NextResponse {
  return NextResponse.json(
    {
      error: 'Invalid date parameters',
      details: message,
      hint: 'Please provide valid ISO 8601 date strings (e.g., "2024-01-01T00:00:00.000Z")',
    },
    { status: 400 }
  );
}

interface TopItem {
  itemId: string;
  itemName: string;
  totalOrders: number;
  totalQuantity: number;
  revenue: number;
}

interface StatusBreakdown {
  pending: number;
  confirmed: number;
  preparing: number;
  ready: number;
  out_for_delivery: number;
  delivered: number;
  cancelled: number;
}

interface PaymentMethodBreakdown {
  creditCard: {
    count: number;
    revenue: number;
  };
  cashOnDelivery: {
    count: number;
    revenue: number;
  };
}

interface AdminStats {
  // Existing metrics
  totalOrders: number;
  completedOrders: number;
  upcomingOrders: number;
  totalOrdersChange: number;
  completedOrdersChange: number;
  revenueChange: number;
  revenueInRange: number;
  todayRevenue: number;
  monthlyRevenue: number;
  totalRevenue: number;
  totalFoodItems: number;
  totalCategories: number;

  // New metrics
  averageOrderValue: number;
  averageOrderValueChange: number;
  statusBreakdown: StatusBreakdown;
  topSellingItems: TopItem[];
  newCustomers: number;
  paymentMethodBreakdown: PaymentMethodBreakdown;
  activeFoodItems: number;

  dateRange: {
    startDate: string;
    endDate: string;
    usedFallback: boolean;
  };
  lastUpdated: string;
}

/**
 * GET /api/admin/stats
 * Fetch admin dashboard statistics with optimized aggregation pipelines
 * Query params: startDate, endDate (optional)
 */
export async function GET(request: NextRequest) {
  const startTime = Date.now();

  try {
    // Extract and verify JWT token
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Missing or invalid authorization header' }, { status: 401 });
    }

    const token = authHeader.substring(7);
    const verificationResult = jwtHandler.verifyToken(token);

    if (!verificationResult.success || !verificationResult.payload) {
      return NextResponse.json({ error: verificationResult.error || 'Invalid token' }, { status: 401 });
    }

    // Check if user is admin
    if (verificationResult.payload.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized: Admin access required' }, { status: 403 });
    }

    // Parse date range from query params with validation
    const searchParams = request.nextUrl.searchParams;
    const startDateParam = searchParams.get('startDate');
    const endDateParam = searchParams.get('endDate');

    // Define default fallback dates
    const now = new Date();
    const defaultStartDate = new Date(now.getFullYear(), now.getMonth(), 1); // First day of current month
    const defaultEndDate = now; // Current date and time

    console.log('📅 Date parameters received:', { startDateParam, endDateParam });

    // Validate and sanitize date parameters
    let startDate: Date;
    let endDate: Date;
    let usedFallback = false;

    // Handle start date
    if (startDateParam) {
      // Validate format if provided
      if (!isValidISODateString(startDateParam)) {
        console.log(`⚠️ Invalid startDate format: "${startDateParam}"`);
        startDate = defaultStartDate;
        usedFallback = true;
      } else {
        startDate = createValidDate(startDateParam, defaultStartDate);
        if (startDate.getTime() === defaultStartDate.getTime()) {
          usedFallback = true;
        }
      }
    } else {
      startDate = defaultStartDate;
      console.log('ℹ️ No startDate provided, using default (first day of current month)');
    }

    // Handle end date
    if (endDateParam) {
      // Validate format if provided
      if (!isValidISODateString(endDateParam)) {
        console.log(`⚠️ Invalid endDate format: "${endDateParam}"`);
        endDate = defaultEndDate;
        usedFallback = true;
      } else {
        endDate = createValidDate(endDateParam, defaultEndDate);
        if (endDate.getTime() === defaultEndDate.getTime() && endDateParam) {
          usedFallback = true;
        }
      }
    } else {
      endDate = defaultEndDate;
      console.log('ℹ️ No endDate provided, using default (current date)');
    }

    // Validate date range logic
    if (!isValidDateRange(startDate, endDate)) {
      console.log(`❌ Invalid date range: startDate (${startDate.toISOString()}) is after endDate (${endDate.toISOString()})`);
      return createDateValidationError('Start date must be before or equal to end date');
    }

    // Validate date range size to prevent performance issues
    const daysDifference = (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24);
    if (daysDifference > 365 * 2) { // More than 2 years
      console.log(`❌ Date range too large: ${Math.round(daysDifference)} days, max allowed is 730 days (2 years)`);
      return createDateValidationError('Date range cannot exceed 2 years for performance reasons');
    }

    // Log the final date range being used
    console.log('📊 Date range for stats:', {
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString(),
      usedFallback,
      originalParams: { startDateParam, endDateParam }
    });

    // Get current date boundaries
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const currentMonthStart = new Date(today.getFullYear(), today.getMonth(), 1);
    const nextMonthStart = new Date(today.getFullYear(), today.getMonth() + 1, 1);

    // Calculate previous period for comparison
    const periodDuration = endDate.getTime() - startDate.getTime();
    const previousStartDate = new Date(startDate.getTime() - periodDuration);
    const previousEndDate = new Date(startDate.getTime());

    try {
      // ============ PLATFORM STATISTICS ============
      const foodItemsResult = await db.count('fooditems', {});
      const categoriesResult = await db.count('foodcategories', {});
      const activeFoodItemsResult = await db.count('fooditems', { available: true });

      const totalFoodItems = foodItemsResult.success ? foodItemsResult.count || 0 : 0;
      const totalCategories = categoriesResult.success ? categoriesResult.count || 0 : 0;
      const activeFoodItems = activeFoodItemsResult.success ? activeFoodItemsResult.count || 0 : 0;

      // ============ ORDER COUNTS (using existing count method) ============
      const [
        ordersInRangeResult,
        completedOrdersResult,
        upcomingOrdersResult,
        previousOrdersResult,
        previousCompletedResult,
      ] = await Promise.all([
        db.count('orders', { createdAt: { $gte: startDate, $lte: endDate } }),
        db.count('orders', { createdAt: { $gte: startDate, $lte: endDate }, status: 'delivered' }),
        db.count('orders', { createdAt: { $gte: startDate, $lte: endDate }, status: { $in: ['pending', 'confirmed', 'preparing'] } }),
        db.count('orders', { createdAt: { $gte: previousStartDate, $lt: previousEndDate } }),
        db.count('orders', { createdAt: { $gte: previousStartDate, $lt: previousEndDate }, status: 'delivered' }),
      ]);

      const totalOrders = ordersInRangeResult.success ? ordersInRangeResult.count || 0 : 0;
      const completedOrders = completedOrdersResult.success ? completedOrdersResult.count || 0 : 0;
      const upcomingOrders = upcomingOrdersResult.success ? upcomingOrdersResult.count || 0 : 0;
      const previousOrders = previousOrdersResult.success ? previousOrdersResult.count || 0 : 0;
      const previousCompleted = previousCompletedResult.success ? previousCompletedResult.count || 0 : 0;

      // ============ REVENUE CALCULATIONS (using aggregation) ============
      // Current period revenue
      const revenueAggResult = await db.aggregate('orders', [
        {
          $match: {
            createdAt: { $gte: startDate, $lte: endDate },
            status: { $ne: 'cancelled' },
          },
        },
        {
          $group: {
            _id: null,
            totalRevenue: { $sum: '$totalPaid' },
            orderCount: { $sum: 1 },
          },
        },
      ]);

      const revenueInRange = revenueAggResult.success && revenueAggResult.data && revenueAggResult.data.length > 0
        ? revenueAggResult.data[0].totalRevenue || 0
        : 0;
      const ordersForAvg = revenueAggResult.success && revenueAggResult.data && revenueAggResult.data.length > 0
        ? revenueAggResult.data[0].orderCount || 0
        : 0;

      // Previous period revenue
      const previousRevenueAggResult = await db.aggregate('orders', [
        {
          $match: {
            createdAt: { $gte: previousStartDate, $lt: previousEndDate },
            status: { $ne: 'cancelled' },
          },
        },
        {
          $group: {
            _id: null,
            totalRevenue: { $sum: '$totalPaid' },
            orderCount: { $sum: 1 },
          },
        },
      ]);

      const previousRevenue = previousRevenueAggResult.success && previousRevenueAggResult.data && previousRevenueAggResult.data.length > 0
        ? previousRevenueAggResult.data[0].totalRevenue || 0
        : 0;
      const previousOrdersForAvg = previousRevenueAggResult.success && previousRevenueAggResult.data && previousRevenueAggResult.data.length > 0
        ? previousRevenueAggResult.data[0].orderCount || 0
        : 0;

      // Today's revenue
      const todayRevenueAggResult = await db.aggregate('orders', [
        {
          $match: {
            createdAt: { $gte: today, $lt: tomorrow },
            status: { $ne: 'cancelled' },
          },
        },
        {
          $group: {
            _id: null,
            totalRevenue: { $sum: '$totalPaid' },
          },
        },
      ]);

      const todayRevenue = todayRevenueAggResult.success && todayRevenueAggResult.data && todayRevenueAggResult.data.length > 0
        ? todayRevenueAggResult.data[0].totalRevenue || 0
        : 0;

      // Monthly revenue
      const monthlyRevenueAggResult = await db.aggregate('orders', [
        {
          $match: {
            createdAt: { $gte: currentMonthStart, $lt: nextMonthStart },
            status: { $ne: 'cancelled' },
          },
        },
        {
          $group: {
            _id: null,
            totalRevenue: { $sum: '$totalPaid' },
          },
        },
      ]);

      const monthlyRevenue = monthlyRevenueAggResult.success && monthlyRevenueAggResult.data && monthlyRevenueAggResult.data.length > 0
        ? monthlyRevenueAggResult.data[0].totalRevenue || 0
        : 0;

      // Total revenue (all time)
      const totalRevenueAggResult = await db.aggregate('orders', [
        {
          $match: {
            status: { $ne: 'cancelled' },
          },
        },
        {
          $group: {
            _id: null,
            totalRevenue: { $sum: '$totalPaid' },
          },
        },
      ]);

      const totalRevenue = totalRevenueAggResult.success && totalRevenueAggResult.data && totalRevenueAggResult.data.length > 0
        ? totalRevenueAggResult.data[0].totalRevenue || 0
        : 0;

      // ============ AVERAGE ORDER VALUE ============
      const averageOrderValue = ordersForAvg > 0 ? revenueInRange / ordersForAvg : 0;
      const previousAverageOrderValue = previousOrdersForAvg > 0 ? previousRevenue / previousOrdersForAvg : 0;

      // ============ STATUS BREAKDOWN ============
      const statusAggResult = await db.aggregate('orders', [
        {
          $match: {
            createdAt: { $gte: startDate, $lte: endDate },
          },
        },
        {
          $group: {
            _id: '$status',
            count: { $sum: 1 },
          },
        },
      ]);

      const statusBreakdown: StatusBreakdown = {
        pending: 0,
        confirmed: 0,
        preparing: 0,
        ready: 0,
        out_for_delivery: 0,
        delivered: 0,
        cancelled: 0,
      };

      if (statusAggResult.success && statusAggResult.data) {
        (statusAggResult.data as Array<{ _id: string; count: number }>).forEach((item) => {
          const status = item._id as keyof StatusBreakdown;
          if (status in statusBreakdown) {
            statusBreakdown[status] = item.count;
          }
        });
      }

      // ============ TOP SELLING ITEMS ============
      const topItemsAggResult = await db.aggregate('orders', [
        {
          $match: {
            createdAt: { $gte: startDate, $lte: endDate },
            status: { $ne: 'cancelled' },
          },
        },
        { $unwind: '$items' },
        { $unwind: '$items.items' },
        {
          $group: {
            _id: {
              itemId: '$items.items.food._id',
              itemName: '$items.items.food.name',
            },
            totalOrders: { $sum: 1 },
            totalQuantity: { $sum: '$items.items.quantity' },
            revenue: { $sum: { $multiply: ['$items.items.price', '$items.items.quantity'] } },
          },
        },
        { $sort: { totalQuantity: -1 } },
        { $limit: 10 },
      ]);

      const topSellingItems: TopItem[] = topItemsAggResult.success && topItemsAggResult.data
        ? (topItemsAggResult.data as Array<{ _id: { itemId: string; itemName: string }; totalOrders: number; totalQuantity: number; revenue: number }>).map((item) => ({
            itemId: item._id.itemId,
            itemName: item._id.itemName,
            totalOrders: item.totalOrders,
            totalQuantity: item.totalQuantity,
            revenue: item.revenue,
          }))
        : [];

      // ============ NEW CUSTOMERS ============
      const newCustomersAggResult = await db.aggregate('orders', [
        {
          $group: {
            _id: '$user',
            firstOrderDate: { $min: '$createdAt' },
          },
        },
        {
          $match: {
            firstOrderDate: { $gte: startDate, $lte: endDate },
          },
        },
        {
          $count: 'newCustomers',
        },
      ]);

      const newCustomers = newCustomersAggResult.success && newCustomersAggResult.data && newCustomersAggResult.data.length > 0
        ? newCustomersAggResult.data[0].newCustomers || 0
        : 0;

      // ============ PAYMENT METHOD BREAKDOWN ============
      const paymentMethodAggResult = await db.aggregate('orders', [
        {
          $match: {
            createdAt: { $gte: startDate, $lte: endDate },
            status: { $ne: 'cancelled' },
          },
        },
        {
          $group: {
            _id: '$paymentMethod',
            count: { $sum: 1 },
            revenue: { $sum: '$totalPaid' },
          },
        },
      ]);

      const paymentMethodBreakdown: PaymentMethodBreakdown = {
        creditCard: { count: 0, revenue: 0 },
        cashOnDelivery: { count: 0, revenue: 0 },
      };

      if (paymentMethodAggResult.success && paymentMethodAggResult.data) {
        (paymentMethodAggResult.data as Array<{ _id: string; count: number; revenue: number }>).forEach((item) => {
          if (item._id === 'Credit Card') {
            paymentMethodBreakdown.creditCard = {
              count: item.count,
              revenue: item.revenue,
            };
          } else if (item._id === 'Cash on Delivery') {
            paymentMethodBreakdown.cashOnDelivery = {
              count: item.count,
              revenue: item.revenue,
            };
          }
        });
      }

      // ============ CALCULATE PERCENTAGE CHANGES ============
      const totalOrdersChange = previousOrders > 0 ? ((totalOrders - previousOrders) / previousOrders) * 100 : 0;
      const completedOrdersChange = previousCompleted > 0 ? ((completedOrders - previousCompleted) / previousCompleted) * 100 : 0;
      const revenueChange = previousRevenue > 0 ? ((revenueInRange - previousRevenue) / previousRevenue) * 100 : 0;
      const averageOrderValueChange = previousAverageOrderValue > 0
        ? ((averageOrderValue - previousAverageOrderValue) / previousAverageOrderValue) * 100
        : 0;

      // ============ PREPARE RESPONSE ============
      const stats: AdminStats = {
        // Existing metrics
        totalOrders,
        completedOrders,
        upcomingOrders,
        totalOrdersChange: Math.round(totalOrdersChange * 10) / 10,
        completedOrdersChange: Math.round(completedOrdersChange * 10) / 10,
        revenueChange: Math.round(revenueChange * 10) / 10,
        revenueInRange: Math.round(revenueInRange * 100) / 100,
        todayRevenue: Math.round(todayRevenue * 100) / 100,
        monthlyRevenue: Math.round(monthlyRevenue * 100) / 100,
        totalRevenue: Math.round(totalRevenue * 100) / 100,
        totalFoodItems,
        totalCategories,

        // New metrics
        averageOrderValue: Math.round(averageOrderValue * 100) / 100,
        averageOrderValueChange: Math.round(averageOrderValueChange * 10) / 10,
        statusBreakdown,
        topSellingItems,
        newCustomers,
        paymentMethodBreakdown,
        activeFoodItems,

        dateRange: {
          startDate: startDate.toISOString(),
          endDate: endDate.toISOString(),
          usedFallback,
        },
        lastUpdated: new Date().toISOString(),
      };

      const executionTime = Date.now() - startTime;
      console.log(`✅ Admin stats fetched in ${executionTime}ms`);

      return NextResponse.json(stats, { status: 200 });
    } catch (dbError) {
      console.error('❌ Database error in /api/admin/stats:', dbError);
      return NextResponse.json(
        {
          error: 'Database error occurred while fetching statistics',
          details: dbError instanceof Error ? dbError.message : 'Unknown database error',
        },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error('❌ Error in /api/admin/stats:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}
