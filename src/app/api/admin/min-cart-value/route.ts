import { NextRequest, NextResponse } from 'next/server';
import { jwtHandler } from '@/lib/jwt';
import { db } from '@/lib/db';
import { ObjectId } from 'mongodb';

interface Zipcode {
  _id?: ObjectId | string;
  zipcode: string;
  minCartValue: number;
  deliveryFee?: number;
  label?: string;
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
 * GET /api/admin/min-cart-value
 * List delivery zones with pagination and search
 */
export async function GET(request: NextRequest) {
  try {
    // Verify authentication
    const authResult = verifyAuth(request);
    if (!authResult.success) {
      return NextResponse.json({ error: authResult.error }, { status: 401 });
    }

    // Get query parameters
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1', 10);
    const pageSize = parseInt(searchParams.get('pageSize') || '20', 10);
    const search = searchParams.get('search') || '';

    // Build query
    const query: Record<string, unknown> = {};
    if (search.trim()) {
      // Search by both zipcode and label fields
      query.$or = [
        { zipcode: { $regex: search.trim(), $options: 'i' } },
        { label: { $regex: search.trim(), $options: 'i' } },
      ];
    }

    // Calculate pagination
    const skip = (page - 1) * pageSize;

    // Fetch delivery zones with pagination
    const result = await db.read<Zipcode>('zincodes', query, {
      sort: { createdAt: -1 },
      skip,
      limit: pageSize,
    });

    if (!result.success) {
      throw new Error(result.error || 'Failed to fetch zipcodes');
    }

    // Get total count for pagination
    const countResult = await db.count('zincodes', query);
    const total = countResult.success ? countResult.count || 0 : 0;

    return NextResponse.json({
      data: {
        items: result.data || [],
        total,
        page,
        pageSize,
      },
      message: 'Delivery zones fetched successfully',
    });
  } catch (error) {
    console.error('Error in GET /api/admin/min-cart-value:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/admin/min-cart-value
 * Create new delivery zone with minimum cart value
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
    const { zipcode, minCartValue, deliveryFee, label } = body;

    // Validate zipcode
    if (!zipcode || typeof zipcode !== 'string' || zipcode.trim().length === 0) {
      return NextResponse.json(
        { error: 'Zipcode is required and must be a non-empty string' },
        { status: 400 }
      );
    }

    // Validate zipcode format (US format: 5 digits or 5+4 digits)
    const zipcodeRegex = /^\d{5}(-\d{4})?$/;
    if (!zipcodeRegex.test(zipcode.trim())) {
      return NextResponse.json(
        { error: 'Invalid zipcode format. Use 5 digits (12345) or 5+4 digits (12345-6789)' },
        { status: 400 }
      );
    }

    // Validate minimum cart value
    if (minCartValue === undefined || minCartValue === null) {
      return NextResponse.json(
        { error: 'Minimum cart value is required' },
        { status: 400 }
      );
    }

    if (typeof minCartValue !== 'number' || minCartValue < 0) {
      return NextResponse.json(
        { error: 'Minimum cart value must be a non-negative number' },
        { status: 400 }
      );
    }

    // Validate delivery fee
    if (deliveryFee === undefined || deliveryFee === null) {
      return NextResponse.json(
        { error: 'Delivery fee is required' },
        { status: 400 }
      );
    }

    if (typeof deliveryFee !== 'number' || deliveryFee < 0) {
      return NextResponse.json(
        { error: 'Delivery fee must be a non-negative number' },
        { status: 400 }
      );
    }

    // Validate label (optional, max 50 characters)
    if (label !== undefined && label !== null) {
      if (typeof label !== 'string') {
        return NextResponse.json(
          { error: 'Label must be a string' },
          { status: 400 }
        );
      }
      if (label.trim().length > 50) {
        return NextResponse.json(
          { error: 'Label must be 50 characters or less' },
          { status: 400 }
        );
      }
    }

    // Check if zipcode already exists
    const existingResult = await db.readOne<Zipcode>('zincodes', {
      zipcode: zipcode.trim(),
    });

    if (existingResult.success && existingResult.data) {
      return NextResponse.json(
        { error: 'Zipcode already exists' },
        { status: 409 }
      );
    }

    // Prepare delivery zone data
    const zipcodeData: Zipcode = {
      zipcode: zipcode.trim(),
      minCartValue,
      deliveryFee,
      label: label?.trim() || undefined,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    // Create delivery zone
    const result = await db.create<Zipcode>('zincodes', zipcodeData);

    if (!result.success) {
      throw new Error(result.error || 'Failed to create zipcode');
    }

    // Fetch the created delivery zone
    const createdZipcode = await db.readOne<Zipcode>('zincodes', {
      _id: new ObjectId(result.id),
    });

    return NextResponse.json(createdZipcode.data, { status: 201 });
  } catch (error) {
    console.error('Error in POST /api/admin/min-cart-value:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/admin/min-cart-value
 * Update existing delivery zone
 */
export async function PUT(request: NextRequest) {
  try {
    // Verify authentication
    const authResult = verifyAuth(request);
    if (!authResult.success) {
      return NextResponse.json({ error: authResult.error }, { status: 401 });
    }

    // Parse request body
    const body = await request.json();
    const { _id, zipcode, minCartValue, deliveryFee, label } = body;

    // Validate required fields
    if (!_id) {
      return NextResponse.json({ error: 'Zipcode ID is required' }, { status: 400 });
    }

    // Validate zipcode
    if (!zipcode || typeof zipcode !== 'string' || zipcode.trim().length === 0) {
      return NextResponse.json(
        { error: 'Zipcode is required and must be a non-empty string' },
        { status: 400 }
      );
    }

    // Validate zipcode format
    const zipcodeRegex = /^\d{5}(-\d{4})?$/;
    if (!zipcodeRegex.test(zipcode.trim())) {
      return NextResponse.json(
        { error: 'Invalid zipcode format. Use 5 digits (12345) or 5+4 digits (12345-6789)' },
        { status: 400 }
      );
    }

    // Validate minimum cart value
    if (minCartValue === undefined || minCartValue === null) {
      return NextResponse.json(
        { error: 'Minimum cart value is required' },
        { status: 400 }
      );
    }

    if (typeof minCartValue !== 'number' || minCartValue < 0) {
      return NextResponse.json(
        { error: 'Minimum cart value must be a non-negative number' },
        { status: 400 }
      );
    }

    // Validate delivery fee
    if (deliveryFee === undefined || deliveryFee === null) {
      return NextResponse.json(
        { error: 'Delivery fee is required' },
        { status: 400 }
      );
    }

    if (typeof deliveryFee !== 'number' || deliveryFee < 0) {
      return NextResponse.json(
        { error: 'Delivery fee must be a non-negative number' },
        { status: 400 }
      );
    }

    // Validate label (optional, max 50 characters)
    if (label !== undefined && label !== null) {
      if (typeof label !== 'string') {
        return NextResponse.json(
          { error: 'Label must be a string' },
          { status: 400 }
        );
      }
      if (label.trim().length > 50) {
        return NextResponse.json(
          { error: 'Label must be 50 characters or less' },
          { status: 400 }
        );
      }
    }

    // Check if zipcode exists
    const existingResult = await db.readOne<Zipcode>('zincodes', {
      _id: new ObjectId(_id),
    });

    if (!existingResult.success || !existingResult.data) {
      return NextResponse.json({ error: 'Zipcode not found' }, { status: 404 });
    }

    // Check if zipcode is being changed and if it conflicts with another record
    if (zipcode.trim() !== existingResult.data.zipcode) {
      const duplicateResult = await db.readOne<Zipcode>('zincodes', {
        zipcode: zipcode.trim(),
        _id: { $ne: new ObjectId(_id) },
      });

      if (duplicateResult.success && duplicateResult.data) {
        return NextResponse.json(
          { error: 'Zipcode already exists' },
          { status: 409 }
        );
      }
    }

    // Prepare update data
    const updateData: Partial<Zipcode> = {
      zipcode: zipcode.trim(),
      minCartValue,
      deliveryFee,
      label: label?.trim() || undefined,
      updatedAt: new Date(),
    };

    // Update zipcode
    const updateResult = await db.updateOne<Zipcode>(
      'zincodes',
      { _id: new ObjectId(_id) },
      { $set: updateData }
    );

    if (!updateResult.success) {
      throw new Error(updateResult.error || 'Failed to update zipcode');
    }

    // Fetch updated delivery zone
    const updatedZipcode = await db.readOne<Zipcode>('zincodes', {
      _id: new ObjectId(_id),
    });

    return NextResponse.json(updatedZipcode.data);
  } catch (error) {
    console.error('Error in PUT /api/admin/min-cart-value:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/admin/min-cart-value
 * Delete delivery zone
 */
export async function DELETE(request: NextRequest) {
  try {
    // Verify authentication
    const authResult = verifyAuth(request);
    if (!authResult.success) {
      return NextResponse.json({ error: authResult.error }, { status: 401 });
    }

    // Get zipcode ID from query params
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'Zipcode ID is required' }, { status: 400 });
    }

    // Check if zipcode exists
    const existingResult = await db.readOne<Zipcode>('zincodes', {
      _id: new ObjectId(id),
    });

    if (!existingResult.success || !existingResult.data) {
      return NextResponse.json({ error: 'Zipcode not found' }, { status: 404 });
    }

    // Delete from database
    const deleteResult = await db.deleteOne<Zipcode>('zincodes', {
      _id: new ObjectId(id),
    });

    if (!deleteResult.success) {
      throw new Error(deleteResult.error || 'Failed to delete zipcode');
    }

    return NextResponse.json({ success: true, message: 'Zipcode deleted successfully' });
  } catch (error) {
    console.error('Error in DELETE /api/admin/min-cart-value:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}
