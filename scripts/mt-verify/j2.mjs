/**
 * J2 — Tenant admin day-1 (Alpha): users, projects, membership, role hierarchy.
 */
import { Sess, rec, expectStatus, flush, fixture } from './lib.mjs';

const f = fixture('fixture');
const ALPHA = f.tenants['alpha-constructions'];
const BETA = f.tenants['beta-builders'];
const BOB = f.users['bob@beta.test'];
const SUPER = f.users['superadmin@gmail.com'];

const alice = new Sess('alice');
expectStatus('UC-2.0', await alice.login('alice@alpha.test', 'passwordA1!'), 200, 'alice login');

// UC-2.1 admin creates users & projects
const petros = await alice.req('POST', '/api/users', {
  cookie: true,
  body: { name: 'Petros Worker', email: 'petros@alpha.test', password: 'passwordP1!', role: 'user' },
});
expectStatus('UC-2.1a', petros, 201, 'admin creates WORKER');
const petrosId = petros.json?._id ?? petros.json?.data?._id;

const proj = await alice.req('POST', '/api/projects', {
  cookie: true,
  body: {
    name: 'Kifisia Block A',
    location: 'Kifisia',
    ownerEmail: 'alice@alpha.test',
    contractorEmail: 'alice@alpha.test',
    status: 'in-progress',
  },
});
expectStatus('UC-2.1b', proj, 201, 'admin creates project');
const projectId = proj.json?._id ?? proj.json?.data?._id;

const petrosSess = new Sess('petros');
const petrosLogin = await petrosSess.login('petros@alpha.test', 'passwordP1!');
expectStatus('UC-2.1c', petrosLogin, 200, 'new worker can log in');
const petrosProjects = (await petrosSess.req('GET', '/api/projects', { cookie: true })).json || [];
const names = petrosProjects.map((p) => p.name);
rec('UC-2.1d', 'worker sees the tenant project', JSON.stringify(names),
  names.includes('Kifisia Block A'), `count=${names.length}`);
rec('UC-2.1e', 'worker sees no Beta project', String(names.some((n) => /Marousi/.test(n))), !names.some((n) => /Marousi/.test(n)));

// UC-2.2 members management
const members1 = await alice.req('GET', '/api/tenant/members', { cookie: true });
expectStatus('UC-2.2a', members1, 200, 'members list');
const memberEmails = (members1.json || []).map((m) => m.email ?? m.user?.email);
rec('UC-2.2a2', 'list has alice + nick + petros', JSON.stringify(memberEmails),
  ['alice@alpha.test', 'nick@alpha.test', 'petros@alpha.test'].every((e) => memberEmails.includes(e)),
  `count=${memberEmails.length}`);

const nickId = f.users['nick@alpha.test'];
const putNick = (body) => alice.req('PUT', `/api/tenant/members/${nickId}`, { cookie: true, body });

expectStatus('UC-2.2b', await putNick({ tenantRole: 'MANAGER' }), 200, 'WORKER -> MANAGER');
const afterPromote = (await alice.req('GET', '/api/tenant/members', { cookie: true })).json || [];
rec('UC-2.2b2', 'nick now MANAGER',
  String(afterPromote.find((m) => m.userId === nickId)?.tenantRole),
  afterPromote.find((m) => m.userId === nickId)?.tenantRole === 'MANAGER');

expectStatus('UC-2.2c', await putNick({ tenantRole: 'WORKER' }), 200, 'MANAGER -> WORKER');

expectStatus('UC-2.2d', await putNick({ tenantRole: 'WORKER', isActive: false }), 200, 'deactivate nick');
const nickOff = new Sess('nick-off');
const nickOffLogin = await nickOff.login('nick@alpha.test', 'passwordA1!');
rec('UC-2.2e', 'deactivated member cannot get in (401/403 + message)',
  `${nickOffLogin.status} ${JSON.stringify(nickOffLogin.json)?.slice(0, 80)}`,
  [401, 403].includes(nickOffLogin.status));

expectStatus('UC-2.2f', await putNick({ tenantRole: 'WORKER', isActive: true }), 200, 'reactivate nick');
const nick = new Sess('nick');
expectStatus('UC-2.2g', await nick.login('nick@alpha.test', 'passwordA1!'), 200, 'reactivated member logs in');

// UC-2.3 membership edges
const addMember = (body) => alice.req('POST', '/api/tenant/members', { cookie: true, body });
expectStatus('UC-2.3a', await addMember({ userId: BOB, tenantRole: 'ADMIN' }), 400, 'foreign tenant admin');
expectStatus('UC-2.3b', await addMember({ userId: SUPER, tenantRole: 'WORKER' }), 400, 'superadmin not addable');
expectStatus('UC-2.3c', await addMember({ userId: '000000000000000000000000', tenantRole: 'WORKER' }), 404, 'unknown userId');

const before = (await alice.req('GET', '/api/tenant/members', { cookie: true })).json?.length;
const dup = await addMember({ userId: petrosId, tenantRole: 'WORKER' });
const after = (await alice.req('GET', '/api/tenant/members', { cookie: true })).json?.length;
rec('UC-2.3d', 'adding an existing member upserts, does not duplicate', `${dup.status} ${before}->${after}`,
  [200, 201].includes(dup.status) && before === after);

// UC-2.4 role hierarchy
expectStatus('UC-2.4a', await nick.req('POST', '/api/users', {
  cookie: true, body: { name: 'Nope', email: 'nope@alpha.test', password: 'passwordN1!', role: 'user' },
}), 403, 'WORKER cannot create users');

await putNick({ tenantRole: 'MANAGER' });
const managerSess = new Sess('nick-manager');
await managerSess.login('nick@alpha.test', 'passwordA1!');
const managerCreatesAdmin = await managerSess.req('POST', '/api/users', {
  cookie: true, body: { name: 'Sneaky Admin', email: 'sneaky@alpha.test', password: 'passwordS1!', role: 'admin' },
});
expectStatus('UC-2.4b', managerCreatesAdmin, 403, 'MANAGER cannot mint an admin');
rec('UC-2.4b2', 'refusal names the role', JSON.stringify(managerCreatesAdmin.json)?.slice(0, 90),
  /cannot create/i.test(JSON.stringify(managerCreatesAdmin.json)));

expectStatus('UC-2.4c', await alice.req('POST', '/api/users', {
  cookie: true, body: { name: 'Maria Manager', email: 'maria@alpha.test', password: 'passwordM2!', role: 'manager' },
}), 201, 'ADMIN creates MANAGER');
expectStatus('UC-2.4d', await alice.req('POST', '/api/users', {
  cookie: true, body: { name: 'Aris Admin', email: 'aris@alpha.test', password: 'passwordA2!', role: 'admin' },
}), 201, 'ADMIN creates ADMIN');

await putNick({ tenantRole: 'WORKER' });

export { projectId, petrosId };
flush('j2');
