import { readFileSync } from 'node:fs';
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

const EMAIL = 'test@local.dev';
const PASSWORD = 'test1234';

const client = new MongoClient(uri);
try {
  await client.connect();
  const users = client.db(dbName).collection('users');

  const now = new Date();
  const passwordHash = await hash(PASSWORD, 12);

  const result = await users.updateOne(
    { email: EMAIL },
    {
      $set: {
        name: 'Test Local',
        email: EMAIL,
        password: passwordHash,
        role: 'admin',
        requiresPasswordReset: false,
        updatedAt: now,
      },
      $setOnInsert: { createdAt: now },
    },
    { upsert: true }
  );

  console.log(`DB: ${dbName}`);
  console.log(`User ${EMAIL} ready (matched=${result.matchedCount}, upserted=${result.upsertedCount}, modified=${result.modifiedCount}).`);
  console.log('Login with:');
  console.log(`  email:    ${EMAIL}`);
  console.log(`  password: ${PASSWORD}`);
} finally {
  await client.close();
}
