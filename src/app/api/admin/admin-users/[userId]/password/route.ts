import { NextRequest, NextResponse } from 'next/server';
import { jwtHandler } from '@/lib/jwt';
import { db } from '@/lib/db';
import { UserDocument } from '@/types/user';
import { ObjectId } from 'mongodb';
import bcrypt from 'bcryptjs';
import { passwordProblem } from '@/lib/passwordRules';

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
 * Validate password strength
 */
function isValidPassword(password: unknown): { valid: boolean; error?: string } {
  const problem = passwordProblem(password);
  return problem ? { valid: false, error: problem } : { valid: true };
}

/**
 * PUT /api/admin/admin-users/[userId]/password
 * Reset another admin user's password
 * Body: { newPassword }
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  try {
    // Verify authentication
    const authResult = verifyAuth(request);
    if (!authResult.success) {
      return NextResponse.json({ error: authResult.error }, { status: 401 });
    }

    const { userId } = await params;

    // Validate userId
    if (!ObjectId.isValid(userId)) {
      return NextResponse.json({ error: 'Invalid user ID' }, { status: 400 });
    }

    // Parse request body
    const body = await request.json();
    const { newPassword } = body;

    if (!newPassword) {
      return NextResponse.json(
        { error: 'New password is required' },
        { status: 400 }
      );
    }

    // Validate password strength
    const passwordValidation = isValidPassword(newPassword);
    if (!passwordValidation.valid) {
      return NextResponse.json(
        { error: passwordValidation.error },
        { status: 400 }
      );
    }

    // Check if target user exists and is an admin
    const targetUserResult = await db.read<UserDocument>(
      'users',
      { _id: new ObjectId(userId), role: 'ADMIN' }
    );

    if (!targetUserResult.success || !targetUserResult.data || targetUserResult.data.length === 0) {
      return NextResponse.json(
        { error: 'Admin user not found' },
        { status: 404 }
      );
    }

    // Hash new password
    const hashedPassword = await bcrypt.hash(newPassword, 10);

    // Update password
    const updateResult = await db.updateOne<UserDocument>(
      'users',
      { _id: new ObjectId(userId), role: 'ADMIN' },
      { $set: { password: hashedPassword, updatedAt: new Date() } }
    );

    if (!updateResult.success) {
      throw new Error(updateResult.error || 'Failed to reset password');
    }

    return NextResponse.json({
      message: 'Password reset successfully',
    });
  } catch (error) {
    console.error('Error in PUT /api/admin/admin-users/[userId]/password:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}
