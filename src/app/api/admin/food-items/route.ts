import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { jwtHandler } from '@/lib/jwt';
import { db } from '@/lib/db';
import { deleteUnusedPhotos, deleteRemovedPhotos, imageFields, incomingImages } from '@/lib/itemImageStore';
import { storedImages } from '@/utils/itemImages';
import { ObjectId, type Filter } from 'mongodb';
import { invalidateLivesiteHomeMenuCache } from '@/lib/invalidateHomeMenuCache';
import { stockFieldsForCreate, stockFieldsForUpdate, stockUnitProblem } from '@/lib/stockSettings';
import { stockOf, type StockDoc } from '@/lib/stockCounts';
import { writeStockLog } from '@/lib/stockLog';
import { isPreparationType } from '@/utils/preparationType';
import { isStickerFlag } from '@/utils/stickerFlag';
import { foodItemListFilters, stockLevelParam } from './listFilters';

// Interface for available days
interface AvailableDay {
  _id?: ObjectId | string;
  day: string;
  enabled: boolean;
  sequence: number;
  label: string;
  createdAt?: Date;
  updatedAt?: Date;
}

// Interface for weekly menu
interface WeeklyMenu {
  _id?: ObjectId | string;
  active: boolean;
  weekStartDate?: Date;
  allDays: ObjectId[];
  tuesday: ObjectId[];
  wednesday: ObjectId[];
  thursday: ObjectId[];
  friday: ObjectId[];
  createdAt?: Date;
  updatedAt?: Date;
}

// Interface for food category with day-wise items
interface FoodCategory {
  _id?: ObjectId | string;
  name: string;
  description?: string;
  url?: string;
  public_id?: string;
  sequence?: number;
  isDraft?: boolean;
  listingType?: 'flat' | 'day-wise';
  dayWiseItems?: Array<{
    day: string;
    items: string[];
  }>;
  createdAt?: Date;
  updatedAt?: Date;
}

// Interface for CategoryFoodMapping (FLAT rows from this route; day-wise uses other APIs)
interface CategoryFoodMapping {
  _id?: ObjectId | string;
  foodItemId: ObjectId;
  categoryId: ObjectId;
  sequence: number;
  mappingType: 'FLAT';
  createdAt?: Date;
  updatedAt?: Date;
}

// Cache for available days (5 minutes TTL)
let availableDaysCache: {
  data: string[];
  timestamp: number;
} | null = null;

const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

/**
 * Validate day name against allowed values
 */
function validateDayName(day: string): boolean {
  const validDays = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
  return validDays.includes(day.toLowerCase());
}

/**
 * Get cached available days or fetch from database
 */
async function getAvailableDays(): Promise<string[]> {
  // Check cache first
  if (availableDaysCache && (Date.now() - availableDaysCache.timestamp) < CACHE_DURATION) {
    return availableDaysCache.data;
  }

  try {
    const result = await db.read<AvailableDay>('availableDays', { enabled: true }, {
      sort: { sequence: 1 }
    });

    let enabledDays: string[] = [];

    if (result.success && result.data) {
      enabledDays = result.data.map(day => day.day.toLowerCase());
    }

    // Update cache
    availableDaysCache = {
      data: enabledDays,
      timestamp: Date.now()
    };

    return enabledDays;
  } catch (error) {
    console.warn('Failed to fetch available days, using all days as fallback:', error);
    // Fallback to all days if database query fails
    return ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
  }
}

/**
 * Get active weekly menu
 */
async function getActiveWeeklyMenu(): Promise<WeeklyMenu | null> {
  try {
    const result = await db.readOne<WeeklyMenu>('weeklymenus', { active: true });
    return result.success && result.data ? result.data : null;
  } catch (error) {
    console.warn('Failed to fetch weekly menu:', error);
    return null;
  }
}

/**
 * Get food categories with day-wise items
 */
async function getFoodCategories(): Promise<FoodCategory[]> {
  try {
    const result = await db.read<FoodCategory>('foodcategories', {
      isDraft: { $ne: true },
      listingType: 'day-wise'
    });
    return result.success && result.data ? result.data : [];
  } catch (error) {
    console.warn('Failed to fetch food categories:', error);
    return [];
  }
}

/**
 * Check if a food item is available on a specific day
 */
async function isFoodItemAvailableOnDay(
  foodItemId: string,
  day: string,
  weeklyMenu: WeeklyMenu | null,
  categories: FoodCategory[]
): Promise<boolean> {
  const dayLower = day.toLowerCase();

  // Check if day is enabled
  const enabledDays = await getAvailableDays();
  if (!enabledDays.includes(dayLower)) {
    return false;
  }

  // Check weekly menu availability
  if (weeklyMenu) {
    const dayKey = dayLower as keyof WeeklyMenu;
    if (dayKey !== 'allDays' && Array.isArray(weeklyMenu[dayKey])) {
      const dayItems = weeklyMenu[dayKey] as ObjectId[];
      if (dayItems.some(id => id.toString() === foodItemId)) {
        return true;
      }
    }

    // Also check allDays if the item is not specifically assigned to this day
    if (Array.isArray(weeklyMenu.allDays)) {
      if (weeklyMenu.allDays.some(id => id.toString() === foodItemId)) {
        return true;
      }
    }
  }

  // Check category day-wise items
  for (const category of categories) {
    if (category.dayWiseItems) {
      const dayItems = category.dayWiseItems.find(dayItem =>
        dayItem.day.toLowerCase() === dayLower
      );
      if (dayItems && dayItems.items.includes(foodItemId)) {
        return true;
      }
    }
  }

  // If no specific day restrictions found, assume available for backward compatibility
  return true;
}

