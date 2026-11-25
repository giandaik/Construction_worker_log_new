#!/usr/bin/env node
/**
 * Ships a built artifact to Firebase App Distribution.
 *
 *   node scripts/dist-firebase.mjs android/app/build/outputs/apk/debug/app-debug.apk
 *   node scripts/dist-firebase.mjs build/App.ipa --platform ios --groups qa,client
 *
 * The app id comes from the environment (or `.env.firebase`, gitignored):
 *   FIREBASE_APP_ID_ANDROID=1:1234567890:android:abc123
 *   FIREBASE_APP_ID_IOS=1:1234567890:ios:def456
 *
 * Credentials, in order of preference:
 *   1. `firebase login` on this machine (interactive, personal use)
 *   2. GOOGLE_APPLICATION_CREDENTIALS=/path/service-account.json  (CI)
 *
 * Testers live in a Firebase console group (`--groups testers`), not in this
 * repository — the repo has no business holding anyone's email address.
 */

import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const FIREBASE_TOOLS = process.env.FIREBASE_TOOLS_VERSION || 'firebase-tools@14';

function usage(message) {
  if (message) console.error(`error: ${message}\n`);
  console.error(
    'usage: node scripts/dist-firebase.mjs <artifact> [--platform android|ios] [--groups a,b] [--notes "text"]',
  );
  process.exit(1);
}

function loadEnvFile(file) {
  if (!fs.existsSync(file)) return;
  for (const line of fs.readFileSync(file, 'utf8').split('\n')) {
    const match = /^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/.exec(line);
    if (match && !process.env[match[1]]) process.env[match[1]] = match[2].replace(/^["']|["']$/g, '');
  }
}

// --- arguments --------------------------------------------------------------
const argv = process.argv.slice(2);
const artifact = argv.find((arg) => !arg.startsWith('--') && !/^(android|ios)$/.test(arg));
const flag = (name, fallback) => {
  const index = argv.indexOf(`--${name}`);
  return index === -1 ? fallback : argv[index + 1];
};

if (!artifact || artifact.startsWith('--')) usage('missing artifact path');
if (!fs.existsSync(artifact)) usage(`artifact not found: ${artifact}`);

loadEnvFile(path.join(process.cwd(), '.env.firebase'));

const platform = flag('platform', artifact.endsWith('.ipa') ? 'ios' : 'android');
if (!['android', 'ios'].includes(platform)) usage(`unknown platform "${platform}"`);

const appId =
  flag('app', undefined) ||
  process.env[platform === 'ios' ? 'FIREBASE_APP_ID_IOS' : 'FIREBASE_APP_ID_ANDROID'];

if (!appId) {
  usage(
    `no Firebase app id for ${platform}. Set FIREBASE_APP_ID_${platform.toUpperCase()} ` +
      '(and put it in .env.firebase so it sticks).',
  );
}

if (platform === 'android' && !artifact.endsWith('.apk')) {
  console.error('warning: Firebase App Distribution takes an .apk, not an .aab — pass the debug or a signed APK.');
}

if (platform === 'ios' && !/\.(ipa)$/.test(artifact)) {
  usage('iOS needs an ad-hoc signed .ipa (register tester UDIDs in the Apple portal first)');
}

const groups = flag('groups', process.env.FIREBASE_GROUPS || 'testers');
const notes =
  flag('notes', process.env.FIREBASE_RELEASE_NOTES) ||
  `Build of ${artifact.split('/').pop()} at ${new Date().toISOString().slice(0, 16).replace('T', ' ')} UTC`;

const sizeMb = (fs.statSync(artifact).size / 1024 / 1024).toFixed(1);
console.log(`distributing ${artifact} (${sizeMb} MB) → app ${appId}, groups: ${groups}`);
console.log(`notes: ${notes}`);
if (!process.env.GOOGLE_APPLICATION_CREDENTIALS) {
  console.log('auth: using the local firebase login (no GOOGLE_APPLICATION_CREDENTIALS set)');
}

// --- distribute -------------------------------------------------------------
const args = [
  '--yes',
  FIREBASE_TOOLS,
  'appdistribution:distribute',
  artifact,
  '--app',
  appId,
  '--groups',
  groups,
  '--release-notes',
  notes,
];

try {
  execFileSync('npx', args, { stdio: 'inherit' });
} catch (error) {
  console.error(
    '\nDistribution failed. Most common causes: not logged in (`npx firebase-tools@14 login`), ' +
      'the app id does not belong to the account, or the group has no testers yet.',
  );
  process.exit(typeof error.status === 'number' ? error.status : 1);
}
