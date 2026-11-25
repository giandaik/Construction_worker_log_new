/**
 * Live multi-tenant test harness for docs/testing/multi-tenant-test-plan.md.
 * Drives the running app on :3100 against db cwl_mt_test and records every
 * case as a row so the report can be generated from data, not memory.
 */
import { writeFileSync, appendFileSync, existsSync, readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';

// Overridable so a journey run can target a throwaway server/database and leave
// the developer's working copy of the test db alone.
export const BASE = process.env.MT_BASE || 'http://127.0.0.1:3100';
export const DB_URI = process.env.MT_DB_URI || 'mongodb://127.0.0.1:28017/cwl_mt_test';

/**
 * Run a mongosh expression against the harness database and return its output.
 *
 * execFileSync, not execSync: a shell would expand the `$ne`/`$set` in the
 * expressions and mangle them, and it cannot find a Homebrew mongosh on a
 * non-login PATH.
 */
export function mongoEval(expr) {
  const bin = process.env.MONGOSH || '/opt/homebrew/bin/mongosh';
  return execFileSync(bin, ['--quiet', DB_URI, '--eval', expr]).toString().trim();
}
const RESULTS = new URL('./results.jsonl', import.meta.url).pathname;

let ipSeq = 0;
/** Each session gets its own X-Forwarded-For so the per-IP login bucket
 *  does not trip while we log in as a dozen different users. */
export const freshIp = () => `10.9.${Math.floor(++ipSeq / 250)}.${(ipSeq % 250) + 1}`;

export class Sess {
  constructor(name, ip = freshIp()) {
    this.name = name;
    this.ip = ip;
    this.cookie = null;
    this.token = null;
  }

  async req(method, path, opts = {}) {
    const headers = {
      'x-forwarded-for': opts.ip ?? this.ip,
      ...(opts.headers ?? {}),
    };
    if (opts.body !== undefined) headers['content-type'] = 'application/json';

    const bearer = opts.bearer === true ? this.token : opts.bearer;
    if (bearer) headers.authorization = `Bearer ${bearer}`;
    if (opts.cookie === true ? this.cookie : opts.cookie) headers.cookie = opts.cookie === true ? this.cookie : opts.cookie;

    const res = await fetch(BASE + path, {
      method,
      headers,
      body: opts.body === undefined ? undefined : JSON.stringify(opts.body),
      redirect: 'manual',
    });

    const rawCookies = res.headers.getSetCookie?.() ?? [];
    for (const c of rawCookies) {
      const pair = c.split(';')[0];
      if (/session|token|auth/i.test(pair.split('=')[0])) this.cookie = pair;
    }

    const text = await res.text();
    let json = null;
    try {
      json = JSON.parse(text);
    } catch {
      json = text.slice(0, 300);
    }
    return { status: res.status, json, headers: res.headers, cookies: rawCookies };
  }

  async login(email, password, opts = {}) {
    const r = await this.req('POST', '/api/login', {
      body: { email, password },
      ...opts,
    });
    if (r.json && typeof r.json === 'object' && r.json.token) this.token = r.json.token;
    return r;
  }
}

const rows = [];
export function rec(id, expected, actual, ok, note = '') {
  const row = { id, expected, actual, ok, note, at: new Date().toISOString() };
  rows.push(row);
  appendFileSync(RESULTS, JSON.stringify(row) + '\n');
  const mark = ok ? 'PASS' : 'FAIL';
  console.log(`${mark} ${id} | exp=${expected} | got=${actual}${note ? ' | ' + note : ''}`);
  return row;
}

/** Compare a status code (or a predicate) and record. */
export function expectStatus(id, res, want, note = '') {
  const wantList = Array.isArray(want) ? want : [want];
  return rec(id, wantList.join('/'), String(res.status), wantList.includes(res.status), note);
}

export function flush(name) {
  const out = new URL(`./report-${name}.json`, import.meta.url).pathname;
  writeFileSync(out, JSON.stringify(rows, null, 2));
  const failed = rows.filter((r) => !r.ok).length;
  console.log(`\n== ${name}: ${rows.length - failed} pass, ${failed} fail (${rows.length} cases) ==`);
  return { total: rows.length, failed };
}

export function resetRows() {
  rows.length = 0;
}

export { resultsPath };
const resultsPath = RESULTS;

/** Read a JSON fixture file written by the setup step. */
export function fixture(name) {
  const p = new URL(`./${name}.json`, import.meta.url).pathname;
  return existsSync(p) ? JSON.parse(readFileSync(p, 'utf8')) : null;
}
