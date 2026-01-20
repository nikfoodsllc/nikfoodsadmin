/**
 * Script to check the availableDays collection in the database
 * Run with: node scripts/check-available-days.js
 */

require('dotenv').config({ path: '.env.local' });
const { MongoClient } = require('mongodb');

async function checkAvailableDays() {
  const client = new MongoClient(process.env.DATABASE_URL);

  try {
    await client.connect();
    console.log('✅ Connected to database');

    const db = client.db();
    const collection = db.collection('availableDays');

    // Count documents
    const count = await collection.countDocuments();
    console.log(`\n📊 Total documents in availableDays: ${count}\n`);

    if (count === 0) {
      console.log('⚠️  No documents found in availableDays collection');
      return;
    }

    // Fetch all documents
    const days = await collection.find({}).sort({ sequence: 1 }).toArray();

    console.log('📋 All days in database:');
    console.log('========================\n');

    days.forEach(day => {
      console.log(`Day: ${day.day}`);
      console.log(`  Label: ${day.label || '(none)'}`);
      console.log(`  Enabled: ${day.enabled ? '✅' : '❌'}`);
      console.log(`  Sequence: ${day.sequence}`);
      console.log(`  ID: ${day._id}`);
      console.log(`  Created: ${day.createdAt}`);
      console.log(`  Updated: ${day.updatedAt}`);
      console.log('');
    });

    console.log('========================');
    console.log(`\n✅ Enabled days: ${days.filter(d => d.enabled).map(d => d.day).join(', ')}`);
    console.log(`❌ Disabled days: ${days.filter(d => !d.enabled).map(d => d.day).join(', ')}`);

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await client.close();
    console.log('\n🔌 Database connection closed');
  }
}

checkAvailableDays();
