/**
 * One-time migration: find users with SHA-256 password hashes and replace
 * them with bcrypt hashes + a temporary password.
 *
 * SHA-256 hashes are 64-char lowercase hex strings.
 * bcrypt hashes always start with $2b$.
 *
 * Run from the project root:
 *   node scripts/migrate-sha256-passwords.mjs
 *
 * The script is idempotent — safe to run more than once.
 */

import { readFileSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
import { MongoClient } from 'mongodb';
import { hash } from 'bcryptjs';

const env = Object.fromEntries(
  readFileSync('.env.local', 'utf8')
    .split('\n')
    .filter((l) => l.includes('=') && !l.trim().startsWith('#'))
    .map((l) => {
      const i = l.indexOf('=');
      return [l.slice(0, i).trim(), l.slice(i + 1).trim()];
    })
);

const uri = env.MONGODB_URI;
if (!uri) {
  console.error('MONGODB_URI not found in .env.local');
  process.exit(1);
}

const dbName = new URL(uri.replace('mongodb+srv://', 'https://'))
  .pathname.replace(/^\//, '')
  .split('?')[0] || 'test';

const SHA256_PATTERN = /^[0-9a-f]{64}$/;

function tempPassword() {
  return randomBytes(9).toString('base64url'); // 12 URL-safe chars
}

const client = new MongoClient(uri);
try {
  await client.connect();
  const users = client.db(dbName).collection('users');

  const allUsers = await users.find({}).toArray();
  const stale = allUsers.filter(
    (u) => u.password && SHA256_PATTERN.test(u.password)
  );

  if (stale.length === 0) {
    console.log('No SHA-256 password hashes found. Nothing to migrate.');
    process.exit(0);
  }

  console.log(`Found ${stale.length} user(s) with SHA-256 password hashes:\n`);

  const report = [];

  for (const user of stale) {
    const temp = tempPassword();
    const bcryptHash = await hash(temp, 12);

    await users.updateOne(
      { _id: user._id },
      {
        $set: {
          password: bcryptHash,
          requiresPasswordReset: true,
          updatedAt: new Date(),
        },
      }
    );

    report.push({ email: user.email, name: user.name, tempPassword: temp });
    console.log(`  ✓ ${user.email} (${user.name})`);
  }

  console.log('\n--- Temporary credentials (share securely, then delete) ---');
  for (const { email, name, tempPassword } of report) {
    console.log(`  ${email}  →  ${tempPassword}`);
  }
  console.log('\nAll migrated users have requiresPasswordReset: true.');
  console.log('They can log in with the temp password above and must change it.');
} finally {
  await client.close();
}
