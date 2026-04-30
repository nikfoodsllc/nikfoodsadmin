import { ObjectId } from 'mongodb';
import { db } from '@/lib/db';
import { CategoryFoodMapping } from '@/types/order';

/**
 * Re-export CategoryFoodMapping type from types/order.ts
 * This maintains backward compatibility for imports
 */
export type { CategoryFoodMapping };

/**
 * Migration Result Interface
 */
export interface MigrationResult {
  success: boolean;
  message: string;
  data?: {
    totalProcessed: number;
    successfulMappings: number;
    failedMappings: number;
    errors: string[];
    indexesCreated: string[];
  };
  error?: string;
}

/**
 * Audit Log Entry
 */
interface AuditLog {
  timestamp: Date;
  operation: string;
  details: string;
  success: boolean;
  error?: string;
}

/**
 * Migration Audit Trail
 */
class MigrationAudit {
  private logs: AuditLog[] = [];

  log(operation: string, details: string, success: boolean, error?: string) {
    const logEntry: AuditLog = {
      timestamp: new Date(),
      operation,
      details,
      success,
      error,
    };
    this.logs.push(logEntry);

    // Also log to console
    const timestamp = logEntry.timestamp.toISOString();
    if (success) {
      console.log(`[${timestamp}] ✅ ${operation}: ${details}`);
    } else {
      console.error(`[${timestamp}] ❌ ${operation}: ${details}${error ? ` - ${error}` : ''}`);
    }
  }

  getLogs(): AuditLog[] {
    return this.logs;
  }

  getSummary(): { total: number; successful: number; failed: number } {
    return {
      total: this.logs.length,
      successful: this.logs.filter((log) => log.success).length,
      failed: this.logs.filter((log) => !log.success).length,
    };
  }
}

/**
 * Forward Migration: Create CategoryFoodMapping collection and migrate data
 */
