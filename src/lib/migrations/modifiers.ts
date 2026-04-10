import { db } from '@/lib/db';
import { FoodModifier } from '@/types/modifier';

// Re-export type for convenience
export type { FoodModifier };

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
 * Migration: Create foodmodifiers collection with indexes
 *
 * This migration sets up the food modifiers collection which stores
 * add-ons, customizations, and modifiers that can be applied to food items.
 *
 * Indexes created:
 * - itemType: For filtering modifiers by item type (simple, portions, combo, all)
 * - available: For filtering by availability status
 * - itemType + name: Unique compound index to ensure modifier names are unique per item type
 * - sequence: For ordering modifiers in the UI
 */
export async function migrateModifiers(): Promise<MigrationResult> {
  const collectionName = 'foodmodifiers';
  const indexesCreated: string[] = [];

  try {
    console.log(`[Migration] Starting ${collectionName} collection migration...`);

    // Get database instance
    const database = await db.getDb();

    // Check if collection already exists
    const existingCollections = await database.listCollections().toArray();
    const collectionExists = existingCollections.some((col) => col.name === collectionName);

    let collectionCreated = false;

    if (collectionExists) {
      console.log(`[Migration] Collection '${collectionName}' already exists`);
    } else {
      // Create the collection
      await database.createCollection(collectionName);
      collectionCreated = true;
      console.log(`[Migration] Created collection '${collectionName}'`);
    }

    // Get the collection
    const collection = database.collection(collectionName);

    // Create index on itemType for efficient filtering
    try {
      await collection.createIndex(
        { itemType: 1 },
        { name: 'idx_itemType' }
      );
      indexesCreated.push('idx_itemType');
      console.log(`[Migration] Created index: idx_itemType`);
    } catch (error: any) {
      if (error.code !== 85 /* Index already exists */) {
        throw error;
      }
      console.log(`[Migration] Index 'idx_itemType' already exists`);
    }

    // Create index on available for efficient filtering
    try {
      await collection.createIndex(
        { available: 1 },
        { name: 'idx_available' }
      );
      indexesCreated.push('idx_available');
      console.log(`[Migration] Created index: idx_available`);
    } catch (error: any) {
      if (error.code !== 85 /* Index already exists */) {
        throw error;
      }
      console.log(`[Migration] Index 'idx_available' already exists`);
    }

    // Create compound unique index on itemType and name for uniqueness
    try {
      await collection.createIndex(
        { itemType: 1, name: 1 },
        {
          name: 'idx_itemType_name_unique',
          unique: true
        }
      );
      indexesCreated.push('idx_itemType_name_unique');
      console.log(`[Migration] Created unique index: idx_itemType_name_unique`);
    } catch (error: any) {
      if (error.code !== 85 /* Index already exists */) {
        throw error;
      }
      console.log(`[Migration] Index 'idx_itemType_name_unique' already exists`);
    }

    // Create index on sequence for sorting
    try {
      await collection.createIndex(
        { sequence: 1 },
        { name: 'idx_sequence' }
      );
      indexesCreated.push('idx_sequence');
      console.log(`[Migration] Created index: idx_sequence`);
    } catch (error: any) {
      if (error.code !== 85 /* Index already exists */) {
        throw error;
      }
      console.log(`[Migration] Index 'idx_sequence' already exists`);
    }

    console.log(`[Migration] ✅ ${collectionName} migration completed successfully`);

    return {
      success: true,
      message: `${collectionName} migration completed successfully`,
      data: {
        indexesCreated,
        collectionCreated,
      },
    };
  } catch (error) {
    console.error(`[Migration] ❌ Error during ${collectionName} migration:`, error);
    return {
      success: false,
      message: `${collectionName} migration failed`,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Seed sample food modifiers for testing
 */
export async function seedSampleModifiers(): Promise<{
  success: boolean;
  message: string;
  seeded?: number;
  error?: string;
}> {
  try {
    console.log(`[Seed] Starting sample food modifiers seeding...`);

    const sampleModifiers: FoodModifier[] = [
      {
        name: 'Extra Cheese',
        description: 'Add extra cheese to your order',
        price: 2.00,
        itemType: 'all',
        available: true,
        isDefault: false,
        sequence: 1,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        name: 'Spicy Sauce',
        description: 'Add our signature spicy sauce',
        price: 0.50,
        itemType: 'portions',
        available: true,
        isDefault: false,
        sequence: 2,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        name: 'Gluten-Free Option',
        description: 'Make your order gluten-free',
        price: 1.50,
        itemType: 'simple',
        available: true,
        isDefault: false,
        sequence: 3,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        name: 'Double Portion',
        description: 'Double the portion size',
        price: 3.00,
        itemType: 'portions',
        available: true,
        isDefault: false,
        sequence: 4,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        name: 'Extra Sauce',
        description: 'Add extra sauce on the side',
        price: 0.75,
        itemType: 'all',
        available: true,
        isDefault: false,
        sequence: 5,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ];

    // Check if modifiers already exist
    const existingResult = await db.count<FoodModifier>('foodmodifiers', {});

    if (existingResult.success && existingResult.count && existingResult.count > 0) {
      console.log(`[Seed] Found ${existingResult.count} existing modifiers, skipping seed`);
      return {
        success: true,
        message: 'Sample modifiers already exist, skipping seed',
        seeded: 0,
      };
    }

    // Insert sample modifiers
    const result = await db.createMany<FoodModifier>('foodmodifiers', sampleModifiers);

    if (!result.success) {
      throw new Error(result.error || 'Failed to seed sample modifiers');
    }

    console.log(`[Seed] ✅ Successfully seeded ${result.ids?.length || 0} sample modifiers`);

    return {
      success: true,
      message: 'Sample modifiers seeded successfully',
      seeded: result.ids?.length || 0,
    };
  } catch (error) {
    console.error(`[Seed] ❌ Error seeding sample modifiers:`, error);
    return {
      success: false,
      message: 'Failed to seed sample modifiers',
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}
