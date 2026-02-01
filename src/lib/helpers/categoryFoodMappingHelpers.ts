import { ObjectId } from 'mongodb';
import { db } from '@/lib/db';
import { CategoryFoodMapping, MappingType } from '@/types/order';

/**
 * Helper functions for CategoryFoodMapping operations
 * Provides convenient methods for common category-food mapping queries
 * Supports both FLAT and DAY_WISE mapping types
 */

/**
 * Result interface for helper functions
 */
export interface HelperResult<T> {
  success: boolean;
  data?: T;
  error?: string;
}

/**
 * Filter options for mapping queries
 */
export interface MappingFilterOptions {
  mappingType?: MappingType;
  day?: string; // Required for DAY_WISE queries
}

/**
 * Get all category IDs for a food item
 * @param foodItemId - The food item ID
 * @param options - Optional filters for mappingType and day
 * @returns Array of category IDs sorted by sequence
 */
export async function getCategoriesForFoodItem(
  foodItemId: string,
  options?: MappingFilterOptions
): Promise<HelperResult<string[]>> {
  try {
    if (!ObjectId.isValid(foodItemId)) {
      return {
        success: false,
        error: 'Invalid food item ID format'
      };
    }

    const query: any = { foodItemId: new ObjectId(foodItemId) };

    // Apply filters if provided
    if (options?.mappingType) {
      query.mappingType = options.mappingType;

      // For DAY_WISE, validate day parameter
      if (options.mappingType === 'DAY_WISE') {
        if (!options.day) {
          return {
            success: false,
            error: 'Day parameter is required for DAY_WISE mapping type'
          };
        }
        query.day = options.day;
      }
    }

    const result = await db.read<CategoryFoodMapping>(
      'categoryfoodmapping',
      query,
      { sort: { sequence: 1 } }
    );

    if (!result.success) {
      return {
        success: false,
        error: result.error || 'Failed to fetch categories'
      };
    }

    const categoryIds = (result.data || []).map(mapping => mapping.categoryId.toString());

    return {
      success: true,
      data: categoryIds
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

/**
 * Get all food item IDs in a category
 * @param categoryId - The category ID
 * @param options - Optional filters for mappingType and day
 * @returns Array of food item IDs sorted by sequence
 */
export async function getFoodItemsInCategory(
  categoryId: string,
  options?: MappingFilterOptions
): Promise<HelperResult<string[]>> {
  try {
    if (!ObjectId.isValid(categoryId)) {
      return {
        success: false,
        error: 'Invalid category ID format'
      };
    }

    const query: any = { categoryId: new ObjectId(categoryId) };

    // Apply filters if provided
    if (options?.mappingType) {
      query.mappingType = options.mappingType;

      // For DAY_WISE, validate day parameter
      if (options.mappingType === 'DAY_WISE') {
        if (!options.day) {
          return {
            success: false,
            error: 'Day parameter is required for DAY_WISE mapping type'
          };
        }
        query.day = options.day;
      }
    }

    const result = await db.read<CategoryFoodMapping>(
      'categoryfoodmapping',
      query,
      { sort: { sequence: 1 } }
    );

    if (!result.success) {
      return {
        success: false,
        error: result.error || 'Failed to fetch food items'
      };
    }

    const foodItemIds = (result.data || []).map(mapping => mapping.foodItemId.toString());

    return {
      success: true,
      data: foodItemIds
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

/**
 * Get all mappings for a food item with full details
 * @param foodItemId - The food item ID
 * @param options - Optional filters for mappingType and day
 * @returns Array of CategoryFoodMapping objects
 */
export async function getMappingsForFoodItem(
  foodItemId: string,
  options?: MappingFilterOptions
): Promise<HelperResult<CategoryFoodMapping[]>> {
  try {
    if (!ObjectId.isValid(foodItemId)) {
      return {
        success: false,
        error: 'Invalid food item ID format'
      };
    }

    const query: any = { foodItemId: new ObjectId(foodItemId) };

    // Apply filters if provided
    if (options?.mappingType) {
      query.mappingType = options.mappingType;

      // For DAY_WISE, validate day parameter
      if (options.mappingType === 'DAY_WISE') {
        if (!options.day) {
          return {
            success: false,
            error: 'Day parameter is required for DAY_WISE mapping type'
          };
        }
        query.day = options.day;
      }
    }

    const result = await db.read<CategoryFoodMapping>(
      'categoryfoodmapping',
      query,
      { sort: { sequence: 1 } }
    );

    if (!result.success) {
      return {
        success: false,
        error: result.error || 'Failed to fetch mappings'
      };
    }

    return {
      success: true,
      data: result.data || []
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

/**
 * Get all mappings for a category with full details
 * @param categoryId - The category ID
 * @param options - Optional filters for mappingType and day
 * @returns Array of CategoryFoodMapping objects
 */
export async function getMappingsForCategory(
  categoryId: string,
  options?: MappingFilterOptions
): Promise<HelperResult<CategoryFoodMapping[]>> {
  try {
    if (!ObjectId.isValid(categoryId)) {
      return {
        success: false,
        error: 'Invalid category ID format'
      };
    }

    const query: any = { categoryId: new ObjectId(categoryId) };

    // Apply filters if provided
    if (options?.mappingType) {
      query.mappingType = options.mappingType;

      // For DAY_WISE, validate day parameter
      if (options.mappingType === 'DAY_WISE') {
        if (!options.day) {
          return {
            success: false,
            error: 'Day parameter is required for DAY_WISE mapping type'
          };
        }
        query.day = options.day;
      }
    }

    const result = await db.read<CategoryFoodMapping>(
      'categoryfoodmapping',
      query,
      { sort: { sequence: 1 } }
    );

    if (!result.success) {
      return {
        success: false,
        error: result.error || 'Failed to fetch mappings'
      };
    }

    return {
      success: true,
      data: result.data || []
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

/**
 * Check if a food item belongs to a specific category
 * @param foodItemId - The food item ID
 * @param categoryId - The category ID
 * @param options - Optional filters for mappingType and day
 * @returns true if the mapping exists
 */
export async function isFoodItemInCategory(
  foodItemId: string,
  categoryId: string,
  options?: MappingFilterOptions
): Promise<HelperResult<boolean>> {
  try {
    if (!ObjectId.isValid(foodItemId) || !ObjectId.isValid(categoryId)) {
      return {
        success: false,
        error: 'Invalid ID format'
      };
    }

    const query: any = {
      foodItemId: new ObjectId(foodItemId),
      categoryId: new ObjectId(categoryId)
    };

    // Apply filters if provided
    if (options?.mappingType) {
      query.mappingType = options.mappingType;

      // For DAY_WISE, validate day parameter
      if (options.mappingType === 'DAY_WISE') {
        if (!options.day) {
          return {
            success: false,
            error: 'Day parameter is required for DAY_WISE mapping type'
          };
        }
        query.day = options.day;
      }
    }

    const result = await db.readOne<CategoryFoodMapping>('categoryfoodmapping', query);

    if (!result.success) {
      return {
        success: false,
        error: result.error || 'Failed to check mapping'
      };
    }

    return {
      success: true,
      data: !!result.data
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

/**
 * Get the sequence number of a food item in a category
 * @param foodItemId - The food item ID
 * @param categoryId - The category ID
 * @param options - Optional filters for mappingType and day
 * @returns Sequence number or null if not found
 */
export async function getFoodItemSequenceInCategory(
  foodItemId: string,
  categoryId: string,
  options?: MappingFilterOptions
): Promise<HelperResult<number | null>> {
  try {
    if (!ObjectId.isValid(foodItemId) || !ObjectId.isValid(categoryId)) {
      return {
        success: false,
        error: 'Invalid ID format'
      };
    }

    const query: any = {
      foodItemId: new ObjectId(foodItemId),
      categoryId: new ObjectId(categoryId)
    };

    // Apply filters if provided
    if (options?.mappingType) {
      query.mappingType = options.mappingType;

      // For DAY_WISE, validate day parameter
      if (options.mappingType === 'DAY_WISE') {
        if (!options.day) {
          return {
            success: false,
            error: 'Day parameter is required for DAY_WISE mapping type'
          };
        }
        query.day = options.day;
      }
    }

    const result = await db.readOne<CategoryFoodMapping>('categoryfoodmapping', query);

    if (!result.success) {
      return {
        success: false,
        error: result.error || 'Failed to fetch sequence'
      };
    }

    return {
      success: true,
      data: result.data?.sequence ?? null
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

/**
 * Count the number of food items in a category
 * @param categoryId - The category ID
 * @param options - Optional filters for mappingType and day
 * @returns Count of food items
 */
export async function countFoodItemsInCategory(
  categoryId: string,
  options?: MappingFilterOptions
): Promise<HelperResult<number>> {
  try {
    if (!ObjectId.isValid(categoryId)) {
      return {
        success: false,
        error: 'Invalid category ID format'
      };
    }

    const query: any = { categoryId: new ObjectId(categoryId) };

    // Apply filters if provided
    if (options?.mappingType) {
      query.mappingType = options.mappingType;

      // For DAY_WISE, validate day parameter
      if (options.mappingType === 'DAY_WISE') {
        if (!options.day) {
          return {
            success: false,
            error: 'Day parameter is required for DAY_WISE mapping type'
          };
        }
        query.day = options.day;
      }
    }

    const result = await db.count<CategoryFoodMapping>('categoryfoodmapping', query);

    if (!result.success) {
      return {
        success: false,
        error: result.error || 'Failed to count items'
      };
    }

    return {
      success: true,
      data: result.count ?? 0
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

/**
 * Count the number of categories for a food item
 * @param foodItemId - The food item ID
 * @param options - Optional filters for mappingType and day
 * @returns Count of categories
 */
export async function countCategoriesForFoodItem(
  foodId: string,
  options?: MappingFilterOptions
): Promise<HelperResult<number>> {
  try {
    if (!ObjectId.isValid(foodId)) {
      return {
        success: false,
        error: 'Invalid food item ID format'
      };
    }

    const query: any = { foodItemId: new ObjectId(foodId) };

    // Apply filters if provided
    if (options?.mappingType) {
      query.mappingType = options.mappingType;

      // For DAY_WISE, validate day parameter
      if (options.mappingType === 'DAY_WISE') {
        if (!options.day) {
          return {
            success: false,
            error: 'Day parameter is required for DAY_WISE mapping type'
          };
        }
        query.day = options.day;
      }
    }

    const result = await db.count<CategoryFoodMapping>('categoryfoodmapping', query);

    if (!result.success) {
      return {
        success: false,
        error: result.error || 'Failed to count categories'
      };
    }

    return {
      success: true,
      data: result.count ?? 0
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

/**
 * Create a new category-food mapping
 * @param foodItemId - The food item ID
 * @param categoryId - The category ID
 * @param mappingType - The mapping type ('FLAT' or 'DAY_WISE')
 * @param sequence - The sequence number (optional)
 * @param day - The day (required for DAY_WISE mapping type)
 * @returns Created mapping or error
 */
export async function createCategoryMapping(
  foodItemId: string,
  categoryId: string,
  mappingType: MappingType = 'FLAT',
  sequence?: number,
  day?: string
): Promise<HelperResult<CategoryFoodMapping>> {
  try {
    if (!ObjectId.isValid(foodItemId) || !ObjectId.isValid(categoryId)) {
      return {
        success: false,
        error: 'Invalid ID format'
      };
    }

    // Validate DAY_WISE requirements
    if (mappingType === 'DAY_WISE' && !day) {
      return {
        success: false,
        error: 'Day parameter is required for DAY_WISE mapping type'
      };
    }

    // Check if mapping already exists
    const existingResult = await isFoodItemInCategory(foodItemId, categoryId, {
      mappingType,
      day: mappingType === 'DAY_WISE' ? day : undefined
    });
    if (!existingResult.success) {
      return {
        success: false,
        error: 'Failed to check existing mapping'
      };
    }

    if (existingResult.data) {
      return {
        success: false,
        error: 'Mapping already exists for this food item and category with the same type and day'
      };
    }

    // Auto-generate sequence if not provided
    let finalSequence = sequence ?? 0;
    if (sequence === undefined) {
      const countResult = await countFoodItemsInCategory(categoryId, {
        mappingType,
        day: mappingType === 'DAY_WISE' ? day : undefined
      });
      if (countResult.success) {
        finalSequence = countResult.data ?? 0;
      }
    }

    const mappingData: CategoryFoodMapping = mappingType === 'DAY_WISE' ? {
      foodItemId: new ObjectId(foodItemId),
      categoryId: new ObjectId(categoryId),
      sequence: finalSequence,
      mappingType: 'DAY_WISE',
      day: day!,
      createdAt: new Date(),
      updatedAt: new Date()
    } : {
      foodItemId: new ObjectId(foodItemId),
      categoryId: new ObjectId(categoryId),
      sequence: finalSequence,
      mappingType: 'FLAT',
      createdAt: new Date(),
      updatedAt: new Date()
    };

    const result = await db.create<CategoryFoodMapping>('categoryfoodmapping', mappingData);

    if (!result.success) {
      return {
        success: false,
        error: result.error || 'Failed to create mapping'
      };
    }

    return {
      success: true,
      data: {
        ...mappingData,
        _id: result.id
      }
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

/**
 * Delete all category mappings for a food item
 * @param foodItemId - The food item ID
 * @returns Number of deleted mappings
 */
export async function deleteAllMappingsForFoodItem(foodItemId: string): Promise<HelperResult<number>> {
  try {
    if (!ObjectId.isValid(foodItemId)) {
      return {
        success: false,
        error: 'Invalid food item ID format'
      };
    }

    const result = await db.delete<CategoryFoodMapping>('categoryfoodmapping', {
      foodItemId: new ObjectId(foodItemId)
    });

    if (!result.success) {
      return {
        success: false,
        error: result.error || 'Failed to delete mappings'
      };
    }

    return {
      success: true,
      data: result.deletedCount ?? 0
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

/**
 * Delete all category mappings for a category
 * @param categoryId - The category ID
 * @returns Number of deleted mappings
 */
export async function deleteAllMappingsForCategory(categoryId: string): Promise<HelperResult<number>> {
  try {
    if (!ObjectId.isValid(categoryId)) {
      return {
        success: false,
        error: 'Invalid category ID format'
      };
    }

    const result = await db.delete<CategoryFoodMapping>('categoryfoodmapping', {
      categoryId: new ObjectId(categoryId)
    });

    if (!result.success) {
      return {
        success: false,
        error: result.error || 'Failed to delete mappings'
      };
    }

    return {
      success: true,
      data: result.deletedCount ?? 0
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

/**
 * Delete a specific category-food mapping
 * @param foodItemId - The food item ID
 * @param categoryId - The category ID
 * @returns Success status
 */
export async function deleteCategoryMapping(
  foodItemId: string,
  categoryId: string
): Promise<HelperResult<boolean>> {
  try {
    if (!ObjectId.isValid(foodItemId) || !ObjectId.isValid(categoryId)) {
      return {
        success: false,
        error: 'Invalid ID format'
      };
    }

    const result = await db.deleteOne<CategoryFoodMapping>('categoryfoodmapping', {
      foodItemId: new ObjectId(foodItemId),
      categoryId: new ObjectId(categoryId)
    });

    if (!result.success) {
      return {
        success: false,
        error: result.error || 'Failed to delete mapping'
      };
    }

    return {
      success: true,
      data: (result.deletedCount ?? 0) > 0
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

/**
 * Update the sequence of all items in a category
 * Useful for reordering items after deletion or insertion
 * @param categoryId - The category ID
 * @returns Success status
 */
export async function reorderCategoryItems(categoryId: string): Promise<HelperResult<boolean>> {
  try {
    // Fetch all mappings for this category
    const mappingsResult = await getMappingsForCategory(categoryId);

    if (!mappingsResult.success || !mappingsResult.data) {
      return {
        success: false,
        error: 'Failed to fetch category mappings'
      };
    }

    // Update sequence numbers
    const updatePromises = mappingsResult.data.map((mapping, index) =>
      db.updateOne<CategoryFoodMapping>(
        'categoryfoodmapping',
        { _id: mapping._id },
        { $set: { sequence: index, updatedAt: new Date() } }
      )
    );

    await Promise.all(updatePromises);

    return {
      success: true,
      data: true
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

/**
 * Batch create category mappings for a food item
 * Replaces all existing mappings with new ones
 * @param foodItemId - The food item ID
 * @param categoryIds - Array of category IDs with their sequence numbers and optional day
 * @param mappingType - The mapping type ('FLAT' or 'DAY_WISE')
 * @returns Number of created mappings
 */
export async function batchCreateCategoryMappings(
  foodItemId: string,
  categoryIds: Array<{ categoryId: string; sequence: number; day?: string }>,
  mappingType: MappingType = 'FLAT'
): Promise<HelperResult<number>> {
  try {
    if (!ObjectId.isValid(foodItemId)) {
      return {
        success: false,
        error: 'Invalid food item ID format'
      };
    }

    // Validate DAY_WISE requirements
    if (mappingType === 'DAY_WISE') {
      const missingDay = categoryIds.some(cat => !cat.day);
      if (missingDay) {
        return {
          success: false,
          error: 'Day parameter is required for all categories in DAY_WISE mapping type'
        };
      }
    }

    // Delete existing mappings of this type
    await deleteAllMappingsForFoodItem(foodItemId);

    // Create new mappings
    const mappingPromises = categoryIds.map(({ categoryId, sequence, day }) =>
      createCategoryMapping(foodItemId, categoryId, mappingType, sequence, day)
    );

    const results = await Promise.all(mappingPromises);
    const successCount = results.filter(r => r.success).length;

    return {
      success: true,
      data: successCount
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

/**
 * Get detailed category information for a food item
 * Joins with foodcategories collection to get category details
 * @param foodItemId - The food item ID
 * @param options - Optional filters for mappingType and day
 * @returns Array of categories with their details
 */
export async function getCategoryDetailsForFoodItem(
  foodItemId: string,
  options?: MappingFilterOptions
): Promise<HelperResult<any[]>> {
  try {
    if (!ObjectId.isValid(foodItemId)) {
      return {
        success: false,
        error: 'Invalid food item ID format'
      };
    }

    const mappingsResult = await getMappingsForFoodItem(foodItemId, options);

    if (!mappingsResult.success || !mappingsResult.data) {
      return {
        success: false,
        error: 'Failed to fetch category mappings'
      };
    }

    const categoryIds = mappingsResult.data.map(m => m.categoryId);

    // Fetch category details
    const categoriesResult = await db.read('foodcategories', {
      _id: { $in: categoryIds }
    });

    if (!categoriesResult.success) {
      return {
        success: false,
        error: 'Failed to fetch category details'
      };
    }

    // Merge category details with sequence and day
    const categoriesWithSequence = (categoriesResult.data || []).map(category => {
      const mapping = mappingsResult.data!.find(m => m.categoryId.toString() === category._id.toString());
      return {
        ...category,
        sequence: mapping?.sequence ?? 0,
        ...(mapping?.mappingType === 'DAY_WISE' && { day: (mapping as any).day })
      };
    });

    return {
      success: true,
      data: categoriesWithSequence
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

/**
 * Get all food items in a category for a specific day (DAY_WISE mapping)
 * @param categoryId - The category ID
 * @param day - The day to filter by (e.g., "Monday", "Tuesday")
 * @returns Array of food item IDs sorted by sequence
 */
export async function getFoodItemsInCategoryByDay(
  categoryId: string,
  day: string
): Promise<HelperResult<string[]>> {
  try {
    if (!ObjectId.isValid(categoryId)) {
      return {
        success: false,
        error: 'Invalid category ID format'
      };
    }

    const result = await db.read<CategoryFoodMapping>(
      'categoryfoodmapping',
      {
        categoryId: new ObjectId(categoryId),
        mappingType: 'DAY_WISE',
        day
      },
      { sort: { sequence: 1 } }
    );

    if (!result.success) {
      return {
        success: false,
        error: result.error || 'Failed to fetch food items'
      };
    }

    const foodItemIds = (result.data || []).map(mapping => mapping.foodItemId.toString());

    return {
      success: true,
      data: foodItemIds
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

/**
 * Get all categories for a food item for a specific day (DAY_WISE mapping)
 * @param foodItemId - The food item ID
 * @param day - The day to filter by (e.g., "Monday", "Tuesday")
 * @returns Array of category IDs sorted by sequence
 */
export async function getCategoriesForFoodItemByDay(
  foodItemId: string,
  day: string
): Promise<HelperResult<string[]>> {
  try {
    if (!ObjectId.isValid(foodItemId)) {
      return {
        success: false,
        error: 'Invalid food item ID format'
      };
    }

    const result = await db.read<CategoryFoodMapping>(
      'categoryfoodmapping',
      {
        foodItemId: new ObjectId(foodItemId),
        mappingType: 'DAY_WISE',
        day
      },
      { sort: { sequence: 1 } }
    );

    if (!result.success) {
      return {
        success: false,
        error: result.error || 'Failed to fetch categories'
      };
    }

    const categoryIds = (result.data || []).map(mapping => mapping.categoryId.toString());

    return {
      success: true,
      data: categoryIds
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

/**
 * Get all available days for a category (DAY_WISE mapping)
 * @param categoryId - The category ID
 * @returns Array of unique days
 */
export async function getDaysForCategory(categoryId: string): Promise<HelperResult<string[]>> {
  try {
    if (!ObjectId.isValid(categoryId)) {
      return {
        success: false,
        error: 'Invalid category ID format'
      };
    }

    // Get all DAY_WISE mappings for this category
    const result = await db.read<CategoryFoodMapping>(
      'categoryfoodmapping',
      {
        categoryId: new ObjectId(categoryId),
        mappingType: 'DAY_WISE'
      }
    );

    if (!result.success) {
      return {
        success: false,
        error: result.error || 'Failed to fetch days'
      };
    }

    // Extract unique days
    const days = [...new Set(
      (result.data || [])
        .map(mapping => (mapping as any).day)
        .filter(Boolean)
    )];

    return {
      success: true,
      data: days
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

/**
 * Get all available days for a food item (DAY_WISE mapping)
 * @param foodItemId - The food item ID
 * @returns Array of unique days
 */
export async function getDaysForFoodItem(foodItemId: string): Promise<HelperResult<string[]>> {
  try {
    if (!ObjectId.isValid(foodItemId)) {
      return {
        success: false,
        error: 'Invalid food item ID format'
      };
    }

    // Get all DAY_WISE mappings for this food item
    const result = await db.read<CategoryFoodMapping>(
      'categoryfoodmapping',
      {
        foodItemId: new ObjectId(foodItemId),
        mappingType: 'DAY_WISE'
      }
    );

    if (!result.success) {
      return {
        success: false,
        error: result.error || 'Failed to fetch days'
      };
    }

    // Extract unique days
    const days = [...new Set(
      (result.data || [])
        .map(mapping => (mapping as any).day)
        .filter(Boolean)
    )];

    return {
      success: true,
      data: days
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

/**
 * Delete all DAY_WISE mappings for a specific day
 * @param categoryId - The category ID (optional)
 * @param foodItemId - The food item ID (optional)
 * @param day - The day to delete mappings for
 * @returns Number of deleted mappings
 */
export async function deleteDayWiseMappingsForDay(
  day: string,
  categoryId?: string,
  foodItemId?: string
): Promise<HelperResult<number>> {
  try {
    const query: any = {
      mappingType: 'DAY_WISE',
      day
    };

    if (categoryId) {
      if (!ObjectId.isValid(categoryId)) {
        return {
          success: false,
          error: 'Invalid category ID format'
        };
      }
      query.categoryId = new ObjectId(categoryId);
    }

    if (foodItemId) {
      if (!ObjectId.isValid(foodItemId)) {
        return {
          success: false,
          error: 'Invalid food item ID format'
        };
      }
      query.foodItemId = new ObjectId(foodItemId);
    }

    const result = await db.delete<CategoryFoodMapping>('categoryfoodmapping', query);

    if (!result.success) {
      return {
        success: false,
        error: result.error || 'Failed to delete mappings'
      };
    }

    return {
      success: true,
      data: result.deletedCount ?? 0
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

