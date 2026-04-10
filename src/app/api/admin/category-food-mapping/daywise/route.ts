import { NextRequest, NextResponse } from 'next/server';
import { jwtHandler } from '@/lib/jwt';
import { db } from '@/lib/db';
import { ObjectId } from 'mongodb';
import {
  CategoryFoodMapping,
  DayWiseCategoryFoodMapping,
  MappingType
} from '@/types/order';
import { validateBulkMapping, sanitizeMappingData } from '@/lib/validators/categoryFoodMapping';

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
 * GET /api/admin/category-food-mapping/daywise
 * Get all DAY_WISE mappings, optionally filtered by day or category
 * Query params:
 *   - day (optional): Filter by day (e.g., "Monday", "Tuesday")
 *   - categoryId (optional): Filter by category ID
 *   - foodItemId (optional): Filter by food item ID
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
    const day = searchParams.get('day');
    const categoryId = searchParams.get('categoryId');
    const foodItemId = searchParams.get('foodItemId');

    // Build filter for DAY_WISE mappings
    const filter: any = {
      mappingType: 'DAY_WISE'
    };

    if (day) {
      filter.day = day;
    }

    if (categoryId) {
      try {
        filter.categoryId = new ObjectId(categoryId);
      } catch (error) {
        return NextResponse.json({ error: 'Invalid category ID format' }, { status: 400 });
      }
    }

    if (foodItemId) {
      try {
        filter.foodItemId = new ObjectId(foodItemId);
      } catch (error) {
        return NextResponse.json({ error: 'Invalid food item ID format' }, { status: 400 });
      }
    }

    // Fetch DAY_WISE mappings
    const result = await db.read<DayWiseCategoryFoodMapping>('categoryfoodmapping', filter, {
      sort: { day: 1, sequence: 1 },
    });

    if (!result.success) {
      throw new Error(result.error || 'Failed to fetch day-wise mappings');
    }

    // Group by day for better response structure
    const groupedByDay: Record<string, DayWiseCategoryFoodMapping[]> = {};
    const mappings = result.data || [];

    mappings.forEach(mapping => {
      if (!groupedByDay[mapping.day]) {
        groupedByDay[mapping.day] = [];
      }
      groupedByDay[mapping.day].push(mapping);
    });

    // Get all unique days
    const days = Object.keys(groupedByDay).sort();

    return NextResponse.json({
      data: {
        mappings,
        total: mappings.length,
        groupedByDay,
        days,
        mappingsByDay: days.map(day => ({
          day,
          count: groupedByDay[day].length,
          mappings: groupedByDay[day]
        }))
      },
      message: 'Day-wise mappings fetched successfully',
    });
  } catch (error) {
    console.error('Error in GET /api/admin/category-food-mapping/daywise:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/admin/category-food-mapping/daywise
 * Bulk create DAY_WISE mappings for multiple food items across different days
 * Request body:
 *   {
 *     "mappings": [
 *       {
 *         "foodItemId": "...",
 *         "categoryId": "...",
 *         "day": "Monday",
 *         "sequence": 0
 *       },
 *       ...
 *     ]
 *   }
 *
 * Alternative format - assign food item to multiple days in a category:
 *   {
 *     "foodItemId": "...",
 *     "categoryId": "...",
 *     "days": [
 *       { "day": "Monday", "sequence": 0 },
 *       { "day": "Tuesday", "sequence": 1 },
 *       ...
 *     ]
 *   }
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

    // Determine the request format
    let mappingsToCreate: Array<{
      foodItemId: string;
      categoryId: string;
      day: string;
      sequence: number;
    }> = [];

    if (body.mappings && Array.isArray(body.mappings)) {
      // Format 1: Array of mappings
      mappingsToCreate = body.mappings;
    } else if (body.foodItemId && body.categoryId && body.days && Array.isArray(body.days)) {
      // Format 2: Single food item assigned to multiple days
      mappingsToCreate = body.days.map((dayConfig: any) => ({
        foodItemId: body.foodItemId,
        categoryId: body.categoryId,
        day: dayConfig.day,
        sequence: dayConfig.sequence || 0
      }));
    } else {
      return NextResponse.json(
        {
          error: 'Invalid request format. Expected either { mappings: [...] } or { foodItemId, categoryId, days: [...] }'
        },
        { status: 400 }
      );
    }

    // Validate all mappings
    const errors: string[] = [];
    const validMappings: DayWiseCategoryFoodMapping[] = [];

    for (const mapping of mappingsToCreate) {
      // Validate required fields
      if (!mapping.foodItemId || !mapping.categoryId || !mapping.day) {
        errors.push(`Missing required fields in mapping: ${JSON.stringify(mapping)}`);
        continue;
      }

      // Validate ObjectId formats
      let foodItemIdObj: ObjectId;
      let categoryIdObj: ObjectId;

      try {
        foodItemIdObj = new ObjectId(mapping.foodItemId);
      } catch (error) {
        errors.push(`Invalid food item ID format: ${mapping.foodItemId}`);
        continue;
      }

      try {
        categoryIdObj = new ObjectId(mapping.categoryId);
      } catch (error) {
        errors.push(`Invalid category ID format: ${mapping.categoryId}`);
        continue;
      }

      // Verify food item exists
      const foodItemResult = await db.readOne('fooditems', {
        _id: foodItemIdObj,
      });

      if (!foodItemResult.success || !foodItemResult.data) {
        errors.push(`Food item not found: ${mapping.foodItemId}`);
        continue;
      }

      // Verify category exists
      const categoryResult = await db.readOne('foodcategories', {
        _id: categoryIdObj,
      });

      if (!categoryResult.success || !categoryResult.data) {
        errors.push(`Category not found: ${mapping.categoryId}`);
        continue;
      }

      // Check if mapping already exists
      const existingResult = await db.readOne<DayWiseCategoryFoodMapping>('categoryfoodmapping', {
        foodItemId: foodItemIdObj,
        categoryId: categoryIdObj,
        mappingType: 'DAY_WISE',
        day: mapping.day
      });

      if (existingResult.success && existingResult.data) {
        errors.push(`Mapping already exists for food item ${mapping.foodItemId}, category ${mapping.categoryId}, day ${mapping.day}`);
        continue;
      }

      // Create mapping document
      const mappingDoc: DayWiseCategoryFoodMapping = {
        foodItemId: foodItemIdObj,
        categoryId: categoryIdObj,
        sequence: mapping.sequence ?? 0,
        mappingType: 'DAY_WISE',
        day: mapping.day,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      validMappings.push(mappingDoc);
    }

    // Insert all valid mappings
    let insertedCount = 0;
    if (validMappings.length > 0) {
      const insertResult = await db.createMany<DayWiseCategoryFoodMapping>('categoryfoodmapping', validMappings);
      if (insertResult.success) {
        insertedCount = insertResult.ids?.length || 0;
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        insertedCount,
        errors: errors.length > 0 ? errors : undefined,
      },
      message: `Created ${insertedCount} day-wise mappings successfully`,
    }, { status: 201 });
  } catch (error) {
    console.error('Error in POST /api/admin/category-food-mapping/daywise:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/admin/category-food-mapping/daywise
 * Delete DAY_WISE mappings
 * Query params:
 *   - day (optional): Delete all mappings for a specific day
 *   - categoryId (optional): Delete all mappings for a category
 *   - foodItemId (optional): Delete all mappings for a food item
 *   - id (optional): Delete a specific mapping by ID
 *
 * If no parameters provided, returns error (must specify at least one filter)
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
    const id = searchParams.get('id');
    const day = searchParams.get('day');
    const categoryId = searchParams.get('categoryId');
    const foodItemId = searchParams.get('foodItemId');

    if (!id && !day && !categoryId && !foodItemId) {
      return NextResponse.json(
        { error: 'At least one filter parameter (id, day, categoryId, or foodItemId) is required' },
        { status: 400 }
      );
    }

    let deletedCount = 0;

    if (id) {
      // Delete single mapping by ID
      let mappingId: ObjectId;
      try {
        mappingId = new ObjectId(id);
      } catch (error) {
        return NextResponse.json({ error: 'Invalid mapping ID format' }, { status: 400 });
      }

      // Check if mapping exists and is DAY_WISE
      const existingResult = await db.readOne<DayWiseCategoryFoodMapping>('categoryfoodmapping', {
        _id: mappingId,
        mappingType: 'DAY_WISE'
      });

      if (!existingResult.success || !existingResult.data) {
        return NextResponse.json({ error: 'Day-wise mapping not found' }, { status: 404 });
      }

      const deleteResult = await db.deleteOne<DayWiseCategoryFoodMapping>('categoryfoodmapping', {
        _id: mappingId,
      });

      if (!deleteResult.success) {
        throw new Error(deleteResult.error || 'Failed to delete mapping');
      }

      deletedCount = deleteResult.deletedCount || 0;
    } else {
      // Delete with filters
      const filter: any = {
        mappingType: 'DAY_WISE'
      };

      if (day) {
        filter.day = day;
      }

      if (categoryId) {
        try {
          filter.categoryId = new ObjectId(categoryId);
        } catch (error) {
          return NextResponse.json({ error: 'Invalid category ID format' }, { status: 400 });
        }
      }

      if (foodItemId) {
        try {
          filter.foodItemId = new ObjectId(foodItemId);
        } catch (error) {
          return NextResponse.json({ error: 'Invalid food item ID format' }, { status: 400 });
        }
      }

      const deleteResult = await db.delete<DayWiseCategoryFoodMapping>('categoryfoodmapping', filter);

      if (!deleteResult.success) {
        throw new Error(deleteResult.error || 'Failed to delete mappings');
      }

      deletedCount = deleteResult.deletedCount || 0;
    }

    return NextResponse.json({
      success: true,
      data: {
        deletedCount,
        ...(day && { day }),
        ...(categoryId && { categoryId }),
        ...(foodItemId && { foodItemId }),
      },
      message: `Deleted ${deletedCount} day-wise mapping(s) successfully`,
    });
  } catch (error) {
    console.error('Error in DELETE /api/admin/category-food-mapping/daywise:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}
