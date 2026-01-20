/**
 * Helper script to generate bcrypt password hashes for admin users
 *
 * Usage:
 *   node scripts/hash-password.mjs <password>
 *
 * Example:
 *   node scripts/hash-password.mjs MySecurePassword123
 */

import bcrypt from 'bcryptjs';

const password = process.argv[2];

if (!password) {
  console.error('Error: Password is required');
  console.log('\nUsage:');
  console.log('  node scripts/hash-password.mjs <password>');
  console.log('\nExample:');
  console.log('  node scripts/hash-password.mjs MySecurePassword123');
  process.exit(1);
}

const hash = bcrypt.hashSync(password, 10);

console.log('\nPassword hashed successfully!\n');
console.log('Hashed password:');
console.log(hash);
console.log('\nUse this hash in your MongoDB user document:');
console.log(`
db.users.insertOne({
  email: "admin@nikfoods.com",
  password: "${hash}",
  role: "ADMIN",
  name: "Admin User",
  isCompleted: true,
  createdAt: new Date(),
  updatedAt: new Date()
})
`);
