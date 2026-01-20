import { NextRequest, NextResponse } from 'next/server';
import { jwtHandler } from '@/lib/jwt';
import {
  migrateCategoryFoodMapping,
  rollbackCategoryFoodMapping,
  getMigrationStatus,
} from '@/lib/migrations/category-food-mapping';

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
 * POST /api/admin/migrations/category-food-mapping
 * Run the forward migration to create CategoryFoodMapping collection
 */
export async function POST(request: NextRequest) {
  try {
    // Verify authentication
    const authResult = verifyAuth(request);
    if (!authResult.success) {
      return NextResponse.json({ error: authResult.error }, { status: 401 });
    }

    console.log('Starting CategoryFoodMapping migration...');

    // Check current status before migration
    const statusBefore = await getMigrationStatus();
    if (statusBefore.success && statusBefore.data?.collectionExists) {
      console.log(`Migration already exists with ${statusBefore.data.documentCount} documents`);
      return NextResponse.json({
        success: true,
        message: 'Migration already exists. No action taken.',
        data: {
          status: statusBefore.data,
          migrationPerformed: false,
        },
      });
    }

    // Run migration
    const result = await migrateCategoryFoodMapping();

    if (result.success) {
      console.log(`\n🎉 Migration completed successfully!`);
      if (result.data) {
        console.log(`   - Total food items processed: ${result.data.totalProcessed}`);
        console.log(`   - Successful mappings: ${result.data.successfulMappings}`);
        console.log(`   - Failed mappings: ${result.data.failedMappings}`);
        console.log(`   - Indexes created: ${result.data.indexesCreated.join(', ')}`);

        if (result.data.errors.length > 0) {
          console.log(`   - Errors: ${result.data.errors.length}`);
          result.data.errors.forEach((err, i) => {
            console.log(`     ${i + 1}. ${err}`);
          });
        }
      }

      // Get status after migration
      const statusAfter = await getMigrationStatus();

      return NextResponse.json({
        success: true,
        message: result.message,
        data: {
          ...result.data,
          status: statusAfter.data,
          migrationPerformed: true,
        },
      });
    } else {
      console.error('❌ Migration failed:', result.error);
      return NextResponse.json(
        {
          success: false,
          error: result.error,
          message: result.message,
        },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error('❌ Migration failed:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Internal server error',
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/admin/migrations/category-food-mapping
 * Get the current migration status
 */
export async function GET(request: NextRequest) {
  try {
    // Verify authentication
    const authResult = verifyAuth(request);
    if (!authResult.success) {
      return NextResponse.json({ error: authResult.error }, { status: 401 });
    }

    // Get migration status
    const statusResult = await getMigrationStatus();

    if (!statusResult.success) {
      throw new Error(statusResult.error || 'Failed to get migration status');
    }

    return NextResponse.json({
      success: true,
      message: 'Migration status retrieved successfully',
      data: statusResult.data,
    });
  } catch (error) {
    console.error('Error in GET /api/admin/migrations/category-food-mapping:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Internal server error',
      },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/admin/migrations/category-food-mapping
 * Rollback the migration by dropping the CategoryFoodMapping collection
 */
export async function DELETE(request: NextRequest) {
  try {
    // Verify authentication
    const authResult = verifyAuth(request);
    if (!authResult.success) {
      return NextResponse.json({ error: authResult.error }, { status: 401 });
    }

    console.log('Starting CategoryFoodMapping rollback...');

    // Run rollback
    const result = await rollbackCategoryFoodMapping();

    if (result.success) {
      console.log(`\n🎉 Rollback completed successfully!`);

      return NextResponse.json({
        success: true,
        message: result.message,
        data: {
          rollbackPerformed: true,
        },
      });
    } else {
      console.error('❌ Rollback failed:', result.error);
      return NextResponse.json(
        {
          success: false,
          error: result.error,
          message: result.message,
        },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error('❌ Rollback failed:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Internal server error',
      },
      { status: 500 }
    );
  }
}
