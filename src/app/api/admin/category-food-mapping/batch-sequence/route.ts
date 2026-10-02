import { NextRequest, NextResponse } from 'next/server';
import { jwtHandler } from '@/lib/jwt';
import { db } from '@/lib/db';
import { ObjectId } from 'mongodb';
import { CategoryFoodMapping } from '@/types/order';
import { invalidateLivesiteHomeMenuCache } from '@/lib/invalidateHomeMenuCache';

/**
 * Interface for sequence update item
 */
interface SequenceUpdate {
  mappingId: string;
  sequence: number;
}

/**
 * Interface for request body
 */
interface BatchSequenceRequest {
  updates: SequenceUpdate[];
}

/**
 * Interface for update result
 */
interface UpdateResult {
  mappingId: string;
  success: boolean;
  error?: string;
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
 * PUT /api/admin/category-food-mapping/batch-sequence
 * Batch update sequence field for multiple category-food-mapping documents
 * Request body:
 *   {
 *     "updates": [
 *       { "mappingId": "...", "sequence": 0 },
 *       { "mappingId": "...", "sequence": 1 },
 *       ...
 *     ]
 *   }
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
    const { updates } = body as BatchSequenceRequest;

    // Validate required fields
    if (!updates || !Array.isArray(updates)) {
      return NextResponse.json(
        { error: 'updates must be an array' },
        { status: 400 }
      );
    }

    if (updates.length === 0) {
      return NextResponse.json(
        { error: 'updates array cannot be empty' },
        { status: 400 }
      );
    }

    // Validate each update item
    for (let i = 0; i < updates.length; i++) {
      const update = updates[i];

      if (!update.mappingId || typeof update.mappingId !== 'string') {
        return NextResponse.json(
          { error: `Invalid mappingId at index ${i}` },
          { status: 400 }
        );
      }

      if (typeof update.sequence !== 'number' || !Number.isInteger(update.sequence) || update.sequence < 0) {
        return NextResponse.json(
          { error: `Invalid sequence value at index ${i}. Must be a non-negative integer` },
          { status: 400 }
        );
      }
    }

    // Extract mapping IDs and convert to ObjectId
    const mappingIds: ObjectId[] = [];
    const mappingIdMap = new Map<string, ObjectId>();

    for (const update of updates) {
      try {
        const objectId = new ObjectId(update.mappingId);
        mappingIds.push(objectId);
        mappingIdMap.set(update.mappingId, objectId);
      } catch (error) {
        return NextResponse.json(
          { error: `Invalid mappingId format: ${update.mappingId}` },
          { status: 400 }
        );
      }
    }

    // Verify all mappings exist
    const existingMappingsResult = await db.read<CategoryFoodMapping>('categoryfoodmapping', {
      _id: { $in: mappingIds },
    });

    if (!existingMappingsResult.success) {
      throw new Error(existingMappingsResult.error || 'Failed to verify mappings');
    }

    const existingMappings = existingMappingsResult.data || [];
    const existingMappingIds = new Set(
      existingMappings.map((m) => m._id?.toString())
    );

    // Check for missing mappings
    const missingMappings = updates.filter(
      (update) => !existingMappingIds.has(update.mappingId)
    );

    if (missingMappings.length > 0) {
      return NextResponse.json(
        {
          error: 'Some mappings do not exist',
          details: missingMappings.map((m) => m.mappingId),
        },
        { status: 404 }
      );
    }

    // Perform batch updates
    const results: UpdateResult[] = [];
    let successCount = 0;
    let failureCount = 0;

    for (const update of updates) {
      try {
        const mappingId = mappingIdMap.get(update.mappingId);

        if (!mappingId) {
          results.push({
            mappingId: update.mappingId,
            success: false,
            error: 'Mapping ID not found in map',
          });
          failureCount++;
          continue;
        }

        const updateResult = await db.updateOne<CategoryFoodMapping>(
          'categoryfoodmapping',
          { _id: mappingId },
          {
            $set: {
              sequence: update.sequence,
              updatedAt: new Date(),
            },
          }
        );

        if (updateResult.success) {
          results.push({
            mappingId: update.mappingId,
            success: true,
          });
          successCount++;
        } else {
          results.push({
            mappingId: update.mappingId,
            success: false,
            error: updateResult.error || 'Update failed',
          });
          failureCount++;
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        results.push({
          mappingId: update.mappingId,
          success: false,
          error: errorMessage,
        });
        failureCount++;
      }
    }

    // Determine overall success
    const allSuccessful = failureCount === 0;

    if (successCount > 0) {
      await invalidateLivesiteHomeMenuCache();
    }

    return NextResponse.json(
      {
        success: allSuccessful,
        data: {
          total: updates.length,
          successCount,
          failureCount,
          results,
        },
        message: `Batch sequence update completed: ${successCount} succeeded, ${failureCount} failed`,
      },
      { status: allSuccessful ? 200 : 207 } // 207 Multi-Status for partial success
    );
  } catch (error) {
    console.error('Error in PUT /api/admin/category-food-mapping/batch-sequence:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}
