import { NextRequest, NextResponse } from 'next/server';
import { jwtHandler } from '@/lib/jwt';
import { db } from '@/lib/db';
import { deleteFromCloudinary } from '@/lib/cloudinary';
import { ObjectId, UpdateFilter } from 'mongodb';
import { FoodCategory, CategoryListingType, CategoryDayWiseItem, CategoryFoodMapping } from '@/types/order';

/**
 * Validate listing type
 */
function validateListingType(listingType?: any): listingType is CategoryListingType {
  if (!listingType) return true; // Optional field
  return ['flat', 'day-wise'].includes(listingType);
}

/**
 * Fetch available days from database with enhanced error handling
 */
async function getAvailableDays(): Promise<string[]> {
  console.log('📅 [getAvailableDays] Starting to fetch available days from database');

  try {
    // Check if database connection is available
    if (!db) {
      console.error('❌ [getAvailableDays] Database connection not available');
      return getFallbackDays();
    }

    console.log('🔍 [getAvailableDays] Querying availableDays collection with filter: { enabled: true }');

    const result = await db.read('availableDays', { enabled: true }, {
      sort: { sequence: 1 }
    });

    console.log('📊 [getAvailableDays] Database query result:', {
      success: result.success,
      dataCount: result.data ? result.data.length : 0,
      error: result.error || null
    });

    if (result.success && result.data && Array.isArray(result.data)) {
      if (result.data.length === 0) {
        console.warn('⚠️ [getAvailableDays] availableDays collection exists but is empty (no enabled days)');
        return getFallbackDays();
      }

      // Validate and convert day names to title case
      const validDays = result.data
        .filter((day: any) => {
          if (!day || typeof day !== 'object') {
            console.warn('⚠️ [getAvailableDays] Invalid day object:', day);
            return false;
          }
          if (!day.day || typeof day.day !== 'string') {
            console.warn('⚠️ [getAvailableDays] Invalid day name in object:', day);
            return false;
          }
          return true;
        })
        .map((day: any) => {
          const dayName = day.day.trim();
          const formattedDay = dayName.charAt(0).toUpperCase() + dayName.slice(1).toLowerCase();
          console.log(`✅ [getAvailableDays] Processed day: "${dayName}" -> "${formattedDay}"`);
          return formattedDay;
        });

      if (validDays.length === 0) {
        console.warn('⚠️ [getAvailableDays] No valid days found after processing, using fallback');
        return getFallbackDays();
      }

      console.log(`🎉 [getAvailableDays] Successfully fetched ${validDays.length} available days:`, validDays);
      return validDays;
    } else {
      console.error('❌ [getAvailableDays] Database query failed:', {
        success: result.success,
        error: result.error,
        dataExists: !!result.data
      });
      return getFallbackDays();
    }
  } catch (error) {
    console.error('💥 [getAvailableDays] Critical error while fetching available days:', {
      error: error instanceof Error ? {
        name: error.name,
        message: error.message,
        stack: error.stack
      } : error,
      errorType: typeof error
    });
    return getFallbackDays();
  }
}

/**
 * Get fallback days when database fails
 */
function getFallbackDays(): string[] {
  const fallbackDays = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
  console.log('🔄 [getAvailableDays] Using fallback days:', fallbackDays);
  return fallbackDays;
}

/**
 * Interface for detailed validation result
 */
interface ValidationResult {
  isValid: boolean;
  errorMessage?: string;
  details?: any;
}

/**
 * Validate day wise items structure against available days with enhanced error handling
 * Returns detailed validation result instead of just boolean
 */
