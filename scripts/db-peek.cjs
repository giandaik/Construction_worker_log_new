// Quick DB peek using the same env-loading trick as list-users.mjs
const { readFileSync } = require('fs');
const env = Object.fromEntries(
  readFileSync('.env.local', 'utf8')
    .split('\n')
    .filter((l) => l.includes('=') && !l.trim().startsWith('#'))
    .map((l) => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; })
);
const { MongoClient } = require('mongodb');
(async () => {
  const uri = env.MONGODB_URI;
  const dbName = new URL(uri.replace('mongodb+srv://', 'https://')).pathname.replace(/^\//, '').split('?')[0] || 'test';
  const c = new MongoClient(uri);
  await c.connect();
  const db = c.db(dbName);
  for (const n of ['users', 'projects', 'worklogs']) {
    try { console.log(n, '=>', await db.collection(n).countDocuments()); } catch (e) { console.log(n, 'ERR', e.message); }
  }
  const p = await db.collection('projects').find().limit(3).toArray();
  console.log('projects:', JSON.stringify(p.map((x) => ({ name: x.name, owner: x.ownerUserId, contractor: x.contractorUserId })), null, 1));
  const w = await db.collection('worklogs').find().sort({ createdAt: -1 }).limit(2).toArray();
  console.log('worklog sample:', w.length ? JSON.stringify({ keys: Object.keys(w[0]), status: w[0].status, project: w[0].projectId }, null, 1) : 'none');
  await c.close();
})().catch((e) => { console.error(e.message); process.exit(1); });
