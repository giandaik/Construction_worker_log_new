// Add more realistic worklogs for a fuller dashboard
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
  const proj = await projects.findOne({ name: 'Athens North — Block A' });
  const now = new Date();

  const entries = [
    {
      date: new Date(now.getTime() - 2 * 86400000),
      weather: 'cloudy',
      temperature: 24,
      workDescription: 'Οπλισμός πλάκας 2ου ορόφου — δέσιμο και τοποθέτηση B500. Έλεγχος στατικής επάρκειας από τον επιβλέποντα.',
      personnel: [{ role: 'Οπλισμός', count: 5, workDetails: 'Δέσιμο οπλισμού πλάκας' }, { role: 'Ξυλότυποι', count: 3, workDetails: 'Στήσιμο ξυλοτύπων περιμετρικά' }],
      equipment: [{ type: 'Γερανός πυργωτός', count: 1, hours: 7 }],
      materials: [{ name: 'Οπλισμός B500', quantity: 2.8, unit: 'τόνοι' }],
      signatures: [], status: 'pending',
    },
    {
      date: new Date(now.getTime() - 3 * 86400000),
      weather: 'sunny',
      temperature: 27,
      workDescription: 'Εκσκαφή θεμελίων και τοποθέτηση στρώσης έδρασης. Έλεγχος υψομέτρων με τοπογραφικό συνεργείο.',
      personnel: [{ role: 'Χωματουργικά', count: 4, workDetails: 'Εκσκαφή' }, { role: 'Τοπογράφοι', count: 2, workDetails: 'Έλεγχος υψομέτρων' }],
      equipment: [{ type: 'Εκσκαφέας', count: 1, hours: 6 }, { type: 'Φορτηγό', count: 2, hours: 5 }],
      materials: [{ name: 'Σκυρόδεμα C12/15', quantity: 18, unit: 'm³' }],
      signatures: [], status: 'pending',
    },
    {
      date: new Date(now.getTime() - 4 * 86400000),
      weather: 'sunny',
      temperature: 26,
      workDescription: 'Καθαρισμός οικοπέδου και χάραξη. Εγκατάσταση οικίσκου εργοταξίου και προσωρινής παροχής ρεύματος.',
      personnel: [{ role: 'Γενικά καθήκοντα', count: 3, workDetails: 'Καθαρισμός & διαμόρφωση' }],
      equipment: [{ type: 'Φορτωτή', count: 1, hours: 4 }],
      materials: [],
      signatures: [], status: 'pending',
    },
  ];

  for (const e of entries) {
    await worklogs.insertOne({
      project: proj._id,
      author: admin._id,
      date: e.date,
      weather: e.weather || 'sunny',
      temperature: e.temperature,
      workDescription: e.workDescription,
      personnel: e.personnel,
      equipment: e.equipment || [],
      materials: e.materials || [],
      issues: '',
      notes: '',
      images: [],
      dwgRefs: [],
      signatures: e.signatures,
      status: e.status,
      createdAt: e.date,
      updatedAt: e.date,
    });
  }
  console.log('added', entries.length, 'realistic worklogs');
  await c.close();
  console.log('DONE');
})().catch((e) => { console.error(e); process.exit(1); });
