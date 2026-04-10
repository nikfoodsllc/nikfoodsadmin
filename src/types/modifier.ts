import { ObjectId } from 'mongodb';

/**
 * Item type enum for food modifiers
 * Determines which type of food item can use this modifier
 */
export type ModifierItemType = 'simple' | 'portions' | 'combo' | 'all';

/**
 * Food Modifier Interface
 * Represents add-ons, customizations, or modifiers that can be applied to food items
 *
 * Examples:
 * - Extra cheese (price: $2.00, applicable to all item types)
 * - Spicy sauce (price: $0.50, applicable to portions only)
 * - Gluten-free option (price: $1.50, applicable to all types)
 * - Double portion (price: $3.00, applicable to portions only)
 *
 * Template Feature:
 * - Modifiers can also serve as templates with preset property values for food items
 * - When used as a template, the following properties are applied to the food item:
 *   - veg: Whether the item is vegetarian
 *   - hasSpiceLevel: Whether the item has spice level options
 *   - spiceLevel: Array of available spice levels
 *   - isEcoFriendlyContainer: Whether eco-friendly container is available
 *   - ecoContainerCharge: Additional charge for eco-friendly container
 */
export interface FoodModifier {
  _id?: ObjectId | string;
  name: string; // Unique per itemType
  description?: string;
  price: number; // Additional cost for the modifier
  itemType: ModifierItemType; // Which item types can use this modifier
  available: boolean; // Whether the modifier is currently available
  isDefault?: boolean; // Whether this modifier is selected by default
  sequence?: number; // Display order in UI
  createdAt?: Date;
  updatedAt?: Date;

  // Template properties (for applying preset values to food items)
  templateProperties?: {
    veg?: boolean;
    hasSpiceLevel?: boolean;
    spiceLevel?: string[];
    isEcoFriendlyContainer?: boolean;
    ecoContainerCharge?: number;
  };
}

/**
 * Create Food Modifier DTO
 * Data transfer object for creating a new food modifier
 */
export interface CreateFoodModifierDTO {
  name: string;
  description?: string;
  price: number;
  itemType: ModifierItemType;
  available?: boolean;
  isDefault?: boolean;
  sequence?: number;
}

/**
 * Update Food Modifier DTO
 * Data transfer object for updating an existing food modifier
 */
export interface UpdateFoodModifierDTO {
  _id: string;
  name?: string;
  description?: string;
  price?: number;
  itemType?: ModifierItemType;
  available?: boolean;
  isDefault?: boolean;
  sequence?: number;
}

/**
 * Filter options for listing food modifiers
 */
export interface ModifierFilterOptions {
  itemType?: ModifierItemType;
  available?: boolean;
  search?: string; // Search in name and description
  page?: number;
  limit?: number;
}