// Combo item schema
const comboItemSchema = z.object({
  item: z.string(), // ObjectId reference
  portion: z.string().optional(),
  price: z.number(),
  portionId: z.string(),
  isDefault: z.boolean().optional(),
  isAvailable: z.boolean().optional().default(true), // Individual item availability within combo
  // How many of this item come with ONE combo (Chapati x 4). Missing = 1.
  quantity: z.number().int().min(1).max(99).optional(),
});

// Section schema for combo items
const sectionSchema = z.object({
  title: z.string(),
  selectedItems: z.array(comboItemSchema),
  sequence: z.number().optional(),
  minSelection: z.number().optional().default(1),
  maxSelection: z.number().optional().default(1),
  isRequired: z.boolean().optional().default(true),
  // whether the combo's spice level applies to this section's parts; left out = the old rule (everything but staples/breads)
  takesSpice: z.boolean().optional(),
  // the customer picks this section's spice level separately from the combo's (only used when takesSpice is on)
  ownSpice: z.boolean().optional(),
});

/** A combo with a spice mode no longer uses the per-section spice switches: drop them so old values cannot linger. */
function withoutSectionSpiceFlags<T extends Record<string, unknown>>(section: T, spiceMode: 'inherit' | 'combo' | null | undefined): T {
  if (spiceMode !== 'inherit' && spiceMode !== 'combo') return section;
  const { takesSpice: _takesSpice, ownSpice: _ownSpice, ...rest } = section;
  return rest as T;
}

// Zod schema for food item validation
const foodItemSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  description: z.string().optional(),
  short_description: z.string().optional(),
  // Clients/DB may send null; optional() only allows undefined, not null
  price: z.preprocess(
    (v) => (v === null ? undefined : v),
    z.number().min(0, 'Price must be non-negative').optional()
  ), // Optional for portions type
  category: z.array(z.string()).optional(), // Category is now optional
  veg: z.boolean(),
  available: z.boolean(),
  isDraft: z.boolean().default(false), // Draft status for food items
  url: z.string().optional(),
  public_id: z.string().optional(),
  // all photos of the item, main photo first (url / public_id above are the first one); at most 8
  images: z.array(z.object({ url: z.string().min(1), public_id: z.string().optional() })).max(8).optional(),
  itemType: z.enum(['simple', 'portions', 'combo']).default('simple'),
  // How the item is prepared for the kitchen. Required when CREATING an item (POST checks it); on update, null means
  // "back to not set yet" and leaving it out leaves the stored value alone.
  preparationType: z.enum(['cooked', 'ready_to_eat']).nullish(),
  // Whether the item's orders get a packing sticker (Kitchen Report; No leaves it off). Optional: null on update means "back to not set yet".
  sticker: z.enum(['yes', 'no']).nullish(),
  // Chef's Pick: true = shown in the mobile app's Chef's Pick row; left out on update = leave as it is
  chefsPick: z.boolean().optional(),
  // Special instructions box for customers: true = on; left out on update = leave as it is (a new item starts with it off)
  allowInstructions: z.boolean().optional(),
  // Order limit (inventory): a whole number of units, null = no limit; left out on update = leave as it is
  stockThreshold: z.number().min(0.25).max(100000).nullable().optional(),
  // what the limit is counted in: units, pounds or ounces (pounds and ounces need an item with sizes)
  stockUnit: z.enum(['units', 'lb', 'oz']).optional(),
  stockResetMode: z.enum(['manual', 'daily']).optional(),
  stockResetTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/).nullable().optional(),
  stockAlertPercent: z.number().int().min(1).max(99).nullable().optional(),
  // Split Sticker: 'yes' = one sticker per box in the Stickers sheet; null on update = back to not set yet
  splitSticker: z.enum(['yes', 'no']).nullish(),

  // Portions type fields
  portions: z.array(z.string()).optional(),
  portionPrices: z.array(z.number()).optional(),
  portionAvailability: z.array(z.boolean()).optional(),

  // Combo type fields
  hasCombo: z.boolean().optional(),
  comboItems: z.array(comboItemSchema).optional(),
  sections: z.array(sectionSchema).optional(),

  // Optional features
  isEcoFriendlyContainer: z.boolean().default(false),
  ecoContainerCharge: z.number().default(0),
  hasSpiceLevel: z.boolean().default(false),
  spiceLevel: z.array(z.string()).optional(),
  // Combos with Has Spice Level: 'inherit' = ask for each item that has spice levels, using its own levels; 'combo' = ask for each such item, using the combo's levels. Missing = the older one-level-for-the-combo behaviour.
  spiceMode: z.enum(['inherit', 'combo']).nullish(),

  isImageUpdated: z.boolean().optional(),
}).refine(
  (data: any) => {
    // For portions type, validate portions array
    if (data.itemType === 'portions') {
      return (
        data.portions &&
        data.portions.length > 0 &&
        data.portionPrices &&
        data.portionPrices.length === data.portions.length
      );
    }
    return true;
  },
  {
    message: 'Portions type must have at least one portion with matching prices',
  }
).refine(
  (data: any) => {
    // For combo type, validate sections
    if (data.itemType === 'combo') {
      return data.sections && data.sections.length > 0;
    }
    return true;
  },
  {
    message: 'Combo type must have at least one section',
  }
).refine(
  (data: any) => {
    // For simple and combo types, price is required
    if (data.itemType === 'simple' || data.itemType === 'combo') {
      return data.price !== undefined && data.price >= 0;
    }
    return true;
  },
  {
    message: 'Price is required for simple and combo items',
  }
);