export async function migrateCategoryFoodMapping(): Promise<MigrationResult> {
  const audit = new MigrationAudit();
  const collectionName = 'categoryfoodmapping';
  const errors: string[] = [];
  const indexesCreated: string[] = [];

  try {
    audit.log('MIGRATION_START', 'Starting CategoryFoodMapping migration', true);

    // Step 1: Check if collection already exists
    audit.log('CHECK_COLLECTION', `Checking if collection '${collectionName}' exists`, true);
    const existingCollections = await db.getDb().then((database) =>
      database.listCollections().toArray()
    );

    const collectionExists = existingCollections.some((col) => col.name === collectionName);

    if (collectionExists) {
      audit.log('CHECK_COLLECTION', `Collection '${collectionName}' already exists`, true);

      // Check if collection has data
      const existingCount = await db.count<CategoryFoodMapping>(collectionName, {});
      if (existingCount.success && existingCount.count && existingCount.count > 0) {
        audit.log(
          'CHECK_COLLECTION',
          `Collection already has ${existingCount.count} documents. Skipping migration.`,
          true
        );
        return {
          success: true,
          message: 'Migration skipped - collection already exists with data',
          data: {
            totalProcessed: 0,
            successfulMappings: existingCount.count,
            failedMappings: 0,
            errors: [],
            indexesCreated: [],
          },
        };
      }
    } else {
      audit.log('CREATE_COLLECTION', `Creating collection '${collectionName}'`, true);
      // Collection will be created automatically on first insert in MongoDB
    }

    // Step 2: Fetch all food items with category data
    audit.log('FETCH_FOODITEMS', 'Fetching food items from database', true);
    const foodItemsResult = await db.read<{
      _id: ObjectId;
      category: string[];
    }>('fooditems', {});

    if (!foodItemsResult.success) {
      throw new Error(foodItemsResult.error || 'Failed to fetch food items');
    }

    const foodItems = foodItemsResult.data || [];
    audit.log('FETCH_FOODITEMS', `Found ${foodItems.length} food items`, true);

    if (foodItems.length === 0) {
      audit.log('FETCH_FOODITEMS', 'No food items to migrate', true);
      return {
        success: true,
        message: 'Migration completed - no food items to migrate',
        data: {
          totalProcessed: 0,
          successfulMappings: 0,
          failedMappings: 0,
          errors: [],
          indexesCreated: [],
        },
      };
    }

    // Step 3: Transform and insert CategoryFoodMapping documents
    audit.log('TRANSFORM_DATA', 'Transforming category data into mapping documents', true);
    const mappingDocuments: CategoryFoodMapping[] = [];
    let successfulMappings = 0;
    let failedMappings = 0;

    for (const foodItem of foodItems) {
      if (!foodItem._id) {
        errors.push(`Food item missing _id: ${JSON.stringify(foodItem)}`);
        failedMappings++;
        continue;
      }

      if (!foodItem.category || !Array.isArray(foodItem.category) || foodItem.category.length === 0) {
        audit.log('TRANSFORM_DATA', `Food item ${foodItem._id} has no categories, skipping`, true);
        continue;
      }

      const foodItemId = foodItem._id instanceof ObjectId ? foodItem._id : new ObjectId(foodItem._id);

      // Create a mapping document for each category in the array
      for (let i = 0; i < foodItem.category.length; i++) {
        const categoryIdStr = foodItem.category[i];

        // Validate and convert categoryId to ObjectId
        let categoryId: ObjectId;
        try {
          if (typeof categoryIdStr === 'string' && ObjectId.isValid(categoryIdStr)) {
            categoryId = new ObjectId(categoryIdStr);
          } else {
            errors.push(
              `Invalid categoryId format for food item ${foodItemId.toString()}: ${categoryIdStr}`
            );
            failedMappings++;
            continue;
          }

          const mapping: CategoryFoodMapping = {
            foodItemId,
            categoryId,
            sequence: i, // Preserve the order from the array
            mappingType: 'FLAT',
            createdAt: new Date(),
            updatedAt: new Date(),
          };

          mappingDocuments.push(mapping);
          successfulMappings++;
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';
          errors.push(
            `Error processing category ${categoryIdStr} for food item ${foodItemId.toString()}: ${errorMessage}`
          );
          failedMappings++;
        }
      }
    }

    audit.log(
      'TRANSFORM_DATA',
      `Created ${mappingDocuments.length} mapping documents from ${foodItems.length} food items`,
      true
    );

    // Step 4: Insert mapping documents in batches
    audit.log('INSERT_DATA', 'Inserting mapping documents into database', true);
    const BATCH_SIZE = 1000;
    let totalInserted = 0;

    for (let i = 0; i < mappingDocuments.length; i += BATCH_SIZE) {
      const batch = mappingDocuments.slice(i, i + BATCH_SIZE);
      const insertResult = await db.createMany<CategoryFoodMapping>(collectionName, batch);

      if (!insertResult.success) {
        throw new Error(insertResult.error || 'Failed to insert mapping documents');
      }

      totalInserted += insertResult.ids?.length || 0;
      audit.log(
        'INSERT_DATA',
        `Inserted batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(mappingDocuments.length / BATCH_SIZE)}: ${batch.length} documents`,
        true
      );
    }

    audit.log('INSERT_DATA', `Successfully inserted ${totalInserted} mapping documents`, true);

    // Step 5: Create indexes for efficient querying
    audit.log('CREATE_INDEXES', 'Creating indexes on CategoryFoodMapping collection', true);

    const database = await db.getDb();
    const collection = database.collection<CategoryFoodMapping>(collectionName);

    // Create index on foodItemId
    try {
      await collection.createIndex({ foodItemId: 1 }, { name: 'idx_foodItemId' });
      indexesCreated.push('idx_foodItemId');
      audit.log('CREATE_INDEX', 'Created index on foodItemId', true);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      errors.push(`Failed to create index on foodItemId: ${errorMessage}`);
      audit.log('CREATE_INDEX', `Failed to create index on foodItemId: ${errorMessage}`, false);
    }

    // Create index on categoryId
    try {
      await collection.createIndex({ categoryId: 1 }, { name: 'idx_categoryId' });
      indexesCreated.push('idx_categoryId');
      audit.log('CREATE_INDEX', 'Created index on categoryId', true);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      errors.push(`Failed to create index on categoryId: ${errorMessage}`);
      audit.log('CREATE_INDEX', `Failed to create index on categoryId: ${errorMessage}`, false);
    }

    // Create compound index for efficient queries on both fields
    try {
      await collection.createIndex(
        { foodItemId: 1, categoryId: 1 },
        { name: 'idx_foodItemId_categoryId', unique: true }
      );
      indexesCreated.push('idx_foodItemId_categoryId');
      audit.log('CREATE_INDEX', 'Created unique compound index on foodItemId and categoryId', true);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      errors.push(`Failed to create compound index: ${errorMessage}`);
      audit.log('CREATE_INDEX', `Failed to create compound index: ${errorMessage}`, false);
    }

    // Step 6: Verify migration
    audit.log('VERIFY_MIGRATION', 'Verifying migration results', true);
    const finalCount = await db.count<CategoryFoodMapping>(collectionName, {});

    if (finalCount.success && finalCount.count === totalInserted) {
      audit.log(
        'VERIFY_MIGRATION',
        `Verification successful: ${finalCount.count} documents in collection`,
        true
      );
    } else {
      const errorMessage = `Verification failed: expected ${totalInserted} documents, found ${finalCount.count || 0}`;
      errors.push(errorMessage);
      audit.log('VERIFY_MIGRATION', errorMessage, false);
    }

    // Generate summary
    const summary = audit.getSummary();
    audit.log('MIGRATION_COMPLETE', `Migration completed with ${summary.failed} errors`, summary.failed === 0);

    return {
      success: true,
      message: 'CategoryFoodMapping migration completed successfully',
      data: {
        totalProcessed: foodItems.length,
        successfulMappings,
        failedMappings,
        errors,
        indexesCreated,
      },
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    audit.log('MIGRATION_ERROR', `Migration failed: ${errorMessage}`, false, errorMessage);

    return {
      success: false,
      message: 'Migration failed',
      error: errorMessage,
    };
  }
}

/**
 * Rollback Migration: Drop CategoryFoodMapping collection
 */
export async function rollbackCategoryFoodMapping(): Promise<MigrationResult> {
  const audit = new MigrationAudit();
  const collectionName = 'categoryfoodmapping';

  try {
    audit.log('ROLLBACK_START', 'Starting CategoryFoodMapping rollback', true);

    // Check if collection exists
    const database = await db.getDb();
    const existingCollections = await database.listCollections().toArray();

    const collectionExists = existingCollections.some((col) => col.name === collectionName);

    if (!collectionExists) {
      audit.log('CHECK_COLLECTION', `Collection '${collectionName}' does not exist, nothing to rollback`, true);
      return {
        success: true,
        message: 'Rollback skipped - collection does not exist',
        data: {
          totalProcessed: 0,
          successfulMappings: 0,
          failedMappings: 0,
          errors: [],
          indexesCreated: [],
        },
      };
    }

    // Drop the collection
    audit.log('DROP_COLLECTION', `Dropping collection '${collectionName}'`, true);
    const dropResult = await database.dropCollection(collectionName).then(
      () => ({ success: true }),
      (error) => ({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      })
    );

    if (!dropResult.success) {
      throw new Error('error' in dropResult ? dropResult.error : 'Failed to drop collection');
    }

    audit.log('DROP_COLLECTION', `Successfully dropped collection '${collectionName}'`, true);
    audit.log('ROLLBACK_COMPLETE', 'Rollback completed successfully', true);

    return {
      success: true,
      message: 'CategoryFoodMapping collection dropped successfully',
      data: {
        totalProcessed: 0,
        successfulMappings: 0,
        failedMappings: 0,
        errors: [],
        indexesCreated: [],
      },
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    audit.log('ROLLBACK_ERROR', `Rollback failed: ${errorMessage}`, false, errorMessage);

    return {
      success: false,
      message: 'Rollback failed',
      error: errorMessage,
    };
  }
}

/**
 * Get migration status
 */
export async function getMigrationStatus(): Promise<{
  success: boolean;
  data?: {
    collectionExists: boolean;
    documentCount: number;
    indexes: string[];
  };
  error?: string;
}> {
  try {
    const collectionName = 'categoryfoodmapping';
    const database = await db.getDb();

    // Check if collection exists
    const existingCollections = await database.listCollections().toArray();
    const collectionExists = existingCollections.some((col) => col.name === collectionName);

    if (!collectionExists) {
      return {
        success: true,
        data: {
          collectionExists: false,
          documentCount: 0,
          indexes: [],
        },
      };
    }

    // Get document count
    const countResult = await db.count<CategoryFoodMapping>(collectionName, {});
    const documentCount = countResult.success && countResult.count ? countResult.count : 0;

    // Get indexes
    const collection = database.collection<CategoryFoodMapping>(collectionName);
    const indexes = await collection
      .listIndexes()
      .toArray()
      .then((idxs) => idxs.map((idx) => idx.name));

    return {
      success: true,
      data: {
        collectionExists: true,
        documentCount,
        indexes,
      },
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return {
      success: false,
      error: errorMessage,
    };
  }
}
