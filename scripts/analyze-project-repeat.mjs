import { readFileSync } from 'node:fs';
import { MongoClient } from 'mongodb';

// Load .env.local the same way list-users.mjs does.
const env = Object.fromEntries(
  readFileSync('.env.local', 'utf8')
    .split('\n')
    .filter((l) => l.includes('=') && !l.trim().startsWith('#'))
    .map((l) => {
      const i = l.indexOf('=');
      return [l.slice(0, i).trim(), l.slice(i + 1).trim()];
    }),
);

const uri = env.MONGODB_URI;
if (!uri) {
  console.error('MONGODB_URI not found in .env.local');
  process.exit(1);
}

const dbName =
  new URL(uri.replace('mongodb+srv://', 'https://')).pathname
    .replace(/^\//, '')
    .split('?')[0] || 'test';

const client = new MongoClient(uri);

try {
  await client.connect();
  const logs = await client
    .db(dbName)
    .collection('worklogs')
    .find(
      {},
      { projection: { author: 1, project: 1, createdAt: 1, date: 1, _id: 0 } },
    )
    .toArray();

  const totalLogs = logs.length;
  if (totalLogs === 0) {
    console.log(`DB: ${dbName} — no worklogs found.`);
    process.exit(0);
  }

  // Group logs by author, ordered by createdAt (true action sequence).
  const byAuthor = new Map();
  for (const log of logs) {
    if (!log.author || !log.project) continue;
    const key = String(log.author);
    if (!byAuthor.has(key)) byAuthor.set(key, []);
    byAuthor.get(key).push(log);
  }
  for (const arr of byAuthor.values()) {
    arr.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
  }

  // Headline: default-to-last-project accuracy.
  // For each log with a prior log by the same author, was its project the same
  // as the immediately preceding log's project? That == the accuracy of a
  // "default the new form to the author's most recent project" rule.
  let comparableLogs = 0;
  let repeats = 0;
  let singleAuthorLogs = 0; // logs by authors who only ever touched one project
  const distinctBuckets = { 1: 0, 2: 0, 3: 0, '4+': 0 };

  for (const [, arr] of byAuthor) {
    const distinct = new Set(arr.map((l) => String(l.project))).size;
    distinctBuckets[distinct >= 4 ? '4+' : String(distinct)] += 1;
    if (distinct === 1) singleAuthorLogs += arr.length;

    for (let i = 1; i < arr.length; i++) {
      comparableLogs += 1;
      if (String(arr[i].project) === String(arr[i - 1].project)) repeats += 1;
    }
  }

  const distinctAuthors = byAuthor.size;
  const distinctProjects = new Set(logs.map((l) => String(l.project))).size;
  const repeatRate = comparableLogs ? (repeats / comparableLogs) * 100 : 0;
  const singleAuthorShare = (singleAuthorLogs / totalLogs) * 100;

  const pct = (n) => `${n.toFixed(1)}%`;

  console.log(`DB: ${dbName}`);
  console.log('─'.repeat(52));
  console.log(`Worklogs:        ${totalLogs}`);
  console.log(`Authors:         ${distinctAuthors}`);
  console.log(`Projects:        ${distinctProjects}`);
  console.log('─'.repeat(52));
  console.log('DEFAULT-TO-LAST-PROJECT ACCURACY');
  console.log(`  Comparable logs (have a prior by same author): ${comparableLogs}`);
  console.log(`  Same project as previous log:                 ${repeats}`);
  console.log(`  ➜ Repeat rate: ${pct(repeatRate)}`);
  console.log('─'.repeat(52));
  console.log('PROJECT CONCENTRATION PER AUTHOR');
  console.log(`  Authors with 1 project:   ${distinctBuckets[1]}`);
  console.log(`  Authors with 2 projects:  ${distinctBuckets[2]}`);
  console.log(`  Authors with 3 projects:  ${distinctBuckets[3]}`);
  console.log(`  Authors with 4+ projects: ${distinctBuckets['4+']}`);
  console.log(`  Logs from single-project authors: ${singleAuthorLogs} (${pct(singleAuthorShare)} of all logs)`);
} finally {
  await client.close();
}
