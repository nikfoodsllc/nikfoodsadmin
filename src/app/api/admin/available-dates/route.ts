import { NextRequest, NextResponse } from 'next/server';
import { jwtHandler } from '@/lib/jwt';
import { db } from '@/lib/db';
import { ObjectId } from 'mongodb';
import { AvailableDate } from '@/types/order';

interface CreateUpdateRequest {
  date: string;
  flatCategoryEnabled: boolean;
  dayWiseCategoryEnabled: boolean;
}

interface BulkUpdateRequest {
  dates: CreateUpdateRequest[];
  startDate?: string;
  endDate?: string;
}

interface BulkDeleteRequest {
  startDate: string;
  endDate: string;
}

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
 * Validate date format (YYYY-MM-DD)
 */
function validateDateFormat(date: string): boolean {
  const regex = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;
  if (!regex.test(date)) {
    return false;
  }

  // Additional validation to ensure it's a valid date
  const dateObj = new Date(date);
  return !isNaN(dateObj.getTime());
}

/**
 * Validate date range
 */
function validateDateRange(startDate: string, endDate: string): { isValid: boolean; error?: string } {
  if (!validateDateFormat(startDate)) {
    return { isValid: false, error: 'Invalid start date format. Must be YYYY-MM-DD' };
  }

  if (!validateDateFormat(endDate)) {
    return { isValid: false, error: 'Invalid end date format. Must be YYYY-MM-DD' };
  }

  const start = new Date(startDate);
  const end = new Date(endDate);

  if (start > end) {
    return { isValid: false, error: 'Start date must be before or equal to end date' };
  }

  return { isValid: true };
}

/**
 * Validate create/update request data
 */
function validateCreateUpdateRequest(data: CreateUpdateRequest): { isValid: boolean; error?: string } {
  if (!data.date || typeof data.date !== 'string') {
    return { isValid: false, error: 'Date is required and must be a string' };
  }

  if (!validateDateFormat(data.date)) {
    return { isValid: false, error: 'Invalid date format. Must be YYYY-MM-DD' };
  }

  if (typeof data.flatCategoryEnabled !== 'boolean') {
    return { isValid: false, error: 'flatCategoryEnabled is required and must be a boolean' };
  }

  if (typeof data.dayWiseCategoryEnabled !== 'boolean') {
    return { isValid: false, error: 'dayWiseCategoryEnabled is required and must be a boolean' };
  }

  return { isValid: true };
}

/**
 * GET /api/admin/available-dates
 * Fetch available dates by date range
 */
