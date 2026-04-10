import { NextRequest, NextResponse } from 'next/server';
import { jwtHandler } from '@/lib/jwt';
import { db } from '@/lib/db';
import { UserDocument } from '@/types/user';
import { ObjectId } from 'mongodb';

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
 * Validate email format
 */
function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

/**
 * PUT /api/admin/admin-users/[userId]
 * Update admin user details (name, email, phone)
 * Body: { email?, name?, phone? }
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
    const { email, name, phone } = body;

    // Build update object
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const updateData: any = {
      updatedAt: new Date(),
    };

    if (email !== undefined) {
      if (!isValidEmail(email)) {
        return NextResponse.json(
          { error: 'Invalid email format' },
          { status: 400 }
        );
      }

      // Check if email is already taken by another user
      const existingUserResult = await db.read<UserDocument>('users', {
        email,
        _id: { $ne: new ObjectId(userId) },
      });

      if (existingUserResult.success && existingUserResult.data && existingUserResult.data.length > 0) {
        return NextResponse.json(
          { error: 'Email already in use by another user' },
          { status: 409 }
        );
      }

      updateData.email = email;
    }

    if (name !== undefined) {
      updateData.name = name;
    }

    if (phone !== undefined) {
      updateData.phone = phone;
    }

    // Update admin user
    const updateResult = await db.updateOne<UserDocument>(
      'users',
      { _id: new ObjectId(userId), role: 'ADMIN' },
      { $set: updateData }
    );

    if (!updateResult.success) {
      throw new Error(updateResult.error || 'Failed to update admin user');
    }

    if (updateResult.matchedCount === 0) {
      return NextResponse.json(
        { error: 'Admin user not found' },
        { status: 404 }
      );
    }

    // Fetch updated admin user (without password)
    const updatedAdminResult = await db.read<UserDocument>(
      'users',
      { _id: new ObjectId(userId) },
      { projection: { password: 0 } }
    );

    const updatedAdmin = updatedAdminResult.data?.[0];

    return NextResponse.json({
      data: updatedAdmin,
      message: 'Admin user updated successfully',
    });
  } catch (error) {
    console.error('Error in PUT /api/admin/admin-users/[userId]:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/admin/admin-users/[userId]
 * Soft delete (deactivate) an admin user
 */
export async function DELETE(
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

    // Prevent admin from deactivating themselves
    if (authResult.userId === userId) {
      return NextResponse.json(
        { error: 'Cannot deactivate your own account' },
        { status: 403 }
      );
    }

    // Soft delete by setting isActive to false
    const updateResult = await db.updateOne<UserDocument>(
      'users',
      { _id: new ObjectId(userId), role: 'ADMIN' },
      { $set: { isActive: false, updatedAt: new Date() } }
    );

    if (!updateResult.success) {
      throw new Error(updateResult.error || 'Failed to deactivate admin user');
    }

    if (updateResult.matchedCount === 0) {
      return NextResponse.json(
        { error: 'Admin user not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      message: 'Admin user deactivated successfully',
    });
  } catch (error) {
    console.error('Error in DELETE /api/admin/admin-users/[userId]:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/admin/admin-users/[userId]
 * Reactivate a deactivated admin user
 */
export async function PATCH(
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

    // Reactivate by setting isActive to true
    const updateResult = await db.updateOne<UserDocument>(
      'users',
      { _id: new ObjectId(userId), role: 'ADMIN' },
      { $set: { isActive: true, updatedAt: new Date() } }
    );

    if (!updateResult.success) {
      throw new Error(updateResult.error || 'Failed to reactivate admin user');
    }

    if (updateResult.matchedCount === 0) {
      return NextResponse.json(
        { error: 'Admin user not found' },
        { status: 404 }
      );
    }

    // Fetch reactivated admin user (without password)
    const reactivatedAdminResult = await db.read<UserDocument>(
      'users',
      { _id: new ObjectId(userId) },
      { projection: { password: 0 } }
    );

    const reactivatedAdmin = reactivatedAdminResult.data?.[0];

    return NextResponse.json({
      data: reactivatedAdmin,
      message: 'Admin user reactivated successfully',
    });
  } catch (error) {
    console.error('Error in PATCH /api/admin/admin-users/[userId]:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}
