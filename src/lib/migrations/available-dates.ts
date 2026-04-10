import { db } from '@/lib/db';
import { AvailableDate } from '@/types/order';

// Re-export type for convenience
export type { AvailableDate };

/**
 * Migration Result Interface
 */
export interface MigrationResult {
  success: boolean;
  message: string;
  data?: {
    indexesCreated: string[];
    collectionCreated: boolean;
  };
  error?: string;
}

/**
 * Migration: Create availableDates collection with indexes
 */
export async function migrateAvailableDates(): Promise<MigrationResult> {
  const collectionName = 'availableDates';
  const indexesCreated: string[] = [];

  try {
    console.log(`[Migration] Starting availableDates collection migration...`);

    // Get database instance
    const database = await db.getDb();

    // Check if collection already exists
    const existingCollections = await database.listCollections().toArray();
    const collectionExists = existingCollections.some((col) => col.name === collectionName);

    if (collectionExists) {
      console.log(`[Migration] Collection '${collectionName}' already exists`);
    } else {
      // Create the collection
      await database.createCollection(collectionName);
      console.log(`[Migration] Created collection '${collectionName}'`);
    }

    // Get the collection
    const collection = database.collection(collectionName);

    // Create unique index on date field
    try {
      await collection.createIndex(
        { date: 1 },
        { unique: true, name: 'date_unique_index' }
      );
      indexesCreated.push('date_unique_index');
      console.log(`[Migration] Created unique index on 'date' field`);
    } catch (error) {
      // Index might already exist
      if (error instanceof Error && !error.message.includes('already exists')) {
        throw error;
      }
      console.log(`[Migration] Index on 'date' field already exists`);
    }

    // Create index on flatCategoryEnabled for querying
    try {
      await collection.createIndex(
        { flatCategoryEnabled: 1 },
        { name: 'flatCategoryEnabled_index' }
      );
      indexesCreated.push('flatCategoryEnabled_index');
      console.log(`[Migration] Created index on 'flatCategoryEnabled' field`);
    } catch (error) {
      if (error instanceof Error && !error.message.includes('already exists')) {
        throw error;
      }
      console.log(`[Migration] Index on 'flatCategoryEnabled' field already exists`);
    }

    // Create index on dayWiseCategoryEnabled for querying
    try {
      await collection.createIndex(
        { dayWiseCategoryEnabled: 1 },
        { name: 'dayWiseCategoryEnabled_index' }
      );
      indexesCreated.push('dayWiseCategoryEnabled_index');
      console.log(`[Migration] Created index on 'dayWiseCategoryEnabled' field`);
    } catch (error) {
      if (error instanceof Error && !error.message.includes('already exists')) {
        throw error;
      }
      console.log(`[Migration] Index on 'dayWiseCategoryEnabled' field already exists`);
    }

    // Create compound index for date range queries
    try {
      await collection.createIndex(
        { date: 1 },
        { name: 'date_range_index' }
      );
      indexesCreated.push('date_range_index');
      console.log(`[Migration] Created date range index`);
    } catch (error) {
      if (error instanceof Error && !error.message.includes('already exists')) {
        throw error;
      }
      console.log(`[Migration] Date range index already exists`);
    }

    console.log(`[Migration] ✅ availableDates migration completed successfully`);

    return {
      success: true,
      message: 'AvailableDates collection migration completed successfully',
      data: {
        indexesCreated,
        collectionCreated: !collectionExists,
      },
    };
  } catch (error) {
    console.error(`[Migration] ❌ Error during availableDates migration:`, error);
    return {
      success: false,
      message: 'Migration failed',
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Rollback: Drop availableDates collection
 */
export async function rollbackAvailableDates(): Promise<{ success: boolean; message: string }> {
  const collectionName = 'availableDates';

  try {
    console.log(`[Rollback] Dropping availableDates collection...`);

    const database = await db.getDb();
    await database.dropCollection(collectionName).catch(() => {
      // Collection might not exist
      console.log(`[Rollback] Collection '${collectionName}' does not exist`);
    });

    console.log(`[Rollback] ✅ availableDates collection dropped successfully`);

    return {
      success: true,
      message: 'AvailableDates collection dropped successfully',
    };
  } catch (error) {
    console.error(`[Rollback] ❌ Error dropping availableDates collection:`, error);
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}
