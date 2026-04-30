import { NextRequest, NextResponse } from 'next/server';
import { jwtHandler } from '@/lib/jwt';
import { db } from '@/lib/db';
import { ObjectId } from 'mongodb';

// Type definitions
interface Zipcode {
  _id?: ObjectId | string;
  zipcode: string;
  minCartValue: number;
  deliveryFee?: number;
  label?: string;
  createdAt?: Date;
  updatedAt?: Date;
}

interface BatchUpdateItem {
  _id: string;
  zipcode?: string;
  label?: string;
  minCartValue?: number;
  deliveryFee?: number;
}

interface BatchUpdateRequest {
  updates: BatchUpdateItem[];
}

interface BatchUpdateResult {
  _id: string;
  success: boolean;
  error?: string;
}

interface BatchUpdateResponse {
  success: boolean;
  results: BatchUpdateResult[];
  successCount: number;
  failureCount: number;
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
 * Validate a single update item
 */
function validateUpdateItem(item: BatchUpdateItem): string | null {
  // Validate _id
  if (!item._id || typeof item._id !== 'string') {
    return 'Invalid or missing _id';
  }

  try {
    new ObjectId(item._id);
  } catch {
    return 'Invalid ObjectId format for _id';
  }

  // Validate zipcode if provided
  if (item.zipcode !== undefined) {
    if (typeof item.zipcode !== 'string' || item.zipcode.trim().length === 0) {
      return 'Zipcode must be a non-empty string';
    }

    const zipcodeRegex = /^\d{5}(-\d{4})?$/;
    if (!zipcodeRegex.test(item.zipcode.trim())) {
      return 'Invalid zipcode format. Use 5 digits (12345) or 5+4 digits (12345-6789)';
    }
  }

  // Validate label if provided
  if (item.label !== undefined && item.label !== null) {
    if (typeof item.label !== 'string') {
      return 'Label must be a string';
    }
    if (item.label.trim().length > 50) {
      return 'Label must be 50 characters or less';
    }
  }

  // Validate minCartValue if provided
  if (item.minCartValue !== undefined) {
    if (typeof item.minCartValue !== 'number' || item.minCartValue < 0) {
      return 'Minimum cart value must be a non-negative number';
    }
  }

  // Validate deliveryFee if provided
  if (item.deliveryFee !== undefined) {
    if (typeof item.deliveryFee !== 'number' || item.deliveryFee < 0) {
      return 'Delivery fee must be a non-negative number';
    }
  }

  return null;
}

/**
 * PUT /api/admin/min-cart-value/batch
 * Batch update delivery zones
 */
export async function PUT(request: NextRequest) {
  try {
    // Verify authentication
    const authResult = verifyAuth(request);
    if (!authResult.success) {
      return NextResponse.json({ error: authResult.error }, { status: 401 });
    }

    // Parse request body
    let body: BatchUpdateRequest;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: 'Invalid JSON in request body' },
        { status: 400 }
      );
    }

    // Validate request structure
    if (!body.updates || !Array.isArray(body.updates)) {
      return NextResponse.json(
        { error: 'Request must contain an updates array' },
        { status: 400 }
      );
    }

    if (body.updates.length === 0) {
      return NextResponse.json(
        { error: 'Updates array cannot be empty' },
        { status: 400 }
      );
    }

    if (body.updates.length > 100) {
      return NextResponse.json(
        { error: 'Maximum 100 updates allowed per batch' },
        { status: 400 }
      );
    }

    const results: BatchUpdateResult[] = [];
    let successCount = 0;
    let failureCount = 0;

    // Pre-validation phase: validate all items first
    const validationErrors: Map<string, string> = new Map();
    const zipcodesInBatch: Map<string, string> = new Map(); // zipcode -> _id mapping for duplicate detection

    for (const item of body.updates) {
      const validationError = validateUpdateItem(item);
      if (validationError) {
        validationErrors.set(item._id, validationError);
        continue;
      }

      // Check for duplicate zipcodes within the batch
      if (item.zipcode) {
        const normalizedZipcode = item.zipcode.trim();
        const existingId = zipcodesInBatch.get(normalizedZipcode);
        if (existingId && existingId !== item._id) {
          validationErrors.set(item._id, `Duplicate zipcode '${normalizedZipcode}' in batch`);
          continue;
        }
        zipcodesInBatch.set(normalizedZipcode, item._id);
      }
    }

    // Check for zipcode conflicts with existing records
    const zipcodesToCheck = Array.from(zipcodesInBatch.entries());
    for (const [zipcode, itemId] of zipcodesToCheck) {
      if (validationErrors.has(itemId)) continue; // Skip already invalid items

      const existingResult = await db.readOne<Zipcode>('zincodes', {
        zipcode: zipcode,
        _id: { $ne: new ObjectId(itemId) },
      });

      if (existingResult.success && existingResult.data) {
        validationErrors.set(itemId, `Zipcode '${zipcode}' already exists`);
      }
    }

    // Process each update
    for (const item of body.updates) {
      // Check if item failed validation
      if (validationErrors.has(item._id)) {
        results.push({
          _id: item._id,
          success: false,
          error: validationErrors.get(item._id),
        });
        failureCount++;
        continue;
      }

      try {
        // Check if the record exists
        const existingResult = await db.readOne<Zipcode>('zincodes', {
          _id: new ObjectId(item._id),
        });

        if (!existingResult.success || !existingResult.data) {
          results.push({
            _id: item._id,
            success: false,
            error: 'Delivery zone not found',
          });
          failureCount++;
          continue;
        }

        // Build update data - only include fields that are provided
        const updateData: Partial<Zipcode> = {
          updatedAt: new Date(),
        };

        if (item.zipcode !== undefined) {
          updateData.zipcode = item.zipcode.trim();
        }

        if (item.label !== undefined) {
          updateData.label = item.label?.trim() || undefined;
        }

        if (item.minCartValue !== undefined) {
          updateData.minCartValue = item.minCartValue;
        }

        if (item.deliveryFee !== undefined) {
          updateData.deliveryFee = item.deliveryFee;
        }

        // Perform the update
        const updateResult = await db.updateOne<Zipcode>(
          'zincodes',
          { _id: new ObjectId(item._id) },
          { $set: updateData }
        );

        if (!updateResult.success) {
          results.push({
            _id: item._id,
            success: false,
            error: updateResult.error || 'Failed to update',
          });
          failureCount++;
          continue;
        }

        results.push({
          _id: item._id,
          success: true,
        });
        successCount++;
      } catch (error) {
        console.error(`Error updating item ${item._id}:`, error);
        results.push({
          _id: item._id,
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
        failureCount++;
      }
    }

    const response: BatchUpdateResponse = {
      success: failureCount === 0,
      results,
      successCount,
      failureCount,
    };

    // Return appropriate status code based on results
    const statusCode = failureCount === body.updates.length ? 400 : 200;

    return NextResponse.json(response, { status: statusCode });
  } catch (error) {
    console.error('Error in PUT /api/admin/min-cart-value/batch:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}
