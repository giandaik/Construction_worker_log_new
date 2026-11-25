/**
 * Dumps the seeded ids the cases need into fixture.json.
 */
import { MongoClient } from 'mongodb';
import { writeFileSync } from 'node:fs';

const c = new MongoClient((process.env.MT_DB_URI || 'mongodb://127.0.0.1:28017/cwl_mt_test'));
await c.connect();
const db = c.db(process.env.MT_DB_NAME || 'cwl_mt_test');

const tenants = await db.collection('tenants').find({}).toArray();
const users = await db.collection('users').find({}).toArray();
const memberships = await db.collection('user_tenant_memberships').find({}).toArray();
const projects = await db.collection('projects').find({}).toArray();
const worklogs = await db.collection('worklogs').find({}).toArray();

const bySlug = Object.fromEntries(tenants.map((t) => [t.slug, t._id.toString()]));
const byEmail = Object.fromEntries(users.map((u) => [u.email, u._id.toString()]));

const fixture = {
  tenants: bySlug,
  users: byEmail,
  memberships: memberships.map((m) => ({
    userId: m.userId.toString(),
    tenantId: m.tenantId.toString(),
    tenantRole: m.tenantRole,
    isActive: m.isActive,
  })),
  projects: Object.fromEntries(projects.map((p) => [p.name, { id: p._id.toString(), tenantId: p.tenantId?.toString() }])),
  worklogs: worklogs.map((w) => ({
    id: w._id.toString(),
    project: w.project?.toString(),
    author: w.author?.toString(),
    tenantId: w.tenantId?.toString(),
    notes: w.notes,
  })),
};

writeFileSync(new URL('./fixture.json', import.meta.url).pathname, JSON.stringify(fixture, null, 2));
console.log(JSON.stringify(fixture, null, 2).slice(0, 1200));
await c.close();
