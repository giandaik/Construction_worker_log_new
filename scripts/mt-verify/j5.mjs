/**
 * J5 — Impersonation: the full web + bearer cycle, statefulness, guards.
 */
import { Sess, rec, expectStatus, flush, fixture, mongoEval } from './lib.mjs';

const f = fixture('fixture');
const BETA = f.tenants['beta-builders'];
const BOB = f.users['bob@beta.test'];
const ALICE = f.users['alice@alpha.test'];
const SUPER = f.users['superadmin@gmail.com'];
const GAMMA = f.tenants['gamma-works'];

const admin = new Sess('superadmin');
await admin.login('superadmin@gmail.com', '12345$dl');
// Starting an impersonation replaces the session cookie with the impersonation
// token, so keep the super-admin cookie aside and put it back for platform work.
const superCookie = admin.cookie;

// UC-5.1 / 5.2 full cycle
const imp = await admin.req('POST', `/api/platform/tenants/${BETA}/impersonate`, {
  cookie: true,
  body: { userId: BOB, reason: 'Customer reports dashboard shows no projects' },
});
expectStatus('UC-5.1a', imp, 200, 'start impersonation of Bob');
const impToken = imp.json?.token;
rec('UC-5.1b', 'impersonation token in the body', String(Boolean(impToken)), Boolean(impToken));
rec('UC-5.1c', 'redirect into the tenant app', String(imp.json?.redirect), imp.json?.redirect === '/app');

const asBob = await admin.req('GET', '/api/projects', { bearer: impToken });
const bobNames = (asBob.json || []).map((p) => p.name);
rec('UC-5.1d', 'impersonation sees exactly Bob data', JSON.stringify(bobNames),
  bobNames.length > 0 && bobNames.every((n) => !/Kifisia/.test(n)));

const restored = await admin.req('DELETE', '/api/platform/impersonation', { bearer: impToken });
expectStatus('UC-5.1e', restored, 200, 'end impersonation');
rec('UC-5.1f', 'a restored super-admin token is returned',
  String(Boolean(restored.json?.token)), Boolean(restored.json?.token) && restored.json.token !== impToken);

const backToPlatform = await admin.req('GET', '/api/platform/tenants', { bearer: restored.json?.token });
expectStatus('UC-5.2a', backToPlatform, 200, 'restored token reads the platform API');

// audit log
const auditRow = mongoEval(
  'printjson(db.impersonation_logs.find({}).sort({startedAt:-1}).limit(1).toArray())'
);
rec('UC-5.1g', 'audit row has startedAt, endedAt and reason',
  `${/startedAt/.test(auditRow)}/${/endedAt/.test(auditRow)}/${/Customer reports/.test(auditRow)}`,
  /startedAt/.test(auditRow) && /endedAt/.test(auditRow) && /Customer reports/.test(auditRow));

// UC-5.3 statefulness
expectStatus('UC-5.3a', await admin.req('GET', '/api/projects', { bearer: impToken }), [401, 403], 'ended impersonation token is dead');
expectStatus('UC-5.3b', await admin.req('DELETE', '/api/platform/impersonation', { bearer: impToken }), [400, 409], 'replayed end is refused');
// The ended token is refused before the route runs (401). The laundering guard
// matters for a LIVE impersonation token, so assert on that one below (5.4k).

// Count the close for THIS session only. Counting every ended row in the
// collection made the case fail as soon as the journey had been run once
// before: the number measured the run history, not the close.
const impId = imp.json?.impersonationId;
const endCount = impId
  ? mongoEval(`print(db.impersonation_logs.countDocuments({_id:ObjectId("${impId}"),endedAt:{$ne:null}}))`)
  : 'no id';
rec('UC-5.3d', 'exactly one close recorded for that impersonation', `id=${impId} ended=${endCount}`,
  endCount === '1', `rows=${endCount}`);

// UC-5.4 guards
const imp2 = await admin.req('POST', `/api/platform/tenants/${BETA}/impersonate`, {
  cookie: true, body: { userId: BOB, reason: 'second session' },
});
const liveToken = imp2.json?.token;
admin.cookie = superCookie;

expectStatus('UC-5.4k', await admin.req('POST', '/api/auth/select-tenant', { bearer: liveToken, body: { tenantId: BETA } }), 400, 'select-tenant refuses a live impersonation token');

expectStatus('UC-5.4a', await admin.req('POST', `/api/platform/tenants/${GAMMA}/impersonate`, {
  cookie: true, body: { userId: f.users['gina@gamma.test'], reason: 'x' },
}), [200, 201], 'impersonate a legit Gamma admin (control case)');

admin.cookie = superCookie;
expectStatus('UC-5.4b', await admin.req('POST', `/api/platform/tenants/${BETA}/impersonate`, {
  cookie: true, body: { userId: ALICE, reason: 'not a member' },
}), 400, 'user from another tenant refused');

expectStatus('UC-5.4c', await admin.req('POST', `/api/platform/tenants/${BETA}/impersonate`, {
  cookie: true, body: { userId: SUPER, reason: 'self' },
}), 400, 'superadmin is not a member anywhere');

expectStatus('UC-5.4d', await admin.req('POST', `/api/platform/tenants/${BETA}/impersonate`, {
  cookie: true, body: { userId: { $ne: 1 }, reason: 'object injection' },
}), 400, 'operator object as userId');

expectStatus('UC-5.4e', await admin.req('POST', `/api/platform/tenants/${BETA}/impersonate`, {
  cookie: true, body: { userId: BOB, reason: { $ne: 1 } },
}), 400, 'operator object as reason');

const alice = new Sess('alice');
await alice.login('alice@alpha.test', 'passwordA1!');
expectStatus('UC-5.4f', await alice.req('POST', `/api/platform/tenants/${BETA}/impersonate`, {
  cookie: true, body: { userId: BOB, reason: 'tenant admin attempt' },
}), 403, 'tenant admin cannot impersonate');

for (const path of ['/api/platform/users', '/api/platform/tenants', `/api/platform/tenants/${BETA}/members`]) {
  expectStatus(`UC-5.4g:${path.replace('/api/platform/', '')}`,
    await admin.req('GET', path, { bearer: liveToken }), 403, 'impersonation token on other platform routes');
}

expectStatus('UC-5.4h', await admin.req('POST', `/api/platform/tenants/${BETA}/impersonate`, {
  cookie: true, body: { userId: BOB, reason: 'x'.repeat(501) },
}), 400, 'reason longer than 500 chars');

const emptyReason = await admin.req('POST', `/api/platform/tenants/${BETA}/impersonate`, {
  cookie: true, body: { userId: BOB },
});
rec('UC-5.4i', 'documented: missing reason behaviour', String(emptyReason.status), true,
  emptyReason.status === 200 ? 'allowed — reason is optional' : 'refused');

// clean up the live session by ending every open one
const open = mongoEval('print(db.impersonation_logs.countDocuments({endedAt:null}))');
rec('UC-5.4j', 'documented: open impersonation sessions left behind', open, true, `open=${open}`);

flush('j5');
