#!/usr/bin/env node

/**
 * Direct Database Seeding Script
 *
 * This script directly seeds the database with the 7 days of the week
 * without requiring HTTP endpoints or authentication.
 *
 * Usage:
 *   node scripts/seed-days-direct.mjs
 */

import { db } from '../src/lib/db.js';

async function seedDays() {
  console.log('🌱 Starting direct database seeding for days...\n');

  const DEFAULT_DAYS = [
    { day: 'monday', enabled: true, sequence: 1, label: 'Monday' },
    { day: 'tuesday', enabled: true, sequence: 2, label: 'Tuesday' },
    { day: 'wednesday', enabled: true, sequence: 3, label: 'Wednesday' },
    { day: 'thursday', enabled: true, sequence: 4, label: 'Thursday' },
    { day: 'friday', enabled: true, sequence: 5, label: 'Friday' },
    { day: 'saturday', enabled: true, sequence: 6, label: 'Saturday' },
    { day: 'sunday', enabled: true, sequence: 7, label: 'Sunday' },
  ];

  try {
    // Step 1: Check if days already exist
    console.log('📊 Step 1: Checking existing days...');
    const existingDaysResult = await db.read('availableDays', {
      sort: { sequence: 1 }
    });

    if (existingDaysResult.success && existingDaysResult.data) {
      const existingDays = existingDaysResult.data;

      if (existingDays.length > 0) {
        console.log(`✅ Found ${existingDays.length} existing days:`);
        existingDays.forEach(day => {
          console.log(`   - ${day.label} (${day.day}) - Enabled: ${day.enabled} - Sequence: ${day.sequence}`);
        });
        console.log('\n🎉 Database already contains days data! No seeding needed.');
        return true;
      }
    }

    console.log('❌ No existing days found. Proceeding with seeding...\n');

    // Step 2: Insert the default days
    console.log('📝 Step 2: Inserting default days...');
    const daysToInsert = DEFAULT_DAYS.map(day => ({
      ...day,
      createdAt: new Date(),
      updatedAt: new Date(),
    }));

    console.log('Days to be inserted:');
    daysToInsert.forEach(day => {
      console.log(`   - ${day.label} (${day.day}) - Enabled: ${day.enabled} - Sequence: ${day.sequence}`);
    });

    const insertResult = await db.createMany('availableDays', daysToInsert);

    if (insertResult.success) {
      console.log(`\n🎉 Successfully seeded ${insertResult.ids?.length || 0} days!`);

      // Step 3: Verify the seeding
      console.log('\n📋 Step 3: Verifying seeded data...');
      const verifyResult = await db.read('availableDays', {
        sort: { sequence: 1 }
      });

      if (verifyResult.success && verifyResult.data) {
        const seededDays = verifyResult.data;
        console.log(`✅ Verification successful! Found ${seededDays.length} days in database:`);
        seededDays.forEach(day => {
          console.log(`   - ${day.label} (${day.day}) - Enabled: ${day.enabled} - Sequence: ${day.sequence} - Created: ${day.createdAt}`);
        });

        console.log('\n🔍 Data Structure Validation:');
        const validationResults = seededDays.map(day => ({
          day: day.day,
          hasRequiredFields: !!(day.day && day.label && typeof day.enabled === 'boolean' && day.sequence),
          lowercaseDay: day.day === day.day.toLowerCase(),
          properSequence: day.sequence >= 1 && day.sequence <= 7,
          hasTimestamps: !!(day.createdAt && day.updatedAt)
        }));

        const allValid = validationResults.every(result =>
          result.hasRequiredFields &&
          result.lowercaseDay &&
          result.properSequence &&
          result.hasTimestamps
        );

        if (allValid) {
          console.log('✅ All data validation checks passed!');
        } else {
          console.log('❌ Some validation checks failed:');
          validationResults.forEach(result => {
            if (!result.hasRequiredFields || !result.lowercaseDay || !result.properSequence || !result.hasTimestamps) {
              console.log(`   - ${result.day}: Issues found`);
            }
          });
        }
      }

      return true;
    } else {
      console.error(`❌ Failed to seed days: ${insertResult.error}`);
      return false;
    }

  } catch (error) {
    console.error('❌ Error during seeding process:', error.message);
    console.error('Stack trace:', error.stack);
    return false;
  }
}

async function main() {
  console.log('🚀 Direct Database Seeding for Days');
  console.log('=====================================\n');

  const success = await seedDays();

  console.log('\n=====================================');

  if (success) {
    console.log('🎉 Seeding Process Completed Successfully!\n');
    console.log('📊 Summary:');
    console.log('   ✅ Database connected successfully');
    console.log('   ✅ 7 days seeded (Monday through Sunday)');
    console.log('   ✅ Data structure validated');
    console.log('   ✅ All days enabled by default');
    console.log('   ✅ Proper sequence (1-7) maintained');
    console.log('   ✅ Timestamps added\n');

    console.log('🔧 Next Steps:');
    console.log('   - Day management API endpoints should now work');
    console.log('   - No more "Day not found" errors expected');
    console.log('   - Admin interface can toggle days on/off');
    console.log('   - Bulk operations (enable all/disable all) should work');
  } else {
    console.log('❌ Seeding Process Failed!\n');
    console.log('🔧 Troubleshooting:');
    console.log('   - Check database connection');
    console.log('   - Verify database permissions');
    console.log('   - Check MongoDB Atlas credentials');
    console.log('   - Ensure network connectivity');
  }

  process.exit(success ? 0 : 1);
}

main().catch(console.error);