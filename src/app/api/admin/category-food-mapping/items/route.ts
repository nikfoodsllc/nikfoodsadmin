import { NextRequest, NextResponse } from 'next/server';
import { jwtHandler } from '@/lib/jwt';
import { db } from '@/lib/db';
import { ObjectId } from 'mongodb';
import { CategoryFoodMapping, MappingType } from '@/types/order';

/**
 * Interface for food item details from aggregation
 */
interface FoodItemDetails {
  _id: ObjectId | string;
  name: string;
  price?: number;
  url?: string;
  description?: string;
}

/**
 * Interface for item response with mapping information
 */
interface ItemWithMapping {
  _id: string;
  name: string;
  url?: string;
  price?: number;
  description?: string;
  sequence: number;
  mappingId: string;
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

/**
 * GET /api/admin/category-food-mapping/items
 * Get food items for a category with their sequence and mapping information
 * Query params:
 *   - categoryId (required): Category ID to fetch items for
 *   - mappingType (optional): Filter by mapping type ('FLAT' or 'DAY_WISE')
 *   - day (optional): Filter by day (only for DAY_WISE mappings)
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
    const categoryId = searchParams.get('categoryId');
    const mappingType = searchParams.get('mappingType') as MappingType | null;
    const day = searchParams.get('day');

    // Validate required parameters
    if (!categoryId) {
      return NextResponse.json(
        { error: 'categoryId is required' },
        { status: 400 }
      );
    }

    // Convert categoryId to ObjectId
    let categoryObjectId: ObjectId;
    try {
      categoryObjectId = new ObjectId(categoryId);
    } catch (error) {
      return NextResponse.json(
        { error: 'Invalid categoryId format' },
        { status: 400 }
      );
    }

    // Validate mappingType if provided
    if (mappingType && mappingType !== 'FLAT' && mappingType !== 'DAY_WISE') {
      return NextResponse.json(
        { error: 'Invalid mappingType. Must be FLAT or DAY_WISE' },
        { status: 400 }
      );
    }

    // Validate day parameter
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

    // Build filter for category-food-mapping collection
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

    // Fetch mappings sorted by sequence
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
      return NextResponse.json({
        success: true,
        data: {
          items: [],
          total: 0,
        },
        message: 'No items found for this category',
      });
    }

    // Extract food item IDs from mappings
    const foodItemIds = mappings.map((mapping) => mapping.foodItemId);

    // Fetch food item details
    const foodItemsResult = await db.read<FoodItemDetails>('fooditems', {
      _id: { $in: foodItemIds },
    });

    if (!foodItemsResult.success) {
      throw new Error(foodItemsResult.error || 'Failed to fetch food items');
    }

    const foodItems = foodItemsResult.data || [];

    // Create a map for quick lookup
    const foodItemMap = new Map<string, FoodItemDetails>();
    foodItems.forEach((item) => {
      foodItemMap.set(item._id.toString(), item);
    });

    // Combine mapping data with food item details, sorted by sequence
    const items: ItemWithMapping[] = mappings
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
        };
      })
      .filter((item): item is NonNullable<typeof item> => item !== null);

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
