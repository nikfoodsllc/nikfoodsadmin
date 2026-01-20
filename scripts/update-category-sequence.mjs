/**
 * Migration script to add sequence field to existing food categories
 *
 * This script assigns sequential values to existing categories based on their creation date
 * to maintain backward compatibility while enabling the new sequence-based sorting feature.
 *
 * Usage:
 *   node scripts/update-category-sequence.mjs
 */

import { db } from '../src/lib/db.js';

async function updateCategorySequence() {
  try {
    console.log('Starting migration: Adding sequence field to existing food categories...');

    // Find all categories that don't have a sequence field
    const result = await db.read('foodcategories', {
      sequence: { $exists: false }
    }, {
      sort: { createdAt: 1 }
    });

    if (!result.success) {
      throw new Error('Failed to fetch categories: ' + result.error);
    }

    const categories = result.data || [];

    if (categories.length === 0) {
      console.log('✅ No categories need sequence field updates. All categories already have sequence values.');
      return;
    }

    console.log(`Found ${categories.length} categories without sequence field`);

    // Get the highest existing sequence number
    const maxSequenceResult = await db.read('foodcategories', {
      sequence: { $exists: true }
    }, {
      sort: { sequence: -1 },
      limit: 1
    });

    let startSequence = 1;
    if (maxSequenceResult.success && maxSequenceResult.data && maxSequenceResult.data.length > 0) {
      const highestSeq = maxSequenceResult.data[0].sequence || 0;
      startSequence = highestSeq + 1;
    }

    console.log(`Starting sequence assignment from ${startSequence}`);

    // Update each category with a sequence value
    let updateCount = 0;
    for (let i = 0; i < categories.length; i++) {
      const category = categories[i];
      const sequenceValue = startSequence + i;

      const updateResult = await db.updateOne('foodcategories', {
        _id: category._id
      }, {
        $set: {
          sequence: sequenceValue,
          updatedAt: new Date()
        }
      });

      if (!updateResult.success) {
        console.error(`❌ Failed to update category ${category._id}: ${updateResult.error}`);
        continue;
      }

      updateCount++;
      console.log(`✅ Updated "${category.name}" with sequence ${sequenceValue}`);
    }

    console.log(`\n🎉 Migration completed successfully!`);
    console.log(`   - Total categories processed: ${categories.length}`);
    console.log(`   - Successfully updated: ${updateCount}`);
    console.log(`   - Failed updates: ${categories.length - updateCount}`);

  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

// Run the migration
updateCategorySequence()
  .then(() => {
    console.log('\nMigration script finished successfully.');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Unexpected error:', error);
    process.exit(1);
  });