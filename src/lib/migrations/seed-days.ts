import { NextRequest, NextResponse } from 'next/server';
import { jwtHandler } from '@/lib/jwt';
import { db } from '@/lib/db';
import { ObjectId } from 'mongodb';

interface AvailableDay {
  _id?: ObjectId | string;
  day: string;
  enabled: boolean;
  sequence: number;
  label: string;
  createdAt?: Date;
  updatedAt?: Date;
}

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
 * Default days data
 */
const DEFAULT_DAYS: Omit<AvailableDay, '_id' | 'createdAt' | 'updatedAt'>[] = [
  { day: 'monday', enabled: true, sequence: 1, label: 'Monday' },
  { day: 'tuesday', enabled: true, sequence: 2, label: 'Tuesday' },
  { day: 'wednesday', enabled: true, sequence: 3, label: 'Wednesday' },
  { day: 'thursday', enabled: true, sequence: 4, label: 'Thursday' },
  { day: 'friday', enabled: true, sequence: 5, label: 'Friday' },
  { day: 'saturday', enabled: true, sequence: 6, label: 'Saturday' },
  { day: 'sunday', enabled: true, sequence: 7, label: 'Sunday' },
];

/**
 * POST /api/admin/days/seed
 * Seed initial available days data
 */
export async function POST(request: NextRequest) {
  try {
    // Verify authentication
    const authResult = verifyAuth(request);
    if (!authResult.success) {
      return NextResponse.json({ error: authResult.error }, { status: 401 });
    }

    console.log('Starting migration: Seeding initial available days data...');

    // Check if days already exist
    const existingDaysResult = await db.read<AvailableDay>('availableDays', {});

    if (!existingDaysResult.success) {
      throw new Error('Failed to check existing days: ' + existingDaysResult.error);
    }

    const existingDays = existingDaysResult.data || [];

    if (existingDays.length > 0) {
      console.log(`✅ Found ${existingDays.length} existing days. Skipping seeding.`);
      return NextResponse.json({
        success: true,
        message: 'Days already exist. No seeding needed.',
        data: {
          totalProcessed: 0,
          successfulInserts: 0,
          failedInserts: 0,
          alreadyExists: true,
          existingDays: existingDays.length
        }
      });
    }

    console.log(`Seeding ${DEFAULT_DAYS.length} days...`);

    // Insert default days
    const daysToInsert = DEFAULT_DAYS.map(day => ({
      ...day,
      createdAt: new Date(),
      updatedAt: new Date(),
    }));

    const insertResult = await db.createMany<AvailableDay>('availableDays', daysToInsert);

    if (!insertResult.success) {
      throw new Error('Failed to seed days: ' + insertResult.error);
    }

    console.log(`\n🎉 Seeding completed successfully!`);
    console.log(`   - Total days seeded: ${DEFAULT_DAYS.length}`);

    return NextResponse.json({
      success: true,
      message: 'Available days seeded successfully',
      data: {
        totalProcessed: DEFAULT_DAYS.length,
        successfulInserts: insertResult.ids?.length || 0,
        failedInserts: 0,
        daysSeeded: daysToInsert.map(day => ({
          day: day.day,
          label: day.label,
          enabled: day.enabled,
          sequence: day.sequence
        }))
      }
    });

  } catch (error) {
    console.error('❌ Seeding failed:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Internal server error'
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/admin/days/seed
 * Check seeding status and return information about available days
 */
export async function GET(request: NextRequest) {
  try {
    // Verify authentication
    const authResult = verifyAuth(request);
    if (!authResult.success) {
      return NextResponse.json({ error: authResult.error }, { status: 401 });
    }

    // Get all available days
    const daysResult = await db.read<AvailableDay>('availableDays', {
      sort: { sequence: 1 }
    });

    if (!daysResult.success) {
      throw new Error('Failed to fetch available days: ' + daysResult.error);
    }

    const days = daysResult.data || [];

    return NextResponse.json({
      success: true,
      message: 'Seeding status retrieved successfully',
      data: {
        totalDays: days.length,
        isSeeded: days.length > 0,
        enabledDays: days.filter(day => day.enabled).length,
        disabledDays: days.filter(day => !day.enabled).length,
        days: days.map(day => ({
          id: day._id?.toString(),
          day: day.day,
          label: day.label,
          enabled: day.enabled,
          sequence: day.sequence,
          createdAt: day.createdAt,
          updatedAt: day.updatedAt
        }))
      }
    });

  } catch (error) {
    console.error('Error in GET /api/admin/days/seed:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Internal server error'
      },
      { status: 500 }
    );
  }
}