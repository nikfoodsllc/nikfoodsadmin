import { NextRequest, NextResponse } from 'next/server';
import { jwtHandler } from '@/lib/jwt';
import { db } from '@/lib/db';
import { UserDocument } from '@/types/user';
import bcrypt from 'bcryptjs';
import { passwordProblem } from '@/lib/passwordRules';
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
 * Validate password strength
 */
function isValidPassword(password: unknown): { valid: boolean; error?: string } {
  const problem = passwordProblem(password);
  return problem ? { valid: false, error: problem } : { valid: true };
}

/**
 * GET /api/admin/admin-users
 * List admin users with search functionality
 * Query params:
 *   - search (name or email)
 *   - includeInactive (true/false, default: false)
 */
export async function GET(request: NextRequest) {
  try {
    // Verify authentication
    const authResult = verifyAuth(request);
    if (!authResult.success) {
      return NextResponse.json({ error: authResult.error }, { status: 401 });
    }

    // Parse query parameters
    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search') || '';
    const includeInactive = searchParams.get('includeInactive') === 'true';

    // Build filter query - only admin users
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const filter: any = { role: 'ADMIN' };

    // Filter by active status
    if (!includeInactive) {
      filter.$or = [
        { isActive: true },
        { isActive: { $exists: false } }, // Handle existing admins without isActive field
      ];
    }

    // Search by name or email
    if (search) {
      const searchConditions = [
        { name: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
      ];

      if (filter.$or) {
        // Combine active filter and search filter
        filter.$and = [
          { $or: filter.$or },
          { $or: searchConditions },
        ];
        delete filter.$or;
      } else {
        filter.$or = searchConditions;
      }
    }

    // Fetch admin users (exclude password)
    const result = await db.read<UserDocument>('users', filter, {
      sort: { createdAt: -1 },
      projection: { password: 0 }, // Exclude password field
    });

    if (!result.success) {
      throw new Error(result.error || 'Failed to fetch admin users');
    }

    const admins = result.data || [];

    return NextResponse.json({
      data: admins,
      message: 'Admin users fetched successfully',
    });
  } catch (error) {
    console.error('Error in GET /api/admin/admin-users:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/admin/admin-users
 * Create a new admin user
 * Body: { email, password, name, phone }
 */
export async function POST(request: NextRequest) {
  try {
    // Verify authentication
    const authResult = verifyAuth(request);
    if (!authResult.success) {
      return NextResponse.json({ error: authResult.error }, { status: 401 });
    }

    // Parse request body
    const body = await request.json();
    const { email, password, name, phone } = body;

    // Validate required fields
    if (!email || !password) {
      return NextResponse.json(
        { error: 'Email and password are required' },
        { status: 400 }
      );
    }

    // Validate email format
    if (!isValidEmail(email)) {
      return NextResponse.json(
        { error: 'Invalid email format' },
        { status: 400 }
      );
    }

    // Validate password strength
    const passwordValidation = isValidPassword(password);
    if (!passwordValidation.valid) {
      return NextResponse.json(
        { error: passwordValidation.error },
        { status: 400 }
      );
    }

    // Check if admin with this email already exists
    const existingUserResult = await db.read<UserDocument>('users', { email });
    if (existingUserResult.success && existingUserResult.data && existingUserResult.data.length > 0) {
      return NextResponse.json(
        { error: 'Admin user with this email already exists' },
        { status: 409 }
      );
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create new admin user
    const newAdmin: Omit<UserDocument, '_id'> = {
      email,
      password: hashedPassword,
      role: 'ADMIN',
      name: name || undefined,
      phone: phone || undefined,
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const createResult = await db.create<UserDocument>('users', newAdmin);

    if (!createResult.success || !createResult.id) {
      throw new Error(createResult.error || 'Failed to create admin user');
    }

    // Fetch created admin (without password)
    const createdAdminResult = await db.readOne<UserDocument>(
      'users',
      { _id: new ObjectId(createResult.id) }
    );

    if (!createdAdminResult.success || !createdAdminResult.data) {
      throw new Error('Failed to fetch created admin user');
    }

    // Return created admin (without password)
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { password: _unusedPassword, ...adminWithoutPassword } = createdAdminResult.data;

    return NextResponse.json(
      {
        data: adminWithoutPassword,
        message: 'Admin user created successfully',
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('Error in POST /api/admin/admin-users:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}
