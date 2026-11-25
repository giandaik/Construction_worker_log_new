/**
 * The plan's seed script hashes at cost 10 while the app's PASSWORD_HASH_COST
 * is 12, so every seeded account compares 3.3x faster than the dummy hash and
 * the J8 timing check reports an oracle that production does not have.
 * Re-hash the fixture at the app's cost to measure the real path.
 */
import { MongoClient } from 'mongodb';
import bcrypt from 'bcryptjs';

const COST = 12;
const PLAINTEXT = {
  'superadmin@gmail.com': '12345$dl',
  'alice@alpha.test': 'passwordA1!',
  'nick@alpha.test': 'passwordA1!',
  'bob@beta.test': 'passwordB1!',
  'vasilis@beta.test': 'passwordB1!',
  'multi@x.test': 'passwordM1!',
  'gina@gamma.test': 'passwordG1!',
  'gus@gamma.test': 'passwordG2!',
  'petros@alpha.test': 'passwordP1!',
  'maria@alpha.test': 'passwordM2!',
  'aris@alpha.test': 'passwordA2!',
};

const c = new MongoClient((process.env.MT_DB_URI || 'mongodb://127.0.0.1:28017/cwl_mt_test'));
await c.connect();
const users = c.db(process.env.MT_DB_NAME || 'cwl_mt_test').collection('users');

for (const [email, plain] of Object.entries(PLAINTEXT)) {
  const hash = await bcrypt.hash(plain, COST);
  const r = await users.updateOne({ email }, { $set: { password: hash } });
  console.log(`${email}: ${r.modifiedCount ? 'rehashed' : 'not found'} (cost ${COST})`);
}

for (const u of await users.find({}).toArray()) {
  const cost = Number(u.password.split('$')[2]);
  if (cost !== COST) console.log(`WARN ${u.email} still at cost ${cost}`);
}

await c.close();
