/**
 * Price Utility Functions for Combo Items
 *
 * These utilities detect zero-priced combo items and fetch/compute
 * original prices from source food item data.
 */

// Food item structure from allFoodItems
export interface FoodItem {
  _id: string;
  name: string;
  itemType: 'simple' | 'portions' | 'combo';
  portions?: string[];
  portionPrices?: number[];
  price?: number;
}

// Combo item structure within sections
export interface ComboItem {
  item: string; // item ID
  portion?: string;
  price: number;
  portionId: string;
  isDefault?: boolean;
  isAvailable?: boolean;
}

// Section structure
export interface Section {
  title: string;
  selectedItems: ComboItem[];
  sequence?: number;
}

// Zero-priced item info for confirmation dialog
export interface ZeroPricedItemInfo {
  sectionIndex: number;
  itemIndex: number;
  sectionTitle: string;
  itemName: string;
  currentPrice: number;
  suggestedPrice: number;
}

/**
 * Get the original price for a food item from the source data
 * Handles both simple items (direct price) and portions items (portion-based price)
 *
 * @param itemId - The food item ID
 * @param portion - Optional portion name for portions-type items
 * @param allFoodItems - Array of all available food items
 * @returns The computed price or 0 if not found
 */
export function getOriginalItemPrice(
  itemId: string,
  portion: string | undefined,
  allFoodItems: FoodItem[]
): number {
  // Find the source food item
  const foodItem = allFoodItems.find((item) => item._id === itemId);

  if (!foodItem) {
    return 0;
  }

  // Handle portions-type items
  if (foodItem.itemType === 'portions' && portion && foodItem.portions && foodItem.portionPrices) {
    const portionIndex = foodItem.portions.indexOf(portion);
    if (portionIndex !== -1 && foodItem.portionPrices[portionIndex] !== undefined) {
      return foodItem.portionPrices[portionIndex];
    }
    // If portion not found but has portions, return first portion price as fallback
    if (foodItem.portionPrices.length > 0) {
      return foodItem.portionPrices[0];
    }
  }

  // Handle simple items or fallback to direct price
  if (foodItem.price !== undefined) {
    return foodItem.price;
  }

  return 0;
}

/**
 * Find all combo items that have a price of zero
 *
 * @param sections - Array of combo sections
 * @param allFoodItems - Array of all available food items
 * @returns Array of zero-priced item info objects
 */
export function findZeroPricedComboItems(
  sections: Section[],
  allFoodItems: FoodItem[]
): ZeroPricedItemInfo[] {
  const zeroPricedItems: ZeroPricedItemInfo[] = [];

  sections.forEach((section, sectionIndex) => {
    section.selectedItems.forEach((comboItem, itemIndex) => {
      // Check if the item has zero price
      if (comboItem.price === 0) {
        // Find the source food item to get its name and suggested price
        const foodItem = allFoodItems.find((item) => item._id === comboItem.item);
        const itemName = foodItem?.name || 'Unknown Item';
        const suggestedPrice = getOriginalItemPrice(
          comboItem.item,
          comboItem.portion,
          allFoodItems
        );

        // Only add if we have a valid suggested price greater than 0
        if (suggestedPrice > 0) {
          zeroPricedItems.push({
            sectionIndex,
            itemIndex,
            sectionTitle: section.title,
            itemName,
            currentPrice: comboItem.price,
            suggestedPrice,
          });
        }
      }
    });
  });

  return zeroPricedItems;
}

/**
 * Update combo item prices based on zero-priced items info
 * Returns a new sections array with updated prices
 *
 * @param sections - Original sections array
 * @param zeroPricedItems - Array of zero-priced items to update
 * @returns New sections array with updated prices
 */
export function updateComboItemPrices(
  sections: Section[],
  zeroPricedItems: ZeroPricedItemInfo[]
): Section[] {
  // Create a deep copy of sections to avoid mutation
  const updatedSections = sections.map((section) => ({
    ...section,
    selectedItems: section.selectedItems.map((item) => ({ ...item })),
  }));

  // Update prices for each zero-priced item
  zeroPricedItems.forEach((zeroPricedItem) => {
    const { sectionIndex, itemIndex, suggestedPrice } = zeroPricedItem;

    // Validate indices are within bounds
    if (
      sectionIndex >= 0 &&
      sectionIndex < updatedSections.length &&
      itemIndex >= 0 &&
      itemIndex < updatedSections[sectionIndex].selectedItems.length
    ) {
      updatedSections[sectionIndex].selectedItems[itemIndex].price = suggestedPrice;
    }
  });

  return updatedSections;
}

/**
 * Check if any combo items have zero price
 * Quick check without computing suggested prices
 *
 * @param sections - Array of combo sections
 * @returns Boolean indicating if any items have zero price
 */
export function hasZeroPricedItems(sections: Section[]): boolean {
  return sections.some((section) =>
    section.selectedItems.some((item) => item.price === 0)
  );
}