interface ComboItem {
  item: string | ObjectId;
  portion?: string;
  price: number;
  portionId: string;
  isDefault?: boolean;
  isAvailable?: boolean; // Individual item availability within combo
  quantity?: number; // How many of this item come with one combo (missing = 1)
}

interface Section {
  title: string;
  selectedItems: ComboItem[];
  sequence?: number;
  minSelection?: number;
  maxSelection?: number;
  isRequired?: boolean;
}

interface FoodItem {
  _id?: ObjectId | string;
  name: string;
  description?: string;
  short_description?: string;
  price?: number;
  category: string[];
  veg: boolean;
  available: boolean;
  isDraft?: boolean; // Draft status for food items
  url?: string;
  public_id?: string;
  images?: Array<{ url: string; public_id?: string }>;
  itemType: 'simple' | 'portions' | 'combo';
  // 'cooked' = made fresh for the day's menu, 'ready_to_eat' = already made, only packed; missing = not set yet
  preparationType?: 'cooked' | 'ready_to_eat';
  // 'yes' = its orders appear on the Stickers sheet, 'no' = they do not; missing = not set yet
  sticker?: 'yes' | 'no';
  splitSticker?: 'yes' | 'no';
  chefsPick?: boolean;
  allowInstructions?: boolean;
  stockThreshold?: number | null;
  stockUnit?: 'units' | 'lb' | 'oz';
  stockResetAt?: Date;
  stockResetMode?: 'manual' | 'daily';
  stockResetTime?: string | null;
  stockAlertPercent?: number | null;

  // Portions fields
  portions?: string[];
  portionPrices?: number[];
  portionAvailability?: boolean[];

  // Combo fields
  hasCombo?: boolean;
  comboItems?: ComboItem[];
  sections?: Section[];

  // Optional features
  isEcoFriendlyContainer: boolean;
  ecoContainerCharge: number;
  hasSpiceLevel: boolean;
  spiceLevel?: string[];
  spiceMode?: 'inherit' | 'combo';

  createdAt?: Date;
  updatedAt?: Date;
}

/**
 * Verify JWT token and check admin role
 */
function dedupeCategoryIds(categoryIds: string[] | undefined): string[] {
  if (!categoryIds?.length) return [];

  const seen = new Set<string>();
  const result: string[] = [];

  for (const id of categoryIds) {
    if (id && !seen.has(id)) {
      seen.add(id);
      result.push(id);
    }
  }

  return result;
}

function dedupeMappingCategoryIds(mappings: CategoryFoodMapping[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];

  for (const mapping of mappings) {
    const categoryId = mapping.categoryId.toString();
    if (!seen.has(categoryId)) {
      seen.add(categoryId);
      result.push(categoryId);
    }
  }

  return result;
}

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

  return { success: true, userId: verificationResult.payload.userId, adminName: String((verificationResult.payload as unknown as { name?: string; email?: string }).name || (verificationResult.payload as unknown as { email?: string }).email || '').slice(0, 60) };
}

