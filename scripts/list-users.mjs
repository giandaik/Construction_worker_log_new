import { readFileSync } from 'node:fs';
import { MongoClient } from 'mongodb';

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

const dbName = new URL(uri.replace('mongodb+srv://', 'https://')).pathname.replace(/^\//, '').split('?')[0] || 'test';

const client = new MongoClient(uri);
try {
  await client.connect();
  const users = await client
    .db(dbName)
    .collection('users')
    .find({}, { projection: { email: 1, role: 1, name: 1, createdAt: 1, _id: 0 } })
    .toArray();

  console.log(`DB: ${dbName}`);
  console.log(`Found ${users.length} user(s):`);
  for (const u of users) {
    console.log(`  - ${u.email}  [${u.role || 'no role'}]  name=${u.name || '?'}  created=${u.createdAt?.toISOString?.() || '?'}`);
  }
} finally {
  await client.close();
}
