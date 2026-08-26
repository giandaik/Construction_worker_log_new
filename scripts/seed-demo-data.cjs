// Seed realistic demo data for the Sitely landing screenshots
// Creates: 1 demo project + 2 worklogs (one fully signed/completed, one awaiting owner)
const { readFileSync } = require('fs');
const env = Object.fromEntries(
  readFileSync('.env.local', 'utf8')
    .split('\n')
    .filter((l) => l.includes('=') && !l.trim().startsWith('#'))
    .map((l) => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; })
);
const { MongoClient, ObjectId } = require('mongodb');

// A hand-drawn looking signature as SVG -> data URI
const sig = (name) =>
  `data:image/svg+xml;base64,${Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="220" height="90" viewBox="0 0 220 90"><rect width="220" height="90" fill="white"/><path d="M20 65 C 45 20, 70 75, 95 45 S 125 25, 145 50 S 175 35, 200 55" stroke="#1f2937" stroke-width="3" fill="none" stroke-linecap="round"/><text x="160" y="82" font-family="sans-serif" font-size="13" fill="#6b7280" font-style="italic">${name}</text></svg>`
  ).toString('base64')}`;

(async () => {
  const uri = env.MONGODB_URI;
  const dbName = new URL(uri.replace('mongodb+srv://', 'https://')).pathname.replace(/^\//, '').split('?')[0] || 'test';
  const c = new MongoClient(uri);
  await c.connect();
  const db = c.db(dbName);
  const users = db.collection('users');
  const projects = db.collection('projects');
  const worklogs = db.collection('worklogs');

  // Anchor user = test admin
  const admin = await users.findOne({ email: 'test@local.dev' });
  if (!admin) { console.error('test@local.dev not found'); process.exit(1); }
  const adminId = admin._id;

  // Demo project (idempotent: upsert by name)
  const projectName = 'Athens North — Block A';
  let proj = await projects.findOne({ name: projectName });
  if (!proj) {
    const res = await projects.insertOne({
      name: projectName,
      location: 'Kifisia, Athens',
      status: 'in-progress',
      ownerUserId: adminId,
      contractorUserId: adminId,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    proj = { _id: res.insertedId };
    console.log('project created:', proj._id);
  } else {
    console.log('project exists:', proj._id);
  }

  const now = new Date();
  const d1 = new Date(now); d1.setDate(now.getDate() - 1);
  const d2 = new Date(now);

  const baseLog = {
    project: proj._id,
    author: adminId,
    weather: 'sunny',
    temperature: 28,
    personnel: [
      { role: 'Σκυροδετητές', count: 6, workDetails: 'Έκχυση πλάκας ορόφου' },
      { role: 'Ξυλότυποι', count: 4, workDetails: 'Τοποθέτηση ξυλοτύπων' },
      { role: 'Οπλισμός', count: 3, workDetails: 'Δέσιμο οπλισμού' },
      { role: 'Χειριστές', count: 1, workDetails: 'Αντλία σκυροδέματος' },
    ],
    equipment: [
      { type: 'Αντλία σκυροδέματος', count: 1, hours: 6 },
      { type: 'Μπετονιέρα', count: 2, hours: 8 },
      { type: 'Γερανός πυργωτός', count: 1, hours: 8 },
    ],
    materials: [
      { name: 'Σκυρόδεμα C25/30', quantity: 42, unit: 'm³' },
      { name: 'Οπλισμός B500', quantity: 3.2, unit: 'τόνοι' },
      { name: 'Ξυλότυπος πλάκας', quantity: 180, unit: 'm²' },
    ],
    issues: '',
    notes: '',
    images: [],
    dwgRefs: [],
    createdAt: now,
    updatedAt: now,
  };

  // Worklog A — completed (both signatures) — for step 3 "Signed and filed"
  await worklogs.deleteMany({ project: proj._id });
  const logA = await worklogs.insertOne({
    ...baseLog,
    date: d1,
    workDescription:
      'Σκυροδέτηση πλάκης 2ου ορόφου. Ολοκληρώθηκε η έκχυση C25/30, τοποθέτηση οπλισμού και ο έλεγχος από τον επιβλέποντα μηχανικό.',
    signatures: [
      { data: sig('G. Papadakis'), signedBy: 'Γεώργιος Παπαδάκης', signedAt: d1, projectRole: 'contractor', signedByUserId: adminId },
      { data: sig('M. Stefanidis'), signedBy: 'Μιχάλης Στεφανίδης', signedAt: d1, projectRole: 'owner', signedByUserId: adminId },
    ],
    status: 'completed',
  });
  console.log('log A (completed):', logA.insertedId);

  // Log B — today, contractor signed, awaiting owner — for step 1/2
  const logB = await worklogs.insertOne({
    ...baseLog,
    date: d2,
    workDescription:
      'Τοποθέτηση ξελοτύπων και οπλισμού πλάκας 2ου ορόφου. Προετοιμασία για σκυροδέτηση αύριο.',
    signatures: [
      { data: sig('G. Papadakis'), signedBy: 'Γ. Παπαδάκης', signedAt: d2, projectRole: 'contractor', signedByUserId: adminId },
    ],
    status: 'signed',
  });
  console.log('log B (awaiting owner):', logB.insertedId);

  await c.close();
  console.log('DONE');
})().catch((e) => { console.error(e); process.exit(1); });
