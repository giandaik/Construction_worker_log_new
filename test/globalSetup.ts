/**
 * Serialises whole-suite runs on one machine.
 *
 * ~20 test files each start their own `mongodb-memory-server` instance. Two
 * `vitest run` processes racing for those ports (a background job plus an
 * interactive run, say) produce a burst of "port already in use" failures in
 * the mongo-backed suites — results that look like broken code but are only
 * contention. Taking an exclusive lock before the run, and releasing it after,
 * turns that into a short wait instead of a red suite.
 */

import { mkdirSync, readFileSync, unlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

const LOCK_PATH = path.join(tmpdir(), 'construction-worker-log.vitest.lock');
const POLL_MS = 500;
const STALE_MS = 15 * 60 * 1000;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function isRunning(pid: number): boolean {
  // Signal 0 asks the kernel whether the pid exists without touching it.
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

function staleness(): { pid: number | null; ageMs: number } {
  try {
    const raw = readFileSync(LOCK_PATH, 'utf8').trim();
    const pid = Number.parseInt(raw, 10);
    const ageMs = Date.now() - Number.parseInt(raw.split('\n')[1] ?? '0', 10);
    return {
      pid: Number.isFinite(pid) ? pid : null,
      ageMs: Number.isFinite(ageMs) ? ageMs : Number.POSITIVE_INFINITY,
    };
  } catch {
    return { pid: null, ageMs: Number.POSITIVE_INFINITY };
  }
}

export default async function setup() {
  const startedAt = Date.now();
  let waited = false;

  for (;;) {
    try {
      mkdirSync(path.dirname(LOCK_PATH), { recursive: true });
      // 'wx' fails when the file exists, which is the whole lock.
      writeFileSync(LOCK_PATH, `${process.pid}\n${Date.now()}`, { flag: 'wx' });
      break;
    } catch {
      const { pid, ageMs } = staleness();

      // A crashed run leaves the file behind; do not let it wedge the suite.
      if (pid !== null && !isRunning(pid) && ageMs > 5_000) {
        try {
          unlinkSync(LOCK_PATH);
        } catch {
          /* someone else cleaned it up first */
        }
        continue;
      }
      if (ageMs > STALE_MS) {
        try {
          unlinkSync(LOCK_PATH);
        } catch {
          /* ignore */
        }
        continue;
      }

      if (!waited) {
        waited = true;
        console.log('[suite-lock] another vitest run holds the lock; waiting…');
      }
      await sleep(POLL_MS);
    }
  }

  if (waited) {
    console.log(`[suite-lock] acquired after ${Date.now() - startedAt}ms`);
  }

  return async () => {
    try {
      const [pid] = readFileSync(LOCK_PATH, 'utf8').split('\n');
      // Only drop the lock if it is still ours — never delete a successor's.
      if (Number.parseInt(pid, 10) === process.pid) unlinkSync(LOCK_PATH);
    } catch {
      /* already gone */
    }
  };
}
