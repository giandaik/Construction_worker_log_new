// One-off: add the multi-tenant fixture account to the LIVE mt-test db without
// wiping it (the owner may be using that database from the browser).
import { MongoClient, ObjectId } from 'mongodb';
import bcrypt from 'bcryptjs';

const c = new MongoClient((process.env.MT_DB_URI || 'mongodb://127.0.0.1:28017/cwl_mt_test'));
await c.connect();
const db = c.db(process.env.MT_DB_NAME || 'cwl_mt_test');

const exists = await db.collection('users').findOne({ email: 'multi@x.test' });
if (exists) {
  console.log('multi@x.test already present:', exists._id.toString());
} else {
  const now = new Date();
  const alpha = await db.collection('tenants').findOne({ slug: 'alpha-constructions' });
  const beta = await db.collection('tenants').findOne({ slug: 'beta-builders' });
  if (!alpha || !beta) throw new Error('alpha/beta tenants missing — run seed-mt-test.cjs first');

  const uid = new ObjectId();
  await db.collection('users').insertOne({
    _id: uid,
    name: 'Multi Tenant',
    email: 'multi@x.test',
    password: await bcrypt.hash('passwordM1!', 12),
    role: 'user',
    platformRole: null,
    createdAt: now,
    updatedAt: now,
  });
  await db.collection('user_tenant_memberships').insertMany([
    { _id: new ObjectId(), userId: uid, tenantId: alpha._id, tenantRole: 'WORKER', isActive: true, joinedAt: now, createdAt: now, updatedAt: now },
    { _id: new ObjectId(), userId: uid, tenantId: beta._id, tenantRole: 'WORKER', isActive: true, joinedAt: now, createdAt: now, updatedAt: now },
  ]);
  console.log('created multi@x.test', uid.toString(), 'in', alpha._id.toString(), beta._id.toString());
}
await c.close();
