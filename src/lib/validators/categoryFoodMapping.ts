import { ObjectId } from 'mongodb';
import { z } from 'zod';
import { BaseCategoryFoodMapping, FlatCategoryFoodMapping, DayWiseCategoryFoodMapping, MappingType, CategoryFoodMapping } from '@/types/order';

/**
 * Validation utilities for CategoryFoodMapping operations
 * Provides schemas and validation functions for discriminated schema with FLAT and DAY_WISE types
 */

/**
 * Re-export types for convenience
 */
export type { BaseCategoryFoodMapping, FlatCategoryFoodMapping, DayWiseCategoryFoodMapping, CategoryFoodMapping };

/**
 * Zod schema for MappingType discriminator
 */
const mappingTypeSchema = z.enum(['FLAT', 'DAY_WISE'], {
  errorMap: () => ({ message: 'Mapping type must be either FLAT or DAY_WISE' })
});

/**
 * Zod schema for FLAT mapping creation
 */
export const createFlatMappingSchema = z.object({
  foodItemId: z.string().min(1, 'Food item ID is required'),
  categoryId: z.string().min(1, 'Category ID is required'),
  sequence: z.number().int().min(0, 'Sequence must be a non-negative integer').optional(),
  mappingType: z.literal('FLAT'),
});

/**
 * Zod schema for DAY_WISE mapping creation
 */
export const createDayWiseMappingSchema = z.object({
  foodItemId: z.string().min(1, 'Food item ID is required'),
  categoryId: z.string().min(1, 'Category ID is required'),
  sequence: z.number().int().min(0, 'Sequence must be a non-negative integer').optional(),
  mappingType: z.literal('DAY_WISE'),
  day: z.string().min(1, 'Day is required for DAY_WISE mapping type'),
});

/**
 * Discriminated union schema for creating any mapping type
 */
export const createMappingSchema = z.discriminatedUnion('mappingType', [
  createFlatMappingSchema,
  createDayWiseMappingSchema
]);

/**
 * Legacy schema for backward compatibility (defaults to FLAT)
 * @deprecated Use createMappingSchema with explicit mappingType instead
 */
export const createMappingLegacySchema = z.object({
  foodItemId: z.string().min(1, 'Food item ID is required'),
  categoryId: z.string().min(1, 'Category ID is required'),
  sequence: z.number().int().min(0, 'Sequence must be a non-negative integer').optional(),
});

/**
 * Zod schema for bulk FLAT category-food mappings
 * Used when assigning multiple categories to a food item in FLAT mode
 */
export const bulkFlatMappingSchema = z.object({
  foodItemId: z.string().min(1, 'Food item ID is required'),
  categories: z.array(z.object({
    categoryId: z.string().min(1, 'Category ID is required'),
    sequence: z.number().int().min(0, 'Sequence must be a non-negative integer'),
  })).min(1, 'At least one category is required'),
  mappingType: z.literal('FLAT'),
});

/**
 * Zod schema for bulk DAY_WISE category-food mappings
 * Used when assigning multiple categories to a food item in DAY_WISE mode
 */
export const bulkDayWiseMappingSchema = z.object({
  foodItemId: z.string().min(1, 'Food item ID is required'),
  categories: z.array(z.object({
    categoryId: z.string().min(1, 'Category ID is required'),
    sequence: z.number().int().min(0, 'Sequence must be a non-negative integer'),
    day: z.string().min(1, 'Day is required for DAY_WISE mapping'),
  })).min(1, 'At least one category is required'),
  mappingType: z.literal('DAY_WISE'),
});

/**
 * Discriminated union schema for bulk mappings
 */
export const bulkMappingSchema = z.discriminatedUnion('mappingType', [
  bulkFlatMappingSchema,
  bulkDayWiseMappingSchema
]);

/**
 * Legacy bulk schema for backward compatibility (defaults to FLAT)
 * @deprecated Use bulkMappingSchema with explicit mappingType instead
 */
export const bulkMappingLegacySchema = z.object({
  foodItemId: z.string().min(1, 'Food item ID is required'),
  categories: z.array(z.object({
    categoryId: z.string().min(1, 'Category ID is required'),
    sequence: z.number().int().min(0, 'Sequence must be a non-negative integer'),
  })).min(1, 'At least one category is required'),
});

/**
 * Zod schema for updating mapping sequence
 */
export const updateMappingSchema = z.object({
  _id: z.string().min(1, 'Mapping ID is required'),
  sequence: z.number().int().min(0, 'Sequence must be a non-negative integer'),
});

/**
 * ValidationResult interface
 */
export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  data?: any;
}

/**
 * Validate ObjectId format
 */
export function isValidObjectId(id: string): boolean {
  return ObjectId.isValid(id);
}

/**
 * Validate category mapping creation data (with discriminated union support)
 */