async function validateDayWiseItems(dayWiseItems?: any): Promise<ValidationResult> {
  console.log('🔍 [validateDayWiseItems] Starting validation, input:', {
    hasInput: !!dayWiseItems,
    inputType: typeof dayWiseItems,
    isArray: Array.isArray(dayWiseItems),
    length: dayWiseItems ? dayWiseItems.length : 0
  });

  // Optional field - if not provided, validation passes
  if (!dayWiseItems) {
    console.log('✅ [validateDayWiseItems] No dayWiseItems provided, validation passes (optional field)');
    return { isValid: true };
  }

  // Must be an array
  if (!Array.isArray(dayWiseItems)) {
    const errorMessage = `dayWiseItems must be an array, but received ${typeof dayWiseItems}`;
    console.error(`❌ [validateDayWiseItems] ${errorMessage}`);
    return {
      isValid: false,
      errorMessage,
      details: { receivedType: typeof dayWiseItems, receivedValue: dayWiseItems }
    };
  }

  // Get available days from database (with fallback handling)
  console.log('📅 [validateDayWiseItems] Fetching available days for validation');
  const availableDays = await getAvailableDays();
  console.log('📋 [validateDayWiseItems] Available days for validation:', availableDays);

  // Validate each item in the array
  const validationResults = dayWiseItems.map((item, index) => {
    console.log(`🔍 [validateDayWiseItems] Validating item at index ${index}:`, item);

    // Check if item exists and is an object
    if (!item || typeof item !== 'object') {
      const reason = `Item at index ${index} is not a valid object (received: ${typeof item})`;
      console.error(`❌ [validateDayWiseItems] ${reason}:`, item);
      return { index, valid: false, reason, item };
    }

    // Check if day property exists and is a string
    if (!item.day || typeof item.day !== 'string') {
      const reason = `Item at index ${index} missing or invalid day property (received: ${typeof item.day}, value: ${item.day})`;
      console.error(`❌ [validateDayWiseItems] ${reason}`);
      return { index, valid: false, reason, item };
    }

    // Check if day is in the list of available days (case-insensitive comparison)
    const normalizedDay = item.day.trim();
    const normalizedAvailableDays = availableDays.map(day => day.toLowerCase());

    if (!normalizedAvailableDays.includes(normalizedDay.toLowerCase()) && !availableDays.includes(item.day)) {
      const reason = `Item at index ${index} has invalid day "${item.day}". Available days are: ${availableDays.join(', ')}`;
      console.error(`❌ [validateDayWiseItems] ${reason}`);
      return { index, valid: false, reason, item, invalidDay: item.day, availableDays };
    }

    // Check if items property exists and is an array
    if (!Array.isArray(item.items)) {
      const reason = `Item at index ${index} "items" property must be an array, but received ${typeof item.items}`;
      console.error(`❌ [validateDayWiseItems] ${reason}:`, item.items);
      return { index, valid: false, reason, item };
    }

    // Check if all item IDs in the items array are strings
    const invalidItemIds: Array<{index: number, value: any, type: string}> = [];
    item.items.forEach((itemId: any, itemIndex: number) => {
      if (typeof itemId !== 'string') {
        invalidItemIds.push({
          index: itemIndex,
          value: itemId,
          type: typeof itemId
        });
        console.error(`❌ [validateDayWiseItems] Item ${index}, items[${itemIndex}] is not a string (type: ${typeof itemId}, value: ${itemId})`);
      }
    });

    if (invalidItemIds.length > 0) {
      const reason = `Item at index ${index} contains ${invalidItemIds.length} invalid item IDs (must be strings)`;
      return {
        index,
        valid: false,
        reason,
        item,
        invalidItemIds
      };
    }

    console.log(`✅ [validateDayWiseItems] Item ${index} validation passed:`, {
      day: item.day,
      itemCount: item.items.length
    });

    return { index, valid: true, reason: 'Valid', item };
  });

  // Check if all items are valid
  const invalidItems = validationResults.filter(result => !result.valid);

  if (invalidItems.length > 0) {
    console.error('❌ [validateDayWiseItems] Validation failed for items:', invalidItems);
    console.table(invalidItems);

    // Build detailed error message
    const errorMessages = invalidItems.map(invalid => {
      if (invalid.invalidDay) {
        return `Invalid day "${invalid.invalidDay}" at position ${invalid.index + 1}. Valid days are: ${invalid.availableDays?.join(', ') || 'N/A'}`;
      }
      if (invalid.invalidItemIds && invalid.invalidItemIds.length > 0) {
        const invalidIdsDetails = invalid.invalidItemIds.map(id =>
          `${id.value} (${id.type})`
        ).join(', ');
        return `Invalid item IDs at position ${invalid.index + 1}: ${invalidIdsDetails}`;
      }
      return invalid.reason;
    });

    const errorMessage = `Validation failed: ${errorMessages.join('; ')}`;

    return {
      isValid: false,
      errorMessage,
      details: {
        invalidItems,
        availableDays,
        totalItems: dayWiseItems.length,
        validItems: validationResults.length - invalidItems.length
      }
    };
  }

  console.log('🎉 [validateDayWiseItems] All items passed validation');
  return {
    isValid: true,
    details: {
      totalItems: dayWiseItems.length,
      availableDays
    }
  };
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

function categoryDocHasParentId(parentCategoryId: unknown): boolean {
  if (parentCategoryId === undefined || parentCategoryId === null) return false;
  if (typeof parentCategoryId === 'string') return parentCategoryId.trim().length > 0;
  return true;
}

/**
 * Resolve and validate parent category for a single-level hierarchy (parent must be top-level).
 */
async function resolveParentCategoryObjectId(
  parentCategoryIdRaw: unknown,
): Promise<{ ok: true; parentObjectId: ObjectId | undefined } | { ok: false; error: string }> {
  if (parentCategoryIdRaw === undefined || parentCategoryIdRaw === null) {
    return { ok: true, parentObjectId: undefined };
  }
  if (typeof parentCategoryIdRaw !== 'string' || !parentCategoryIdRaw.trim()) {
    return { ok: true, parentObjectId: undefined };
  }
  const idStr = parentCategoryIdRaw.trim();
  if (!ObjectId.isValid(idStr)) {
    return { ok: false, error: 'parentCategoryId must be a valid category id' };
  }
  const parentOid = new ObjectId(idStr);
  const parentResult = await db.readOne<FoodCategory>('foodcategories', { _id: parentOid });
  if (!parentResult.success || !parentResult.data) {
    return { ok: false, error: 'Parent category not found' };
  }
  if (categoryDocHasParentId(parentResult.data.parentCategoryId)) {
    return {
      ok: false,
      error: 'Parent must be a top-level category (sub-categories cannot be parents)',
    };
  }
  return { ok: true, parentObjectId: parentOid };
}

/**
 * Calculate item count for a category using CategoryFoodMapping
 * Now uses mapping collection for both flat and day-wise categories
 */
async function calculateItemCount(category: FoodCategory): Promise<number> {
  try {
    if (!category._id) {
      return 0;
    }

    // For both flat and day-wise categories, count from mapping collection
    const mappingResult = await db.read<CategoryFoodMapping>('categoryfoodmapping', {
      categoryId: category._id as ObjectId
    });

    if (mappingResult.success && mappingResult.data) {
      return mappingResult.data.length;
    }
  } catch (error) {
    console.warn(`Failed to count items for category ${category._id}:`, error);

    // Fallback to embedded dayWiseItems for backward compatibility
    if (category.listingType === 'day-wise' && category.dayWiseItems) {
      return category.dayWiseItems.reduce((total, dayItem) => total + dayItem.items.length, 0);
    }
  }

  return 0;
}

/**
 * Fetch day-wise items for a category from the CategoryFoodMapping collection
 * Returns items grouped by day
 */
async function fetchDayWiseItemsForCategory(categoryId: ObjectId): Promise<CategoryDayWiseItem[]> {
  try {
    // Fetch all DAY_WISE mappings for this category
    const mappingResult = await db.read<CategoryFoodMapping>('categoryfoodmapping', {
      categoryId: categoryId,
      mappingType: 'DAY_WISE'
    }, {
      sort: { day: 1, sequence: 1 }
    });

    if (!mappingResult.success || !mappingResult.data) {
      return [];
    }

    // Group items by day
    const dayWiseMap = new Map<string, string[]>();

    for (const mapping of mappingResult.data) {
      if (mapping.mappingType === 'DAY_WISE') {
        const day = mapping.day;
        const foodItemId = mapping.foodItemId.toString();

        if (!dayWiseMap.has(day)) {
          dayWiseMap.set(day, []);
        }

        dayWiseMap.get(day)!.push(foodItemId);
      }
    }

    // Convert to CategoryDayWiseItem format
    return Array.from(dayWiseMap.entries()).map(([day, items]) => ({
      day,
      items
    }));
  } catch (error) {
    console.error(`Error fetching day-wise items for category ${categoryId}:`, error);
    return [];
  }
}


// New code 

// async function fetchDayWiseItemsForCategory(categoryId: ObjectId): Promise<CategoryDayWiseItem[]> {
//   try {

//     // get enabled dates only
//     const availableDatesResult = await db.read(
//       'availableDates',
//       { dayWiseCategoryEnabled: true }
//     );

//     const validDates =
//       availableDatesResult.success && availableDatesResult.data
//         ? availableDatesResult.data.map((d: any) => d.date)
//         : [];

//     // fetch mappings
//     const mappingResult = await db.read<CategoryFoodMapping>(
//       'categoryfoodmapping',
//       {
//         categoryId: categoryId,
//         mappingType: 'DAY_WISE'
//       },
//       {
//         sort: { day: 1, sequence: 1 }
//       }
//     );

//     if (!mappingResult.success || !mappingResult.data) {
//       return [];
//     }

//     // group items by day
//     const dayWiseMap = new Map<string, string[]>();

//     for (const mapping of mappingResult.data) {

//       // ❌ ignore old dates like Jan 28
//       if (!validDates.includes(mapping.day)) continue;

//       const day = mapping.day;
//       const foodItemId = mapping.foodItemId.toString();

//       if (!dayWiseMap.has(day)) {
//         dayWiseMap.set(day, []);
//       }

//       dayWiseMap.get(day)!.push(foodItemId);
//     }

//     return Array.from(dayWiseMap.entries()).map(([day, items]) => ({
//       day,
//       items
//     }));

//   } catch (error) {
//     console.error(`Error fetching day-wise items for category ${categoryId}:`, error);
//     return [];
//   }
// }

/**
 * GET /api/admin/food-category
 * List all food categories
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
    const showDrafts = searchParams.get('showDrafts');

    // Build query filter
    let queryFilter: any = {};

    // If showDrafts is 'false', filter out draft categories
    if (showDrafts === 'false') {
      queryFilter.isDraft = { $ne: true };
    }

    // Fetch categories with filter, sorted by sequence ascending, then createdAt as fallback
    const result = await db.read<FoodCategory>('foodcategories', queryFilter, {
      sort: { sequence: 1, createdAt: 1 },
    });

    if (!result.success) {
      throw new Error(result.error || 'Failed to fetch categories');
    }

    // Calculate item counts and fetch day-wise items for each category
    const categoriesWithCounts = await Promise.all(
      (result.data || []).map(async (category) => {
        const itemCount = await calculateItemCount(category);

        // For day-wise categories, fetch items from mapping collection
        let dayWiseItems = category.dayWiseItems ?? [];
        if (category.listingType === 'day-wise' && category._id) {
          const mappedItems = await fetchDayWiseItemsForCategory(category._id as ObjectId);
          // Use mapped items if available, otherwise fall back to embedded data
          if (mappedItems.length > 0) {
            dayWiseItems = mappedItems;
          }
        }

        return {
          ...category,
          isDraft: category.isDraft ?? false,
          listingType: category.listingType ?? 'flat',
          dayWiseItems,
          itemCount,
        };
      })
    );

    return NextResponse.json({
      data: {
        items: categoriesWithCounts,
        total: categoriesWithCounts.length,
      },
      message: 'Categories fetched successfully',
    });
  } catch (error) {
    console.error('Error in GET /api/admin/food-category:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/admin/food-category
 * Create new food category
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
    const {
      name,
      description,
      url,
      public_id,
      sequence,
      isDraft,
      listingType,
      dayWiseItems: inputDayWiseItems,
      parentCategoryId: parentCategoryIdRaw,
    } = body;

    // Validate required fields
    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      return NextResponse.json(
        { error: 'Name is required and must be a non-empty string' },
        { status: 400 }
      );
    }

    if (description && typeof description !== 'string') {
      return NextResponse.json(
        { error: 'Description must be a string' },
        { status: 400 }
      );
    }

    // Validate isDraft field if provided
    if (isDraft !== undefined && typeof isDraft !== 'boolean') {
      return NextResponse.json(
        { error: 'isDraft must be a boolean value' },
        { status: 400 }
      );
    }

    // Validate sequence field if provided
    if (sequence !== undefined && sequence !== null) {
      if (typeof sequence !== 'number' || !Number.isInteger(sequence) || sequence < 1) {
        return NextResponse.json(
          { error: 'Sequence must be a positive integer' },
          { status: 400 }
        );
      }
    }

  // Validate listingType field if provided
    if (listingType !== undefined && !validateListingType(listingType)) {
      return NextResponse.json(
        { error: 'listingType must be either "flat" or "day-wise"' },
        { status: 400 }
      );
    }

  // Validate dayWiseItems field if provided
    if (inputDayWiseItems !== undefined) {
      const validationResult = await validateDayWiseItems(inputDayWiseItems);
      if (!validationResult.isValid) {
        return NextResponse.json(
          {
            error: validationResult.errorMessage || 'dayWiseItems validation failed',
            details: validationResult.details ? {
              ...validationResult.details,
              guidance: 'dayWiseItems must be an array of objects with valid day names (from enabled days) and item IDs (as strings)'
            } : 'dayWiseItems must be an array of objects with valid day names (from enabled days) and item IDs (as strings)'
          },
          { status: 400 }
        );
      }
    }

  // Note: Removed restrictive validation that required dayWiseItems to have items for every day
  // This allows restaurant managers to create categories with empty day arrays for seasonal scheduling

    if (listingType === 'flat' && inputDayWiseItems && inputDayWiseItems.length > 0) {
      return NextResponse.json(
        { error: 'dayWiseItems should not be provided when listingType is "flat"' },
        { status: 400 }
      );
    }

    const parentResolved = await resolveParentCategoryObjectId(parentCategoryIdRaw);
    if (!parentResolved.ok) {
      return NextResponse.json({ error: parentResolved.error }, { status: 400 });
    }

    // Auto-assign sequence if not provided
    let sequenceValue = sequence;
    if (sequenceValue === undefined || sequenceValue === null) {
      // Get the highest sequence number from existing categories
      const existingCategories = await db.read<FoodCategory>('foodcategories', {}, {
        sort: { sequence: -1 },
        limit: 1,
      });

      if (existingCategories.success && existingCategories.data && existingCategories.data.length > 0) {
        const highestCategory = existingCategories.data[0];
        sequenceValue = (highestCategory.sequence || 0) + 1;
      } else {
        sequenceValue = 1; // Start with 1 if no categories exist
      }
    }

    // Prepare category data
    const categoryData: FoodCategory = {
      name: name.trim(),
      description: description?.trim() || '',
      url: url || '',
      public_id: public_id || '',
      sequence: sequenceValue,
      isDraft: isDraft ?? false, // Default to false if not provided
      listingType: listingType ?? 'flat', // Default to 'flat' for backward compatibility
      dayWiseItems: listingType === 'day-wise' ? (inputDayWiseItems || []) : [],
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    if (parentResolved.parentObjectId) {
      categoryData.parentCategoryId = parentResolved.parentObjectId;
    }

    // Create category
    const result = await db.create<FoodCategory>('foodcategories', categoryData);

    if (!result.success) {
      // Rollback: Delete uploaded image from Cloudinary if DB creation fails
      if (public_id) {
        await deleteFromCloudinary(public_id);
      }
      throw new Error(result.error || 'Failed to create category');
    }

    // Fetch the created category
    if (!result.id) {
      throw new Error('Database create operation succeeded but did not return an ID');
    }
    console.log('🔍 [POST] Fetching created category with ID:', result.id);
    const createdCategory = await db.readOne<FoodCategory>('foodcategories', {
      _id: new ObjectId(result.id),
    });

    if (!createdCategory.success || !createdCategory.data) {
      console.log('❌ [POST] Failed to fetch created category:', {
        success: createdCategory.success,
        data: !!createdCategory.data,
        error: createdCategory.error,
        categoryId: result.id
      });
      return NextResponse.json({ error: 'Failed to retrieve created category' }, { status: 500 });
    }

    console.log('✅ [POST] Created category fetched successfully:', createdCategory.data?.name);

    // Fetch updated day-wise items from mapping collection
    let dayWiseItems = createdCategory.data?.dayWiseItems ?? [];
    if (createdCategory.data?.listingType === 'day-wise' && createdCategory.data?._id) {
      const mappedItems = await fetchDayWiseItemsForCategory(createdCategory.data._id as ObjectId);
      if (mappedItems.length > 0) {
        dayWiseItems = mappedItems;
      }
    }

    // Calculate item count for the newly created category
    const itemCount = await calculateItemCount(createdCategory.data!);

    // Ensure backward compatibility in response
    const responseCategory = {
      ...createdCategory.data,
      isDraft: createdCategory.data?.isDraft ?? false,
      listingType: createdCategory.data?.listingType ?? 'flat',
      dayWiseItems,
      itemCount,
    };

    return NextResponse.json(responseCategory, { status: 201 });
  } catch (error) {
    console.error('Error in POST /api/admin/food-category:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/admin/food-category
 * Update existing food category
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
    const {
      _id,
      name,
      description,
      url,
      public_id,
      sequence,
      isDraft,
      listingType,
      dayWiseItems: inputDayWiseItems,
      isImageUpdated,
      parentCategoryId: parentCategoryIdRaw,
    } = body;

    // Validate required fields
    if (!_id) {
      return NextResponse.json({ error: 'Category ID is required' }, { status: 400 });
    }

    // Convert string ID to ObjectId
    let categoryId: ObjectId;
    try {
      categoryId = new ObjectId(_id);
    } catch (error) {
      return NextResponse.json({ error: 'Invalid category ID format' }, { status: 400 });
    }

    // Validate isDraft field if provided
    if (isDraft !== undefined && typeof isDraft !== 'boolean') {
      return NextResponse.json(
        { error: 'isDraft must be a boolean value' },
        { status: 400 }
      );
    }

    // Validate sequence field if provided
    if (sequence !== undefined && sequence !== null) {
      if (typeof sequence !== 'number' || !Number.isInteger(sequence) || sequence < 1) {
        return NextResponse.json(
          { error: 'Sequence must be a positive integer' },
          { status: 400 }
        );
      }
    }

  // Validate listingType field if provided
    if (listingType !== undefined && !validateListingType(listingType)) {
      return NextResponse.json(
        { error: 'listingType must be either "flat" or "day-wise"' },
        { status: 400 }
      );
    }

  // Validate dayWiseItems field if provided
    if (inputDayWiseItems !== undefined) {
      const validationResult = await validateDayWiseItems(inputDayWiseItems);
      if (!validationResult.isValid) {
        return NextResponse.json(
          {
            error: validationResult.errorMessage || 'dayWiseItems validation failed',
            details: validationResult.details ? {
              ...validationResult.details,
              guidance: 'dayWiseItems must be an array of objects with valid day names (from enabled days) and item IDs (as strings)'
            } : 'dayWiseItems must be an array of objects with valid day names (from enabled days) and item IDs (as strings)'
          },
          { status: 400 }
        );
      }
    }

    // Fetch existing category
    console.log('🔍 [PUT] Fetching existing category with ID:', categoryId.toHexString());
    const existingResult = await db.readOne<FoodCategory>('foodcategories', {
      _id: categoryId,
    });

    if (!existingResult.success || !existingResult.data) {
      console.log('❌ [PUT] Category not found. Query result:', {
        success: existingResult.success,
        data: !!existingResult.data,
        error: existingResult.error,
        categoryId: categoryId.toHexString()
      });
      return NextResponse.json({ error: 'Category not found' }, { status: 404 });
    }

    console.log('✅ [PUT] Category found successfully:', existingResult.data?.name);
    const existingCategory = existingResult.data;
    const oldPublicId = existingCategory.public_id;

  // Determine final listing type (existing or new)
    const finalListingType = listingType ?? existingCategory.listingType ?? 'flat';

  // Note: Removed restrictive validation that required dayWiseItems to have items for every day
  // This allows restaurant managers to update categories with empty day arrays for seasonal scheduling

    if (finalListingType === 'flat' && inputDayWiseItems && inputDayWiseItems.length > 0) {
      return NextResponse.json(
        { error: 'dayWiseItems should not be provided when listingType is "flat"' },
        { status: 400 }
      );
    }

    // Prepare update data
    const updateData: Partial<FoodCategory> = {
      updatedAt: new Date(),
    };

    if (name !== undefined) updateData.name = name.trim();
    if (description !== undefined) updateData.description = description.trim();
    if (url !== undefined) updateData.url = url;
    if (public_id !== undefined) updateData.public_id = public_id;
    if (sequence !== undefined && sequence !== null) updateData.sequence = sequence;
    if (isDraft !== undefined) updateData.isDraft = isDraft;
    if (listingType !== undefined) updateData.listingType = listingType;
    if (inputDayWiseItems !== undefined) updateData.dayWiseItems = inputDayWiseItems;

    let unsetParentCategoryId = false;
    if ('parentCategoryId' in body) {
      const raw = body.parentCategoryId;
      if (raw === null || raw === '' || (typeof raw === 'string' && !raw.trim())) {
        unsetParentCategoryId = true;
      } else if (typeof raw === 'string') {
        const parentResolved = await resolveParentCategoryObjectId(raw);
        if (!parentResolved.ok) {
          return NextResponse.json({ error: parentResolved.error }, { status: 400 });
        }
        if (!parentResolved.parentObjectId) {
          unsetParentCategoryId = true;
        } else if (parentResolved.parentObjectId.equals(categoryId)) {
          return NextResponse.json(
            { error: 'A category cannot be its own parent' },
            { status: 400 }
          );
        } else {
          updateData.parentCategoryId = parentResolved.parentObjectId;
        }
      } else {
        return NextResponse.json(
          { error: 'parentCategoryId must be a string, empty string, or null' },
          { status: 400 }
        );
      }
    }

    const updatePayload: UpdateFilter<FoodCategory> = { $set: updateData };
    if (unsetParentCategoryId) {
      updatePayload.$unset = { parentCategoryId: '' };
      delete updateData.parentCategoryId;
    }

    // Update category
    console.log('🔧 [PUT] Updating category with ID:', categoryId.toHexString());
    const updateResult = await db.updateOne<FoodCategory>(
      'foodcategories',
      { _id: categoryId },
      updatePayload
    );

    if (!updateResult.success) {
      console.log('❌ [PUT] Failed to update category:', {
        categoryId: categoryId.toHexString(),
        error: updateResult.error,
        success: updateResult.success
      });
      throw new Error(updateResult.error || 'Failed to update category');
    }

    console.log('✅ [PUT] Category updated successfully');

    // If image was updated and there was an old image, delete it from Cloudinary
    if (isImageUpdated && oldPublicId) {
      await deleteFromCloudinary(oldPublicId);
    }

    // Fetch updated category
    console.log('✅ [PUT] Fetching updated category with ID:', categoryId.toHexString());
    const updatedCategory = await db.readOne<FoodCategory>('foodcategories', {
      _id: categoryId,
    });

    // Fetch updated day-wise items from mapping collection
    let updatedDayWiseItems = updatedCategory.data?.dayWiseItems ?? [];
    if (updatedCategory.data?.listingType === 'day-wise') {
      const mappedItems = await fetchDayWiseItemsForCategory(categoryId);
      if (mappedItems.length > 0) {
        updatedDayWiseItems = mappedItems;
      }
    }

    // Calculate item count for the updated category
    const itemCount = await calculateItemCount(updatedCategory.data!);

    // Ensure backward compatibility in response
    const responseCategory = {
      ...updatedCategory.data,
      isDraft: updatedCategory.data?.isDraft ?? false,
      listingType: updatedCategory.data?.listingType ?? 'flat',
      dayWiseItems: updatedDayWiseItems,
      itemCount,
    };

    return NextResponse.json(responseCategory);
  } catch (error) {
    console.error('Error in PUT /api/admin/food-category:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/admin/food-category
 * Delete food category
 */
export async function DELETE(request: NextRequest) {
  try {
    // Verify authentication
    const authResult = verifyAuth(request);
    if (!authResult.success) {
      return NextResponse.json({ error: authResult.error }, { status: 401 });
    }

    // Get category ID from query params
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'Category ID is required' }, { status: 400 });
    }

    // Convert string ID to ObjectId
    let categoryId: ObjectId;
    try {
      categoryId = new ObjectId(id);
    } catch (error) {
      return NextResponse.json({ error: 'Invalid category ID format' }, { status: 400 });
    }

    // Fetch category to get public_id for image deletion
    console.log('🔍 [DELETE] Fetching category with ID:', categoryId.toHexString());
    const existingResult = await db.readOne<FoodCategory>('foodcategories', {
      _id: categoryId,
    });

    if (!existingResult.success || !existingResult.data) {
      console.log('❌ [DELETE] Category not found. Query result:', {
        success: existingResult.success,
        data: !!existingResult.data,
        error: existingResult.error,
        categoryId: categoryId.toHexString()
      });
      return NextResponse.json({ error: 'Category not found' }, { status: 404 });
    }

    console.log('✅ [DELETE] Category found successfully:', existingResult.data?.name);
    const category = existingResult.data;

    // Delete from database
    console.log('🗑️ [DELETE] Deleting category with ID:', categoryId.toHexString());
    const deleteResult = await db.deleteOne<FoodCategory>('foodcategories', {
      _id: categoryId,
    });

    if (!deleteResult.success) {
      throw new Error(deleteResult.error || 'Failed to delete category');
    }

    // Delete image from Cloudinary if exists
    if (category.public_id) {
      const cloudinaryResult = await deleteFromCloudinary(category.public_id);
      if (!cloudinaryResult.success) {
        console.error('Failed to delete image from Cloudinary:', cloudinaryResult.error);
        // Continue anyway as DB deletion was successful
      }
    }

    return NextResponse.json({ success: true, message: 'Category deleted successfully' });
  } catch (error) {
    console.error('Error in DELETE /api/admin/food-category:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}
