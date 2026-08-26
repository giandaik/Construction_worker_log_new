// Rename junk projects to realistic demo names
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
  const projects = db.collection('projects');

  const rename = async (from, to, location) => {
    const r = await projects.updateOne({ name: from }, { $set: { name: to, ...(location ? { location } : {}) } });
    console.log(`${from} -> ${to}: matched=${r.matchedCount}`);
  };

  await rename('Default Project', 'Piraeus Port — Warehouse 12', 'Piraeus');
  await rename('meletis', 'Thessaloniki — Retail Unit', 'Thessaloniki');

  const all = await projects.find({}).toArray();
  console.log('projects now:', all.map((p) => p.name).join(' | '));
  await c.close();
  console.log('DONE');
})().catch((e) => { console.error(e); process.exit(1); });
