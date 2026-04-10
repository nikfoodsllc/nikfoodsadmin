import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { jwtHandler } from '@/lib/jwt';
import { validateLoginForm } from '@/lib/validation';
import type { LoginRequest, LoginResponse, ApiErrorResponse } from '@/types/auth';
import type { UserDocument } from '@/types/user';
import bcrypt from 'bcryptjs';

export async function POST(request: NextRequest) {
  try {
    // Parse request body
    const body: LoginRequest = await request.json();
    const { email, password } = body;

    console.log('🔐 [Admin Login] Attempting login for email:', email);

    // Validate input
    const validation = validateLoginForm(email, password);
    if (!validation.isValid) {
      return NextResponse.json(
        {
          success: false,
          error: 'Validation failed',
          message: validation.errors.email || validation.errors.password,
        } as ApiErrorResponse,
        { status: 400 }
      );
    }

    // Find user by email
    const userResult = await db.readOne<UserDocument>('users', { email });

    console.log('📊 [Admin Login] Database query result:', {
      success: userResult.success,
      userFound: !!userResult.data,
      error: userResult.error
    });

    if (!userResult.success || !userResult.data) {
      console.log('❌ [Admin Login] User not found in database');

      return NextResponse.json(
        {
          success: false,
          error: 'Invalid credentials',
          message: 'Email or password is incorrect',
        } as ApiErrorResponse,
        { status: 401 }
      );
    }

    const user = userResult.data;

    console.log('👤 [Admin Login] User found:', {
      email: user.email,
      role: user.role,
      hasPassword: !!user.password,
      isCompleted: user.isCompleted
    });

    // Verify password
    const isPasswordValid = await bcrypt.compare(password, user.password);

    console.log('🔑 [Admin Login] Password comparison result:', isPasswordValid);

    if (!isPasswordValid) {
      console.log('❌ [Admin Login] Password mismatch');

      return NextResponse.json(
        {
          success: false,
          error: 'Invalid credentials',
          message: 'Email or password is incorrect',
        } as ApiErrorResponse,
        { status: 401 }
      );
    }

    // Check if user is admin
    console.log('🛡️ [Admin Login] Checking role:', {
      userRole: user.role,
      isAdmin: user.role === 'ADMIN'
    });

    if (user.role !== 'ADMIN') {
      console.log('❌ [Admin Login] User does not have ADMIN role');

      return NextResponse.json(
        {
          success: false,
          error: 'Unauthorized',
          message: 'Access denied. Admin privileges required.',
        } as ApiErrorResponse,
        { status: 403 }
      );
    }

    // Check if admin account is active
    console.log('🔍 [Admin Login] Checking active status:', {
      isActive: user.isActive
    });

    if (user.isActive === false) {
      console.log('❌ [Admin Login] Admin account is deactivated');

      return NextResponse.json(
        {
          success: false,
          error: 'Account deactivated',
          message: 'Your admin account has been deactivated. Please contact the system administrator.',
        } as ApiErrorResponse,
        { status: 403 }
      );
    }

    console.log('✅ [Admin Login] All checks passed, generating token');

    // Generate JWT token
    const tokenResult = jwtHandler.generateToken(
      user._id!.toString(),
      'admin',
      '7d' // 7 days expiration
    );

    if (!tokenResult.success || !tokenResult.token) {
      console.log('❌ [Admin Login] Token generation failed:', tokenResult.error);

      return NextResponse.json(
        {
          success: false,
          error: 'Token generation failed',
          message: tokenResult.error || 'Failed to generate authentication token',
        } as ApiErrorResponse,
        { status: 500 }
      );
    }

    // Calculate token expiration time (7 days from now)
    const expiresAt = Date.now() + 7 * 24 * 60 * 60 * 1000;

    // Prepare response
    const response: LoginResponse = {
      success: true,
      token: tokenResult.token,
      user: {
        id: user._id!.toString(),
        email: user.email,
        role: user.role,
        name: user.name,
        isCompleted: user.isCompleted,
      },
      expiresAt,
    };

    console.log('🎉 [Admin Login] Login successful for:', user.email);

    return NextResponse.json(response, { status: 200 });
  } catch (error) {
    console.error('Login error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'An unexpected error occurred',
      } as ApiErrorResponse,
      { status: 500 }
    );
  }
}
