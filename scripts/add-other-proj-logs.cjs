// Add one worklog to each other project for variety
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
  const users = db.collection('users');
  const projects = db.collection('projects');
  const worklogs = db.collection('worklogs');

  const admin = await users.findOne({ email: 'test@local.dev' });
  const now = new Date();

  const entries = [
    {
      projName: 'Piraeus Port — Warehouse 12',
      date: new Date(now.getTime() - 1 * 86400000),
      weather: 'sunny', temperature: 26,
      workDescription: 'Αντικατάσταση στεγάνωσης δώματος και καθαρισμός υδρορροών αποθήκης 12.',
      personnel: [{ role: 'Στεγανοποιήσεις', count: 3, workDetails: 'Στεγανοποίηση δώματος' }],
      equipment: [{ type: 'Καλαθοφόρο όχημα', count: 1, hours: 6 }],
      materials: [{ name: 'Μεμβράνη PVC', quantity: 120, unit: 'm²' }],
      status: 'pending',
    },
    {
      projName: 'Thessaloniki — Retail Unit',
      date: new Date(now.getTime() - 2 * 86400000),
      weather: 'cloudy',
      temperature: 22,
      workDescription: 'Εσωτερικές εργασίες διαμόρφωσης — ηλεκτρολογικές γραμμές και ψευδοροφή.',
      personnel: [{ role: 'Ηλεκτρολόγοι', count: 2, workDetails: 'Γραμμώσεις' }, { role: 'Σοβατζήδες', count: 2, workDetails: 'Ψευδοροφή' }],
      equipment: [],
      materials: [{ name: 'Γυψοσανίδα', quantity: 60, unit: 'm²' }],
      status: 'pending',
    },
  ];

  for (const e of entries) {
    const proj = await projects.findOne({ name: e.projName });
    if (!proj) { console.log('skip missing project', e.projName); continue; }
    await worklogs.insertOne({
      project: proj._id,
      author: admin._id,
      date: e.date,
      weather: e.weather,
      temperature: e.temperature,
      workDescription: e.workDescription,
      personnel: e.personnel,
      equipment: e.equipment || [],
      materials: e.materials || [],
      issues: '',
      notes: '',
      images: [],
      dwgRefs: [],
      signatures: [],
      status: e.status,
      createdAt: e.date,
      updatedAt: e.date,
    });
    console.log('added log to', e.projName);
  }
  await c.close();
  console.log('DONE');
})().catch((e) => { console.error(e); process.exit(1); });
