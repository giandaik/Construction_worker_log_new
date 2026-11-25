#!/usr/bin/env node
/**
 * Propagates the version in `package.json` into both native projects.
 *
 *   package.json  "version": "1.2.3"
 *     → Android   versionName "1.2.3", versionCode 10203
 *     → iOS       MARKETING_VERSION = 1.2.3, CURRENT_PROJECT_VERSION = 10203
 *
 * The build number is derived (major*10000 + minor*100 + patch) rather than
 * stored, so it cannot drift from the marketing version and always increases
 * for the store.
 *
 *   node scripts/set-version.mjs           # write
 *   node scripts/set-version.mjs --check   # exit 1 on drift (CI)
 *   BUILD_NUMBER=10204 node scripts/set-version.mjs   # re-cut the same version
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CHECK_ONLY = process.argv.includes('--check');

const GRADLE_FILE = 'android/app/build.gradle';
const XCODE_PROJECT = 'ios/App/App.xcodeproj/project.pbxproj';

function fail(message) {
  console.error(message);
  process.exit(1);
}

function readMarketingVersion() {
  const packageJson = JSON.parse(fs.readFileSync(path.join(projectRoot, 'package.json'), 'utf8'));
  const raw = String(packageJson.version || '');
  const match = /^(\d+)\.(\d+)\.(\d+)(?:[-+].*)?$/.exec(raw);
  if (!match) fail(`package.json "version" must be semver (X.Y.Z), found "${raw}".`);

  return { version: `${match[1]}.${match[2]}.${match[3]}`, major: +match[1], minor: +match[2], patch: +match[3] };
}

function readBuildNumber(marketing) {
  const override = process.env.BUILD_NUMBER;
  if (override) {
    if (!/^\d+$/.test(override)) fail(`BUILD_NUMBER must be an integer, found "${override}".`);
    return { build: Number(override), source: 'BUILD_NUMBER' };
  }

  const build = marketing.major * 10000 + marketing.minor * 100 + marketing.patch;
  if (build > 2100000000) fail(`Derived build number ${build} exceeds the Play Store limit.`);
  return { build, source: 'derived from version' };
}

const read = (relativePath) => fs.readFileSync(path.join(projectRoot, relativePath), 'utf8');

function mustMatch(contents, pattern, label, file) {
  const match = pattern.exec(contents);
  if (!match) fail(`Could not find ${label} in ${file}.`);
  return match;
}

const marketing = readMarketingVersion();
const { build, source } = readBuildNumber(marketing);

const problems = [];
const writes = [];

// --- Android ---------------------------------------------------------------
const gradle = read(GRADLE_FILE);
const gradleCode = mustMatch(gradle, /versionCode\s+(\d+)/, 'versionCode', GRADLE_FILE);
const gradleName = mustMatch(gradle, /versionName\s+"([^"]+)"/, 'versionName', GRADLE_FILE);

let gradleOutput = gradle;
if (gradleCode[1] !== String(build)) {
  problems.push(`${GRADLE_FILE}: versionCode ${gradleCode[1]} → ${build}`);
  gradleOutput = gradleOutput.replace(/versionCode\s+\d+/, `versionCode ${build}`);
}
if (gradleName[1] !== marketing.version) {
  problems.push(`${GRADLE_FILE}: versionName "${gradleName[1]}" → "${marketing.version}"`);
  gradleOutput = gradleOutput.replace(/versionName\s+"[^"]+"/, `versionName "${marketing.version}"`);
}
if (gradleOutput !== gradle) writes.push([GRADLE_FILE, gradleOutput]);

// --- iOS -------------------------------------------------------------------
const xcode = read(XCODE_PROJECT);
const xcodeMarketing = mustMatch(xcode, /MARKETING_VERSION = ([\d.]+);/, 'MARKETING_VERSION', XCODE_PROJECT);
const xcodeBuild = mustMatch(xcode, /CURRENT_PROJECT_VERSION = (\d+);/, 'CURRENT_PROJECT_VERSION', XCODE_PROJECT);

let xcodeOutput = xcode;
if (xcodeMarketing[1] !== marketing.version) {
  problems.push(`${XCODE_PROJECT}: MARKETING_VERSION ${xcodeMarketing[1]} → ${marketing.version}`);
  xcodeOutput = xcodeOutput.replace(/MARKETING_VERSION = [\d.]+;/g, `MARKETING_VERSION = ${marketing.version};`);
}
if (xcodeBuild[1] !== String(build)) {
  problems.push(`${XCODE_PROJECT}: CURRENT_PROJECT_VERSION ${xcodeBuild[1]} → ${build}`);
  xcodeOutput = xcodeOutput.replace(/CURRENT_PROJECT_VERSION = \d+;/g, `CURRENT_PROJECT_VERSION = ${build};`);
}
if (xcodeOutput !== xcode) writes.push([XCODE_PROJECT, xcodeOutput]);

console.log(`version ${marketing.version}  →  build ${build}  (${source})`);

if (problems.length === 0) {
  console.log('Native projects already in sync.');
  process.exit(0);
}

if (CHECK_ONLY) {
  console.error('\nNative versions are out of sync with package.json:');
  for (const problem of problems) console.error(`  - ${problem}`);
  console.error('\nRun: node scripts/set-version.mjs');
  process.exit(1);
}

for (const problem of problems) console.log(`  ${problem}`);
for (const [file, contents] of writes) {
  fs.writeFileSync(path.join(projectRoot, file), contents);
  console.log(`  wrote ${file}`);
}
console.log('\nDone. Re-run `npm run build:mobile` and `npx cap sync` before building.');
