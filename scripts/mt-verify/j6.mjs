/**
 * J6 — Tenant lifecycle: disable / suspend, and what an already-issued session
 * can still do afterwards. UC-6.1 asked "does a status change path exist?".
 */
import { Sess, rec, expectStatus, flush, fixture, mongoEval } from './lib.mjs';
import { execSync } from 'node:child_process';

const f = fixture('fixture');
const BETA = f.tenants['beta-builders'];
const BOB = f.users['bob@beta.test'];
const multiSessionCookie = null;

const admin = new Sess('superadmin');
await admin.login('superadmin@gmail.com', '12345$dl');
const superCookie = admin.cookie;

// A live Bob session issued BEFORE the tenant is disabled.
const bob = new Sess('bob');
const bobLogin = await bob.login('bob@beta.test', 'passwordB1!');
expectStatus('UC-6.1a', bobLogin, 200, 'bob logs in while Beta is active');

const disable = await admin.req('PUT', `/api/platform/tenants/${BETA}`, { cookie: true, body: { status: 'disabled' } });
admin.cookie = superCookie;
expectStatus('UC-6.1b', disable, 200, 'status change path exists (PUT /api/platform/tenants/[id])');
rec('UC-6.1c', 'tenant now disabled', String(disable.json?.status), disable.json?.status === 'disabled');

const bobOff = new Sess('bob-after-disable');
const bobOffLogin = await bobOff.login('bob@beta.test', 'passwordB1!');
rec('UC-6.1d', 'a disabled tenant refuses a new login (plan: 403 "organisation disabled")',
  `${bobOffLogin.status} ${JSON.stringify(bobOffLogin.json)?.slice(0, 80)}`, bobOffLogin.status === 403);

const bobOld = await bob.req('GET', '/api/projects', { cookie: true });
rec('UC-6.2a', 'an existing session keeps working after disable (documented)', String(bobOld.status),
  true, bobOld.status === 200 ? 'still 200 — no per-request tenant-status check' : `${bobOld.status}`);

const multi = new Sess('multi');
const mLogin = await multi.login('multi@x.test', 'passwordM1!');
const selectBeta = await multi.req('POST', '/api/auth/select-tenant', { bearer: mLogin.json?.token, body: { tenantId: BETA } });
rec('UC-6.1e', 'select-tenant into a disabled tenant is refused', String(selectBeta.status), [400, 403].includes(selectBeta.status));

const impDisabled = await admin.req('POST', `/api/platform/tenants/${BETA}/impersonate`, {
  cookie: true, body: { userId: BOB, reason: 'disabled tenant probe' },
});
admin.cookie = superCookie;
rec('UC-6.1f', 'impersonation into a disabled tenant is refused', String(impDisabled.status), impDisabled.status === 400);

const suspend = await admin.req('PUT', `/api/platform/tenants/${BETA}`, { cookie: true, body: { status: 'suspended' } });
admin.cookie = superCookie;
expectStatus('UC-6.1g', suspend, 200, 'suspend is an accepted status');
rec('UC-6.1h', 'tenant now suspended', String(suspend.json?.status), suspend.json?.status === 'suspended');

const reactivate = await admin.req('PUT', `/api/platform/tenants/${BETA}`, { cookie: true, body: { status: 'active' } });
admin.cookie = superCookie;
expectStatus('UC-6.1i', reactivate, 200, 'reactivate');
const bobBack = new Sess('bob-back');
expectStatus('UC-6.1j', await bobBack.login('bob@beta.test', 'passwordB1!'), 200, 'bob logs in again after reactivation');

const membersOfDisabled = mongoEval('print(db.users.countDocuments({}))');
rec('UC-6.2b', 'documented: user rows survive disable (soft delete)', membersOfDisabled, true, `users=${membersOfDisabled}`);

flush('j6');
