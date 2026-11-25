
const { MongoClient, ObjectId } = require('mongodb');
const bcrypt = require('bcryptjs');
(async () => {
  const c = new MongoClient('mongodb://127.0.0.1:28017/cwl_mt_test');
  await c.connect();
  const db = c.db('cwl_mt_test');
  const t = await db.collection('tenants').findOne({ slug: 'alpha-constructions' });
  const now = new Date();
  await db.collection('users').deleteOne({ email: 'timing@alpha.test' });
  const uid = new ObjectId();
  await db.collection('users').insertOne({ _id: uid, name: 'Timing Probe', email: 'timing@alpha.test', password: bcrypt.hashSync('passwordT1!', 12), role: 'user', platformRole: null, createdAt: now, updatedAt: now });
  await db.collection('user_tenant_memberships').insertOne({ _id: new ObjectId(), userId: uid, tenantId: t._id, tenantRole: 'WORKER', isActive: true, joinedAt: now, createdAt: now, updatedAt: now });
  console.log('created timing probe account');
  await c.close();
})().catch(e => { console.error(e.message); process.exit(1); });
