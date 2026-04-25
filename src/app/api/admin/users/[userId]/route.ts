import { NextRequest, NextResponse } from 'next/server';
import { jwtHandler } from '@/lib/jwt';
import { db } from '@/lib/db';
import { UserDocument } from '@/types/user';
import { ObjectId } from 'mongodb';

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

function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

/**
 * PUT /api/admin/users/[userId]
 * Update user details
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  try {
    const authResult = verifyAuth(request);
    if (!authResult.success) {
      return NextResponse.json({ error: authResult.error }, { status: 401 });
    }

    const { userId } = await params;
    if (!ObjectId.isValid(userId)) {
      return NextResponse.json({ error: 'Invalid user ID' }, { status: 400 });
    }

    const body = await request.json();
    const { email, name, phone } = body as {
      email?: string;
      name?: string | null;
      phone?: string | null;
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const updateData: any = { updatedAt: new Date() };

    if (email !== undefined) {
      if (!email || !isValidEmail(email)) {
        return NextResponse.json({ error: 'Invalid email format' }, { status: 400 });
      }

      const existingUserResult = await db.read<UserDocument>('users', {
        email,
        _id: { $ne: new ObjectId(userId) },
      });

      if (existingUserResult.success && (existingUserResult.data?.length || 0) > 0) {
        return NextResponse.json(
          { error: 'Email already in use by another user' },
          { status: 409 }
        );
      }

      updateData.email = email;
    }

    if (name !== undefined) {
      updateData.name = name || '';
    }

    if (phone !== undefined) {
      updateData.phone = phone || '';
    }

    const updateResult = await db.updateOne<UserDocument>(
      'users',
      { _id: new ObjectId(userId) },
      { $set: updateData }
    );

    if (!updateResult.success) {
      throw new Error(updateResult.error || 'Failed to update user');
    }

    if (!updateResult.matchedCount) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const updatedUserResult = await db.read<UserDocument>(
      'users',
      { _id: new ObjectId(userId) },
      { projection: { password: 0 } }
    );

    return NextResponse.json({
      data: updatedUserResult.data?.[0] || null,
      message: 'User updated successfully',
    });
  } catch (error) {
    console.error('Error in PUT /api/admin/users/[userId]:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/admin/users/[userId]
 * Soft delete user by deactivating account
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  try {
    const authResult = verifyAuth(request);
    if (!authResult.success) {
      return NextResponse.json({ error: authResult.error }, { status: 401 });
    }

    const { userId } = await params;
    if (!ObjectId.isValid(userId)) {
      return NextResponse.json({ error: 'Invalid user ID' }, { status: 400 });
    }

    if (authResult.userId === userId) {
      return NextResponse.json(
        { error: 'Cannot delete your own account' },
        { status: 403 }
      );
    }

    const updateResult = await db.updateOne<UserDocument>(
      'users',
      { _id: new ObjectId(userId) },
      { $set: { isActive: false, updatedAt: new Date() } }
    );

    if (!updateResult.success) {
      throw new Error(updateResult.error || 'Failed to delete user');
    }

    if (!updateResult.matchedCount) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    return NextResponse.json({
      message: 'User deleted successfully',
    });
  } catch (error) {
    console.error('Error in DELETE /api/admin/users/[userId]:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}
