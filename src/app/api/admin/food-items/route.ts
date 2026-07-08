import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { jwtHandler } from '@/lib/jwt';
import { db } from '@/lib/db';
import { deleteFromCloudinary } from '@/lib/cloudinary';
import { ObjectId, type Filter } from 'mongodb';

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
});

// Section schema for combo items
const sectionSchema = z.object({
  title: z.string(),
  selectedItems: z.array(comboItemSchema),
  sequence: z.number().optional(),
  minSelection: z.number().optional().default(1),
  maxSelection: z.number().optional().default(1),
  isRequired: z.boolean().optional().default(true),
});

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
  itemType: z.enum(['simple', 'portions', 'combo']).default('simple'),

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
  itemType: 'simple' | 'portions' | 'combo';

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

  return { success: true, userId: verificationResult.payload.userId };
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
      const categoryIdObj = new ObjectId(categoryId);
      const mappingResult = await db.read<CategoryFoodMapping>('categoryfoodmapping', {
        categoryId: categoryIdObj
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
      url: data.url || '',
      public_id: data.public_id || '',
      itemType: data.itemType,
      isEcoFriendlyContainer: data.isEcoFriendlyContainer,
      ecoContainerCharge: data.ecoContainerCharge,
      hasSpiceLevel: data.hasSpiceLevel,
      spiceLevel: data.spiceLevel || [],
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
        ...section,
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
            });
          }
        }
      }
      foodItemData.comboItems = comboItems;
    }

    // Create food item
    const result = await db.create<FoodItem>('fooditems', foodItemData);

    if (!result.success) {
      // Rollback: Delete uploaded image from Cloudinary if DB creation fails
      if (data.public_id) {
        await deleteFromCloudinary(data.public_id);
      }
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
    const { _id, isImageUpdated, ...rest } = body;
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
    const oldPublicId = existingItem.public_id;

   const data = validationResult.data;

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
  url: data.url || '',
  public_id: data.public_id || '',
  itemType: data.itemType,
  isEcoFriendlyContainer: data.isEcoFriendlyContainer,
  ecoContainerCharge: data.ecoContainerCharge,
  hasSpiceLevel: data.hasSpiceLevel,
  spiceLevel: data.spiceLevel || [],
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
        ...section,
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
    const updateResult = await db.updateOne<FoodItem>(
      'fooditems',
      { _id: new ObjectId(_id) },
      { $set: updateData }
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

    // If image was updated and there was an old image, delete it from Cloudinary
    if (isImageUpdated && oldPublicId) {
      await deleteFromCloudinary(oldPublicId);
    }

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

    // Delete image from Cloudinary if exists
    if (item.public_id) {
      const cloudinaryResult = await deleteFromCloudinary(item.public_id);
      if (!cloudinaryResult.success) {
        console.error('Failed to delete image from Cloudinary:', cloudinaryResult.error);
        // Continue anyway as DB deletion was successful
      }
    }

    return NextResponse.json({ success: true, message: 'Food item deleted successfully' });
  } catch (error) {
    console.error('Error in DELETE /api/admin/food-items:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}
