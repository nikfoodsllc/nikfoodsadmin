import { NextRequest, NextResponse } from 'next/server';
import { jwtHandler } from '@/lib/jwt';
import { migrateAvailableDates, rollbackAvailableDates } from '@/lib/migrations/available-dates';

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
 * POST /api/admin/migrations/available-dates
 * Run the availableDates collection migration
 */
export async function POST(request: NextRequest) {
  try {
    // Verify authentication
    const authResult = verifyAuth(request);
    if (!authResult.success) {
      return NextResponse.json({ error: authResult.error }, { status: 401 });
    }

    // Get action from query params
    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action') || 'migrate';

    if (action === 'rollback') {
      // Rollback migration
      const result = await rollbackAvailableDates();

      if (!result.success) {
        return NextResponse.json(
          { error: result.message },
          { status: 500 }
        );
      }

      return NextResponse.json({
        data: result,
        message: result.message,
      });
    }

    // Run migration
    const result = await migrateAvailableDates();

    if (!result.success) {
      return NextResponse.json(
        { error: result.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      data: result.data,
      message: result.message,
    });

  } catch (error) {
    console.error('Error in POST /api/admin/migrations/available-dates:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}
