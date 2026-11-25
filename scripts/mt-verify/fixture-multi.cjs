
const { MongoClient, ObjectId } = require('mongodb');
const bcrypt = require('bcryptjs');
(async () => {
  const c = new MongoClient('mongodb://127.0.0.1:28017/cwl_mt_test');
  await c.connect();
  const db = c.db('cwl_mt_test');
  const tA = await db.collection('tenants').findOne({ slug: 'alpha-constructions' });
  const tB = await db.collection('tenants').findOne({ slug: 'beta-builders' });
  const existing = await db.collection('users').findOne({ email: 'multi@x.test' });
  if (existing) { console.log('multi exists'); await c.close(); return; }
  const uid = new ObjectId();
  const now = new Date();
  await db.collection('users').insertOne({ _id: uid, name: 'Multi User', email: 'multi@x.test', password: bcrypt.hashSync('passwordM1!', 10), role: 'user', platformRole: null, createdAt: now, updatedAt: now });
  await db.collection('user_tenant_memberships').insertMany([
    { _id: new ObjectId(), userId: uid, tenantId: tA._id, tenantRole: 'WORKER', isActive: true, joinedAt: now, createdAt: now, updatedAt: now },
    { _id: new ObjectId(), userId: uid, tenantId: tB._id, tenantRole: 'WORKER', isActive: true, joinedAt: now, createdAt: now, updatedAt: now },
  ]);
  console.log('created multi', uid.toString());
  await c.close();
})().catch(e => { console.error(e.message); process.exit(1); });
