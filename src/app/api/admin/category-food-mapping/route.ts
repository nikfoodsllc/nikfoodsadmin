import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { jwtHandler } from '@/lib/jwt';
import { db } from '@/lib/db';
import { ObjectId } from 'mongodb';
import {
  CategoryFoodMapping,
  BaseCategoryFoodMapping,
  FlatCategoryFoodMapping,
  DayWiseCategoryFoodMapping,
  MappingType
} from '@/types/order';
import {
  validateCreateMapping,
  validateBulkMapping,
  validateUpdateMapping,
  sanitizeMappingData,
  isFlatMapping,
  isDayWiseMapping
} from '@/lib/validators/categoryFoodMapping';
import { invalidateLivesiteHomeMenuCache } from '@/lib/invalidateHomeMenuCache';

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
 * GET /api/admin/category-food-mapping
 * Get category mappings for a food item or category
 * Query params:
 *   - foodItemId (optional): Filter by food item ID
 *   - categoryId (optional): Filter by category ID
 *   - mappingType (optional): Filter by mapping type ('FLAT' or 'DAY_WISE')
 *   - day (optional): Filter by day (only for DAY_WISE mappings)
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
    const foodItemId = searchParams.get('foodItemId');
    const categoryId = searchParams.get('categoryId');
    const mappingType = searchParams.get('mappingType') as MappingType | null;
    const day = searchParams.get('day');

    // Build filter
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const filter: any = {};

    if (foodItemId) {
      try {
        filter.foodItemId = new ObjectId(foodItemId);
      } catch (error) {
        return NextResponse.json({ error: 'Invalid food item ID format' }, { status: 400 });
      }
    }

    if (categoryId) {
      try {
        filter.categoryId = new ObjectId(categoryId);
      } catch (error) {
        return NextResponse.json({ error: 'Invalid category ID format' }, { status: 400 });
      }
    }

    // Add mappingType filter if provided
    if (mappingType) {
      if (mappingType !== 'FLAT' && mappingType !== 'DAY_WISE') {
        return NextResponse.json(
          { error: 'Invalid mappingType. Must be FLAT or DAY_WISE' },
          { status: 400 }
        );
      }
      filter.mappingType = mappingType;
    }

    // Add day filter if provided (only applicable for DAY_WISE mappings)
    if (day) {
      if (mappingType && mappingType !== 'DAY_WISE') {
        return NextResponse.json(
          { error: 'Day filter can only be used with DAY_WISE mapping type' },
          { status: 400 }
        );
      }
      filter.day = day;
    }

    // Require at least one filter
    if (!foodItemId && !categoryId && !mappingType && !day) {
      return NextResponse.json(
        {
          error: 'At least one filter parameter (foodItemId, categoryId, mappingType, or day) is required'
        },
        { status: 400 }
      );
    }

    // Fetch mappings
    const result = await db.read<CategoryFoodMapping>('categoryfoodmapping', filter, {
      sort: { sequence: 1 },
    });

    if (!result.success) {
      throw new Error(result.error || 'Failed to fetch category mappings');
    }

    // Separate mappings by type for better response structure
    const flatMappings = result.data?.filter(isFlatMapping) || [];
    const dayWiseMappings = result.data?.filter(isDayWiseMapping) || [];

    return NextResponse.json({
      data: {
        mappings: result.data || [],
        total: result.data?.length || 0,
        flatMappings,
        dayWiseMappings,
        flatCount: flatMappings.length,
        dayWiseCount: dayWiseMappings.length,
      },
      message: 'Category mappings fetched successfully',
    });
  } catch (error) {
    console.error('Error in GET /api/admin/category-food-mapping:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/admin/category-food-mapping
 * Create a new category mapping or bulk create mappings for a food item
 * Supports both FLAT and DAY_WISE mapping types
 * Request body for single mapping:
 *   {
 *     "foodItemId": "...",
 *     "categoryId": "...",
 *     "sequence": 0,
 *     "mappingType": "FLAT" | "DAY_WISE",
 *     "day": "Monday" // Required only for DAY_WISE
 *   }
 * Request body for bulk mapping:
 *   {
 *     "foodItemId": "...",
 *     "mappingType": "FLAT" | "DAY_WISE",
 *     "categories": [
 *       {
 *         "categoryId": "...",
 *         "sequence": 0,
 *         "day": "Monday" // Required only for DAY_WISE
 *       }
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

    // Check if this is a bulk operation
    if (body.categories && Array.isArray(body.categories)) {
      // Validate bulk mapping
      const validationResult = validateBulkMapping(body);

      if (!validationResult.isValid) {
        return NextResponse.json(
          {
            error: 'Validation failed',
            details: validationResult.errors,
          },
          { status: 400 }
        );
      }

      const data = validationResult.data;

      // Verify food item exists
      const foodItemResult = await db.readOne('fooditems', {
        _id: new ObjectId(data.foodItemId),
      });

      if (!foodItemResult.success || !foodItemResult.data) {
        return NextResponse.json({ error: 'Food item not found' }, { status: 404 });
      }

      // Determine the filter for deleting existing mappings
      // If mappingType is specified, only delete mappings of that type
      const deleteFilter: any = {
        foodItemId: new ObjectId(data.foodItemId)
      };

      // If mappingType is DAY_WISE, we should only delete DAY_WISE mappings
      // For FLAT, we only delete FLAT mappings
      // This allows having both types of mappings for the same food item
      if (data.mappingType) {
        deleteFilter.mappingType = data.mappingType;
      }

      // Delete existing mappings for this food item (filtered by type if specified)
      await db.delete<CategoryFoodMapping>('categoryfoodmapping', deleteFilter);

      // Create new mappings
      const mappingDocuments: CategoryFoodMapping[] = [];
      const errors: string[] = [];

      for (const categoryData of data.categories) {
        try {
          // Verify category exists
          const categoryResult = await db.readOne('foodcategories', {
            _id: new ObjectId(categoryData.categoryId),
          });

          if (!categoryResult.success || !categoryResult.data) {
            errors.push(`Category ${categoryData.categoryId} not found`);
            continue;
          }

          // Build mapping document based on mappingType
          const baseMapping = {
            foodItemId: new ObjectId(data.foodItemId),
            categoryId: new ObjectId(categoryData.categoryId),
            sequence: categoryData.sequence,
            mappingType: data.mappingType || 'FLAT',
            createdAt: new Date(),
            updatedAt: new Date(),
          };

          // Add day field only for DAY_WISE mappings
          if (data.mappingType === 'DAY_WISE') {
            if (!categoryData.day) {
              errors.push(`Day is required for DAY_WISE mapping in category ${categoryData.categoryId}`);
              continue;
            }
            mappingDocuments.push({
              ...baseMapping,
              mappingType: 'DAY_WISE',
              day: categoryData.day
            } as DayWiseCategoryFoodMapping);
          } else {
            mappingDocuments.push({
              ...baseMapping,
              mappingType: 'FLAT'
            } as FlatCategoryFoodMapping);
          }
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';
          errors.push(`Error processing category ${categoryData.categoryId}: ${errorMessage}`);
        }
      }

      // Insert all mappings
      let insertedCount = 0;
      if (mappingDocuments.length > 0) {
        const insertResult = await db.createMany<CategoryFoodMapping>('categoryfoodmapping', mappingDocuments);
        if (insertResult.success) {
          insertedCount = insertResult.ids?.length || 0;
        }
      }

      invalidateLivesiteHomeMenuCache();
      return NextResponse.json({
        success: true,
        data: {
          insertedCount,
          mappingType: data.mappingType || 'FLAT',
          errors: errors.length > 0 ? errors : undefined,
        },
        message: `Created ${insertedCount} ${data.mappingType || 'FLAT'} category mappings successfully`,
      }, { status: 201 });
    } else {
      // Single mapping creation
      const validationResult = validateCreateMapping(body);

      if (!validationResult.isValid) {
        return NextResponse.json(
          {
            error: 'Validation failed',
            details: validationResult.errors,
          },
          { status: 400 }
        );
      }

      const data = validationResult.data;

      // Verify food item exists
      const foodItemResult = await db.readOne('fooditems', {
        _id: new ObjectId(data.foodItemId),
      });

      if (!foodItemResult.success || !foodItemResult.data) {
        return NextResponse.json({ error: 'Food item not found' }, { status: 404 });
      }

      // Verify category exists
      const categoryResult = await db.readOne('foodcategories', {
        _id: new ObjectId(data.categoryId),
      });

      if (!categoryResult.success || !categoryResult.data) {
        return NextResponse.json({ error: 'Category not found' }, { status: 404 });
      }

      // Check if mapping already exists (for the same mappingType)
      const existingFilter: any = {
        foodItemId: new ObjectId(data.foodItemId),
        categoryId: new ObjectId(data.categoryId),
      };

      // If mappingType is specified, check for duplicates of that type
      if (data.mappingType) {
        existingFilter.mappingType = data.mappingType;
      }

      const existingResult = await db.readOne<CategoryFoodMapping>('categoryfoodmapping', existingFilter);

      if (existingResult.success && existingResult.data) {
        return NextResponse.json(
          {
            error: `Mapping already exists for this food item and category with type ${data.mappingType || 'FLAT'}`
          },
          { status: 409 }
        );
      }

      // Get the next sequence number if not provided
      let sequence = data.sequence ?? 0;
      if (data.sequence === undefined) {
        const sequenceFilter: any = {
          foodItemId: new ObjectId(data.foodItemId)
        };
        if (data.mappingType) {
          sequenceFilter.mappingType = data.mappingType;
        }

        const allMappingsResult = await db.read<CategoryFoodMapping>('categoryfoodmapping', sequenceFilter, {
          sort: { sequence: -1 },
          limit: 1,
        });

        if (allMappingsResult.success && allMappingsResult.data && allMappingsResult.data.length > 0) {
          sequence = allMappingsResult.data[0].sequence + 1;
        }
      }

      // Build the complete mapping document based on mappingType
      const baseMapping = {
        foodItemId: new ObjectId(data.foodItemId),
        categoryId: new ObjectId(data.categoryId),
        sequence: sequence,
        mappingType: data.mappingType || 'FLAT',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      // Create the appropriate mapping type
      let mappingDocument: CategoryFoodMapping;
      if (data.mappingType === 'DAY_WISE') {
        if (!data.day) {
          return NextResponse.json(
            { error: 'Day is required for DAY_WISE mapping type' },
            { status: 400 }
          );
        }
        mappingDocument = {
          ...baseMapping,
          mappingType: 'DAY_WISE',
          day: data.day
        } as DayWiseCategoryFoodMapping;
      } else {
        mappingDocument = {
          ...baseMapping,
          mappingType: 'FLAT'
        } as FlatCategoryFoodMapping;
      }

      const result = await db.create<CategoryFoodMapping>('categoryfoodmapping', mappingDocument);

      if (!result.success) {
        throw new Error(result.error || 'Failed to create category mapping');
      }

      invalidateLivesiteHomeMenuCache();
      return NextResponse.json({
        success: true,
        data: {
          _id: result.id,
          ...mappingDocument,
        },
        message: `Created ${data.mappingType || 'FLAT'} category mapping successfully`,
      }, { status: 201 });
    }
  } catch (error) {
    console.error('Error in POST /api/admin/category-food-mapping:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/admin/category-food-mapping
 * Update sequence or day field of a mapping
 * Request body:
 *   {
 *     "_id": "...",
 *     "sequence": 1, // optional
 *     "day": "Monday" // optional, only for DAY_WISE mappings
 *   }
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
    const { _id, sequence, day } = body;

    // Validate required fields
    if (!_id) {
      return NextResponse.json({ error: 'Mapping ID is required' }, { status: 400 });
    }

    if (sequence === undefined && day === undefined) {
      return NextResponse.json(
        { error: 'At least one field (sequence or day) must be provided for update' },
        { status: 400 }
      );
    }

    // Convert string ID to ObjectId
    let mappingId: ObjectId;
    try {
      mappingId = new ObjectId(_id);
    } catch (error) {
      return NextResponse.json({ error: 'Invalid mapping ID format' }, { status: 400 });
    }

    // Check if mapping exists
    const existingResult = await db.readOne<CategoryFoodMapping>('categoryfoodmapping', {
      _id: mappingId,
    });

    if (!existingResult.success || !existingResult.data) {
      return NextResponse.json({ error: 'Mapping not found' }, { status: 404 });
    }

    const existingMapping = existingResult.data;

    // Validate day field
    if (day !== undefined) {
      if (existingMapping.mappingType !== 'DAY_WISE') {
        return NextResponse.json(
          { error: 'Day field can only be updated for DAY_WISE mapping type' },
          { status: 400 }
        );
      }
      if (typeof day !== 'string' || day.trim().length === 0) {
        return NextResponse.json(
          { error: 'Day must be a non-empty string' },
          { status: 400 }
        );
      }
    }

    // Validate sequence field
    if (sequence !== undefined && (typeof sequence !== 'number' || sequence < 0)) {
      return NextResponse.json(
        { error: 'Sequence must be a non-negative number' },
        { status: 400 }
      );
    }

    // Build update object
    const updateObj: any = {
      updatedAt: new Date()
    };

    if (sequence !== undefined) {
      updateObj.sequence = sequence;
    }

    if (day !== undefined) {
      updateObj.day = day;
    }

    // Update mapping
    const updateResult = await db.updateOne<CategoryFoodMapping>(
      'categoryfoodmapping',
      { _id: mappingId },
      { $set: updateObj }
    );

    if (!updateResult.success) {
      throw new Error(updateResult.error || 'Failed to update mapping');
    }

    invalidateLivesiteHomeMenuCache();
    return NextResponse.json({
      success: true,
      message: 'Mapping updated successfully',
      data: {
        _id: mappingId.toString(),
        ...(sequence !== undefined && { sequence }),
        ...(day !== undefined && { day }),
      }
    });
  } catch (error) {
    console.error('Error in PUT /api/admin/category-food-mapping:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/admin/category-food-mapping
 * Delete a category mapping
 * Query params:
 *   - id: Mapping ID (delete single mapping)
 *   - foodItemId: Food item ID (delete all mappings for this food item)
 *   - mappingType: Optional filter by mapping type ('FLAT' or 'DAY_WISE')
 *   - day: Optional filter by day (only applicable with foodItemId and DAY_WISE type)
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
    const foodItemId = searchParams.get('foodItemId');
    const mappingType = searchParams.get('mappingType') as MappingType | null;
    const day = searchParams.get('day');

    if (!id && !foodItemId) {
      return NextResponse.json(
        { error: 'Either mapping ID or food item ID is required' },
        { status: 400 }
      );
    }

    // Validate mappingType if provided
    if (mappingType && mappingType !== 'FLAT' && mappingType !== 'DAY_WISE') {
      return NextResponse.json(
        { error: 'Invalid mappingType. Must be FLAT or DAY_WISE' },
        { status: 400 }
      );
    }

    // Validate day parameter
    if (day) {
      if (!foodItemId) {
        return NextResponse.json(
          { error: 'Day filter can only be used with foodItemId parameter' },
          { status: 400 }
        );
      }
      if (mappingType && mappingType !== 'DAY_WISE') {
        return NextResponse.json(
          { error: 'Day filter can only be used with DAY_WISE mapping type' },
          { status: 400 }
        );
      }
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

      // Check if mapping exists
      const existingResult = await db.readOne<CategoryFoodMapping>('categoryfoodmapping', {
        _id: mappingId,
      });

      if (!existingResult.success || !existingResult.data) {
        return NextResponse.json({ error: 'Mapping not found' }, { status: 404 });
      }

      const deleteResult = await db.deleteOne<CategoryFoodMapping>('categoryfoodmapping', {
        _id: mappingId,
      });

      if (!deleteResult.success) {
        throw new Error(deleteResult.error || 'Failed to delete mapping');
      }

      deletedCount = deleteResult.deletedCount || 0;
    } else if (foodItemId) {
      // Delete mappings for a food item (with optional filters)
      let foodItemIdObj: ObjectId;
      try {
        foodItemIdObj = new ObjectId(foodItemId);
      } catch (error) {
        return NextResponse.json({ error: 'Invalid food item ID format' }, { status: 400 });
      }

      // Build delete filter
      const deleteFilter: any = {
        foodItemId: foodItemIdObj,
      };

      // Add mappingType filter if specified
      if (mappingType) {
        deleteFilter.mappingType = mappingType;
      }

      // Add day filter if specified
      if (day) {
        deleteFilter.day = day;
        // If day is specified but mappingType is not, default to DAY_WISE
        if (!mappingType) {
          deleteFilter.mappingType = 'DAY_WISE';
        }
      }

      const deleteResult = await db.delete<CategoryFoodMapping>('categoryfoodmapping', deleteFilter);

      if (!deleteResult.success) {
        throw new Error(deleteResult.error || 'Failed to delete mappings');
      }

      deletedCount = deleteResult.deletedCount || 0;
    }

    invalidateLivesiteHomeMenuCache();
    return NextResponse.json({
      success: true,
      data: {
        deletedCount,
        mappingType: mappingType || 'all',
        ...(day && { day })
      },
      message: `Deleted ${deletedCount} mapping(s) successfully`,
    });
  } catch (error) {
    console.error('Error in DELETE /api/admin/category-food-mapping:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}
