import { z } from 'zod';
import { FoodModifier, ModifierItemType, CreateFoodModifierDTO, UpdateFoodModifierDTO } from '@/types/modifier';

/**
 * Zod schema for ModifierItemType
 */
const modifierItemTypeSchema = z.enum(['simple', 'portions', 'combo', 'all'], {
  errorMap: () => ({ message: 'Item type must be one of: simple, portions, combo, all' })
});

/**
 * Zod schema for modifier template properties
 */
const templatePropertiesSchema = z.object({
  veg: z.boolean().optional(),
  hasSpiceLevel: z.boolean().optional(),
  spiceLevel: z.array(z.string()).optional(),
  isEcoFriendlyContainer: z.boolean().optional(),
  ecoContainerCharge: z.number().min(0, 'Eco container charge must be non-negative').optional(),
}).optional();

/**
 * Zod schema for creating a food modifier
 */
export const createModifierSchema = z.object({
  name: z.string().min(1, 'Modifier name is required').max(100, 'Modifier name must not exceed 100 characters'),
  description: z.string().max(500, 'Description must not exceed 500 characters').optional(),
  price: z.number().min(0, 'Price must be non-negative').max(9999.99, 'Price must not exceed 9999.99').optional(),
  itemType: modifierItemTypeSchema.optional(),
  available: z.boolean().default(true),
  isDefault: z.boolean().default(false),
  sequence: z.number().int().min(0, 'Sequence must be a non-negative integer').optional(),
  templateProperties: templatePropertiesSchema,
});

/**
 * Zod schema for updating a food modifier
 */
export const updateModifierSchema = z.object({
  _id: z.string().min(1, 'Modifier ID is required'),
  name: z.string().min(1, 'Modifier name is required').max(100, 'Modifier name must not exceed 100 characters').optional(),
  description: z.string().max(500, 'Description must not exceed 500 characters').optional(),
  price: z.number().min(0, 'Price must be non-negative').max(9999.99, 'Price must not exceed 9999.99').optional(),
  itemType: modifierItemTypeSchema.optional(),
  available: z.boolean().optional(),
  isDefault: z.boolean().optional(),
  sequence: z.number().int().min(0, 'Sequence must be a non-negative integer').optional(),
  templateProperties: templatePropertiesSchema,
}).refine(
  (data) => {
    // Ensure at least one field is being updated (besides _id)
    const { _id, ...updateFields } = data;
    return Object.keys(updateFields).length > 0;
  },
  {
    message: 'At least one field must be provided for update',
  }
);

/**
 * Zod schema for filter options
 */
export const modifierFilterSchema = z.object({
  itemType: modifierItemTypeSchema.optional(),
  available: z.boolean().optional(),
  search: z.string().max(100, 'Search term must not exceed 100 characters').optional(),
  page: z.number().int().min(1, 'Page must be a positive integer').optional(),
  limit: z.number().int().min(1, 'Limit must be a positive integer').max(100, 'Limit must not exceed 100').optional(),
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
 * Validate food modifier creation data
 */
export function validateCreateModifier(data: unknown): ValidationResult {
  const result = createModifierSchema.safeParse(data);

  if (!result.success) {
    return {
      isValid: false,
      errors: result.error.issues.map(issue => `${issue.path.join('.')}: ${issue.message}`)
    };
  }

  return {
    isValid: true,
    errors: [],
    data: result.data
  };
}

/**
 * Validate food modifier update data
 */
export function validateUpdateModifier(data: unknown): ValidationResult {
  const result = updateModifierSchema.safeParse(data);

  if (!result.success) {
    return {
      isValid: false,
      errors: result.error.issues.map(issue => `${issue.path.join('.')}: ${issue.message}`)
    };
  }

  return {
    isValid: true,
    errors: [],
    data: result.data
  };
}

/**
 * Validate filter options
 */
export function validateModifierFilters(data: unknown): ValidationResult {
  const result = modifierFilterSchema.safeParse(data);

  if (!result.success) {
    return {
      isValid: false,
      errors: result.error.issues.map(issue => `${issue.path.join('.')}: ${issue.message}`)
    };
  }

  return {
    isValid: true,
    errors: [],
    data: result.data
  };
}

/**
 * Check if modifier name is unique for a specific item type
 */
export function validateModifierNameUniqueness(
  existingModifiers: FoodModifier[],
  newName: string,
  newItemType: ModifierItemType,
  excludeId?: string
): ValidationResult {
  const errors: string[] = [];

  // Check for duplicate name within the same itemType
  const duplicate = existingModifiers.find(modifier => {
    const modifierId = modifier._id?.toString();
    const isSameModifier = excludeId && modifierId === excludeId;
    const isSameName = modifier.name.toLowerCase().trim() === newName.toLowerCase().trim();
    const isSameType = modifier.itemType === newItemType;

    return isSameName && isSameType && !isSameModifier;
  });

  if (duplicate) {
    errors.push(`A modifier with the name "${newName}" already exists for item type "${newItemType}"`);
  }

  return {
    isValid: errors.length === 0,
    errors
  };
}

/**
 * Sanitize modifier data for database operations
 * Converts and cleans data before database insert/update
 */
export function sanitizeModifierData(
  data: any,
  operation: 'create' | 'update'
): Partial<FoodModifier> {
  const sanitized: Partial<FoodModifier> = {};

  if (data.name !== undefined) {
    sanitized.name = data.name.trim();
  }

  if (data.description !== undefined) {
    sanitized.description = data.description?.trim() || '';
  }

  if (data.price !== undefined) {
    sanitized.price = Number(data.price);
  } else if (operation === 'create') {
    // Set default price for new modifiers
    sanitized.price = 0;
  }

  if (data.itemType !== undefined) {
    sanitized.itemType = data.itemType;
  } else if (operation === 'create') {
    // Set default itemType for new modifiers
    sanitized.itemType = 'all';
  }

  if (data.available !== undefined) {
    sanitized.available = Boolean(data.available);
  }

  if (data.isDefault !== undefined) {
    sanitized.isDefault = Boolean(data.isDefault);
  }

  if (data.sequence !== undefined) {
    sanitized.sequence = Number(data.sequence);
  }

  if (data.templateProperties !== undefined) {
    sanitized.templateProperties = data.templateProperties;
  }

  if (operation === 'create') {
    sanitized.createdAt = new Date();
    sanitized.updatedAt = new Date();
  } else if (operation === 'update') {
    sanitized.updatedAt = new Date();
  }

  return sanitized;
}

/**
 * Type guard to check if an object is a valid FoodModifier
 */
export function isFoodModifier(obj: any): obj is FoodModifier {
  return (
    obj &&
    typeof obj === 'object' &&
    typeof obj.name === 'string' &&
    typeof obj.price === 'number' &&
    typeof obj.itemType === 'string' &&
    ['simple', 'portions', 'combo', 'all'].includes(obj.itemType) &&
    typeof obj.available === 'boolean'
  );
}

/**
 * Re-export types for convenience
 */
export type { FoodModifier, CreateFoodModifierDTO, UpdateFoodModifierDTO, ModifierItemType };
