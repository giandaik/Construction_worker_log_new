/**
 * J4 — Multi-tenant user: web (cookie) and mobile (bearer) selection flows.
 */
import { Sess, rec, expectStatus, flush, fixture, runtimeTenantId } from './lib.mjs';
import { readFileSync } from 'node:fs';

const f = fixture('fixture');
const ALPHA = f.tenants['alpha-constructions'];
const BETA = f.tenants['beta-builders'];
const GAMMA = runtimeTenantId('gamma-works');

// UC-4.1 single login, two memberships
const web = new Sess('multi');
const login = await web.login('multi@x.test', 'passwordM1!');
expectStatus('UC-4.1a', login, 200, 'multi-tenant login');
const offered = login.json?.tenants ?? [];
rec('UC-4.1b', 'exactly the two memberships offered', JSON.stringify(offered.map((t) => t.tenantName)),
  offered.length === 2 && offered.every((t) => [ALPHA, BETA].includes(t.tenantId)));
rec('UC-4.1c', 'no app redirect before a tenant is chosen', String(login.json?.redirect),
  login.json?.redirect === '/select-tenant', `redirect=${login.json?.redirect}`);

const pendingToken = login.json?.token;
const pickAlpha = await web.req('POST', '/api/auth/select-tenant', { cookie: true, body: { tenantId: ALPHA } });
expectStatus('UC-4.1d', pickAlpha, 200, 'select Alpha');
rec('UC-4.1e', 'role in selected tenant', String(pickAlpha.json?.user?.role), pickAlpha.json?.user?.role === 'WORKER');

const alphaProjects = await web.req('GET', '/api/projects', { cookie: true });
const names = (alphaProjects.json || []).map((p) => p.name);
rec('UC-4.1f', 'only Alpha data after selecting Alpha', JSON.stringify(names),
  names.length > 0 && !names.some((n) => /Marousi/.test(n)), `count=${names.length}`);

const pickBeta = await web.req('POST', '/api/auth/select-tenant', { cookie: true, body: { tenantId: BETA } });
expectStatus('UC-4.1g', pickBeta, 200, 'switch to Beta');
const betaProjects = await web.req('GET', '/api/projects', { cookie: true });
const betaNames = (betaProjects.json || []).map((p) => p.name);
rec('UC-4.1h', 'no Alpha leakage after switching', JSON.stringify(betaNames),
  betaNames.every((n) => !/Kifisia/.test(n)), `count=${betaNames.length}`);

// UC-4.2 bearer flow
const mobile = new Sess('multi-mobile');
const mLogin = await mobile.login('multi@x.test', 'passwordM1!');
const mPending = mLogin.json?.token;
rec('UC-4.2a', 'login returns a pending token + tenant list',
  `${Boolean(mPending)} / ${mLogin.json?.tenants?.length}`, Boolean(mPending) && mLogin.json?.tenants?.length === 2);

const pendingUse = await mobile.req('GET', '/api/projects', { bearer: mPending });
expectStatus('UC-4.2b', pendingUse, 403, 'pending token cannot read projects');

const bearerSelect = await mobile.req('POST', '/api/auth/select-tenant', { bearer: mPending, body: { tenantId: ALPHA } });
expectStatus('UC-4.2c', bearerSelect, 200, 'select-tenant accepts a Bearer pending token');
const tenantToken = bearerSelect.json?.token;
rec('UC-4.2d', 'new tenant token returned in the body', `${Boolean(tenantToken)}`,
  Boolean(tenantToken) && tenantToken !== mPending);

const bearerProjects = await mobile.req('GET', '/api/projects', { bearer: tenantToken });
const bearerNames = (bearerProjects.json || []).map((p) => p.name);
rec('UC-4.2e', 'tenant token reads only that tenant', JSON.stringify(bearerNames),
  bearerNames.length > 0 && bearerNames.every((n) => !/Marousi/.test(n)));

const second = await mobile.req('POST', '/api/auth/select-tenant', { bearer: mPending, body: { tenantId: BETA } });
expectStatus('UC-4.2f', second, 200, 'the same pending token can open a second, independent session');
const betaBearer = await mobile.req('GET', '/api/projects', { bearer: second.json?.token });
const betaBearerNames = (betaBearer.json || []).map((p) => p.name);
rec('UC-4.2g', 'second session sees Beta only', JSON.stringify(betaBearerNames),
  betaBearerNames.every((n) => !/Kifisia/.test(n)));

// UC-4.3 edges
const g = new Sess('multi-gamma');
const gLogin = await g.login('multi@x.test', 'passwordM1!');
expectStatus('UC-4.3a', await g.req('POST', '/api/auth/select-tenant', { bearer: gLogin.json?.token, body: { tenantId: GAMMA } }), 403, 'select a tenant you are not a member of');

for (const [label, path] of [
  ['platform/tenants', '/api/platform/tenants'],
  ['worklogs', '/api/worklogs'],
  ['tenant/members', '/api/tenant/members'],
  ['me', '/api/me'],
]) {
  const res = await mobile.req('GET', path, { bearer: mPending });
  expectStatus(`UC-4.3b:${label}`, res, [401, 403], `pending token on /api/${label}`);
}

const dbl1 = await mobile.req('POST', '/api/auth/select-tenant', { bearer: mPending, body: { tenantId: ALPHA } });
const dbl2 = await mobile.req('POST', '/api/auth/select-tenant', { bearer: mPending, body: { tenantId: ALPHA } });
rec('UC-4.3c', 'same pending token twice: documented behaviour', `${dbl1.status}/${dbl2.status}`,
  dbl1.status === 200 && dbl2.status === 200, 'both succeed — pending token is not single-use');

flush('j4');
