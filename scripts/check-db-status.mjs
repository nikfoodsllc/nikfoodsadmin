#!/usr/bin/env node

/**
 * Database Status Script
 *
 * This script checks the current status of the database, specifically:
 * 1. Checks if available days exist in the database
 * 2. Checks if admin users exist
 * 3. Provides information needed to proceed with seeding
 *
 * Usage:
 *   node scripts/check-db-status.mjs
 */

import { db } from '../src/lib/db.js';

async function checkDaysStatus() {
  console.log('🔍 Checking available days in database...');

  try {
    const daysResult = await db.read('availableDays', {
      sort: { sequence: 1 }
    });

    if (daysResult.success && daysResult.data) {
      const days = daysResult.data;
      console.log(`\n📊 Available Days Status:`);
      console.log(`   - Total days: ${days.length}`);

      if (days.length > 0) {
        console.log(`   - Days found:`);
        days.forEach(day => {
          console.log(`     * ${day.label} (${day.day}) - Enabled: ${day.enabled} - Sequence: ${day.sequence}`);
        });
        console.log(`   ✅ Database already contains days data`);
      } else {
        console.log(`   ❌ No days found in database`);
        console.log(`   🔄 Seeding is needed`);
      }
    } else {
      console.log(`   ❌ Error checking days: ${daysResult.error}`);
    }
  } catch (error) {
    console.error('❌ Error checking days status:', error.message);
  }
}

async function checkAdminUsers() {
  console.log('\n🔍 Checking admin users in database...');

  try {
    const adminResult = await db.read('users', { role: 'ADMIN' });

    if (adminResult.success && adminResult.data) {
      const admins = adminResult.data;
      console.log(`\n👤 Admin Users Status:`);
      console.log(`   - Total admin users: ${admins.length}`);

      if (admins.length > 0) {
        console.log(`   - Admin users found:`);
        admins.forEach(admin => {
          console.log(`     * ${admin.email} - Active: ${admin.isActive !== false} - Completed: ${admin.isCompleted}`);
        });
        console.log(`   ✅ Admin users exist for authentication`);
      } else {
        console.log(`   ❌ No admin users found`);
        console.log(`   🔄 Need to create admin user first`);
        console.log(`   💡 Use the following commands:`);
        console.log(`      1. Hash password: node scripts/hash-password.mjs YourPassword123`);
        console.log(`      2. Insert admin user manually in MongoDB`);
      }
    } else {
      console.log(`   ❌ Error checking admin users: ${adminResult.error}`);
    }
  } catch (error) {
    console.error('❌ Error checking admin users status:', error.message);
  }
}

async function main() {
  console.log('🚀 Database Status Check\n');
  console.log('=====================================');

  await checkDaysStatus();
  await checkAdminUsers();

  console.log('\n=====================================');
  console.log('✅ Database status check completed\n');

  console.log('Next Steps:');
  console.log('1. If no admin users exist, create one first');
  console.log('2. If no days exist, run the seed endpoint');
  console.log('3. Use admin credentials to get JWT token');
  console.log('4. Call POST /api/admin/days/seed with the token');
}

main().catch(console.error);