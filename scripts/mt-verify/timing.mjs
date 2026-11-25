/**
 * Timing oracle probe: unknown email vs known email + wrong password.
 *
 * The login route keeps a per-email bucket as well as a per-IP one, so the
 * unknown-email case uses a fresh address each time — otherwise the probe
 * measures its own throttle (429) instead of bcrypt. Non-401 samples are
 * dropped and reported, never averaged in.
 */
import { Sess, rec, flush } from './lib.mjs';

const probe = new Sess('timing');
const statuses = [];

async function once(email, ip) {
  const t0 = performance.now();
  const r = await probe.req('POST', '/api/login', { body: { email, password: 'definitely-wrong' }, ip });
  const ms = performance.now() - t0;
  statuses.push(`${email.split('@')[0].replace(/\d+$/, '#')}:${r.status}`);
  return { ms, status: r.status };
}

// warm-up: dev-mode compile, module init, first bcrypt call
await once('warm1@nowhere.test', '10.50.0.1');
await once('warm2@nowhere.test', '10.50.0.2');
await once('timing@alpha.test', '10.50.0.3');

const unknown = [];
const known = [];
for (let i = 0; i < 7; i++) {
  const u = await once(`ghost${Date.now()}${i}@nowhere.test`, `10.52.${i}.9`);
  if (u.status === 401) unknown.push(u.ms);
  const k = await once('timing@alpha.test', `10.53.${i}.9`);
  if (k.status === 401) known.push(k.ms);
}

const median = (xs) => xs.slice().sort((a, b) => a - b)[Math.floor(xs.length / 2)];
const mu = median(unknown);
const mk = median(known);
const ratio = Math.max(mu, mk) / Math.min(mu, mk);

rec('J8-3', 'unknown email vs wrong password timing (median, warmed)',
  `${mu.toFixed(0)}ms vs ${mk.toFixed(0)}ms`, ratio < 1.35,
  `ratio=${ratio.toFixed(2)} samples=${unknown.length}/${known.length} statuses=${[...new Set(statuses)].join(' ')}`);

flush('timing');
