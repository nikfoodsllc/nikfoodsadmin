#!/usr/bin/env node

/**
 * Seed Days with Authentication Script
 *
 * This script:
 * 1. Checks if admin users exist, creates one if needed
 * 2. Checks if days exist, seeds them if needed
 * 3. Handles the entire seeding process with proper authentication
 *
 * Usage:
 *   node scripts/seed-days-with-auth.mjs [admin-email] [admin-password]
 */

import { db } from '../src/lib/db.js';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

// Default admin credentials (can be overridden via command line)
const DEFAULT_ADMIN_EMAIL = 'admin@nikfoods.com';
const DEFAULT_ADMIN_PASSWORD = 'Admin123456!';

function generateToken(userId, role, expiresIn = '7d') {
  const payload = {
    userId,
    role,
    iat: Math.floor(Date.now() / 1000)
  };

  const privateKey = process.env.PRIVATE_KEY || 'kLsk4Nde6I6pE6qTiKi03KQz3q1Kw';

  return jwt.sign(payload, privateKey, {
    algorithm: 'HS256',
    expiresIn
  });
}

async function createAdminUser(email, password) {
  console.log(`👤 Creating admin user: ${email}`);

  try {
    // Check if admin already exists
    const existingAdmin = await db.readOne('users', { email });

    if (existingAdmin.success && existingAdmin.data) {
      console.log(`✅ Admin user already exists: ${email}`);
      return existingAdmin.data;
    }

    // Hash the password
    const hashedPassword = bcrypt.hashSync(password, 10);

    // Create admin user
    const adminUser = {
      email,
      password: hashedPassword,
      role: 'ADMIN',
      name: 'System Administrator',
      isCompleted: true,
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    const result = await db.create('users', adminUser);

    if (result.success) {
      console.log(`✅ Admin user created successfully: ${email}`);
      return { ...adminUser, _id: result.id };
    } else {
      console.error(`❌ Failed to create admin user: ${result.error}`);
      return null;
    }
  } catch (error) {
    console.error('❌ Error creating admin user:', error.message);
    return null;
  }
}

async function checkDaysStatus() {
  console.log('🔍 Checking available days in database...');

  try {
    const daysResult = await db.read('availableDays', {
      sort: { sequence: 1 }
    });

    if (daysResult.success && daysResult.data) {
      const days = daysResult.data;
      console.log(`📊 Found ${days.length} days in database`);

      if (days.length > 0) {
        console.log('✅ Days already exist:');
        days.forEach(day => {
          console.log(`   - ${day.label} (${day.day}) - Enabled: ${day.enabled}`);
        });
        return true; // Days already exist
      }
    }

    console.log('❌ No days found in database');
    return false; // Days don't exist
  } catch (error) {
    console.error('❌ Error checking days status:', error.message);
    return false;
  }
}

async function seedDays() {
  console.log('🌱 Starting days seeding process...');

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
    const daysToInsert = DEFAULT_DAYS.map(day => ({
      ...day,
      createdAt: new Date(),
      updatedAt: new Date(),
    }));

    const insertResult = await db.createMany('availableDays', daysToInsert);

    if (insertResult.success) {
      console.log(`🎉 Successfully seeded ${insertResult.ids?.length || 0} days!`);
      console.log('Seeded days:');
      daysToInsert.forEach(day => {
        console.log(`   - ${day.label} (${day.day}) - Enabled: ${day.enabled} - Sequence: ${day.sequence}`);
      });
      return true;
    } else {
      console.error(`❌ Failed to seed days: ${insertResult.error}`);
      return false;
    }
  } catch (error) {
    console.error('❌ Error seeding days:', error.message);
    return false;
  }
}

async function callSeedEndpoint(token) {
  console.log('🔄 Calling seed endpoint with authentication...');

  try {
    // Import the seed function directly
    const { POST } = await import('../src/lib/migrations/seed-days.js');

    // Create a mock request with authorization header
    const mockRequest = {
      headers: {
        get: (name) => name === 'authorization' ? `Bearer ${token}` : null
      }
    };

    // Call the POST function
    const result = await POST(mockRequest);

    if (result.status === 200) {
      const responseData = await result.json();
      console.log('✅ Seed endpoint called successfully!');
      console.log('Response:', responseData);
      return true;
    } else {
      const errorData = await result.json();
      console.error(`❌ Seed endpoint returned error (${result.status}):`, errorData);
      return false;
    }
  } catch (error) {
    console.error('❌ Error calling seed endpoint:', error.message);
    return false;
  }
}

async function main() {
  console.log('🚀 Starting Seed Days Process\n');
  console.log('=====================================');

  // Get admin credentials from command line or use defaults
  const adminEmail = process.argv[2] || DEFAULT_ADMIN_EMAIL;
  const adminPassword = process.argv[3] || DEFAULT_ADMIN_PASSWORD;

  console.log(`📧 Admin Email: ${adminEmail}`);
  console.log(`🔑 Using provided password or default`);

  // Step 1: Create admin user
  console.log('\n📍 Step 1: Setting up admin user...');
  const adminUser = await createAdminUser(adminEmail, adminPassword);

  if (!adminUser) {
    console.error('❌ Failed to create or find admin user. Aborting.');
    process.exit(1);
  }

  // Step 2: Check if days already exist
  console.log('\n📍 Step 2: Checking existing days...');
  const daysExist = await checkDaysStatus();

  if (daysExist) {
    console.log('✅ Days already exist. Process completed successfully!');
    process.exit(0);
  }

  // Step 3: Generate JWT token
  console.log('\n📍 Step 3: Generating authentication token...');
  const token = generateToken(adminUser._id.toString(), 'admin');
  console.log('✅ JWT token generated successfully');

  // Step 4: Seed the days
  console.log('\n📍 Step 4: Seeding days...');
  const seedSuccess = await seedDays();

  if (!seedSuccess) {
    console.error('❌ Failed to seed days. Trying alternative method...');

    // Alternative: Call the seed endpoint
    const endpointSuccess = await callSeedEndpoint(token);
    if (!endpointSuccess) {
      console.error('❌ Both seeding methods failed. Aborting.');
      process.exit(1);
    }
  }

  console.log('\n=====================================');
  console.log('🎉 Seed Days Process Completed Successfully!\n');

  console.log('📊 Summary:');
  console.log(`   - Admin User: ${adminEmail}`);
  console.log(`   - Days Seeded: 7 (Monday through Sunday)`);
  console.log(`   - Database: MongoDB Atlas`);

  console.log('\n✅ The database now contains all necessary days data!');
  console.log('✅ Day management functionality should now work without errors!');
}

main().catch(console.error);