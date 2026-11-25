// Seed multi-tenant test data into local mongo :28017/cwl_mt_test
// superadmin@gmail.com / 12345$dl (as user gave), 2 tenants with admins+workers, projects, worklogs
const { MongoClient, ObjectId } = require('mongodb');
const bcrypt = require('bcryptjs');

(async () => {
  const c = new MongoClient((process.env.MT_DB_URI || 'mongodb://127.0.0.1:28017/cwl_mt_test'));
  await c.connect();
  const db = c.db(process.env.MT_DB_NAME || 'cwl_mt_test');
  const users = db.collection('users');
  const tenants = db.collection('tenants');
  const memberships = db.collection('user_tenant_memberships');
  const projects = db.collection('projects');
  const worklogs = db.collection('worklogs');

  // Clean slate
  await Promise.all([
    users.deleteMany({}), tenants.deleteMany({}), memberships.deleteMany({}),
    projects.deleteMany({}), worklogs.deleteMany({}),
  ]);

  const now = new Date();
  // Cost 12 to match PASSWORD_HASH_COST (lib/constants/security.ts). At 10 the
  // seeded accounts compare ~3x faster than the login route's dummy hash, so
  // the J8 timing check reports a user-enumeration oracle the app does not have.
  const hash = (p) => bcrypt.hashSync(p, 12);

  // SuperAdmin
  await users.insertOne({
    _id: new ObjectId(), name: 'Super Admin', email: 'superadmin@gmail.com',
    password: hash('12345$dl'), role: 'user', platformRole: 'SUPER_ADMIN',
    createdAt: now, updatedAt: now,
  });

  // Tenant A + B
  const tA = new ObjectId(), tB = new ObjectId();
  await tenants.insertMany([
    { _id: tA, name: 'Alpha Constructions', slug: 'alpha-constructions', status: 'active', plan: 'free', createdAt: now, updatedAt: now },
    { _id: tB, name: 'Beta Builders', slug: 'beta-builders', status: 'active', plan: 'free', createdAt: now, updatedAt: now },
  ]);

  const mkUser = async (name, email, pass, tenantId, tenantRole) => {
    const uid = new ObjectId();
    await users.insertOne({ _id: uid, name, email, password: hash(pass), role: 'user', platformRole: null, createdAt: now, updatedAt: now });
    await memberships.insertOne({ _id: new ObjectId(), userId: uid, tenantId, tenantRole, isActive: true, joinedAt: now, createdAt: now, updatedAt: now });
    return uid;
  };

  const adminA = await mkUser('Alice Admin', 'alice@alpha.test', 'passwordA1!', tA, 'ADMIN');
  const workerA = await mkUser('Nick Worker', 'nick@alpha.test', 'passwordA1!', tA, 'WORKER');
  const adminB = await mkUser('Bob Admin', 'bob@beta.test', 'passwordB1!', tB, 'ADMIN');
  const workerB = await mkUser('Vasilis Worker', 'vasilis@beta.test', 'passwordB1!', tB, 'WORKER');

  // The multi-tenant account J4/J5/J6 need: same person, WORKER in both orgs.
  // Without it those journeys cannot run at all (login → 401), so it belongs in
  // the seed rather than in a one-off repair script.
  const multiUid = new ObjectId();
  await users.insertOne({
    _id: multiUid, name: 'Multi Tenant', email: 'multi@x.test', password: hash('passwordM1!'),
    role: 'user', platformRole: null, createdAt: now, updatedAt: now,
  });
  await memberships.insertMany([
    { _id: new ObjectId(), userId: multiUid, tenantId: tA, tenantRole: 'WORKER', isActive: true, joinedAt: now, createdAt: now, updatedAt: now },
    { _id: new ObjectId(), userId: multiUid, tenantId: tB, tenantRole: 'WORKER', isActive: true, joinedAt: now, createdAt: now, updatedAt: now },
  ]);

  // Projects + worklogs per tenant
  const pA = new ObjectId(), pB = new ObjectId();
  await projects.insertMany([
    { _id: pA, name: 'Alpha — Kifisia Block A', location: 'Kifisia', status: 'in-progress', tenantId: tA, ownerUserId: adminA, contractorUserId: adminA, createdAt: now, updatedAt: now },
    { _id: pB, name: 'Beta — Marousi Site 1', location: 'Marousi', status: 'in-progress', tenantId: tB, ownerUserId: adminB, contractorUserId: adminB, createdAt: now, updatedAt: now },
  ]);
  await worklogs.insertMany([
    { _id: new ObjectId(), project: pA, author: workerA, tenantId: tA, date: now, weather: 'sunny', temperature: 28, notes: 'Alpha internal — secret footing plan', createdAt: now, updatedAt: now },
    { _id: new ObjectId(), project: pB, author: workerB, tenantId: tB, date: now, weather: 'cloudy', temperature: 24, notes: 'Beta internal — crane delivery schedule', createdAt: now, updatedAt: now },
  ]);

  console.log(JSON.stringify({ tA: tA.toString(), tB: tB.toString(), adminA: adminA.toString(), adminB: adminB.toString() }));
  await c.close();
})().catch((e) => { console.error(e); process.exit(1); });