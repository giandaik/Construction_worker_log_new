#!/usr/bin/env node
/**
 * Builds the Capacitor static export.
 *
 * `next build` has no `--config` flag, so the mobile config cannot simply be
 * pointed at. Instead this script stages a mobile-shaped tree, runs the build,
 * and restores the working tree afterwards — always, including on failure or
 * Ctrl-C. Nothing tracked by git is left modified once it exits.
 *
 * Staging does three things:
 *   1. Swaps `next.config.mobile.mjs` in as `next.config.mjs`.
 *   2. Moves `app/api/` and `middleware.ts` aside — route handlers and
 *      middleware cannot exist in a static export. The mobile app talks to the
 *      deployed backend instead (Phase 2).
 *   3. Overlays `mobile/app-overrides/` onto `app/`, replacing the pages that
 *      depend on a server request (see `mobile/README.md`).
 *   4. Moves `.next/` aside so the static-export build does not clobber the web
 *      build/dev cache (`distDir` cannot be used for this — under
 *      `output: 'export'` it relocates the export itself, away from `out/`).
 *
 * It also resolves `NEXT_PUBLIC_API_BASE_URL` (see `resolveApiBaseUrl`), which
 * tells the bundled `lib/apiClient.ts` which backend to call. That value is
 * inlined at build time, so it has to be settled before `next build` starts.
 */

import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const backupRoot = path.join(projectRoot, '.mobile-build-backup');
const overridesRoot = path.join(projectRoot, 'mobile', 'app-overrides');

/** Paths (relative to the project root) moved out of the way for the build. */
const EXCLUDED_FROM_EXPORT = ['app/api', 'middleware.ts', '.next'];

/** Records what staging changed so restore() can undo it in reverse order. */
const undoStack = [];

function abs(relativePath) {
  return path.join(projectRoot, relativePath);
}

function backupPathFor(relativePath) {
  return path.join(backupRoot, relativePath);
}

/** Moves an existing path into the backup tree, remembering how to put it back. */
function stashExisting(relativePath) {
  const source = abs(relativePath);
  if (!fs.existsSync(source)) return false;

  const destination = backupPathFor(relativePath);
  fs.mkdirSync(path.dirname(destination), { recursive: true });
  fs.renameSync(source, destination);
  undoStack.push(() => {
    fs.rmSync(source, { recursive: true, force: true });
    fs.mkdirSync(path.dirname(source), { recursive: true });
    fs.renameSync(destination, source);
  });
  return true;
}

/** Writes a file that did not exist before, remembering to delete it on restore. */
function addTemporaryFile(relativePath, contents) {
  const destination = abs(relativePath);
  fs.mkdirSync(path.dirname(destination), { recursive: true });
  fs.writeFileSync(destination, contents);
  undoStack.push(() => fs.rmSync(destination, { force: true }));
}

/** Minimal `KEY=VALUE` parser — enough for the one var these files carry. */
function readEnvFile(relativePath) {
  const filePath = abs(relativePath);
  if (!fs.existsSync(filePath)) return {};

  const values = {};
  for (const line of fs.readFileSync(filePath, 'utf8').split('\n')) {
    const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/i);
    if (!match || line.trimStart().startsWith('#')) continue;
    values[match[1]] = match[2].replace(/^(['"])(.*)\1$/, '$2');
  }
  return values;
}

/**
 * Decides which backend the mobile bundle talks to, most explicit first:
 *
 *   1. `NEXT_PUBLIC_API_BASE_URL` already in the environment (one-off override:
 *      `NEXT_PUBLIC_API_BASE_URL=https://staging.example.com npm run build:mobile`)
 *   2. `.env.mobile` — the normal place to configure it (gitignored; copy
 *      `.env.mobile.example`)
 *   3. `.env.local` — reuse the web dev config rather than duplicating it
 *
 * An empty result is a hard error: the WebView origin has no server behind it,
 * so a bundle built with no base URL cannot reach the API at all.
 */
function resolveApiBaseUrl() {
  const fromEnvironment = process.env.NEXT_PUBLIC_API_BASE_URL;
  if (fromEnvironment) return { value: fromEnvironment, source: 'environment' };

  for (const file of ['.env.mobile', '.env.local']) {
    const value = readEnvFile(file).NEXT_PUBLIC_API_BASE_URL;
    if (value) return { value, source: file };
  }
  return { value: '', source: null };
}

function listFilesRecursively(root) {
  const files = [];
  for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
    const entryPath = path.join(root, entry.name);
    if (entry.isDirectory()) {
      files.push(...listFilesRecursively(entryPath));
    } else {
      files.push(entryPath);
    }
  }
  return files;
}

function stage() {
  fs.rmSync(backupRoot, { recursive: true, force: true });
  fs.mkdirSync(backupRoot, { recursive: true });

  stashExisting('next.config.mjs');
  addTemporaryFile('next.config.mjs', fs.readFileSync(abs('next.config.mobile.mjs')));

  for (const relativePath of EXCLUDED_FROM_EXPORT) {
    stashExisting(relativePath);
  }

  for (const overrideFile of listFilesRecursively(overridesRoot)) {
    const relativePath = path.join('app', path.relative(overridesRoot, overrideFile));
    const replacedOriginal = stashExisting(relativePath);
    addTemporaryFile(relativePath, fs.readFileSync(overrideFile));
    console.log(`  ${replacedOriginal ? 'replaced' : 'added'} ${relativePath}`);
  }
}

function restore() {
  while (undoStack.length > 0) {
    const undo = undoStack.pop();
    try {
      undo();
    } catch (error) {
      console.error('Failed to restore a staged path:', error);
    }
  }
  fs.rmSync(backupRoot, { recursive: true, force: true });
}

let restored = false;
function restoreOnce() {
  if (restored) return;
  restored = true;
  restore();
}

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => {
    restoreOnce();
    process.exit(1);
  });
}
process.on('exit', restoreOnce);

const apiBaseUrl = resolveApiBaseUrl();

if (!apiBaseUrl.value) {
  console.error(
    'NEXT_PUBLIC_API_BASE_URL is not set.\n\n' +
      'The mobile bundle is served from the WebView origin (capacitor://localhost\n' +
      'on iOS, http://localhost on Android), which has no API behind it, so every\n' +
      'API call needs an absolute URL to the deployed backend.\n\n' +
      'Fix: cp .env.mobile.example .env.mobile and set the URL there.',
  );
  process.exit(1);
}

console.log(`API base URL: ${apiBaseUrl.value}  (from ${apiBaseUrl.source})`);

console.log('\nStaging mobile build tree...');
stage();

console.log('\nBuilding static export...');
const build = spawnSync('npx', ['next', 'build'], {
  cwd: projectRoot,
  stdio: 'inherit',
  env: {
    ...process.env,
    NEXT_PUBLIC_MOBILE_BUILD: 'true',
    // Wins over `.env.local`: `@next/env` never overwrites an existing
    // process.env entry.
    NEXT_PUBLIC_API_BASE_URL: apiBaseUrl.value,
  },
});

restoreOnce();

if (build.status !== 0) {
  console.error('\nMobile build failed.');
  process.exit(build.status ?? 1);
}

console.log('\nStatic export written to out/. Working tree restored.');
