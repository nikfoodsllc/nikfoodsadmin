import { NextRequest, NextResponse } from 'next/server';
import { jwtHandler } from '@/lib/jwt';
import { db } from '@/lib/db';
import { UserDocument } from '@/types/user';
import { ObjectId } from 'mongodb';
import bcrypt from 'bcryptjs';
import { passwordProblem } from '@/lib/passwordRules';
import { clearCounter, isBlocked, recordFailure, tooManyMessage, type RateLimit } from '@/lib/authRateLimit';

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
 * PUT /api/admin/admin-users/change-password
 * Change own password (requires current password verification)
 * Body: { currentPassword, newPassword }
 */
export async function PUT(request: NextRequest) {
  try {
    // Verify authentication
    const authResult = verifyAuth(request);
    if (!authResult.success) {
      return NextResponse.json({ error: authResult.error }, { status: 401 });
    }

    const currentUserId = authResult.userId;

    // Parse request body
    const body = await request.json();
    const { currentPassword, newPassword } = body;

    if (!currentPassword || !newPassword) {
      return NextResponse.json(
        { error: 'Current password and new password are required' },
        { status: 400 }
      );
    }

    // Validate new password strength
    const passwordValidation = isValidPassword(newPassword);
    if (!passwordValidation.valid) {
      return NextResponse.json(
        { error: passwordValidation.error },
        { status: 400 }
      );
    }

    // Wrong "current password" tries are limited like a login
    const limits: RateLimit[] = [{ key: `admin-change-password:${currentUserId}`, max: 5, windowSec: 15 * 60 }];
    const blocked = await isBlocked(limits);
    if (!blocked.ok) {
      return NextResponse.json(
        { error: tooManyMessage(blocked.retryAfterSec) },
        { status: 429, headers: { 'Retry-After': String(blocked.retryAfterSec) } }
      );
    }

    // Fetch current user with password
    const userResult = await db.read<UserDocument>(
      'users',
      { _id: new ObjectId(currentUserId), role: 'ADMIN' }
    );

    if (!userResult.success || !userResult.data || userResult.data.length === 0) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    const user = userResult.data[0];

    // Verify current password
    const isPasswordValid = await bcrypt.compare(currentPassword, user.password);
    if (!isPasswordValid) {
      await recordFailure(limits);
      return NextResponse.json(
        { error: 'Current password is incorrect' },
        { status: 401 }
      );
    }

    await clearCounter(limits[0].key);

    // Check if new password is same as current
    const isSamePassword = await bcrypt.compare(newPassword, user.password);
    if (isSamePassword) {
      return NextResponse.json(
        { error: 'New password must be different from current password' },
        { status: 400 }
      );
    }

    // Hash new password
    const hashedPassword = await bcrypt.hash(newPassword, 10);

    // Update password
    const updateResult = await db.updateOne<UserDocument>(
      'users',
      { _id: new ObjectId(currentUserId) },
      { $set: { password: hashedPassword, updatedAt: new Date() } }
    );

    if (!updateResult.success) {
      throw new Error(updateResult.error || 'Failed to change password');
    }

    return NextResponse.json({
      message: 'Password changed successfully',
    });
  } catch (error) {
    console.error('Error in PUT /api/admin/admin-users/change-password:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}