/**
 * GET /api/admin/food-items
 * List food items with filters and pagination
 * Query params: _id (optional - fetch single item), search, category, vegOnly, draftOnly, excludeDrafts, day (optional), page (default: 1), limit (default: 7)
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
    const search = searchParams.get('search') || '';
    const categoryId = searchParams.get('category') || '';
    const vegOnly = searchParams.get('vegOnly') === 'true';
    const draftOnly = searchParams.get('draftOnly') === 'true';
    const excludeDrafts = searchParams.get('excludeDrafts') === 'true';
    const day = searchParams.get('day');
    const id = searchParams.get('_id');
    const page = parseInt(searchParams.get('page') || '1', 10);
    const limit = parseInt(searchParams.get('limit') || '7', 10);
    const skip = (page - 1) * limit;

    // If _id is provided, fetch single item with categories from CategoryFoodMapping
    if (id) {
      try {
        const itemResult = await db.readOne<FoodItem>('fooditems', {
          _id: new ObjectId(id)
        });

        if (!itemResult.success || !itemResult.data) {
          return NextResponse.json({ error: 'Food item not found' }, { status: 404 });
        }

        // Fetch category mappings for this food item
        const mappingResult = await db.read<CategoryFoodMapping>('categoryfoodmapping', {
          foodItemId: new ObjectId(id)
        }, {
          sort: { sequence: 1 }
        });

        // Attach category IDs to the item
        const itemWithCategories = {
          ...itemResult.data,
          category: mappingResult.success && mappingResult.data
            ? dedupeMappingCategoryIds(mappingResult.data)
            : []
        };

        return NextResponse.json({
          data: {
            items: [itemWithCategories],
            total: 1,
            page: 1,
            pageSize: 1,
          },
          message: 'Food item fetched successfully',
        });
      } catch (error) {
        console.error('Error fetching food item by _id:', error);
        return NextResponse.json(
          { error: error instanceof Error ? error.message : 'Failed to fetch food item' },
          { status: 500 }
        );
      }
    }

    // Validate day parameter if provided
    if (day && !validateDayName(day)) {
      return NextResponse.json(
        { error: 'Invalid day parameter. Must be one of: monday, tuesday, wednesday, thursday, friday, saturday, sunday' },
        { status: 400 }
      );
    }

    // Build filter query
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const filter: any = {};

    // Search by name (case-insensitive)
    if (search) {
      filter.name = { $regex: search, $options: 'i' };
    }

    // Filter by category using CategoryFoodMapping collection
    // We'll fetch the food item IDs from the mapping collection first
    let categoryFoodItemIds: ObjectId[] | null = null;
    if (categoryId) {
      // one category id, or several separated by commas (a category and its sub-categories): an item in any of them matches
      const categoryIdObjs = categoryId
        .split(',')
        .map((id) => id.trim())
        .filter(Boolean);
      if (categoryIdObjs.length === 0 || categoryIdObjs.length > 100 || categoryIdObjs.some((id) => !ObjectId.isValid(id))) {
        return NextResponse.json({ error: 'category must be one or more category ids' }, { status: 400 });
      }
      const mappingResult = await db.read<CategoryFoodMapping>('categoryfoodmapping', {
        categoryId: { $in: categoryIdObjs.map((id) => new ObjectId(id)) }
      });

      if (mappingResult.success && mappingResult.data) {
        categoryFoodItemIds = mappingResult.data.map(m => m.foodItemId);
        console.log('[GET /api/admin/food-items] Category filter applied:', {
          categoryId: categoryId,
          itemCount: categoryFoodItemIds.length,
          note: 'Using CategoryFoodMapping collection'
        });

        // If no items found for this category, return empty result early
        if (categoryFoodItemIds.length === 0) {
          return NextResponse.json({
            data: {
              items: [],
              total: 0,
              page,
              pageSize: limit,
            },
            message: 'Food items fetched successfully',
          });
        }
      }
    }

    // Filter by veg only
    if (vegOnly) {
      filter.veg = true;
    }

    // Column filters of the Food Items table: veg, available, type, preparation type
    // (applied after vegOnly, so a `veg` filter wins when both are sent)
    Object.assign(filter, foodItemListFilters(searchParams));

    // Stock filter by level (ok / low / sold out): the level follows the live count, so the items with a limit are counted first
    const wantedLevel = stockLevelParam(searchParams);
    let stockLevelIds: ObjectId[] | null = null;
    if (wantedLevel) {
      const limited = await db.read<FoodItem>('fooditems', { stockThreshold: { $gt: 0 } });
      const docs = (limited.success && limited.data ? limited.data : []) as unknown as StockDoc[];
      const levels = await stockOf(docs);
      stockLevelIds = docs.filter((d) => levels.get(String(d._id))?.level === wantedLevel).map((d) => new ObjectId(String(d._id)));
    }

    // Filter by draft status
    if (draftOnly) {
      filter.isDraft = true;
    } else if (excludeDrafts) {
      filter.isDraft = { $ne: true };
    }

    // Add category filter if applicable
    if (categoryFoodItemIds && categoryFoodItemIds.length > 0) {
      filter._id = { $in: categoryFoodItemIds };
    }
    if (stockLevelIds) {
      // only the items at that stock level (and in the chosen category, when one is chosen)
      const inCategory = filter._id ? new Set((filter._id as { $in: ObjectId[] }).$in.map((x) => String(x))) : null;
      filter._id = { $in: stockLevelIds.filter((x) => !inCategory || inCategory.has(String(x))) };
    }

    // Get all food items first (we'll filter by day after fetching)
    const allItemsResult = await db.read<FoodItem>('fooditems', filter, {
      sort: { createdAt: -1 },
    });

    if (!allItemsResult.success) {
      throw new Error(allItemsResult.error || 'Failed to fetch food items');
    }

    let filteredItems = allItemsResult.data || [];

    // Fetch category mappings for all filtered items and attach category IDs
    const itemIds = filteredItems.map(item => item._id).filter((id): id is ObjectId => id !== undefined);
    const itemsWithCategories: FoodItem[] = [];

    if (itemIds.length > 0) {
      // Fetch all category mappings for these items
      const allMappingsResult = await db.read<CategoryFoodMapping>('categoryfoodmapping', {
        foodItemId: { $in: itemIds }
      }, {
        sort: { sequence: 1 }
      });

      // Create a map of foodItemId to category IDs
      const categoryMap = new Map<string, string[]>();
      if (allMappingsResult.success && allMappingsResult.data) {
        for (const mapping of allMappingsResult.data) {
          const foodItemIdStr = mapping.foodItemId.toString();
          if (!categoryMap.has(foodItemIdStr)) {
            categoryMap.set(foodItemIdStr, []);
          }
          const categoryIds = categoryMap.get(foodItemIdStr)!;
          const categoryId = mapping.categoryId.toString();
          if (!categoryIds.includes(categoryId)) {
            categoryIds.push(categoryId);
          }
        }
      }

      // Attach categories to each item
      for (const item of filteredItems) {
        const itemIdStr = item._id?.toString();
        itemsWithCategories.push({
          ...item,
          category: itemIdStr && categoryMap.has(itemIdStr) ? categoryMap.get(itemIdStr)! : []
        });
      }
    }

    console.log('[GET /api/admin/food-items] Query results:', {
      totalItems: itemsWithCategories.length,
      categoryId: categoryId || 'none',
      filter: filter,
      sampleItems: itemsWithCategories.slice(0, 3).map(item => ({
        _id: item._id?.toString(),
        name: item.name,
        category: item.category,
        categoryTypes: item.category.map((c: string) => typeof c)
      }))
    });

    filteredItems = itemsWithCategories;

    // Apply day filtering if day parameter is provided
    let dayFilterInfo = null;
    if (day) {
      const weeklyMenu = await getActiveWeeklyMenu();
      const categories = await getFoodCategories();

      // Filter items based on day availability - fix async filtering
      const dayAvailabilityPromises = filteredItems.map(async (item) => {
        const itemId = item._id?.toString();
        if (!itemId) return false;

        return await isFoodItemAvailableOnDay(itemId, day, weeklyMenu, categories);
      });

      const availabilityResults = await Promise.all(dayAvailabilityPromises);
      filteredItems = filteredItems.filter((_, index) => availabilityResults[index]);

      dayFilterInfo = {
        day: day.toLowerCase(),
        dayEnabled: true, // We know it's enabled if we got here
        totalItemsBeforeFilter: allItemsResult.data?.length || 0,
        totalItemsAfterFilter: filteredItems.length,
      };
    }

    // Get total count for pagination (after day filtering if applied)
    const total = filteredItems.length;

    // Apply pagination
    const paginatedItems = filteredItems.slice(skip, skip + limit);

    // items with an order limit: how many were ordered and how many are left (live)
    try {
      const stock = await stockOf(paginatedItems as unknown as StockDoc[]);
      for (const item of paginatedItems as unknown as Array<Record<string, unknown>>) {
        const s = stock.get(String(item._id));
        if (s) item.stock = s;
      }
    } catch (stockError) {
      console.error('Could not count the stock for the list:', stockError);
    }

    return NextResponse.json({
      data: {
        items: paginatedItems,
        total,
        page,
        pageSize: limit,
        dayFilter: dayFilterInfo,
      },
      message: 'Food items fetched successfully',
    });
  } catch (error) {
    console.error('Error in GET /api/admin/food-items:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/admin/food-items
 * Create new food item
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
    const validationResult = foodItemSchema.safeParse(body);

    if (!validationResult.success) {
      return NextResponse.json(
        {
          error: 'Validation failed',
          details: validationResult.error.issues,
        },
        { status: 400 }
      );
    }

    const data = validationResult.data;
    const stockProblem = stockUnitProblem(data, Array.isArray(data.portions) && data.portions.length > 0);
    if (stockProblem) return NextResponse.json({ error: stockProblem }, { status: 400 });

    // A new food item must say how it is prepared (updates may leave it as it is).
    // A combo is not asked: the reports use the Prep Type and Sticker of each item inside it.
    if (data.itemType !== 'combo' && !isPreparationType(data.preparationType)) {
      return NextResponse.json(
        { error: 'Preparation type is required (Cooked or Ready to eat)' },
        { status: 400 }
      );
    }

    // Check duplicate food item
    const escapedName = data.name
      .trim()
      .replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

    const existingFoodItem = await db.readOne<FoodItem>('fooditems', {
      name: {
        $regex: new RegExp(`^${escapedName}$`, 'i'),
      },
    });

    console.log('Checking duplicate create:', data.name);
    console.log('Duplicate create result:', existingFoodItem);

    if (existingFoodItem.success && existingFoodItem.data) {
      return NextResponse.json(
        {
          error: 'Food item already exists',
        },
        { status: 400 }
      );
    }

    // Set default short description if not provided
    const foodItemData: FoodItem = {
      name: data.name.trim(),
      description: data.description?.trim() || '',
      short_description:
        data.short_description?.trim() ||
        'A perfect balance of taste, aroma, and warmth.',
      category: [],
      veg: data.veg,
      available: data.available,
      isDraft: data.isDraft ?? false,
      ...imageFields(incomingImages(data)),
      itemType: data.itemType,
      isEcoFriendlyContainer: data.isEcoFriendlyContainer,
      ecoContainerCharge: data.ecoContainerCharge,
      hasSpiceLevel: data.hasSpiceLevel,
      spiceLevel: data.spiceLevel || [],
      ...(data.itemType === 'combo' && data.hasSpiceLevel && data.spiceMode ? { spiceMode: data.spiceMode } : {}),
      ...(isPreparationType(data.preparationType) ? { preparationType: data.preparationType } : {}),
      // a new item is on the Stickers sheet unless it was created with Sticker = No
      sticker: isStickerFlag(data.sticker) ? data.sticker : 'yes',
      chefsPick: data.chefsPick === true,
      allowInstructions: data.allowInstructions === true,
      ...stockFieldsForCreate(data, new Date()),
      // an item with no sticker has no split sticker either
      ...(data.sticker === 'no' ? { splitSticker: 'no' } : isStickerFlag(data.splitSticker) ? { splitSticker: data.splitSticker } : {}),
      createdAt: new Date(),
      updatedAt: new Date(),
    };



    // Add type-specific fields
    if (data.itemType === 'simple' || data.itemType === 'combo') {
      foodItemData.price = data.price;
    }

    if (data.itemType === 'portions') {
      foodItemData.portions = data.portions;
      foodItemData.portionPrices = data.portionPrices;
      // Default all portions to available if not provided
      foodItemData.portionAvailability = data.portionAvailability ||
        (data.portions ? data.portions.map(() => true) : []);
    }

    if (data.itemType === 'combo') {
      foodItemData.hasCombo = true;
      // Assign sequence numbers to sections based on their array index
      foodItemData.sections = data.sections?.map((section: any, index: number) => ({
        ...withoutSectionSpiceFlags(section, data.hasSpiceLevel ? data.spiceMode : null),
        sequence: section.sequence ?? index,
      }));

      // Flatten sections into comboItems for backward compatibility
      const comboItems: ComboItem[] = [];
      if (data.sections) {
        for (const section of data.sections) {
          for (const selectedItem of section.selectedItems) {
            comboItems.push({
              item: new ObjectId(selectedItem.item),
              portion: selectedItem.portion,
              price: selectedItem.price,
              portionId: selectedItem.portionId,
              isDefault: selectedItem.isDefault,
              isAvailable: selectedItem.isAvailable ?? true,
              ...(selectedItem.quantity && selectedItem.quantity > 1 ? { quantity: selectedItem.quantity } : {}),
            });
          }
        }
      }
      foodItemData.comboItems = comboItems;
    }

    // Create food item
    const result = await db.create<FoodItem>('fooditems', foodItemData);

    if (!result.success) {
      // Rollback: Delete uploaded images from Cloudinary if DB creation fails
      await deleteUnusedPhotos(incomingImages(data).map((i) => i.public_id ?? ''));
      throw new Error(result.error || 'Failed to create food item');
    }

    // Create CategoryFoodMapping entries for each category
    const uniqueCategoryIds = dedupeCategoryIds(data.category);
    if (result.id && uniqueCategoryIds.length > 0) {
      const foodItemId = new ObjectId(result.id);
      const mappingDocuments: CategoryFoodMapping[] = [];

      for (let i = 0; i < uniqueCategoryIds.length; i++) {
        const categoryIdStr = uniqueCategoryIds[i];
        try {
          const categoryId = new ObjectId(categoryIdStr);
          mappingDocuments.push({
            foodItemId,
            categoryId,
            sequence: i,
            mappingType: 'FLAT',
            createdAt: new Date(),
            updatedAt: new Date(),
          });
        } catch (error) {
          console.error(`Invalid category ID ${categoryIdStr} for food item ${result.id}:`, error);
        }
      }

      // Insert all mappings in batch
      if (mappingDocuments.length > 0) {
        const mappingResult = await db.createMany<CategoryFoodMapping>('categoryfoodmapping', mappingDocuments);
        if (!mappingResult.success) {
          console.error('Failed to create category mappings:', mappingResult.error);
          // Note: We don't rollback the food item creation here as it already succeeded
          // The mappings can be created manually later
        }
      }
    }

    // Fetch the created item with mappings
    const createdItem = await db.readOne<FoodItem>('fooditems', {
      _id: new ObjectId(result.id),
    });

    if (!createdItem.success || !createdItem.data) {
      // Item was created but fetch failed - return success with the ID
      return NextResponse.json(
        { success: true, _id: result.id, message: 'Food item created successfully' },
        { status: 201 }
      );
    }

    // Attach categories from mappings to the response
    let itemWithCategories = { ...createdItem.data };
    if (result.id) {
      const mappingResult = await db.read<CategoryFoodMapping>('categoryfoodmapping', {
        foodItemId: new ObjectId(result.id)
      }, {
        sort: { sequence: 1 }
      });

      itemWithCategories = {
        ...createdItem.data,
        category: mappingResult.success && mappingResult.data
          ? dedupeMappingCategoryIds(mappingResult.data)
          : []
      };
    }

    invalidateLivesiteHomeMenuCache();
    return NextResponse.json(itemWithCategories, { status: 201 });
  } catch (error) {
    console.error('Error in POST /api/admin/food-items:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/admin/food-items
 * Update existing food item
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
    const { _id, isImageUpdated: _legacyImageFlag, ...rest } = body;
    /** Only sync FLAT mappings when client explicitly sends `category` (omit = leave mappings unchanged). */
    const categoryProvided = Object.prototype.hasOwnProperty.call(body, 'category');

    // Validate required fields
    if (!_id) {
      return NextResponse.json({ error: 'Food item ID is required' }, { status: 400 });
    }

    // Validate using Zod
    const validationResult = foodItemSchema.safeParse(rest);

    if (!validationResult.success) {
      return NextResponse.json(
        {
          error: 'Validation failed',
          details: validationResult.error.issues,
        },
        { status: 400 }
      );
    }

    // Fetch existing item
    const existingResult = await db.readOne<FoodItem>('fooditems', {
      _id: new ObjectId(_id),
    });

    if (!existingResult.success || !existingResult.data) {
      return NextResponse.json({ error: 'Food item not found' }, { status: 404 });
    }

    const existingItem = existingResult.data;
   const data = validationResult.data;
    const stockProblem = stockUnitProblem(data, Array.isArray(data.portions) && data.portions.length > 0);
    if (stockProblem) return NextResponse.json({ error: stockProblem }, { status: 400 });
    // order limit (inventory): what to save, and what to write in the item's stock log
    const stockUpdate = stockFieldsForUpdate(existingItem as unknown as Record<string, unknown>, data, new Date());

