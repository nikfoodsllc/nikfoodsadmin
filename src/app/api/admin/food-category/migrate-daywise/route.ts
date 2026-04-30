import { NextRequest, NextResponse } from 'next/server';
import { jwtHandler } from '@/lib/jwt';
import { db } from '@/lib/db';
import { ObjectId } from 'mongodb';
import { FoodCategory } from '@/types/order';

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
 * POST /api/admin/food-category/migrate-daywise
 * One-time migration to add listingType field to existing categories
 */
export async function POST(request: NextRequest) {
  try {
    // Verify authentication
    const authResult = verifyAuth(request);
    if (!authResult.success) {
      return NextResponse.json({ error: authResult.error }, { status: 401 });
    }

    console.log('Starting migration: Adding listingType field to existing food categories...');

    // Find all categories that don't have a listingType field
    const result = await db.read<FoodCategory>('foodcategories', {
      listingType: { $exists: false }
    }, {
      sort: { createdAt: 1 }
    });

    if (!result.success) {
      throw new Error('Failed to fetch categories: ' + result.error);
    }

    const categories = result.data || [];

    if (categories.length === 0) {
      console.log('✅ No categories need listingType field updates. All categories already have listingType values.');
      return NextResponse.json({
        success: true,
        message: 'Migration completed: No categories needed listingType updates',
        data: {
          totalProcessed: 0,
          successfulUpdates: 0,
          failedUpdates: 0,
          alreadyHasListingType: true
        }
      });
    }

    console.log(`Found ${categories.length} categories without listingType field`);

    // Update each category with 'flat' listingType for backward compatibility
    let updateCount = 0;
    const failedUpdates: Array<{ id: string; name: string; error: string }> = [];

    for (const category of categories) {
      const updateResult = await db.updateOne<FoodCategory>('foodcategories', {
        _id: category._id
      }, {
        $set: {
          listingType: 'flat',
          updatedAt: new Date()
        }
      });

      if (!updateResult.success) {
        console.error(`❌ Failed to update category ${category._id}: ${updateResult.error}`);
        failedUpdates.push({
          id: category._id?.toString() || 'unknown',
          name: category.name || 'unnamed',
          error: updateResult.error || 'Unknown error'
        });
        continue;
      }

      updateCount++;
      console.log(`✅ Updated "${category.name}" with listingType 'flat'`);
    }

    console.log(`\n🎉 Migration completed successfully!`);
    console.log(`   - Total categories processed: ${categories.length}`);
    console.log(`   - Successfully updated: ${updateCount}`);
    console.log(`   - Failed updates: ${categories.length - updateCount}`);

    return NextResponse.json({
      success: true,
      message: 'Migration completed successfully',
      data: {
        totalProcessed: categories.length,
        successfulUpdates: updateCount,
        failedUpdates: categories.length - updateCount,
        failedCategories: failedUpdates
      }
    });

  } catch (error) {
    console.error('❌ Migration failed:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Internal server error'
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/admin/food-category/migrate-daywise
 * Check migration status and return information about categories without listingType
 */
export async function GET(request: NextRequest) {
  try {
    // Verify authentication
    const authResult = verifyAuth(request);
    if (!authResult.success) {
      return NextResponse.json({ error: authResult.error }, { status: 401 });
    }

    // Count categories without listingType
    const withoutListingTypeResult = await db.read<FoodCategory>('foodcategories', {
      listingType: { $exists: false }
    }, {
      sort: { createdAt: 1 }
    });

    // Count categories with listingType
    const withListingTypeResult = await db.read<FoodCategory>('foodcategories', {
      listingType: { $exists: true }
    }, {
      sort: { sequence: 1 }
    });

    // Get total count
    const totalResult = await db.read<FoodCategory>('foodcategories', {}, {
      sort: { createdAt: 1 }
    });

    // Get listing type statistics
    const flatCategoriesResult = await db.read<FoodCategory>('foodcategories', {
      listingType: 'flat'
    });

    const dayWiseCategoriesResult = await db.read<FoodCategory>('foodcategories', {
      listingType: 'day-wise'
    });

    if (!withoutListingTypeResult.success || !withListingTypeResult.success ||
        !totalResult.success || !flatCategoriesResult.success || !dayWiseCategoriesResult.success) {
      throw new Error('Failed to fetch category statistics');
    }

    const withoutListingType = withoutListingTypeResult.data || [];
    const withListingType = withListingTypeResult.data || [];
    const total = totalResult.data || [];
    const flatCategories = flatCategoriesResult.data || [];
    const dayWiseCategories = dayWiseCategoriesResult.data || [];

    return NextResponse.json({
      success: true,
      message: 'Migration status retrieved successfully',
      data: {
        totalCategories: total.length,
        categoriesWithListingType: withListingType.length,
        categoriesWithoutListingType: withoutListingType.length,
        needsMigration: withoutListingType.length > 0,
        flatCategoriesCount: flatCategories.length,
        dayWiseCategoriesCount: dayWiseCategories.length,
        categoriesNeedingListingType: withoutListingType.map(cat => ({
          id: cat._id?.toString(),
          name: cat.name,
          createdAt: cat.createdAt
        })),
        listingTypeDistribution: {
          flat: flatCategories.length,
          'day-wise': dayWiseCategories.length
        }
      }
    });

  } catch (error) {
    console.error('Error in GET /api/admin/food-category/migrate-daywise:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Internal server error'
      },
      { status: 500 }
    );
  }
}