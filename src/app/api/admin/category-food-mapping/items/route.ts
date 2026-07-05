import { NextRequest, NextResponse } from 'next/server';
import { jwtHandler } from '@/lib/jwt';
import { db } from '@/lib/db';
import { ObjectId } from 'mongodb';
import {
  CategoryFoodMapping,
  CategoryListingType,
  FoodCategory,
  MappingType,
} from '@/types/order';

interface FoodItemDetails {
  _id: ObjectId | string;
  name: string;
  price?: number;
  url?: string;
  description?: string;
}

interface ItemWithMapping {
  _id: string;
  name: string;
  url?: string;
  price?: number;
  description?: string;
  sequence: number;
  mappingId: string;
  mappingCategoryId: string;
}

interface ItemGroup {
  categoryId: string;
  categoryName: string;
  isSubCategory: boolean;
  items: ItemWithMapping[];
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

async function fetchItemsForCategory(
  categoryObjectId: ObjectId,
  mappingType?: MappingType,
  day?: string | null
): Promise<ItemWithMapping[]> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const filter: any = {
    categoryId: categoryObjectId,
  };

  if (mappingType) {
    filter.mappingType = mappingType;
  }

  if (day) {
    filter.day = day;
  }

  const mappingsResult = await db.read<CategoryFoodMapping>(
    'categoryfoodmapping',
    filter,
    { sort: { sequence: 1 } }
  );

  if (!mappingsResult.success) {
    throw new Error(mappingsResult.error || 'Failed to fetch category mappings');
  }

  const mappings = mappingsResult.data || [];

  if (mappings.length === 0) {
    return [];
  }

  const foodItemIds = mappings.map((mapping) => mapping.foodItemId);

  const foodItemsResult = await db.read<FoodItemDetails>('fooditems', {
    _id: { $in: foodItemIds },
  });

  if (!foodItemsResult.success) {
    throw new Error(foodItemsResult.error || 'Failed to fetch food items');
  }

  const foodItems = foodItemsResult.data || [];
  const foodItemMap = new Map<string, FoodItemDetails>();

  foodItems.forEach((item) => {
    foodItemMap.set(item._id.toString(), item);
  });

  const categoryIdStr = categoryObjectId.toString();

  return mappings
    .map((mapping) => {
      const foodItemId = mapping.foodItemId.toString();
      const foodItem = foodItemMap.get(foodItemId);

      if (!foodItem) {
        console.warn(`Food item not found: ${foodItemId}`);
        return null;
      }

      return {
        _id: foodItem._id.toString(),
        name: foodItem.name,
        url: foodItem.url,
        price: foodItem.price,
        description: foodItem.description,
        sequence: mapping.sequence,
        mappingId: mapping._id?.toString() || '',
        mappingCategoryId: categoryIdStr,
      };
    })
    .filter((item): item is NonNullable<typeof item> => item !== null);
}

function mergeItemsById(
  existing: ItemWithMapping[],
  incoming: ItemWithMapping[]
): ItemWithMapping[] {
  const byId = new Map(existing.map((item) => [item._id, item]));

  for (const item of incoming) {
    if (!byId.has(item._id)) {
      byId.set(item._id, item);
    }
  }

  return Array.from(byId.values());
}

function toCategoryObjectId(id: ObjectId | string): ObjectId {
  if (id instanceof ObjectId) {
    return id;
  }

  return new ObjectId(id);
}

async function fetchSubCategories(
  parentCategoryObjectId: ObjectId
): Promise<FoodCategory[]> {
  const result = await db.read<FoodCategory>(
    'foodcategories',
    {
      parentCategoryId: parentCategoryObjectId,
      isDraft: { $ne: true },
    },
    { sort: { sequence: 1, createdAt: 1 } }
  );

  if (!result.success) {
    throw new Error(result.error || 'Failed to fetch sub-categories');
  }

  return result.data || [];
}

async function buildFlatGroupsWithSubs(
  category: FoodCategory,
  categoryObjectId: ObjectId
): Promise<ItemGroup[]> {
  const subCategories = await fetchSubCategories(categoryObjectId);
  const parentItems = await fetchItemsForCategory(categoryObjectId, 'FLAT');

  const groups: ItemGroup[] = [];

  if (parentItems.length > 0) {
    groups.push({
      categoryId: categoryObjectId.toString(),
      categoryName: category.name,
      isSubCategory: false,
      items: parentItems,
    });
  }

  for (const sub of subCategories) {
    if (!sub._id) continue;

    const subObjectId = toCategoryObjectId(sub._id);

    const subItems = await fetchItemsForCategory(subObjectId, 'FLAT');

    if (subItems.length > 0) {
      groups.push({
        categoryId: subObjectId.toString(),
        categoryName: sub.name,
        isSubCategory: true,
        items: subItems,
      });
    }
  }

  return groups;
}

