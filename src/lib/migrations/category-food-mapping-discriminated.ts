import { ObjectId } from 'mongodb';
import { db } from '@/lib/db';
import { MappingType, CategoryFoodMapping, BaseCategoryFoodMapping } from '@/types/order';

/**
 * Migration for Discriminated CategoryFoodMapping Schema
 *
 * This migration adds the `mappingType` field to existing CategoryFoodMapping documents
 * to support discriminated union schema with FLAT and DAY_WISE types.
 *
 * - Existing documents without mappingType will be defaulted to 'FLAT'
 * - DAY_WISE mappings will include an additional `day` field
 * - New index will be created on mappingType for efficient querying
 */

/**
 * Document shape before migration
 */
interface LegacyCategoryFoodMapping {
  _id?: ObjectId | string;
  foodItemId: ObjectId;
  categoryId: ObjectId;
  sequence: number;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Document shape after migration (discriminated)
 */
interface MigratedCategoryFoodMapping extends BaseCategoryFoodMapping {
  mappingType: MappingType;
}

/**
 * Migration Result Interface
 */
export interface DiscriminatedMigrationResult {
  success: boolean;
  message: string;
  data?: {
    totalDocuments: number;
    migratedDocuments: number;
    alreadyMigrated: number;
    flatMappings: number;
    dayWiseMappings: number;
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
 * Forward Migration: Add mappingType field to existing CategoryFoodMapping documents
 */
export async function migrateToDiscriminatedSchema(): Promise<DiscriminatedMigrationResult> {
  const audit = new MigrationAudit();
  const collectionName = 'categoryfoodmapping';
  const errors: string[] = [];
  const indexesCreated: string[] = [];

  try {
    audit.log('MIGRATION_START', 'Starting discriminated schema migration', true);

    // Step 1: Check if collection exists
    audit.log('CHECK_COLLECTION', `Checking if collection '${collectionName}' exists`, true);
    const existingCollections = await db.getDb().then((database) =>
      database.listCollections().toArray()
    );

    const collectionExists = existingCollections.some((col) => col.name === collectionName);

    if (!collectionExists) {
      audit.log('CHECK_COLLECTION', `Collection '${collectionName}' does not exist`, true);
      return {
        success: true,
        message: 'Migration skipped - collection does not exist yet',
        data: {
          totalDocuments: 0,
          migratedDocuments: 0,
          alreadyMigrated: 0,
          flatMappings: 0,
          dayWiseMappings: 0,
          errors: [],
          indexesCreated: [],
        },
      };
    }

    // Step 2: Get total document count
    audit.log('COUNT_DOCUMENTS', 'Counting total documents in collection', true);
    const countResult = await db.count(collectionName, {});

    if (!countResult.success || !countResult.count) {
      throw new Error(countResult.error || 'Failed to count documents');
    }

    const totalDocuments = countResult.count;
    audit.log('COUNT_DOCUMENTS', `Found ${totalDocuments} documents`, true);

    if (totalDocuments === 0) {
      audit.log('COUNT_DOCUMENTS', 'No documents to migrate', true);
      return {
        success: true,
        message: 'Migration completed - no documents to migrate',
        data: {
          totalDocuments: 0,
          migratedDocuments: 0,
          alreadyMigrated: 0,
          flatMappings: 0,
          dayWiseMappings: 0,
          errors: [],
          indexesCreated: [],
        },
      };
    }

    // Step 3: Check which documents already have mappingType
    audit.log('CHECK_SCHEMA', 'Checking for documents with mappingType field', true);
    const alreadyMigratedResult = await db.count(collectionName, {
      mappingType: { $exists: true }
    });

    const alreadyMigrated = alreadyMigratedResult.success && alreadyMigratedResult.count
      ? alreadyMigratedResult.count
      : 0;

    const needsMigration = totalDocuments - alreadyMigrated;
    audit.log(
      'CHECK_SCHEMA',
      `Found ${alreadyMigrated} already migrated, ${needsMigration} need migration`,
      true
    );

    if (needsMigration === 0) {
      audit.log('CHECK_SCHEMA', 'All documents already have mappingType field', true);

      // Ensure index exists even if all documents are already migrated
      await ensureMappingTypeIndex(collectionName, audit, indexesCreated, errors);

      return {
        success: true,
        message: 'Migration completed - all documents already have mappingType',
        data: {
          totalDocuments,
          migratedDocuments: 0,
          alreadyMigrated,
          flatMappings: 0,
          dayWiseMappings: 0,
          errors,
          indexesCreated,
        },
      };
    }

    // Step 4: Migrate documents without mappingType (default to FLAT)
    audit.log('MIGRATE_DOCUMENTS', 'Adding mappingType field to legacy documents', true);

    const database = await db.getDb();
    const collection = database.collection<LegacyCategoryFoodMapping>(collectionName);

    // Find all documents without mappingType
    const legacyDocuments = await collection.find({
      mappingType: { $exists: false }
    }).toArray();

    audit.log('MIGRATE_DOCUMENTS', `Found ${legacyDocuments.length} legacy documents to migrate`, true);

    let migratedCount = 0;
    let flatMappings = 0;
    let dayWiseMappings = 0;

    // Update documents in batches
    const BATCH_SIZE = 1000;
    for (let i = 0; i < legacyDocuments.length; i += BATCH_SIZE) {
      const batch = legacyDocuments.slice(i, i + BATCH_SIZE);

      for (const doc of batch) {
        if (!doc._id) {
          errors.push(`Document missing _id: ${JSON.stringify(doc)}`);
          continue;
        }

        try {
          // Default to FLAT for existing documents
          const result = await collection.updateOne(
            { _id: doc._id },
            {
              $set: {
                mappingType: 'FLAT' as MappingType,
                updatedAt: new Date()
              }
            }
          );

          if (result.modifiedCount > 0) {
            migratedCount++;
            flatMappings++;
          }
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';
          errors.push(`Failed to migrate document ${doc._id.toString()}: ${errorMessage}`);
          audit.log(
            'MIGRATE_DOCUMENTS',
            `Failed to migrate document ${doc._id.toString()}`,
            false,
            errorMessage
          );
        }
      }

      audit.log(
        'MIGRATE_DOCUMENTS',
        `Migrated batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(legacyDocuments.length / BATCH_SIZE)}: ${batch.length} documents`,
        true
      );
    }

    audit.log('MIGRATE_DOCUMENTS', `Successfully migrated ${migratedCount} documents to FLAT type`, true);

    // Step 5: Create index on mappingType for efficient querying
    await ensureMappingTypeIndex(collectionName, audit, indexesCreated, errors);

    // Step 6: Verify migration
    audit.log('VERIFY_MIGRATION', 'Verifying migration results', true);

    const remainingLegacyDocs = await db.count(collectionName, {
      mappingType: { $exists: false }
    });

    if (!remainingLegacyDocs.success) {
      errors.push('Failed to verify migration: could not count remaining legacy documents');
    } else if (remainingLegacyDocs.count && remainingLegacyDocs.count > 0) {
      errors.push(`${remainingLegacyDocs.count} documents still missing mappingType field`);
    } else {
      audit.log('VERIFY_MIGRATION', 'All documents now have mappingType field', true);
    }

    // Count FLAT and DAY_WISE mappings
    const flatCountResult = await db.count(collectionName, { mappingType: 'FLAT' });
    const dayWiseCountResult = await db.count(collectionName, { mappingType: 'DAY_WISE' });

    flatMappings = flatCountResult.success && flatCountResult.count ? flatCountResult.count : flatMappings;
    dayWiseMappings = dayWiseCountResult.success && dayWiseCountResult.count ? dayWiseCountResult.count : 0;

    audit.log(
      'VERIFY_MIGRATION',
      `Migration summary: ${flatMappings} FLAT, ${dayWiseMappings} DAY_WISE`,
      true
    );

    // Generate summary
    const summary = audit.getSummary();
    audit.log('MIGRATION_COMPLETE', `Migration completed with ${summary.failed} errors`, summary.failed === 0);

    return {
      success: true,
      message: 'Discriminated schema migration completed successfully',
      data: {
        totalDocuments,
        migratedDocuments: migratedCount,
        alreadyMigrated,
        flatMappings,
        dayWiseMappings,
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
 * Ensure mappingType index exists
 */
async function ensureMappingTypeIndex(
  collectionName: string,
  audit: MigrationAudit,
  indexesCreated: string[],
  errors: string[]
): Promise<void> {
  try {
    const database = await db.getDb();
    const collection = database.collection(collectionName);

    audit.log('CREATE_INDEX', 'Creating index on mappingType', true);

    await collection.createIndex(
      { mappingType: 1 },
      { name: 'idx_mappingType' }
    );

    indexesCreated.push('idx_mappingType');
    audit.log('CREATE_INDEX', 'Created index on mappingType', true);

    // Create compound index on mappingType + categoryId for efficient queries
    await collection.createIndex(
      { mappingType: 1, categoryId: 1 },
      { name: 'idx_mappingType_categoryId' }
    );

    indexesCreated.push('idx_mappingType_categoryId');
    audit.log('CREATE_INDEX', 'Created compound index on mappingType and categoryId', true);

    // Create compound index on mappingType + foodItemId for efficient queries
    await collection.createIndex(
      { mappingType: 1, foodItemId: 1 },
      { name: 'idx_mappingType_foodItemId' }
    );

    indexesCreated.push('idx_mappingType_foodItemId');
    audit.log('CREATE_INDEX', 'Created compound index on mappingType and foodItemId', true);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    errors.push(`Failed to create indexes: ${errorMessage}`);
    audit.log('CREATE_INDEX', `Failed to create indexes: ${errorMessage}`, false);
  }
}

/**
 * Rollback Migration: Remove mappingType field from documents
 * WARNING: This will convert DAY_WISE mappings back to FLAT, losing day information
 */
export async function rollbackDiscriminatedSchema(): Promise<DiscriminatedMigrationResult> {
  const audit = new MigrationAudit();
  const collectionName = 'categoryfoodmapping';
  const errors: string[] = [];

  try {
    audit.log('ROLLBACK_START', 'Starting discriminated schema rollback', true);

    // Check if collection exists
    const database = await db.getDb();
    const existingCollections = await database.listCollections().toArray();

    const collectionExists = existingCollections.some((col) => col.name === collectionName);

    if (!collectionExists) {
      audit.log('CHECK_COLLECTION', `Collection '${collectionName}' does not exist`, true);
      return {
        success: true,
        message: 'Rollback skipped - collection does not exist',
        data: {
          totalDocuments: 0,
          migratedDocuments: 0,
          alreadyMigrated: 0,
          flatMappings: 0,
          dayWiseMappings: 0,
          errors: [],
          indexesCreated: [],
        },
      };
    }

    const collection = database.collection(collectionName);

    // Remove mappingType field from all documents
    audit.log('REMOVE_FIELD', 'Removing mappingType field from all documents', true);

    const updateResult = await collection.updateMany(
      { mappingType: { $exists: true } },
      {
        $unset: { mappingType: '', day: '' }, // Remove both mappingType and day field
        $set: { updatedAt: new Date() }
      }
    );

    audit.log(
      'REMOVE_FIELD',
      `Removed mappingType from ${updateResult.modifiedCount} documents`,
      true
    );

    // Drop mappingType indexes
    audit.log('DROP_INDEXES', 'Dropping mappingType indexes', true);

    try {
      await collection.dropIndex('idx_mappingType');
      audit.log('DROP_INDEXES', 'Dropped index idx_mappingType', true);
    } catch (error) {
      // Index might not exist, continue
      audit.log('DROP_INDEXES', 'Index idx_mappingType does not exist or already dropped', true);
    }

    try {
      await collection.dropIndex('idx_mappingType_categoryId');
      audit.log('DROP_INDEXES', 'Dropped index idx_mappingType_categoryId', true);
    } catch (error) {
      // Index might not exist, continue
      audit.log('DROP_INDEXES', 'Index idx_mappingType_categoryId does not exist or already dropped', true);
    }

    try {
      await collection.dropIndex('idx_mappingType_foodItemId');
      audit.log('DROP_INDEXES', 'Dropped index idx_mappingType_foodItemId', true);
    } catch (error) {
      // Index might not exist, continue
      audit.log('DROP_INDEXES', 'Index idx_mappingType_foodItemId does not exist or already dropped', true);
    }

    audit.log('ROLLBACK_COMPLETE', 'Rollback completed successfully', true);

    return {
      success: true,
      message: 'Discriminated schema rollback completed',
      data: {
        totalDocuments: updateResult.modifiedCount,
        migratedDocuments: updateResult.modifiedCount,
        alreadyMigrated: 0,
        flatMappings: 0,
        dayWiseMappings: 0,
        errors,
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
 * Get migration status for discriminated schema
 */
export async function getDiscriminatedMigrationStatus(): Promise<{
  success: boolean;
  data?: {
    collectionExists: boolean;
    totalDocuments: number;
    migratedDocuments: number;
    legacyDocuments: number;
    flatMappings: number;
    dayWiseMappings: number;
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
          totalDocuments: 0,
          migratedDocuments: 0,
          legacyDocuments: 0,
          flatMappings: 0,
          dayWiseMappings: 0,
          indexes: [],
        },
      };
    }

    const collection = database.collection(collectionName);

    // Get total document count
    const totalResult = await collection.countDocuments();
    const totalDocuments = totalResult;

    // Get migrated documents count
    const migratedResult = await collection.countDocuments({
      mappingType: { $exists: true }
    });

    // Get legacy documents count
    const legacyDocuments = totalDocuments - migratedResult;

    // Get FLAT and DAY_WISE counts
    const flatMappings = await collection.countDocuments({ mappingType: 'FLAT' });
    const dayWiseMappings = await collection.countDocuments({ mappingType: 'DAY_WISE' });

    // Get indexes
    const indexes = await collection
      .listIndexes()
      .toArray()
      .then((idxs) => idxs.map((idx) => idx.name));

    return {
      success: true,
      data: {
        collectionExists: true,
        totalDocuments,
        migratedDocuments: migratedResult,
        legacyDocuments,
        flatMappings,
        dayWiseMappings,
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
