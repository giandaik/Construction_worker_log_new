/**
 * J3 — Worker daily logging, plus worklog write edges and cross-tenant IDOR.
 */
import { Sess, rec, expectStatus, flush, fixture } from './lib.mjs';

const f = fixture('fixture');
const alphaProject = f.projects['Alpha — Kifisia Block A'].id;
const betaProject = f.projects['Beta — Marousi Site 1'].id;
const betaLog = f.worklogs.find((w) => w.project === betaProject);
const alphaLog = f.worklogs.find((w) => w.project === alphaProject);

const nick = new Sess('nick');
await nick.login('nick@alpha.test', 'passwordA1!');
const alice = new Sess('alice');
await alice.login('alice@alpha.test', 'passwordA1!');
const bob = new Sess('bob');
await bob.login('bob@beta.test', 'passwordB1!');
const nickId = f.users['nick@alpha.test'];

// The seed writes a log for today, and the app allows one log per project per
// day. A fixed calendar date made this journey pass on the first run and fail on
// every later one, so take a day that this run cannot have written yet.
const LOG_DAY = new Date(Date.now() + (3 + Math.floor(Math.random() * 300)) * 86400000)
  .toISOString()
  .slice(0, 10);

// UC-3.1 lifecycle
const create = await nick.req('POST', '/api/worklogs', {
  cookie: true,
  body: {
    date: LOG_DAY,
    project: alphaProject,
    author: nickId,
    workDescription: 'Poured the footings on grid B',
    weather: 'sunny',
    temperature: 22,
    personnel: [{ role: 'Mason', count: 4, workDetails: 'footings' }],
    equipment: [{ type: 'Excavator', count: 1, hours: 3 }],
    materials: [{ name: 'Concrete', quantity: 12, unit: 'm3' }],
    notes: 'cured overnight',
  },
});
expectStatus('UC-3.1a', create, [200, 201], 'worker saves a work log');
const logId = create.json?._id ?? create.json?.data?._id;

const list = await nick.req('GET', '/api/worklogs', { cookie: true });
const rows = Array.isArray(list.json) ? list.json : list.json?.data ?? [];
rec('UC-3.1b', 'log appears in the worker list', `${rows.length} rows`,
  rows.some((r) => (r._id ?? r.id) === logId), `ids=${rows.map((r) => r._id ?? r.id).slice(0, 4).join(',')}`);

const edit = await nick.req('PUT', `/api/worklogs/${logId}`, {
  cookie: true,
  body: { workDescription: 'Poured footings on grid B and C' },
});
expectStatus('UC-3.1c', edit, 200, 'worker edits own log');

const afterEdit = await nick.req('GET', `/api/worklogs/${logId}`, { cookie: true });
const tenantOf = afterEdit.json?.tenantId;
const alphaTenant = f.tenants['alpha-constructions'];
rec('UC-3.1d', 'tenantId unchanged after edit', String(tenantOf), tenantOf === alphaTenant);

const aliceSees = await alice.req('GET', `/api/worklogs?project=${alphaProject}`, { cookie: true });
const aliceRows = Array.isArray(aliceSees.json) ? aliceSees.json : aliceSees.json?.data ?? [];
rec('UC-3.1e', 'admin sees the worker log on the project', `${aliceRows.length} rows`,
  aliceRows.some((r) => (r._id ?? r.id) === logId));

// UC-3.2 write edges
const put = (body) => nick.req('PUT', `/api/worklogs/${logId}`, { cookie: true, body });
expectStatus('UC-3.2a', await put({ tenantId: 'deadbeefdeadbeefdeadbeef' }), 400, 'tenantId in body rejected');
expectStatus('UC-3.2b', await put({ createdAt: '1999-01-01' }), 400, 'createdAt in body rejected');
// The update schema is strict, so `author` is refused outright rather than
// accepted and silently ignored: a mass-assignment attempt must not look like it
// worked. (The plan expected 200 + no change; 400 with no change is stronger.)
expectStatus('UC-3.2c', await put({ author: f.users['bob@beta.test'] }), 400, 'author reassignment rejected');
const afterAuthor = await nick.req('GET', `/api/worklogs/${logId}`, { cookie: true });
rec('UC-3.2c2', 'author NOT changed in the DB', String(afterAuthor.json?.author), afterAuthor.json?.author === nickId);
expectStatus('UC-3.2d', await put({ evilField: 'x' }), 400, 'unknown field rejected');
expectStatus('UC-3.2e', await put({}), 200, 'empty diff is idempotent');

const bigNotes = 'x'.repeat(1024 * 1024);
const bigRes = await put({ notes: bigNotes });
rec('UC-3.2f', 'documented: 1MB notes accepted or rejected', String(bigRes.status),
  true, bigRes.status === 200 ? 'accepted — no length cap on notes' : 'rejected');

const future = await put({ date: '2099-01-01' });
rec('UC-3.2g', 'documented: future date behaviour', String(future.status), true,
  future.status === 200 ? 'accepted — no date bounds' : 'rejected');
await put({ date: LOG_DAY });

// UC-3.3 cross-tenant IDOR
expectStatus('UC-3.3a', await nick.req('GET', `/api/worklogs/${betaLog.id}`, { cookie: true }), 404, 'GET foreign log');
expectStatus('UC-3.3b', await nick.req('PUT', `/api/worklogs/${betaLog.id}`, { cookie: true, body: { notes: 'pwn' } }), 404, 'PUT foreign log');
expectStatus('UC-3.3c', await nick.req('DELETE', `/api/worklogs/${betaLog.id}`, { cookie: true }), [403, 404], 'DELETE foreign log');

const foreignFilter = await nick.req('GET', `/api/worklogs?project=${betaProject}`, { cookie: true });
const foreignRows = Array.isArray(foreignFilter.json) ? foreignFilter.json : foreignFilter.json?.data ?? [];
rec('UC-3.3d', 'filtering by a foreign project id returns nothing', `${foreignRows.length} rows`, foreignRows.length === 0);

expectStatus('UC-3.3e', await bob.req('GET', `/api/projects/${alphaProject}`, { cookie: true }), 404, 'GET foreign project');
expectStatus('UC-3.3f', await nick.req('POST', '/api/projects', {
  cookie: true, body: { name: 'Ghost', ownerEmail: 'nick@alpha.test', contractorEmail: 'nick@alpha.test' },
}), 403, 'worker cannot create projects');

flush('j3');