export function validateCreateMapping(data: unknown): ValidationResult {
  // Try discriminated schema first
  let result = createMappingSchema.safeParse(data);

  // Fall back to legacy schema for backward compatibility
  if (!result.success) {
    const legacyResult = createMappingLegacySchema.safeParse(data);
    if (legacyResult.success) {
      // Default to FLAT mapping type for legacy data
      result = {
        success: true,
        data: {
          ...legacyResult.data,
          mappingType: 'FLAT' as const
        }
      };
    }
  }

  if (!result.success) {
    return {
      isValid: false,
      errors: result.error.issues.map(issue => `${issue.path.join('.')}: ${issue.message}`)
    };
  }

  // Validate ObjectId formats
  const { foodItemId, categoryId } = result.data;
  const errors: string[] = [];

  if (!isValidObjectId(foodItemId)) {
    errors.push('Invalid food item ID format');
  }

  if (!isValidObjectId(categoryId)) {
    errors.push('Invalid category ID format');
  }

  // Validate DAY_WISE specific fields
  if (result.data.mappingType === 'DAY_WISE') {
    if (!('day' in result.data) || !result.data.day) {
      errors.push('Day is required for DAY_WISE mapping type');
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
    data: result.data
  };
}

/**
 * Validate bulk category mapping data (with discriminated union support)
 */
export function validateBulkMapping(data: unknown): ValidationResult {
  // Try discriminated schema first
  let result = bulkMappingSchema.safeParse(data);

  // Fall back to legacy schema for backward compatibility
  if (!result.success) {
    const legacyResult = bulkMappingLegacySchema.safeParse(data);
    if (legacyResult.success) {
      // Default to FLAT mapping type for legacy data
      result = {
        success: true,
        data: {
          ...legacyResult.data,
          mappingType: 'FLAT' as const
        }
      };
    }
  }

  if (!result.success) {
    return {
      isValid: false,
      errors: result.error.issues.map(issue => `${issue.path.join('.')}: ${issue.message}`)
    };
  }

  // Validate ObjectId formats
  const { foodItemId, categories } = result.data;
  const errors: string[] = [];

  if (!isValidObjectId(foodItemId)) {
    errors.push('Invalid food item ID format');
  }

  categories.forEach((cat, index) => {
    if (!isValidObjectId(cat.categoryId)) {
      errors.push(`Invalid category ID format at index ${index}`);
    }

    // Validate DAY_WISE specific fields
    if (result.data.mappingType === 'DAY_WISE') {
      if (!('day' in cat) || !cat.day) {
        errors.push(`Day is required for DAY_WISE mapping at category index ${index}`);
      }
    }
  });

  return {
    isValid: errors.length === 0,
    errors,
    data: result.data
  };
}

/**
 * Validate mapping update data
 */
export function validateUpdateMapping(data: unknown): ValidationResult {
  const result = updateMappingSchema.safeParse(data);

  if (!result.success) {
    return {
      isValid: false,
      errors: result.error.issues.map(issue => `${issue.path.join('.')}: ${issue.message}`)
    };
  }

  // Validate ObjectId format
  const { _id } = result.data;
  const errors: string[] = [];

  if (!isValidObjectId(_id)) {
    errors.push('Invalid mapping ID format');
  }

  return {
    isValid: errors.length === 0,
    errors,
    data: result.data
  };
}

/**
 * Validate that a food item can be added to a category
 * Checks for duplicate mappings
 */
export function validateMappingUniqueness(
  existingMappings: CategoryFoodMapping[],
  newFoodItemId: string,
  newCategoryId: string
): ValidationResult {
  const errors: string[] = [];

  const hasDuplicate = existingMappings.some(mapping =>
    mapping.foodItemId.toString() === newFoodItemId &&
    mapping.categoryId.toString() === newCategoryId
  );

  if (hasDuplicate) {
    errors.push('Mapping already exists for this food item and category combination');
  }

  return {
    isValid: errors.length === 0,
    errors
  };
}

/**
 * Validate sequence numbers are unique for a food item
 */
export function validateSequenceUniqueness(categories: Array<{categoryId: string, sequence: number}>): ValidationResult {
  const errors: string[] = [];
  const sequences = categories.map(c => c.sequence);
  const uniqueSequences = new Set(sequences);

  if (sequences.length !== uniqueSequences.size) {
    errors.push('Sequence numbers must be unique for a food item within a category');
  }

  return {
    isValid: errors.length === 0,
    errors
  };
}

/**
 * Validate category mapping data before database operation
 * Comprehensive validation including uniqueness and format checks
 */
export async function validateMappingOperation(
  operation: 'create' | 'update' | 'delete',
  data: any,
  existingMappings?: CategoryFoodMapping[]
): Promise<ValidationResult> {
  const errors: string[] = [];

  // Step 1: Schema validation
  let schemaResult: ValidationResult;
  switch (operation) {
    case 'create':
      schemaResult = validateCreateMapping(data);
      break;
    case 'update':
      schemaResult = validateUpdateMapping(data);
      break;
    case 'delete':
      // Delete operations only need valid ID
      if (!data._id && !data.foodItemId) {
        return {
          isValid: false,
          errors: ['Either mapping ID or food item ID is required for deletion']
        };
      }
      schemaResult = { isValid: true, errors: [] };
      break;
  }

  if (!schemaResult.isValid) {
    return schemaResult;
  }

  // Step 2: Uniqueness validation for create operations
  if (operation === 'create' && existingMappings && schemaResult.data) {
    const { foodItemId, categoryId } = schemaResult.data;
    const uniquenessResult = validateMappingUniqueness(
      existingMappings,
      foodItemId,
      categoryId
    );

    if (!uniquenessResult.isValid) {
      return uniquenessResult;
    }
  }

  return {
    isValid: true,
    errors: [],
    data: schemaResult.data
  };
}

/**
 * Validate bulk category assignment
 * Ensures all category IDs are unique and sequences are valid
 */
export function validateBulkCategoryAssignment(data: unknown): ValidationResult {
  const result = validateBulkMapping(data);

  if (!result.isValid) {
    return result;
  }

  if (!result.data) {
    return { isValid: false, errors: ['No data provided'] };
  }

  const { categories } = result.data;
  const errors: string[] = [];

  // Check for duplicate category IDs
  const categoryIds = categories.map((c: {categoryId: string, sequence: number}) => c.categoryId);
  const uniqueCategoryIds = new Set(categoryIds);

  if (categoryIds.length !== uniqueCategoryIds.size) {
    errors.push('Duplicate category IDs detected. Each category can only be assigned once.');
  }

  // Check for duplicate sequences
  const sequences = categories.map((c: {categoryId: string, sequence: number}) => c.sequence);
  const uniqueSequences = new Set(sequences);

  if (sequences.length !== uniqueSequences.size) {
    errors.push('Duplicate sequence numbers detected. Sequences must be unique.');
  }

  return {
    isValid: errors.length === 0,
    errors,
    data: result.data
  };
}

/**
 * Type guard to check if an object is a valid CategoryFoodMapping (discriminated)
 */
export function isCategoryFoodMapping(obj: any): obj is CategoryFoodMapping {
  return (
    obj &&
    typeof obj === 'object' &&
    obj.foodItemId instanceof ObjectId &&
    obj.categoryId instanceof ObjectId &&
    typeof obj.sequence === 'number' &&
    obj.sequence >= 0 &&
    (obj.mappingType === 'FLAT' || obj.mappingType === 'DAY_WISE') &&
    (obj.mappingType !== 'DAY_WISE' || typeof obj.day === 'string')
  );
}

/**
 * Type guard to check if mapping is FLAT type
 */
export function isFlatMapping(obj: any): obj is FlatCategoryFoodMapping {
  return isCategoryFoodMapping(obj) && obj.mappingType === 'FLAT';
}

/**
 * Type guard to check if mapping is DAY_WISE type
 */
export function isDayWiseMapping(obj: any): obj is DayWiseCategoryFoodMapping {
  return isCategoryFoodMapping(obj) && obj.mappingType === 'DAY_WISE' && typeof obj.day === 'string';
}

/**
 * Sanitize mapping data for database operations
 * Converts string IDs to ObjectIds and sets timestamps
 * Supports discriminated union with mappingType
 */
export function sanitizeMappingData(
  data: any,
  operation: 'create' | 'update'
): Partial<BaseCategoryFoodMapping> {
  const sanitized: Partial<BaseCategoryFoodMapping> = {};

  if (data.foodItemId) {
    sanitized.foodItemId = typeof data.foodItemId === 'string'
      ? new ObjectId(data.foodItemId)
      : data.foodItemId;
  }

  if (data.categoryId) {
    sanitized.categoryId = typeof data.categoryId === 'string'
      ? new ObjectId(data.categoryId)
      : data.categoryId;
  }

  if (data.sequence !== undefined) {
    sanitized.sequence = data.sequence;
  }

  if (data.mappingType) {
    sanitized.mappingType = data.mappingType;
  } else if (operation === 'create') {
    // Default to FLAT for new mappings if not specified
    sanitized.mappingType = 'FLAT';
  }

  if (data.day && data.mappingType === 'DAY_WISE') {
    (sanitized as Partial<DayWiseCategoryFoodMapping>).day = data.day;
  }

  if (operation === 'create') {
    sanitized.createdAt = new Date();
    sanitized.updatedAt = new Date();
  } else if (operation === 'update') {
    sanitized.updatedAt = new Date();
  }

  return sanitized;
}
