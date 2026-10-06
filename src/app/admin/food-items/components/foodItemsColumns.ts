import { ColumnDef } from '@/utils/columnPreferences';

/** What the loading placeholder for a column looks like. */
export type FoodItemsSkeletonShape = 'circles' | 'pill' | 'image' | 'text';

export interface FoodItemsColumnDef extends ColumnDef {
  skeleton: FoodItemsSkeletonShape;
  skeletonWidth?: number;
}

export const FOOD_ITEMS_COLUMNS_STORAGE_KEY = 'admin_food_items_table_columns';

/**
 * Columns of the Food Items table, in display order. Actions (edit / delete / duplicate) is locked:
 * always shown and not resizable. Default widths are used until an admin drags a column edge.
 */
export const FOOD_ITEMS_COLUMNS: FoodItemsColumnDef[] = [
  { key: 'select', label: '', defaultWidth: 48, locked: true, skeleton: 'text', skeletonWidth: 20 },
  { key: 'actions', label: 'Actions', defaultWidth: 120, locked: true, skeleton: 'circles' },
  { key: 'available', label: 'Available', defaultWidth: 125, skeleton: 'pill', skeletonWidth: 90 },
  { key: 'image', label: 'Image', defaultWidth: 100, skeleton: 'image' },
  { key: 'name', label: 'Name', defaultWidth: 240, skeleton: 'text', skeletonWidth: 140 },
  { key: 'preparation', label: 'Preparation', defaultWidth: 150, skeleton: 'pill', skeletonWidth: 90 },
  { key: 'price', label: 'Price', defaultWidth: 140, skeleton: 'text', skeletonWidth: 70 },
  { key: 'veg', label: 'Veg/Non-Veg', defaultWidth: 130, skeleton: 'pill', skeletonWidth: 70 },
  { key: 'type', label: 'Type', defaultWidth: 110, skeleton: 'pill', skeletonWidth: 70 },
  { key: 'description', label: 'Description', defaultWidth: 240, skeleton: 'text', skeletonWidth: 200 },
];
