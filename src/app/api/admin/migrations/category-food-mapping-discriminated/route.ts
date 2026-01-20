import { NextRequest, NextResponse } from 'next/server';
import {
  migrateToDiscriminatedSchema,
  rollbackDiscriminatedSchema,
  getDiscriminatedMigrationStatus
} from '@/lib/migrations/category-food-mapping-discriminated';

/**
 * GET /api/admin/migrations/category-food-mapping-discriminated
 * Get the status of the discriminated schema migration
 */
export async function GET() {
  try {
    const status = await getDiscriminatedMigrationStatus();

    if (!status.success) {
      return NextResponse.json(
        { success: false, error: status.error },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      data: status.data
    });
  } catch (error) {
    console.error('Error fetching migration status:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

/**
 * POST /api/admin/migrations/category-food-mapping-discriminated
 * Run the discriminated schema migration
 *
 * Body: { action: 'migrate' | 'rollback' | 'status' }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action } = body;

    if (action === 'status') {
      const status = await getDiscriminatedMigrationStatus();

      if (!status.success) {
        return NextResponse.json(
          { success: false, error: status.error },
          { status: 500 }
        );
      }

      return NextResponse.json({
        success: true,
        data: status.data
      });
    }

    if (action === 'migrate') {
      const result = await migrateToDiscriminatedSchema();

      if (!result.success) {
        return NextResponse.json(
          { success: false, error: result.error },
          { status: 500 }
        );
      }

      return NextResponse.json({
        success: true,
        message: result.message,
        data: result.data
      });
    }

    if (action === 'rollback') {
      const result = await rollbackDiscriminatedSchema();

      if (!result.success) {
        return NextResponse.json(
          { success: false, error: result.error },
          { status: 500 }
        );
      }

      return NextResponse.json({
        success: true,
        message: result.message,
        data: result.data
      });
    }

    return NextResponse.json(
      {
        success: false,
        error: 'Invalid action. Must be "migrate", "rollback", or "status"'
      },
      { status: 400 }
    );
  } catch (error) {
    console.error('Error in migration endpoint:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
