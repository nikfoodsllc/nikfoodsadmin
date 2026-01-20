import { NextRequest, NextResponse } from 'next/server';
import { jwtHandler } from '@/lib/jwt';
import { db } from '@/lib/db';
import { ObjectId } from 'mongodb';

interface FoodCategory {
  _id?: ObjectId | string;
  name: string;
  description?: string;
  url?: string;
  public_id?: string;
  sequence?: number;
  isDraft?: boolean;
  createdAt?: Date;
  updatedAt?: Date;
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
 * POST /api/admin/food-category/migrate-sequence
 * One-time migration to assign sequence values to existing categories
 */
export async function POST(request: NextRequest) {
  try {
    // Verify authentication
    const authResult = verifyAuth(request);
    if (!authResult.success) {
      return NextResponse.json({ error: authResult.error }, { status: 401 });
    }

    console.log('Starting migration: Adding sequence field to existing food categories...');

    // Find all categories that don't have a sequence field
    const result = await db.read<FoodCategory>('foodcategories', {
      sequence: { $exists: false }
    }, {
      sort: { createdAt: 1 }
    });

    if (!result.success) {
      throw new Error('Failed to fetch categories: ' + result.error);
    }

    const categories = result.data || [];

    if (categories.length === 0) {
      console.log('✅ No categories need sequence field updates. All categories already have sequence values.');
      return NextResponse.json({
        success: true,
        message: 'Migration completed: No categories needed sequence updates',
        data: {
          totalProcessed: 0,
          successfulUpdates: 0,
          failedUpdates: 0,
          alreadyHasSequence: true
        }
      });
    }

    console.log(`Found ${categories.length} categories without sequence field`);

    // Get the highest existing sequence number
    const maxSequenceResult = await db.read<FoodCategory>('foodcategories', {
      sequence: { $exists: true }
    }, {
      sort: { sequence: -1 },
      limit: 1
    });

    let startSequence = 1;
    if (maxSequenceResult.success && maxSequenceResult.data && maxSequenceResult.data.length > 0) {
      const highestSeq = maxSequenceResult.data[0].sequence || 0;
      startSequence = highestSeq + 1;
    }

    console.log(`Starting sequence assignment from ${startSequence}`);

    // Update each category with a sequence value
    let updateCount = 0;
    const failedUpdates: Array<{ id: string; name: string; error: string }> = [];

    for (let i = 0; i < categories.length; i++) {
      const category = categories[i];
      const sequenceValue = startSequence + i;

      const updateResult = await db.updateOne<FoodCategory>('foodcategories', {
        _id: category._id
      }, {
        $set: {
          sequence: sequenceValue,
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
      console.log(`✅ Updated "${category.name}" with sequence ${sequenceValue}`);
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
        startSequence,
        endSequence: startSequence + categories.length - 1,
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
 * GET /api/admin/food-category/migrate-sequence
 * Check migration status and return information about categories without sequence
 */
export async function GET(request: NextRequest) {
  try {
    // Verify authentication
    const authResult = verifyAuth(request);
    if (!authResult.success) {
      return NextResponse.json({ error: authResult.error }, { status: 401 });
    }

    // Count categories without sequence
    const withoutSequenceResult = await db.read<FoodCategory>('foodcategories', {
      sequence: { $exists: false }
    }, {
      sort: { createdAt: 1 }
    });

    // Count categories with sequence
    const withSequenceResult = await db.read<FoodCategory>('foodcategories', {
      sequence: { $exists: true }
    }, {
      sort: { sequence: 1 }
    });

    // Get total count
    const totalResult = await db.read<FoodCategory>('foodcategories', {}, {
      sort: { createdAt: 1 }
    });

    if (!withoutSequenceResult.success || !withSequenceResult.success || !totalResult.success) {
      throw new Error('Failed to fetch category statistics');
    }

    const withoutSequence = withoutSequenceResult.data || [];
    const withSequence = withSequenceResult.data || [];
    const total = totalResult.data || [];

    return NextResponse.json({
      success: true,
      message: 'Migration status retrieved successfully',
      data: {
        totalCategories: total.length,
        categoriesWithSequence: withSequence.length,
        categoriesWithoutSequence: withoutSequence.length,
        needsMigration: withoutSequence.length > 0,
        categoriesNeedingSequence: withoutSequence.map(cat => ({
          id: cat._id?.toString(),
          name: cat.name,
          createdAt: cat.createdAt
        })),
        sequenceRange: withSequence.length > 0 ? {
          min: Math.min(...withSequence.map(c => c.sequence || 0)),
          max: Math.max(...withSequence.map(c => c.sequence || 0))
        } : null
      }
    });

  } catch (error) {
    console.error('Error in GET /api/admin/food-category/migrate-sequence:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Internal server error'
      },
      { status: 500 }
    );
  }
}