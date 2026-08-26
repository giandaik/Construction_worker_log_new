// Backup old test worklogs, keep only demo data
const { readFileSync, writeFileSync } = require('fs');
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
  const worklogs = db.collection('worklogs');

  // Keep only the 2 demo logs (Athens North project), backup the rest
  const proj = await db.collection('projects').findOne({ name: 'Athens North — Block A' });
  const demoLogs = await worklogs.find({ project: proj._id }).toArray();
  const demoIds = demoLogs.map((l) => l._id);

  const old = await worklogs.find({ _id: { $nin: demoIds } }).toArray();
  writeFileSync('/tmp/old-worklogs-backup.json', JSON.stringify(old, null, 2));
  console.log('backed up', old.length, 'old worklogs to /tmp/old-worklogs-backup.json');

  const del = await worklogs.deleteMany({ _id: { $nin: demoIds } });
  console.log('deleted', del.deletedCount);

  // Also cleanup junk projects except the demo + meletis? Keep Default Project & meletis (harmless), but remove their worklogs only.
  // Soften: also remove worklogs of Default Project & meletis to keep dashboard clean
  const demoProjIds = [proj._id];
  const junk = await worklogs.find({ project: { $nin: demoProjIds } }).toArray();
  if (junk.length) {
    const r = await worklogs.deleteMany({ project: { $nin: demoProjIds } });
    console.log('removed', r.deletedCount, 'junk worklogs from other projects');
  }

  const remaining = await worklogs.countDocuments();
  console.log('remaining worklogs:', remaining);
  await c.close();
  console.log('DONE');
})().catch((e) => { console.error(e); process.exit(1); });