export async function GET(request: NextRequest) {
  try {
    // Verify authentication
    const authResult = verifyAuth(request);
    if (!authResult.success) {
      return NextResponse.json({ error: authResult.error }, { status: 401 });
    }

    // Get query parameters
    const { searchParams } = new URL(request.url);
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');

    // Build query
    const query: Record<string, unknown> = {};

    if (startDate && endDate) {
      // Validate date range
      const rangeValidation = validateDateRange(startDate, endDate);
      if (!rangeValidation.isValid) {
        return NextResponse.json({ error: rangeValidation.error }, { status: 400 });
      }

      query.date = {
        $gte: startDate,
        $lte: endDate
      };
    } else if (startDate) {
      if (!validateDateFormat(startDate)) {
        return NextResponse.json(
          { error: 'Invalid startDate format. Must be YYYY-MM-DD' },
          { status: 400 }
        );
      }
      query.date = { $gte: startDate };
    } else if (endDate) {
      if (!validateDateFormat(endDate)) {
        return NextResponse.json(
          { error: 'Invalid endDate format. Must be YYYY-MM-DD' },
          { status: 400 }
        );
      }
      query.date = { $lte: endDate };
    }

    // Fetch dates
    const result = await db.read<AvailableDate>('availableDates', query, {
      sort: { date: 1 }
    });

    if (!result.success) {
      throw new Error(result.error || 'Failed to fetch available dates');
    }

    const dates = result.data || [];

    const responseData = dates.map(date => ({
      id: date._id?.toString(),
      date: date.date,
      flatCategoryEnabled: date.flatCategoryEnabled,
      dayWiseCategoryEnabled: date.dayWiseCategoryEnabled,
      createdAt: date.createdAt,
      updatedAt: date.updatedAt
    }));

    return NextResponse.json({
      data: responseData,
      message: 'Available dates fetched successfully',
    });

  } catch (error) {
    console.error('Error in GET /api/admin/available-dates:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/admin/available-dates
 * Create or upsert a single date
 */
export async function POST(request: NextRequest) {
  try {
    // Verify authentication
    const authResult = verifyAuth(request);
    if (!authResult.success) {
      return NextResponse.json({ error: authResult.error }, { status: 401 });
    }

    // Parse request body
    const body = await request.json();

    // Validate request data
    const validation = validateCreateUpdateRequest(body);
    if (!validation.isValid) {
      return NextResponse.json({ error: validation.error }, { status: 400 });
    }

    const { date, flatCategoryEnabled, dayWiseCategoryEnabled } = body;

    // Check if date already exists
    const existingResult = await db.readOne<AvailableDate>('availableDates', { date });

    if (!existingResult.success) {
      return NextResponse.json(
        { error: `Database error: ${existingResult.error}` },
        { status: 500 }
      );
    }

    const now = new Date();

    if (!existingResult.data) {
      // Create new date entry
      const newDateData: AvailableDate = {
        date,
        flatCategoryEnabled,
        dayWiseCategoryEnabled,
        createdAt: now,
        updatedAt: now
      };

      const createResult = await db.create<AvailableDate>('availableDates', newDateData);

      if (!createResult.success) {
        // Check for duplicate key error (date already exists)
        if (createResult.error?.includes('duplicate key')) {
          return NextResponse.json(
            { error: 'Date already exists' },
            { status: 409 }
          );
        }
        throw new Error(createResult.error || 'Failed to create new date');
      }

      // Fetch the created date to return complete data
      const createdDate = await db.readOne<AvailableDate>('availableDates', {
        _id: new ObjectId(createResult.id)
      });

      if (!createdDate.success || !createdDate.data) {
        throw new Error('Failed to fetch created date data');
      }

      return NextResponse.json({
        data: {
          id: createdDate.data._id?.toString(),
          date: createdDate.data.date,
          flatCategoryEnabled: createdDate.data.flatCategoryEnabled,
          dayWiseCategoryEnabled: createdDate.data.dayWiseCategoryEnabled,
          createdAt: createdDate.data.createdAt,
          updatedAt: createdDate.data.updatedAt
        },
        message: 'Date created successfully',
      }, { status: 201 });
    }

    // Update existing date
    const updateData: Partial<AvailableDate> = {
      flatCategoryEnabled,
      dayWiseCategoryEnabled,
      updatedAt: now
    };

    const updateResult = await db.updateOne<AvailableDate>(
      'availableDates',
      { _id: existingResult.data._id },
      { $set: updateData }
    );

    if (!updateResult.success) {
      throw new Error(updateResult.error || 'Failed to update date');
    }

    // Fetch updated date
    const updatedDate = await db.readOne<AvailableDate>('availableDates', {
      _id: existingResult.data._id
    });

    return NextResponse.json({
      data: {
        id: updatedDate.data?._id?.toString(),
        date: updatedDate.data?.date,
        flatCategoryEnabled: updatedDate.data?.flatCategoryEnabled,
        dayWiseCategoryEnabled: updatedDate.data?.dayWiseCategoryEnabled,
        createdAt: updatedDate.data?.createdAt,
        updatedAt: updatedDate.data?.updatedAt
      },
      message: 'Date updated successfully',
    });

  } catch (error) {
    console.error('Error in POST /api/admin/available-dates:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/admin/available-dates
 * Bulk update - delete all in range + insert new
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
    const { dates, startDate, endDate } = body as BulkUpdateRequest;

    // Validate dates array
    if (!dates || !Array.isArray(dates) || dates.length === 0) {
      return NextResponse.json(
        { error: 'Dates array is required and must not be empty' },
        { status: 400 }
      );
    }

    // Validate each date in the array
    for (const dateData of dates) {
      const validation = validateCreateUpdateRequest(dateData);
      if (!validation.isValid) {
        return NextResponse.json(
          { error: `Invalid data for date ${dateData.date}: ${validation.error}` },
          { status: 400 }
        );
      }
    }

    // Check for duplicate dates in the request
    const dateStrings = dates.map(d => d.date);
    const uniqueDates = new Set(dateStrings);
    if (dateStrings.length !== uniqueDates.size) {
      return NextResponse.json(
        { error: 'Duplicate dates found in request' },
        { status: 400 }
      );
    }

    const now = new Date();
    let deletedCount = 0;
    let createdCount = 0;
    const errors: string[] = [];

    // If date range is provided, delete all dates in that range first
    if (startDate && endDate) {
      const rangeValidation = validateDateRange(startDate, endDate);
      if (!rangeValidation.isValid) {
        return NextResponse.json({ error: rangeValidation.error }, { status: 400 });
      }

      const deleteResult = await db.delete<AvailableDate>('availableDates', {
        date: {
          $gte: startDate,
          $lte: endDate
        }
      });

      if (deleteResult.success) {
        deletedCount = deleteResult.deletedCount || 0;
      }
    }

    // Insert all new dates
    const datesToInsert: AvailableDate[] = dates.map(dateData => ({
      date: dateData.date,
      flatCategoryEnabled: dateData.flatCategoryEnabled,
      dayWiseCategoryEnabled: dateData.dayWiseCategoryEnabled,
      createdAt: now,
      updatedAt: now
    }));

    const insertResult = await db.createMany<AvailableDate>('availableDates', datesToInsert);

    if (insertResult.success && insertResult.ids) {
      createdCount = insertResult.ids.length;
    } else {
      errors.push(insertResult.error || 'Failed to insert dates');
    }

    // Fetch all inserted dates to return complete data
    const insertedDates = await db.read<AvailableDate>('availableDates', {
      date: { $in: dates.map(d => d.date) }
    });

    const responseData = insertedDates.data?.map(date => ({
      id: date._id?.toString(),
      date: date.date,
      flatCategoryEnabled: date.flatCategoryEnabled,
      dayWiseCategoryEnabled: date.dayWiseCategoryEnabled,
      createdAt: date.createdAt,
      updatedAt: date.updatedAt
    })) || [];

    return NextResponse.json({
      data: {
        updated: responseData,
        deletedCount,
        createdCount,
        errors: errors.length > 0 ? errors : undefined
      },
      message: `Bulk update completed. ${deletedCount} deleted, ${createdCount} created${errors.length > 0 ? `, ${errors.length} errors` : ''}`,
    });

  } catch (error) {
    console.error('Error in PUT /api/admin/available-dates:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/admin/available-dates
 * Delete dates by date range
 */
export async function DELETE(request: NextRequest) {
  try {
    // Verify authentication
    const authResult = verifyAuth(request);
    if (!authResult.success) {
      return NextResponse.json({ error: authResult.error }, { status: 401 });
    }

    // Get query parameters
    const { searchParams } = new URL(request.url);
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');

    if (!startDate || !endDate) {
      return NextResponse.json(
        { error: 'Both startDate and endDate query parameters are required' },
        { status: 400 }
      );
    }

    // Validate date range
    const rangeValidation = validateDateRange(startDate, endDate);
    if (!rangeValidation.isValid) {
      return NextResponse.json({ error: rangeValidation.error }, { status: 400 });
    }

    // Delete dates in range
    const deleteResult = await db.delete<AvailableDate>('availableDates', {
      date: {
        $gte: startDate,
        $lte: endDate
      }
    });

    if (!deleteResult.success) {
      throw new Error(deleteResult.error || 'Failed to delete dates');
    }

    return NextResponse.json({
      data: {
        deletedCount: deleteResult.deletedCount || 0,
        startDate,
        endDate
      },
      message: `${deleteResult.deletedCount || 0} date(s) deleted successfully`,
    });

  } catch (error) {
    console.error('Error in DELETE /api/admin/available-dates:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}
