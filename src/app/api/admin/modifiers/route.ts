import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { jwtHandler } from '@/lib/jwt';
import { db } from '@/lib/db';
import { ObjectId } from 'mongodb';
import {
  FoodModifier,
  ModifierItemType,
  validateCreateModifier,
  validateUpdateModifier,
  validateModifierNameUniqueness,
  sanitizeModifierData,
} from '@/lib/validators/modifier';

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
 * GET /api/admin/modifiers
 * List food modifiers with filters and pagination
 * Query params: itemType, available, search, page (default: 1), limit (default: 10)
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
    const itemType = searchParams.get('itemType') as ModifierItemType | null;
    const available = searchParams.get('available');
    const search = searchParams.get('search') || '';
    const page = parseInt(searchParams.get('page') || '1', 10);
    const limit = parseInt(searchParams.get('limit') || '10', 10);
    const skip = (page - 1) * limit;

    // Build filter query
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const filter: any = {};

    // Filter by itemType
    if (itemType) {
      const validItemTypes: ModifierItemType[] = ['simple', 'portions', 'combo', 'all'];
      if (validItemTypes.includes(itemType)) {
        filter.itemType = itemType;
      } else {
        return NextResponse.json(
          { error: 'Invalid itemType. Must be one of: simple, portions, combo, all' },
          { status: 400 }
        );
      }
    }

    // Filter by availability
    if (available !== null) {
      filter.available = available === 'true';
    }

    // Search by name or description (case-insensitive)
    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } }
      ];
    }

    // Get total count for pagination
    const countResult = await db.count<FoodModifier>('foodmodifiers', filter);

    if (!countResult.success) {
      throw new Error(countResult.error || 'Failed to count modifiers');
    }

    const total = countResult.count || 0;

    // Fetch modifiers with pagination and sorting
    const modifiersResult = await db.read<FoodModifier>('foodmodifiers', filter, {
      skip,
      limit,
      sort: { sequence: 1, name: 1 }
    });

    if (!modifiersResult.success) {
      throw new Error(modifiersResult.error || 'Failed to fetch modifiers');
    }

    return NextResponse.json({
      data: {
        modifiers: modifiersResult.data || [],
        total,
        page,
        pageSize: limit,
        totalPages: Math.ceil(total / limit)
      },
      message: 'Food modifiers fetched successfully',
    });
  } catch (error) {
    console.error('Error in GET /api/admin/modifiers:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/admin/modifiers
 * Create new food modifier
 */
export async function POST(request: NextRequest) {
  try {
    // Verify authentication
    const authResult = verifyAuth(request);
    if (!authResult.success) {
      return NextResponse.json({ error: authResult.error }, { status: 401 });
    }

    // Parse and validate request body
    const body = await request.json();
    const validationResult = validateCreateModifier(body);

    if (!validationResult.isValid) {
      return NextResponse.json(
        {
          error: 'Validation failed',
          details: validationResult.errors,
        },
        { status: 400 }
      );
    }

    const data = validationResult.data!;

    // Apply default values if not provided
    const modifierItemType = data.itemType || 'all';
    const modifierPrice = data.price !== undefined ? data.price : 0;

    // Prepare data with defaults
    const modifierDataWithDefaults = {
      ...data,
      itemType: modifierItemType,
      price: modifierPrice
    };

    // Check for unique modifier name per itemType
    const existingModifiersResult = await db.read<FoodModifier>('foodmodifiers', {
      itemType: modifierItemType
    });

    if (existingModifiersResult.success && existingModifiersResult.data) {
      const uniquenessCheck = validateModifierNameUniqueness(
        existingModifiersResult.data,
        data.name,
        modifierItemType
      );

      if (!uniquenessCheck.isValid) {
        return NextResponse.json(
          {
            error: 'Validation failed',
            details: uniquenessCheck.errors,
          },
          { status: 409 } // Conflict status code
        );
      }
    }

    // Sanitize and prepare modifier data
    const modifierData: FoodModifier = sanitizeModifierData(modifierDataWithDefaults, 'create') as FoodModifier;

    // Create modifier
    const result = await db.create<FoodModifier>('foodmodifiers', modifierData);

    if (!result.success) {
      throw new Error(result.error || 'Failed to create food modifier');
    }

    // Fetch the created modifier
    const createdModifier = await db.readOne<FoodModifier>('foodmodifiers', {
      _id: new ObjectId(result.id),
    });

    if (!createdModifier.success || !createdModifier.data) {
      // Modifier was created but fetch failed - return success with the ID
      return NextResponse.json(
        { success: true, _id: result.id, message: 'Food modifier created successfully' },
        { status: 201 }
      );
    }

    return NextResponse.json(createdModifier.data, { status: 201 });
  } catch (error) {
    console.error('Error in POST /api/admin/modifiers:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/admin/modifiers
 * Update existing food modifier
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

    // Validate using Zod
    const validationResult = validateUpdateModifier(body);

    if (!validationResult.isValid) {
      return NextResponse.json(
        {
          error: 'Validation failed',
          details: validationResult.errors,
        },
        { status: 400 }
      );
    }

    const data = validationResult.data!;
    const { _id, ...updateFields } = data;

    // Check if modifier exists
    const existingResult = await db.readOne<FoodModifier>('foodmodifiers', {
      _id: new ObjectId(_id),
    });

    if (!existingResult.success || !existingResult.data) {
      return NextResponse.json({ error: 'Food modifier not found' }, { status: 404 });
    }

    const existingModifier = existingResult.data;

    // If name or itemType is being updated, check uniqueness
    if (updateFields.name || updateFields.itemType) {
      const newName = updateFields.name || existingModifier.name;
      const newItemType = updateFields.itemType || existingModifier.itemType;

      const existingModifiersResult = await db.read<FoodModifier>('foodmodifiers', {
        itemType: newItemType
      });

      if (existingModifiersResult.success && existingModifiersResult.data) {
        const uniquenessCheck = validateModifierNameUniqueness(
          existingModifiersResult.data,
          newName,
          newItemType,
          _id
        );

        if (!uniquenessCheck.isValid) {
          return NextResponse.json(
            {
              error: 'Validation failed',
              details: uniquenessCheck.errors,
            },
            { status: 409 } // Conflict status code
          );
        }
      }
    }

    // Sanitize update data
    const sanitizedUpdate = sanitizeModifierData(updateFields, 'update');

    // Update modifier
    const updateResult = await db.updateOne<FoodModifier>(
      'foodmodifiers',
      { _id: new ObjectId(_id) },
      { $set: sanitizedUpdate }
    );

    if (!updateResult.success) {
      throw new Error(updateResult.error || 'Failed to update food modifier');
    }

    if (updateResult.matchedCount === 0) {
      return NextResponse.json({ error: 'Food modifier not found' }, { status: 404 });
    }

    // Fetch updated modifier
    const updatedModifier = await db.readOne<FoodModifier>('foodmodifiers', {
      _id: new ObjectId(_id),
    });

    if (!updatedModifier.success || !updatedModifier.data) {
      // Modifier was updated but fetch failed - return success
      return NextResponse.json(
        { success: true, _id: _id, message: 'Food modifier updated successfully' },
        { status: 200 }
      );
    }

    return NextResponse.json(updatedModifier.data);
  } catch (error) {
    console.error('Error in PUT /api/admin/modifiers:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/admin/modifiers
 * Delete food modifier
 */
export async function DELETE(request: NextRequest) {
  try {
    // Verify authentication
    const authResult = verifyAuth(request);
    if (!authResult.success) {
      return NextResponse.json({ error: authResult.error }, { status: 401 });
    }

    // Get modifier ID from query params
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'Modifier ID is required' }, { status: 400 });
    }

    // Check if modifier exists
    const existingResult = await db.readOne<FoodModifier>('foodmodifiers', {
      _id: new ObjectId(id),
    });

    if (!existingResult.success || !existingResult.data) {
      return NextResponse.json({ error: 'Food modifier not found' }, { status: 404 });
    }

    // Delete from database
    const deleteResult = await db.deleteOne<FoodModifier>('foodmodifiers', {
      _id: new ObjectId(id),
    });

    if (!deleteResult.success) {
      throw new Error(deleteResult.error || 'Failed to delete food modifier');
    }

    if (deleteResult.deletedCount === 0) {
      return NextResponse.json({ error: 'Food modifier not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true, message: 'Food modifier deleted successfully' });
  } catch (error) {
    console.error('Error in DELETE /api/admin/modifiers:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}
