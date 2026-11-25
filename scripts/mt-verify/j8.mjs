/**
 * J8 — Security regression quick-suite (H1–M3 from the audit).
 */
import { Sess, rec, expectStatus, flush, fixture } from './lib.mjs';

const f = fixture('fixture');
const BETA = f.tenants['beta-builders'];
const BOB = f.users['bob@beta.test'];
const ALICE = f.users['alice@alpha.test'];

const anon = new Sess('anon');

// 1. H1 — operator object as the login identifier
const op = await anon.req('POST', '/api/login', { body: { email: { $regex: '^a' }, password: 'x' } });
expectStatus('J8-1', op, 400, 'operator object as email');

// 2. M1 — login throttling
const spray = new Sess('spray', '10.42.42.42');
let firstlimit = null;
for (let i = 1; i <= 12; i++) {
  const r = await spray.req('POST', '/api/login', {
    body: { email: `nobody${i}@alpha.test`, password: 'wrong' },
    ip: '10.42.42.42',
  });
  if (r.status === 429 && firstlimit === null) firstlimit = i;
}
rec('J8-2', 'login throttles after repeated wrong passwords', String(firstlimit), firstlimit !== null && firstlimit <= 11,
  firstlimit ? `first 429 at attempt ${firstlimit}` : 'no 429 in 12 attempts');

// 3. H1 — no timing oracle between unknown email and wrong password
const timeOf = async (email) => {
  const starts = [];
  for (let i = 0; i < 5; i++) {
    const t0 = performance.now();
    await anon.req('POST', '/api/login', { body: { email, password: 'wrongpassword' }, ip: `10.43.${i}.7` });
    starts.push(performance.now() - t0);
  }
  return starts.sort((a, b) => a - b)[2];
};
const unknown = await timeOf('ghost@nowhere.test');
const wrongPass = await timeOf('alice@alpha.test');
const ratio = Math.max(unknown, wrongPass) / Math.min(unknown, wrongPass);
rec('J8-3', 'unknown email and wrong password take comparable time', `${unknown.toFixed(0)}ms vs ${wrongPass.toFixed(0)}ms`,
  ratio < 1.6, `ratio=${ratio.toFixed(2)}`);

// 4. H2 — tenantId in a worklog body
const alice = new Sess('alice');
await alice.login('alice@alpha.test', 'passwordA1!');
const logs = (await alice.req('GET', '/api/worklogs', { cookie: true })).json || [];
const own = logs[0];
expectStatus('J8-4', await alice.req('PUT', `/api/worklogs/${own?._id}`, {
  cookie: true, body: { tenantId: f.tenants['alpha-constructions'] },
}), 400, 'tenantId in a worklog body');

// 5. H3 — attach a foreign user to your tenant
const bob2 = new Sess('bob2');
await bob2.login('bob@beta.test', 'passwordB1!');
expectStatus('J8-5', await alice.req('PUT', `/api/tenant/members/${BOB}`, {
  cookie: true, body: { tenantRole: 'WORKER' },
}), 400, 'PUT a member from another tenant');

// 6. H4 — laundering via select-tenant (needs a live impersonation token)
const admin = new Sess('superadmin');
await admin.login('superadmin@gmail.com', '12345$dl');
const superCookie = admin.cookie;
const imp = await admin.req('POST', `/api/platform/tenants/${BETA}/impersonate`, {
  cookie: true, body: { userId: BOB, reason: 'J8 laundering probe' },
});
admin.cookie = superCookie;
expectStatus('J8-6', await admin.req('POST', '/api/auth/select-tenant', {
  bearer: imp.json?.token, body: { tenantId: BETA },
}), 400, 'select-tenant with an impersonation token');
await admin.req('DELETE', '/api/platform/impersonation', { bearer: imp.json?.token });

// 7. A tenant admin's token on the platform API
expectStatus('J8-7', await alice.req('GET', '/api/platform/tenants', { cookie: true }), 403, 'tenant admin on platform API');

// 8. impersonation token on /api/platform/users
const imp2 = await admin.req('POST', `/api/platform/tenants/${BETA}/impersonate`, {
  cookie: true, body: { userId: BOB, reason: 'J8 platform probe' },
});
admin.cookie = superCookie;
expectStatus('J8-8', await admin.req('GET', '/api/platform/users', { bearer: imp2.json?.token }), 403, 'impersonation token on platform users');
await admin.req('DELETE', '/api/platform/impersonation', { bearer: imp2.json?.token });

// 9. M2 — manager minting an admin
const nickId = f.users['nick@alpha.test'];
await alice.req('PUT', `/api/tenant/members/${nickId}`, { cookie: true, body: { tenantRole: 'MANAGER' } });
const nick = new Sess('nick-mgr');
await nick.login('nick@alpha.test', 'passwordA1!');
expectStatus('J8-9', await nick.req('POST', '/api/users', {
  cookie: true, body: { name: 'X', email: 'x@alpha.test', password: 'passwordX1!', role: 'admin' },
}), 403, 'manager cannot mint an admin');
await alice.req('PUT', `/api/tenant/members/${nickId}`, { cookie: true, body: { tenantRole: 'WORKER' } });

// 10. M3 — operator object as the impersonation reason
expectStatus('J8-10', await admin.req('POST', `/api/platform/tenants/${BETA}/impersonate`, {
  cookie: true, body: { userId: BOB, reason: { $ne: 1 } },
}), 400, 'operator object as reason');

flush('j8');
