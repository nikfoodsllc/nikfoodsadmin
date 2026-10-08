import { NextRequest, NextResponse } from 'next/server';
import { jwtHandler } from '@/lib/jwt';
import { db } from '@/lib/db';
import { ObjectId } from 'mongodb';
import { AvailableDate } from '@/types/order';
import { parseCutoff, validateCutoff } from '@/utils/orderCutoff';
import { invalidateLivesiteHomeMenuCacheAndWait } from '@/lib/invalidateHomeMenuCache';
import { applyLockedMenuToDates } from '@/lib/server/lockedMenu';

interface CreateUpdateRequest {
  date: string;
  flatCategoryEnabled: boolean;
  dayWiseCategoryEnabled: boolean;
  /**
   * Custom order cutoff for flat items (ISO moment). Omit to leave it unchanged; null clears it
   * (back to the standard 5 PM Pacific the day before).
   */
  flatCutoffAt?: string | null;
  /**
   * Custom order cutoff for day-wise (Food Menu) items (ISO moment). Omit to leave it unchanged; null clears it
   * (back to the standard 1 PM Pacific the day before).
   */
  dayWiseCutoffAt?: string | null;
  /** Both kinds at once (what older versions of the screen sent): sets or clears flat and day-wise together. */
  cutoffAt?: string | null;
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

/** Locked rows onto the given days; a problem here is logged and never fails the day save. */
async function applyLockedMenuSafely(days: string[]): Promise<number> {
  if (days.length === 0) return 0;
  try {
    return (await applyLockedMenuToDates(days)).added;
  } catch (error) {
    console.error('[locked-menu] could not repeat the locked rows onto', days, error);
    return 0;
  }
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

/** A date as the admin screen gets it back (all the custom cutoff fields). */
function toResponse(date: Partial<AvailableDate> | null | undefined) {
  return {
    id: date?._id?.toString(),
    date: date?.date,
    flatCategoryEnabled: date?.flatCategoryEnabled,
    dayWiseCategoryEnabled: date?.dayWiseCategoryEnabled,
    cutoffAt: date?.cutoffAt ?? null,
    flatCutoffAt: date?.flatCutoffAt ?? null,
    dayWiseCutoffAt: date?.dayWiseCutoffAt ?? null,
    flatCutoffSet: date?.flatCutoffSet ?? null,
    dayWiseCutoffSet: date?.dayWiseCutoffSet ?? null,
    createdAt: date?.createdAt,
    updatedAt: date?.updatedAt,
  };
}

/** Name of the admin who is saving (shown next to a custom cutoff so people can see who set it and when). */
async function adminName(userId: unknown): Promise<string | undefined> {
  try {
    if (typeof userId !== 'string' || !ObjectId.isValid(userId)) return undefined;
    const user = await db.readOne<{ name?: string; email?: string }>('users', { _id: new ObjectId(userId) } as never);
    return user.data?.name || user.data?.email || undefined;
  } catch {
    return undefined;
  }
}

/**
 * What to do with one kind's cutoff when a date is saved: undefined = leave it, null = clear it, a string = set it.
 * The older single `cutoffAt` in a request means "both kinds" and applies where the kind has no field of its own.
 */
function cutoffInstruction(own: string | null | undefined, both: string | null | undefined): string | null | undefined {
  return own !== undefined ? own : both;
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

  for (const field of ['cutoffAt', 'flatCutoffAt', 'dayWiseCutoffAt'] as const) {
    const value = data[field];
    if (value === undefined || value === null) continue;
    const cutoff = typeof value === 'string' ? parseCutoff(value) : null;
    if (!cutoff) {
      return { isValid: false, error: `${field} must be a valid date and time, or null to use the standard cutoff` };
    }
    const problem = validateCutoff(data.date, cutoff);
    if (problem) {
      return { isValid: false, error: problem };
    }
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

    const responseData = dates.map(toResponse);

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
    // per kind: undefined = leave the custom cutoff as it is, null = clear it, string = set it
    const flatInstruction = cutoffInstruction(body.flatCutoffAt, body.cutoffAt);
    const dayWiseInstruction = cutoffInstruction(body.dayWiseCutoffAt, body.cutoffAt);
    const cutoffTouched = flatInstruction !== undefined || dayWiseInstruction !== undefined;
    const setBy = cutoffTouched ? await adminName(authResult.userId) : undefined;

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
        ...(typeof flatInstruction === 'string' ? { flatCutoffAt: new Date(flatInstruction), flatCutoffSet: { at: now, by: setBy } } : {}),
        ...(typeof dayWiseInstruction === 'string' ? { dayWiseCutoffAt: new Date(dayWiseInstruction), dayWiseCutoffSet: { at: now, by: setBy } } : {}),
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

      // switched on for day-wise ordering: locked rows repeat onto this day (never fails the save)
      const lockedAdded = dayWiseCategoryEnabled === true ? await applyLockedMenuSafely([date]) : 0;

      return NextResponse.json({
        data: toResponse(createdDate.data),
        lockedItemsAdded: lockedAdded,
        message: 'Date created successfully',
      }, { status: 201 });
    }

    // Update existing date
    const updateData: Partial<AvailableDate> = {
      flatCategoryEnabled,
      dayWiseCategoryEnabled,
      updatedAt: now
    };
    const unsetFields: Record<string, ''> = {};
    if (cutoffTouched) {
      // The older single cutoff is replaced by the two fields: what a kind was not told to change keeps the value
      // it had (its own field, else the older single one), so nothing is lost when that single field goes.
      const legacy = parseCutoff(existingResult.data.cutoffAt);
      const resolve = (instruction: string | null | undefined, ownExisting: unknown): Date | null =>
        instruction === undefined ? parseCutoff(ownExisting) ?? legacy : instruction === null ? null : new Date(instruction);
      const flat = resolve(flatInstruction, existingResult.data.flatCutoffAt);
      const dayWise = resolve(dayWiseInstruction, existingResult.data.dayWiseCutoffAt);
      if (flat) updateData.flatCutoffAt = flat;
      else unsetFields.flatCutoffAt = '';
      if (dayWise) updateData.dayWiseCutoffAt = dayWise;
      else unsetFields.dayWiseCutoffAt = '';
      // remember when and by whom each cutoff that was just set got set; clearing a cutoff clears that note too
      if (typeof flatInstruction === 'string') updateData.flatCutoffSet = { at: now, by: setBy };
      else if (!flat) unsetFields.flatCutoffSet = '';
      if (typeof dayWiseInstruction === 'string') updateData.dayWiseCutoffSet = { at: now, by: setBy };
      else if (!dayWise) unsetFields.dayWiseCutoffSet = '';
      unsetFields.cutoffAt = '';
    }

    const updateResult = await db.updateOne<AvailableDate>(
      'availableDates',
      { _id: existingResult.data._id },
      Object.keys(unsetFields).length > 0 ? { $set: updateData, $unset: unsetFields } : { $set: updateData }
    );

    if (!updateResult.success) {
      throw new Error(updateResult.error || 'Failed to update date');
    }

    // Fetch updated date
    const updatedDate = await db.readOne<AvailableDate>('availableDates', {
      _id: existingResult.data._id
    });

    // A changed cutoff changes what customers can order: tell the customer site now and wait for its answer
    const livesiteNotified = cutoffTouched ? await invalidateLivesiteHomeMenuCacheAndWait() : undefined;

    // only when day-wise ordering has just been switched ON for this day: locked rows repeat onto it
    const justEnabled = dayWiseCategoryEnabled === true && existingResult.data.dayWiseCategoryEnabled !== true;
    const lockedAdded = justEnabled ? await applyLockedMenuSafely([date]) : 0;

    return NextResponse.json({
      data: toResponse(updatedDate.data),
      lockedItemsAdded: lockedAdded,
      livesiteNotified,
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

    // days that already had day-wise ordering on, so only days switched on now repeat the locked rows
    const alreadyOn = new Set<string>();
    const rememberDaysAlreadyOn = async () => {
      const prior = await db.read<AvailableDate>('availableDates', { date: { $in: dateStrings }, dayWiseCategoryEnabled: true });
      for (const d of prior.data ?? []) alreadyOn.add(d.date);
    };

    // Custom order cutoffs already set on dates in the range: the delete-and-reinsert below must not lose them
    const keptCutoffs = new Map<string, { cutoffAt?: Date; flatCutoffAt?: Date; dayWiseCutoffAt?: Date }>();

    // If date range is provided, delete all dates in that range first
    if (startDate && endDate) {
      const rangeValidation = validateDateRange(startDate, endDate);
      if (!rangeValidation.isValid) {
        return NextResponse.json({ error: rangeValidation.error }, { status: 400 });
      }

      const existingInRange = await db.read<AvailableDate>('availableDates', {
        date: { $gte: startDate, $lte: endDate },
        $or: [
          { cutoffAt: { $exists: true, $ne: null } },
          { flatCutoffAt: { $exists: true, $ne: null } },
          { dayWiseCutoffAt: { $exists: true, $ne: null } },
        ],
      });
      if (!existingInRange.success) {
        // without this the reinsert would silently drop custom cutoffs: stop instead
        throw new Error(existingInRange.error || 'Failed to read existing dates');
      }
      for (const existing of existingInRange.data ?? []) {
        const kept = {
          cutoffAt: parseCutoff(existing.cutoffAt) ?? undefined,
          flatCutoffAt: parseCutoff(existing.flatCutoffAt) ?? undefined,
          dayWiseCutoffAt: parseCutoff(existing.dayWiseCutoffAt) ?? undefined,
        };
        if (kept.cutoffAt || kept.flatCutoffAt || kept.dayWiseCutoffAt) keptCutoffs.set(existing.date, kept);
      }

      await rememberDaysAlreadyOn();

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

    // without a range nothing was deleted above: read the current state before the insert
    if (!(startDate && endDate)) await rememberDaysAlreadyOn();

    // Insert all new dates
    const datesToInsert: AvailableDate[] = dates.map(dateData => {
      // a cutoff sent with the date wins; otherwise the date keeps what it had
      const kept = keptCutoffs.get(dateData.date);
      const sent = (own: string | null | undefined, both: string | null | undefined) => {
        const value = own !== undefined ? own : both;
        return typeof value === 'string' ? parseCutoff(value) : null;
      };
      const flatSent = sent(dateData.flatCutoffAt, dateData.cutoffAt);
      const dayWiseSent = sent(dateData.dayWiseCutoffAt, dateData.cutoffAt);
      const anySent = [dateData.flatCutoffAt, dateData.dayWiseCutoffAt, dateData.cutoffAt].some((v) => typeof v === 'string');
      const flatCutoff = anySent ? flatSent ?? kept?.flatCutoffAt ?? kept?.cutoffAt : kept?.flatCutoffAt;
      const dayWiseCutoff = anySent ? dayWiseSent ?? kept?.dayWiseCutoffAt ?? kept?.cutoffAt : kept?.dayWiseCutoffAt;
      // an untouched date keeps the older single cutoff as it was
      const legacyCutoff = anySent ? undefined : kept?.cutoffAt;
      return {
        date: dateData.date,
        flatCategoryEnabled: dateData.flatCategoryEnabled,
        dayWiseCategoryEnabled: dateData.dayWiseCategoryEnabled,
        ...(legacyCutoff ? { cutoffAt: legacyCutoff } : {}),
        ...(flatCutoff ? { flatCutoffAt: flatCutoff } : {}),
        ...(dayWiseCutoff ? { dayWiseCutoffAt: dayWiseCutoff } : {}),
        createdAt: now,
        updatedAt: now
      };
    });

    const insertResult = await db.createMany<AvailableDate>('availableDates', datesToInsert);

    if (insertResult.success && insertResult.ids) {
      createdCount = insertResult.ids.length;
    } else {
      errors.push(insertResult.error || 'Failed to insert dates');
    }

    // days switched on for day-wise ordering by this save: locked rows repeat onto them (never fails the save)
    const lockedAdded = await applyLockedMenuSafely(dates.filter((d) => d.dayWiseCategoryEnabled === true && !alreadyOn.has(d.date)).map((d) => d.date));

    // Fetch all inserted dates to return complete data
    const insertedDates = await db.read<AvailableDate>('availableDates', {
      date: { $in: dates.map(d => d.date) }
    });

    const responseData = insertedDates.data?.map(toResponse) || [];

    return NextResponse.json({
      data: {
        updated: responseData,
        deletedCount,
        createdCount,
        lockedItemsAdded: lockedAdded,
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