async function buildDayWiseGroupsWithSubs(
  category: FoodCategory,
  categoryObjectId: ObjectId,
  day: string
): Promise<ItemGroup[]> {
  const subCategories = await fetchSubCategories(categoryObjectId);
  const parentItems = await fetchItemsForCategory(
    categoryObjectId,
    'DAY_WISE',
    day
  );

  const subIds = subCategories
    .filter((sub) => sub._id)
    .map((sub) => toCategoryObjectId(sub._id!));

  const itemToSubId = new Map<string, string>();

  if (subIds.length > 0) {
    const flatMappingsResult = await db.read<CategoryFoodMapping>(
      'categoryfoodmapping',
      {
        categoryId: { $in: subIds },
        $or: [{ mappingType: 'FLAT' }, { mappingType: { $exists: false } }],
      }
    );

    if (flatMappingsResult.success && flatMappingsResult.data) {
      for (const mapping of flatMappingsResult.data) {
        const foodItemId = mapping.foodItemId.toString();
        const subId = mapping.categoryId.toString();

        if (!itemToSubId.has(foodItemId)) {
          itemToSubId.set(foodItemId, subId);
        }
      }
    }
  }

  const parentOnlyItems: ItemWithMapping[] = [];
  const subItemsById = new Map<string, ItemWithMapping[]>();

  for (const sub of subCategories) {
    if (sub._id) {
      subItemsById.set(toCategoryObjectId(sub._id).toString(), []);
    }
  }

  for (const item of parentItems) {
    const subId = itemToSubId.get(item._id);

    if (subId && subItemsById.has(subId)) {
      subItemsById.get(subId)!.push(item);
    } else {
      parentOnlyItems.push(item);
    }
  }

  const groups: ItemGroup[] = [];

  if (parentOnlyItems.length > 0) {
    groups.push({
      categoryId: categoryObjectId.toString(),
      categoryName: category.name,
      isSubCategory: false,
      items: parentOnlyItems,
    });
  }

  for (const sub of subCategories) {
    if (!sub._id) continue;

    const subObjectId = toCategoryObjectId(sub._id);
    const subIdStr = subObjectId.toString();

    let subGroupItems = subItemsById.get(subIdStr) ?? [];

    if ((sub.listingType || 'flat') === 'day-wise') {
      const subDayItems = await fetchItemsForCategory(
        subObjectId,
        'DAY_WISE',
        day
      );
      subGroupItems = mergeItemsById(subGroupItems, subDayItems);
    } else {
      const subFlatItems = await fetchItemsForCategory(subObjectId, 'FLAT');
      subGroupItems = mergeItemsById(subGroupItems, subFlatItems);
    }

    if (subGroupItems.length > 0) {
      groups.push({
        categoryId: subIdStr,
        categoryName: sub.name,
        isSubCategory: true,
        items: subGroupItems,
      });
    }
  }

  return groups;
}

async function buildGroupedItems(
  category: FoodCategory,
  categoryObjectId: ObjectId,
  mappingType: MappingType | null,
  day: string | null
): Promise<ItemGroup[]> {
  const listingType: CategoryListingType = category.listingType || 'flat';

  if (listingType === 'day-wise') {
    if (!day) {
      return [];
    }

    return buildDayWiseGroupsWithSubs(category, categoryObjectId, day);
  }

  return buildFlatGroupsWithSubs(category, categoryObjectId);
}

/**
 * GET /api/admin/category-food-mapping/items
 * Query params:
 *   - categoryId (required)
 *   - mappingType (optional): 'FLAT' | 'DAY_WISE'
 *   - day (optional): required for DAY_WISE
 *   - includeSubCategories (optional): when true, return items grouped by sub-category
 */
export async function GET(request: NextRequest) {
  try {
    const authResult = verifyAuth(request);
    if (!authResult.success) {
      return NextResponse.json({ error: authResult.error }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const categoryId = searchParams.get('categoryId');
    const mappingType = searchParams.get('mappingType') as MappingType | null;
    const day = searchParams.get('day');
    const includeSubCategories =
      searchParams.get('includeSubCategories') === 'true';

    if (!categoryId) {
      return NextResponse.json(
        { error: 'categoryId is required' },
        { status: 400 }
      );
    }

    let categoryObjectId: ObjectId;
    try {
      categoryObjectId = new ObjectId(categoryId);
    } catch {
      return NextResponse.json(
        { error: 'Invalid categoryId format' },
        { status: 400 }
      );
    }

    if (mappingType && mappingType !== 'FLAT' && mappingType !== 'DAY_WISE') {
      return NextResponse.json(
        { error: 'Invalid mappingType. Must be FLAT or DAY_WISE' },
        { status: 400 }
      );
    }

    if (day) {
      if (!mappingType) {
        return NextResponse.json(
          { error: 'mappingType must be provided when using day filter' },
          { status: 400 }
        );
      }
      if (mappingType !== 'DAY_WISE') {
        return NextResponse.json(
          { error: 'Day filter can only be used with DAY_WISE mapping type' },
          { status: 400 }
        );
      }
    }

    if (includeSubCategories) {
      const categoryResult = await db.readOne<FoodCategory>('foodcategories', {
        _id: categoryObjectId,
      });

      if (!categoryResult.success || !categoryResult.data) {
        return NextResponse.json(
          { error: 'Category not found' },
          { status: 404 }
        );
      }

      const category = categoryResult.data;

      if (category.parentCategoryId) {
        return NextResponse.json(
          {
            error:
              'includeSubCategories is only supported for top-level categories',
          },
          { status: 400 }
        );
      }

      const groups = await buildGroupedItems(
        category,
        categoryObjectId,
        mappingType,
        day
      );

      const items = groups.flatMap((group) => group.items);

      return NextResponse.json({
        success: true,
        data: {
          items,
          groups,
          total: items.length,
        },
        message: `Fetched ${items.length} items in ${groups.length} groups successfully`,
      });
    }

    const items = await fetchItemsForCategory(
      categoryObjectId,
      mappingType || undefined,
      day
    );

    return NextResponse.json({
      success: true,
      data: {
        items,
        total: items.length,
      },
      message: `Fetched ${items.length} items successfully`,
    });
  } catch (error) {
    console.error('Error in GET /api/admin/category-food-mapping/items:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}