// Check duplicate food item except current item
const escapedName = data.name
  .trim()
  .replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const duplicateFoodItem = await db.readOne<FoodItem>('fooditems', {
  name: {
    $regex: new RegExp(`^${escapedName}$`, 'i'),
  },
  _id: { $ne: new ObjectId(_id) },
});

console.log('Checking duplicate update:', data.name);
console.log('Duplicate update result:', duplicateFoodItem);

if (duplicateFoodItem.success && duplicateFoodItem.data) {
  return NextResponse.json(
    {
      error: 'Food item already exists',
    },
    { status: 400 }
  );
}

// Prepare update data
const updateData: Partial<FoodItem> = {
  name: data.name.trim(),
  description: data.description?.trim() || '',
  short_description:
    data.short_description?.trim() ||
    'A perfect balance of taste, aroma, and warmth.',
  veg: data.veg,
  available: data.available,
  isDraft: data.isDraft ?? false,
  ...imageFields(incomingImages(data)),
  itemType: data.itemType,
  isEcoFriendlyContainer: data.isEcoFriendlyContainer,
  ecoContainerCharge: data.ecoContainerCharge,
  hasSpiceLevel: data.hasSpiceLevel,
  spiceLevel: data.spiceLevel || [],
  ...(data.itemType === 'combo' && data.hasSpiceLevel && data.spiceMode ? { spiceMode: data.spiceMode } : {}),
  ...(isPreparationType(data.preparationType) ? { preparationType: data.preparationType } : {}),
  ...(isStickerFlag(data.sticker) ? { sticker: data.sticker } : {}),
  ...(typeof data.chefsPick === 'boolean' ? { chefsPick: data.chefsPick } : {}),
  ...(typeof data.allowInstructions === 'boolean' ? { allowInstructions: data.allowInstructions } : {}),
  ...stockUpdate.set,
  // an item with no sticker has no split sticker either; otherwise the Split Sticker choice is saved as sent
  ...(data.sticker === 'no' ? { splitSticker: 'no' } : isStickerFlag(data.splitSticker) ? { splitSticker: data.splitSticker } : {}),
  updatedAt: new Date(),
};

    // Add type-specific fields
    if (data.itemType === 'simple' || data.itemType === 'combo') {
      updateData.price = data.price;
    } else {
      // Clear price for portions type
      updateData.price = undefined;
    }

    if (data.itemType === 'portions') {
      updateData.portions = data.portions;
      updateData.portionPrices = data.portionPrices;
      // Default all portions to available if not provided
      updateData.portionAvailability = data.portionAvailability ||
        (data.portions ? data.portions.map(() => true) : []);
      // Clear combo fields
      updateData.hasCombo = false;
      updateData.comboItems = [];
      updateData.sections = [];
    } else {
      // Clear portions fields
      updateData.portions = [];
      updateData.portionPrices = [];
      updateData.portionAvailability = [];
    }

    if (data.itemType === 'combo') {
      updateData.hasCombo = true;
      // Assign sequence numbers to sections based on their array index
      updateData.sections = data.sections?.map((section: any, index: number) => ({
        ...withoutSectionSpiceFlags(section, data.hasSpiceLevel ? data.spiceMode : null),
        sequence: section.sequence ?? index,
      }));

      // Flatten sections into comboItems
      const comboItems: ComboItem[] = [];
      if (data.sections) {
        for (const section of data.sections) {
          for (const selectedItem of section.selectedItems) {
            comboItems.push({
              item: new ObjectId(selectedItem.item),
              portion: selectedItem.portion,
              price: selectedItem.price,
              portionId: selectedItem.portionId,
              isDefault: selectedItem.isDefault,
              isAvailable: selectedItem.isAvailable ?? true,
              ...(selectedItem.quantity && selectedItem.quantity > 1 ? { quantity: selectedItem.quantity } : {}),
            });
          }
        }
      }
      updateData.comboItems = comboItems;
      // Sync combo item availability with original food items
      if (data.sections) {
        for (const section of data.sections) {
          for (const selectedItem of section.selectedItems) {

            await db.updateOne(
              'fooditems',
              { _id: new ObjectId(selectedItem.item) },
              {
                $set: {
                  available: selectedItem.isAvailable ?? true,
                  updatedAt: new Date(),
                },
              }
            );

          }
        }
      }
    } else {
      // Clear combo fields
      updateData.hasCombo = false;
      updateData.comboItems = [];
      updateData.sections = [];
    }

    if (categoryProvided) {
      updateData.category = [];
    }

    // Update food item
    // preparationType / sticker: sent as null means "back to not set yet"; left out means "leave as it is"
    const unset: Record<string, ''> = {};
    if (data.preparationType === null) unset.preparationType = '';
    if (data.sticker === null) unset.sticker = '';
    // a combo without spice (or sent without a spice mode) goes back to no spice mode
    if (data.itemType === 'combo' && (data.hasSpiceLevel === false || data.spiceMode === null)) unset.spiceMode = '';
    if (data.splitSticker === null && data.sticker !== 'no') unset.splitSticker = '';
    const updateResult = await db.updateOne<FoodItem>(
      'fooditems',
      { _id: new ObjectId(_id) },
      Object.keys(unset).length > 0 ? { $set: updateData, $unset: unset } : { $set: updateData }
    );

    if (!updateResult.success) {
      throw new Error(updateResult.error || 'Failed to update food item');
    }

    // CategoryFoodMapping: only when client sent `category` (FLAT links). Preserves DAY_WISE date rows otherwise.
    if (categoryProvided) {
      const deleteFlatMappingsFilter: Filter<Record<string, unknown>> = {
        foodItemId: new ObjectId(_id),
        $or: [{ mappingType: 'FLAT' }, { mappingType: { $exists: false } }],
      };
      const deleteResult = await db.delete<CategoryFoodMapping>(
        'categoryfoodmapping',
        deleteFlatMappingsFilter as Filter<CategoryFoodMapping>
      );

      if (!deleteResult.success) {
        console.error('Failed to delete old FLAT category mappings:', deleteResult.error);
      }

      if (data.category && data.category.length > 0) {
        const foodItemId = new ObjectId(_id);
        const mappingDocuments: CategoryFoodMapping[] = [];
        const uniqueCategoryIds = dedupeCategoryIds(data.category);

        for (let i = 0; i < uniqueCategoryIds.length; i++) {
          const categoryIdStr = uniqueCategoryIds[i];
          try {
            const categoryId = new ObjectId(categoryIdStr);
            mappingDocuments.push({
              foodItemId,
              categoryId,
              sequence: i,
              mappingType: 'FLAT',
              createdAt: new Date(),
              updatedAt: new Date(),
            });
          } catch (error) {
            console.error(`Invalid category ID ${categoryIdStr} for food item ${_id}:`, error);
          }
        }

        if (mappingDocuments.length > 0) {
          const mappingResult = await db.createMany<CategoryFoodMapping>('categoryfoodmapping', mappingDocuments);
          if (!mappingResult.success) {
            console.error('Failed to create category mappings:', mappingResult.error);
          }
        }
      }
    }

    // photos the item no longer has are removed from Cloudinary (unless another item still uses them)
    await deleteRemovedPhotos(existingItem, incomingImages(data), existingItem._id);

    for (const entry of stockUpdate.log) await writeStockLog({ foodItemId: String(_id), ...entry, byId: String(authResult.userId ?? ''), byName: authResult.adminName ?? '' });

    // Fetch updated item
    const updatedItem = await db.readOne<FoodItem>('fooditems', {
      _id: new ObjectId(_id),
    });

    if (!updatedItem.success || !updatedItem.data) {
      // Item was updated but fetch failed - return success with the ID
      return NextResponse.json(
        { success: true, _id: _id, message: 'Food item updated successfully' },
        { status: 200 }
      );
    }

    // Attach categories from mappings to the response
    const mappingResult = await db.read<CategoryFoodMapping>('categoryfoodmapping', {
      foodItemId: new ObjectId(_id)
    }, {
      sort: { sequence: 1 }
    });

    const itemWithCategories = {
      ...updatedItem.data,
      category: mappingResult.success && mappingResult.data
        ? dedupeMappingCategoryIds(mappingResult.data)
        : []
    };

    invalidateLivesiteHomeMenuCache();
    return NextResponse.json(itemWithCategories);
  } catch (error) {
    console.error('Error in PUT /api/admin/food-items:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/admin/food-items
 * Delete food item
 */
export async function DELETE(request: NextRequest) {
  try {
    // Verify authentication
    const authResult = verifyAuth(request);
    if (!authResult.success) {
      return NextResponse.json({ error: authResult.error }, { status: 401 });
    }

    // Get item ID from query params
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'Food item ID is required' }, { status: 400 });
    }

    // Fetch item to get public_id for image deletion
    const existingResult = await db.readOne<FoodItem>('fooditems', {
      _id: new ObjectId(id),
    });

    if (!existingResult.success || !existingResult.data) {
      return NextResponse.json({ error: 'Food item not found' }, { status: 404 });
    }

    const item = existingResult.data;

    // Delete CategoryFoodMapping entries for this food item
    const mappingDeleteResult = await db.delete<CategoryFoodMapping>('categoryfoodmapping', {
      foodItemId: new ObjectId(id)
    });

    if (!mappingDeleteResult.success) {
      console.error('Failed to delete category mappings:', mappingDeleteResult.error);
      // Continue anyway as we still want to delete the food item
    } else {
      console.log(`Deleted ${mappingDeleteResult.deletedCount || 0} category mappings for food item ${id}`);
    }

    // Delete from database
    const deleteResult = await db.deleteOne<FoodItem>('fooditems', {
      _id: new ObjectId(id),
    });

    if (!deleteResult.success) {
      throw new Error(deleteResult.error || 'Failed to delete food item');
    }

    // Delete the item's photos from Cloudinary (a photo another item still uses is kept)
    await deleteUnusedPhotos(storedImages(item).map((i) => i.public_id ?? ''), item._id);

    invalidateLivesiteHomeMenuCache();
    return NextResponse.json({ success: true, message: 'Food item deleted successfully' });
  } catch (error) {
    console.error('Error in DELETE /api/admin/food-items:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}
