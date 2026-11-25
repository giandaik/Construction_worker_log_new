/**
 * J1 — Platform bootstrap & tenant provisioning.
 */
import { Sess, rec, expectStatus, flush, fixture } from './lib.mjs';

const f = fixture('fixture');
const admin = new Sess('superadmin');

const r = await admin.login('superadmin@gmail.com', '12345$dl');
expectStatus('UC-1.1a', r, 200, 'superadmin login');
rec('UC-1.1b', 'redirect /platform', String(r.json?.redirect), r.json?.redirect === '/platform');
rec('UC-1.1c', 'session cookie set', 'yes/no', r.cookies.length > 0, r.cookies[0]?.split(';')[0]?.split('=')[0] ?? 'none');

const list = await admin.req('GET', '/api/platform/tenants', { cookie: true });
expectStatus('UC-1.1d', list, 200, 'tenant list');
const tenants = Array.isArray(list.json) ? list.json : list.json?.data ?? [];
const counts = Object.fromEntries(tenants.map((t) => [t.slug, t.memberCount]));
rec('UC-1.1e', 'Alpha memberCount=3, Beta=3 (2 seeded + multi)', JSON.stringify(counts),
  counts['alpha-constructions'] === 3 && counts['beta-builders'] === 3, `tenants=${tenants.length}`);

// UC-1.2 provision a new tenant with an initial admin
const gamma = await admin.req('POST', '/api/platform/tenants', {
  cookie: true,
  body: {
    name: 'Gamma Works',
    initialAdmin: {
      name: 'Gina Admin',
      email: 'gina@gamma.test',
      password: 'passwordG1!',
      confirmPassword: 'passwordG1!',
    },
  },
});
expectStatus('UC-1.2a', gamma, 201, 'provision Gamma Works');
const gammaId = gamma.json?.tenantId;
rec('UC-1.2b', 'gamma id returned', String(gammaId).slice(-6), Boolean(gammaId));

const afterProvision = await admin.req('GET', '/api/platform/tenants', { cookie: true });
const gammaRow = (afterProvision.json || []).find((t) => t.slug === 'gamma-works');
rec('UC-1.2c', 'Gamma memberCount=1', String(gammaRow?.memberCount), gammaRow?.memberCount === 1);

const gina = new Sess('gina');
const ginaLogin = await gina.login('gina@gamma.test', 'passwordG1!');
expectStatus('UC-1.2d', ginaLogin, 200, 'gina login');
rec('UC-1.2e', 'redirect /app', String(ginaLogin.json?.redirect), ginaLogin.json?.redirect === '/app');
rec('UC-1.2f', 'tenant role ADMIN', String(ginaLogin.json?.user?.role), ginaLogin.json?.user?.role === 'ADMIN');

const ginaProjects = await gina.req('GET', '/api/projects', { cookie: true });
const ginaNames = (ginaProjects.json || []).map((p) => p.name);
rec('UC-1.2g', 'no Alpha/Beta projects visible', JSON.stringify(ginaNames),
  !ginaNames.some((n) => /Alpha|Beta/.test(n)), `count=${ginaNames.length}`);

// UC-1.3 second admin in the same tenant
const addGus = await admin.req('POST', `/api/platform/tenants/${gammaId}/add-admin`, {
  cookie: true,
  body: { name: 'Gus Admin', email: 'gus@gamma.test', password: 'passwordG2!' },
});
expectStatus('UC-1.3a', addGus, [200, 201], 'add-admin Gus');
const gus = new Sess('gus');
const gusLogin = await gus.login('gus@gamma.test', 'passwordG2!');
expectStatus('UC-1.3b', gusLogin, 200, 'gus login');
rec('UC-1.3c', 'gus role ADMIN', String(gusLogin.json?.user?.role), gusLogin.json?.user?.role === 'ADMIN');
rec('UC-1.3d', 'gus tenant == gamma', String(gusLogin.json?.user?.tenantId).slice(-6), gusLogin.json?.user?.tenantId === gammaId);

// UC-1.4 provisioning edge inputs
const prov = (body) => admin.req('POST', '/api/platform/tenants', { cookie: true, body });
const mk = (name, email, pw = 'passwordG3!', confirm = pw) => ({
  name,
  initialAdmin: { name: 'X', email, password: pw, confirmPassword: confirm },
});

expectStatus('UC-1.4a', await prov(mk('   ', 'e1@gamma.test')), 400, 'blank name');
expectStatus('UC-1.4b', await prov(mk('🏗️🏗️', 'e2@gamma.test')), 400, 'emoji-only name');
expectStatus('UC-1.4c', await prov(mk('A', 'e3@gamma.test')), 400, 'slug shorter than 2');
expectStatus('UC-1.4d', await prov(mk('Short Pass Co', 'e4@gamma.test', 'short')), 400, 'password < 8');
expectStatus('UC-1.4e', await prov(mk('Mismatch Co', 'e5@gamma.test', 'passwordG3!', 'passwordG4!')), 400, 'confirm mismatch');
expectStatus('UC-1.4f', await prov(mk('Alpha Constructions', 'e6@gamma.test')), 400, 'duplicate tenant slug');
expectStatus('UC-1.4g', await prov(mk('Dup Mail Co', 'alice@alpha.test')), 400, 'duplicate admin email');

const caseMail = await prov(mk('Dup Mail Co 2', '  Alice@Alpha.TEST  '));
rec('UC-1.4h', 'mixed-case/space email normalised -> 400 duplicate', String(caseMail.status),
  caseMail.status === 400, JSON.stringify(caseMail.json)?.slice(0, 120));

const longName = 'L'.repeat(80);
const longRes = await prov(mk(longName, 'long@gamma.test'));
const longSlug = (await admin.req('GET', '/api/platform/tenants', { cookie: true })).json
  ?.find((t) => t.slug?.startsWith('llll'))?.slug;
rec('UC-1.4i', '80-char name -> 201 with 63-char slug', `${longRes.status} slug=${longSlug}`,
  longRes.status === 201 && longSlug?.length === 63);

// UC-1.5 provisioning without the right
const alice = new Sess('alice');
await alice.login('alice@alpha.test', 'passwordA1!');
expectStatus('UC-1.5a', await alice.req('POST', '/api/platform/tenants', { cookie: true, body: mk('Hack Co', 'h@x.test') }), 403, 'ADMIN cannot provision');

const multi = new Sess('multi');
const multiLogin = await multi.login('multi@x.test', 'passwordM1!');
const pendingSess = new Sess('multi-pending');
pendingSess.token = multiLogin.json?.token;
pendingSess.cookie = 'x';
const pendingProv = await pendingSess.req('POST', '/api/platform/tenants', {
  bearer: true,
  body: mk('Pending Co', 'p@x.test'),
});
expectStatus('UC-1.5b', pendingProv, 403, 'pending_selection token cannot provision');
rec('UC-1.5c', 'pending login returned tenants list', String(multiLogin.json?.tenants?.length),
  Array.isArray(multiLogin.json?.tenants) && multiLogin.json.tenants.length === 2);

expectStatus('UC-1.5d', await new Sess('anon').req('POST', '/api/platform/tenants', { body: mk('Anon Co', 'a@x.test') }), 401, 'anonymous cannot provision');

flush('j1');
