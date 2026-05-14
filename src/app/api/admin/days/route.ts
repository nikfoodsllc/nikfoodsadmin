import { NextRequest, NextResponse } from 'next/server';
import { jwtHandler } from '@/lib/jwt';
import { db } from '@/lib/db';
import { ObjectId } from 'mongodb';

interface AvailableDay {
  _id?: ObjectId | string;
  day: string;
  enabled: boolean;
  sequence: number;
  label: string;
  createdAt?: Date;
  updatedAt?: Date;
}

interface UpdateDayRequest {
  day: string;
  enabled: boolean;
  sequence: number;
  label?: string;
}

interface BulkUpdateRequest {
  days: UpdateDayRequest[];
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
 * Validate day name
 */
function validateDayName(day: string): boolean {
  const validDays = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
  return validDays.includes(day.toLowerCase());
}

/**
 * Validate update request data
 */
function validateUpdateRequest(data: UpdateDayRequest): { isValid: boolean; error?: string } {
  if (!data.day || typeof data.day !== 'string') {
    return { isValid: false, error: 'Day is required and must be a string' };
  }

  if (!validateDayName(data.day)) {
    return { isValid: false, error: 'Invalid day name. Must be one of: monday, tuesday, wednesday, thursday, friday, saturday, sunday' };
  }

  if (typeof data.enabled !== 'boolean') {
    return { isValid: false, error: 'Enabled field is required and must be a boolean' };
  }

  if (typeof data.sequence !== 'number' || data.sequence < 1 || data.sequence > 7) {
    return { isValid: false, error: 'Sequence is required and must be a number between 1 and 7' };
  }

  if (data.label !== undefined && data.label !== null) {
    if (typeof data.label !== 'string') {
      return { isValid: false, error: 'Label must be a string' };
    }
    if (data.label.trim().length === 0) {
      return { isValid: false, error: 'Label cannot be empty' };
    }
    if (data.label.trim().length > 20) {
      return { isValid: false, error: 'Label must be 20 characters or less' };
    }
  }

  return { isValid: true };
}

/**
 * GET /api/admin/days
 * Get all available days
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
    const enabledOnly = searchParams.get('enabledOnly') === 'true';

    // Build query
    const query: Record<string, unknown> = {};
    if (enabledOnly) {
      query.enabled = true;
    }

    // Fetch days
    const result = await db.read<AvailableDay>('availableDays', query, {
      sort: { sequence: 1 }
    });

    if (!result.success) {
      throw new Error(result.error || 'Failed to fetch available days');
    }

    const days = result.data || [];

    const responseData = days.map(day => ({
      id: day._id?.toString(),
      day: day.day,
      label: day.label,
      enabled: day.enabled,
      sequence: day.sequence,
      createdAt: day.createdAt,
      updatedAt: day.updatedAt
    }));

    return NextResponse.json({
      data: responseData,
      message: 'Available days fetched successfully',
    });

  } catch (error) {
    console.error('Error in GET /api/admin/days:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/admin/days
 * Update available days (supports both single and bulk updates)
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

    // Handle single day update
    if (body.day !== undefined) {
      const { day, enabled, sequence, label } = body;

      // Validate request data
      const validation = validateUpdateRequest({ day, enabled, sequence, label });
      if (!validation.isValid) {
        return NextResponse.json({ error: validation.error }, { status: 400 });
      }

      // Find existing day with case-insensitive query
      const searchQuery = { day: { $regex: `^${day.toLowerCase()}$`, $options: 'i' } };
      const existingResult = await db.readOne<AvailableDay>('availableDays', searchQuery);

      if (!existingResult.success) {
        return NextResponse.json({ error: `Database error: ${existingResult.error}` }, { status: 500 });
      }

      if (!existingResult.data) {
        // Create new day data
        const newDayData: AvailableDay = {
          day: day.toLowerCase(),
          enabled,
          sequence,
          label: label !== undefined && label !== null ? label.trim() : '',
          createdAt: new Date(),
          updatedAt: new Date()
        };

        // Insert new day
        const createResult = await db.create<AvailableDay>('availableDays', newDayData);

        if (!createResult.success) {
          throw new Error(createResult.error || 'Failed to create new day');
        }

        // Fetch the created day to return complete data
        const createdDay = await db.readOne<AvailableDay>('availableDays', {
          _id: createResult.id
        });

        if (!createdDay.success || !createdDay.data) {
          throw new Error('Failed to fetch created day data');
        }

        return NextResponse.json({
          data: {
            id: createdDay.data._id?.toString(),
            day: createdDay.data.day,
            label: createdDay.data.label,
            enabled: createdDay.data.enabled,
            sequence: createdDay.data.sequence,
            createdAt: createdDay.data.createdAt,
            updatedAt: createdDay.data.updatedAt
          },
          message: 'Day created successfully',
        });
      }

      // Prepare update data
      const updateData: Partial<AvailableDay> = {
        enabled,
        sequence,
        updatedAt: new Date()
      };

      if (label !== undefined && label !== null) {
        updateData.label = label.trim();
      }

      // Update day
      const updateResult = await db.updateOne<AvailableDay>(
        'availableDays',
        { _id: existingResult.data._id },
        { $set: updateData }
      );

      if (!updateResult.success) {
        throw new Error(updateResult.error || 'Failed to update day');
      }

      // Fetch updated day
      const updatedDay = await db.readOne<AvailableDay>('availableDays', {
        _id: existingResult.data._id
      });

      return NextResponse.json({
        data: {
          id: updatedDay.data?._id?.toString(),
          day: updatedDay.data?.day,
          label: updatedDay.data?.label,
          enabled: updatedDay.data?.enabled,
          sequence: updatedDay.data?.sequence,
          createdAt: updatedDay.data?.createdAt,
          updatedAt: updatedDay.data?.updatedAt
        },
        message: 'Day updated successfully',
      });
    }

    // Handle bulk update
    else if (body.days && Array.isArray(body.days)) {
      const { days } = body as BulkUpdateRequest;

      if (days.length === 0) {
        return NextResponse.json({ error: 'At least one day must be provided for bulk update' }, { status: 400 });
      }

      // Validate all days
      for (const dayUpdate of days) {
        const validation = validateUpdateRequest(dayUpdate);
        if (!validation.isValid) {
          return NextResponse.json({
            error: `Invalid data for day ${dayUpdate.day}: ${validation.error}`
          }, { status: 400 });
        }
      }

      // Check for duplicate sequences
      const sequences = days.map(d => d.sequence);
      const uniqueSequences = [...new Set(sequences)];
      if (sequences.length !== uniqueSequences.length) {
        return NextResponse.json({
          error: 'Duplicate sequence values are not allowed'
        }, { status: 400 });
      }

      const updatedDays: AvailableDay[] = [];
      const failedUpdates: Array<{ day: string; error: string }> = [];

      // Update each day
      for (const dayUpdate of days) {
        try {
          // Find existing day with case-insensitive query
          const searchQuery = { day: { $regex: `^${dayUpdate.day.toLowerCase()}$`, $options: 'i' } };
          const existingResult = await db.readOne<AvailableDay>('availableDays', searchQuery);

          if (!existingResult.success) {
            failedUpdates.push({
              day: dayUpdate.day,
              error: `Database error: ${existingResult.error}`
            });
            continue;
          }

          if (!existingResult.data) {
            // Create new day data
            const newDayData: AvailableDay = {
              day: dayUpdate.day.toLowerCase(),
              enabled: dayUpdate.enabled,
              sequence: dayUpdate.sequence,
              label: dayUpdate.label !== undefined && dayUpdate.label !== null ? dayUpdate.label.trim() : '',
              createdAt: new Date(),
              updatedAt: new Date()
            };

            // Insert new day
            const createResult = await db.create<AvailableDay>('availableDays', newDayData);

            if (!createResult.success) {
              failedUpdates.push({
                day: dayUpdate.day,
                error: createResult.error || 'Failed to create new day'
              });
              continue;
            }

            // Fetch the created day to add to updatedDays
            const createdDay = await db.readOne<AvailableDay>('availableDays', {
              _id: createResult.id
            });

            if (createdDay.success && createdDay.data) {
              updatedDays.push(createdDay.data);
            } else {
              failedUpdates.push({
                day: dayUpdate.day,
                error: 'Failed to fetch created day data'
              });
            }
            continue;
          }

          // Prepare update data
          const updateData: Partial<AvailableDay> = {
            enabled: dayUpdate.enabled,
            sequence: dayUpdate.sequence,
            updatedAt: new Date()
          };

          if (dayUpdate.label !== undefined && dayUpdate.label !== null) {
            updateData.label = dayUpdate.label.trim();
          }

          // Update day
          const updateResult = await db.updateOne<AvailableDay>(
            'availableDays',
            { _id: existingResult.data._id },
            { $set: updateData }
          );

          if (!updateResult.success) {
            failedUpdates.push({
              day: dayUpdate.day,
              error: updateResult.error || 'Failed to update'
            });
            continue;
          }

          // Fetch updated day
          const updatedDay = await db.readOne<AvailableDay>('availableDays', {
            _id: existingResult.data._id
          });

          if (updatedDay.success && updatedDay.data) {
            updatedDays.push(updatedDay.data);
          } else {
            failedUpdates.push({
              day: dayUpdate.day,
              error: 'Failed to fetch updated data'
            });
          }

        } catch (error) {
          failedUpdates.push({
            day: dayUpdate.day,
            error: error instanceof Error ? error.message : 'Unknown error'
          });
        }
      }

      return NextResponse.json({
        data: {
          updated: updatedDays.map(day => ({
            id: day._id?.toString(),
            day: day.day,
            label: day.label,
            enabled: day.enabled,
            sequence: day.sequence,
            createdAt: day.createdAt,
            updatedAt: day.updatedAt
          })),
          failed: failedUpdates
        },
        message: `Bulk upsert completed. ${updatedDays.length} processed successfully, ${failedUpdates.length} failed`,
      });

    } else {
      return NextResponse.json({
        error: 'Invalid request format. Provide either a single day object or a days array for bulk update'
      }, { status: 400 });
    }

  } catch (error) {
    console.error('Error in PUT /api/admin/days:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}