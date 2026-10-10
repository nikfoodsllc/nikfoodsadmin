import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { jwtHandler } from '@/lib/jwt';
import { validateLoginForm } from '@/lib/validation';
import type { LoginRequest, LoginResponse, ApiErrorResponse } from '@/types/auth';
import type { UserDocument } from '@/types/user';
import bcrypt from 'bcryptjs';
import { clearCounter, clientIp, isBlocked, recordFailure, tooManyMessage, type RateLimit } from '@/lib/authRateLimit';

// a real hash of nothing in particular: an unknown email costs the same time as a wrong password
const DUMMY_HASH = bcrypt.hashSync('no-such-account', 10);

export async function POST(request: NextRequest) {
  try {
    // Parse request body
    const body: LoginRequest = await request.json();
    const { email, password } = body;

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

    // Slow down password guessing: failed tries count per email + address, and per address
    const ip = clientIp(request);
    const pairKey = `admin-login:pair:${String(email).toLowerCase().trim()}:${ip}`;
    const limits: RateLimit[] = [
      { key: pairKey, max: 8, windowSec: 15 * 60 },
      { key: `admin-login:ip:${ip}`, max: 40, windowSec: 15 * 60 },
    ];
    const blocked = await isBlocked(limits);
    if (!blocked.ok) {
      return NextResponse.json(
        {
          success: false,
          error: 'Too many attempts',
          message: tooManyMessage(blocked.retryAfterSec),
        } as ApiErrorResponse,
        { status: 429, headers: { 'Retry-After': String(blocked.retryAfterSec) } }
      );
    }

    // Find user by email
    const userResult = await db.readOne<UserDocument>('users', { email });
    const user = userResult.success ? userResult.data : null;

    // Always run one password check, so an unknown email takes as long as a wrong password
    const isPasswordValid = await bcrypt.compare(password, user?.password || DUMMY_HASH);

    if (!user || !isPasswordValid) {
      await recordFailure(limits);
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid credentials',
          message: 'Email or password is incorrect',
        } as ApiErrorResponse,
        { status: 401 }
      );
    }
    await clearCounter(pairKey);

    // Check if user is admin
    if (user.role !== 'ADMIN') {
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
    if (user.isActive === false) {
      return NextResponse.json(
        {
          success: false,
          error: 'Account deactivated',
          message: 'Your admin account has been deactivated. Please contact the system administrator.',
        } as ApiErrorResponse,
        { status: 403 }
      );
    }

    // Generate JWT token
    const tokenResult = jwtHandler.generateToken(
      user._id!.toString(),
      'admin',
      '7d' // 7 days expiration
    );

    if (!tokenResult.success || !tokenResult.token) {
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
