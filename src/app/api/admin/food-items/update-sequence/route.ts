import { NextRequest, NextResponse } from 'next/server';
import { jwtHandler } from '@/lib/jwt';
import { db } from '@/lib/db';
import { ObjectId } from 'mongodb';
import { CategoryFoodMapping } from '@/types/order';
import { invalidateLivesiteHomeMenuCache } from '@/lib/invalidateHomeMenuCache';

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
 * PUT /api/admin/food-items/update-sequence
 * Update the sequence of food items within a category
 * Body: { categoryId: string, items: [{ foodItemId: string, sequence: number }] }
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
    const { categoryId, items } = body;

    // Validate required fields
    if (!categoryId) {
      return NextResponse.json(
        { error: 'categoryId is required' },
        { status: 400 }
      );
    }

    if (!items || !Array.isArray(items)) {
      return NextResponse.json(
        { error: 'items array is required' },
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

    // Update sequence for each item
    const updatePromises = items.map(async (item: { foodItemId: string; sequence: number }) => {
      const { foodItemId, sequence } = item;

      if (!foodItemId || typeof sequence !== 'number') {
        throw new Error('Invalid item format: each item must have foodItemId (string) and sequence (number)');
      }

      let foodItemIdObj: ObjectId;
      try {
        foodItemIdObj = new ObjectId(foodItemId);
      } catch (error) {
        throw new Error(`Invalid foodItemId format: ${foodItemId}`);
      }

      return db.updateOne<CategoryFoodMapping>(
        'categoryfoodmapping',
        {
          categoryId: categoryObjectId,
          foodItemId: foodItemIdObj,
        },
        {
          $set: {
            sequence,
            updatedAt: new Date(),
          },
        }
      );
    });

    const results = await Promise.all(updatePromises);

    // Check if all updates were successful
    const failedUpdates = results.filter((r) => !r.success);
    if (failedUpdates.length > 0) {
      console.error('Some sequence updates failed:', failedUpdates);
      return NextResponse.json(
        { error: 'Failed to update some item sequences' },
        { status: 500 }
      );
    }

    await invalidateLivesiteHomeMenuCache();
    return NextResponse.json({
      success: true,
      message: 'Item sequences updated successfully',
    });
  } catch (error) {
    console.error('Error in PUT /api/admin/food-items/update-sequence:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}
