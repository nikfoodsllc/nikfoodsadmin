import { NextRequest, NextResponse } from 'next/server';
import { jwtHandler } from '@/lib/jwt';
import { migrateModifiers, seedSampleModifiers } from '@/lib/migrations/modifiers';

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
 * POST /api/admin/migrations/modifiers
 * Run the food modifiers migration
 * Query params:
 * - seed=true to also seed sample data
 */
export async function POST(request: NextRequest) {
  try {
    // Verify authentication
    const authResult = verifyAuth(request);
    if (!authResult.success) {
      return NextResponse.json({ error: authResult.error }, { status: 401 });
    }

    // Check if we should also seed sample data
    const { searchParams } = new URL(request.url);
    const shouldSeed = searchParams.get('seed') === 'true';

    // Run migration
    const migrationResult = await migrateModifiers();

    if (!migrationResult.success) {
      return NextResponse.json(
        {
          error: 'Migration failed',
          details: migrationResult.error,
        },
        { status: 500 }
      );
    }

    const responseData: any = {
      message: migrationResult.message,
      data: migrationResult.data,
    };

    // Seed sample data if requested
    if (shouldSeed) {
      const seedResult = await seedSampleModifiers();
      responseData.seedResult = {
        success: seedResult.success,
        message: seedResult.message,
        seeded: seedResult.seeded,
      };
    }

    return NextResponse.json(responseData);
  } catch (error) {
    console.error('Error in POST /api/admin/migrations/modifiers:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}
