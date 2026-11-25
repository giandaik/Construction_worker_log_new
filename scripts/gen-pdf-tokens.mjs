#!/usr/bin/env node
/**
 * design/tokens.css → lib/pdf/tokens.generated.ts
 *
 * The PDF must not carry its own palette. Every colour the sheet prints is read
 * out of the design system's stylesheet, resolved from `hsl(var(--x))` down to
 * the primitive triplet, and emitted as an RGB tuple jsPDF can use. Change a
 * token and the paper changes with it.
 *
 *   node scripts/gen-pdf-tokens.mjs
 *
 * Reads the `:root` blocks, the `.dark` block (ignored: the sheet always prints
 * light) and the `@media print` overrides (used where they exist, e.g. the
 * hazard strip's paper size).
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const cssPath = resolve(root, 'design/tokens.css');
const outPath = resolve(root, 'lib/pdf/tokens.generated.ts');

/** Everything the sheet can print: semantic roles first, primitives second. */
const COLORS = [
  ['ink', '--ink-900', 'body copy, headings, rules above 2pt'],
  ['inkSoft', '--ink-600', 'labels, captions, timestamps'],
  ['inkFaint', '--paper-300', 'unused text step kept for hairlines'],
  ['rule', '--paper-300', 'card and table borders'],
  ['ruleSoft', '--paper-200', 'row separators'],
  ['paper', '--paper-0', 'the sheet itself'],
  ['paperWarm', '--paper-50', 'description block ground'],
  ['sunken', '--paper-100', 'table heads, quick-info cards'],
  ['hazardDark', '--ink-950', 'hazard stripe ground'],
  ['accent', '--yellow-500', 'hazard stripes, section rules, total row edge'],
  ['accentSoft', '--yellow-100', 'total row fill'],
  ['accentQuiet', '--yellow-50', 'callout ground'],
  ['onAccent', '--ink-950', 'ink on a yellow ground'],
  ['greenInk', '--green-600', 'signed'],
  ['greenSoft', '--green-100', 'signed badge ground'],
  ['amberInk', '--amber-600', 'awaiting signature'],
  ['amberSoft', '--amber-100', 'awaiting signature ground'],
  ['redInk', '--red-600', 'rejected, returned log'],
  ['redSoft', '--red-100', 'rejected ground'],
  ['neutralInk', '--ink-600', 'draft badge ink'],
  ['neutralSoft', '--paper-100', 'draft badge ground'],
];

const MEASURES = [
  ['pageWidthMm', '--doc-width', 'A4 width'],
  ['marginMm', '--doc-margin', 'document margin'],
  ['hazardMm', '--doc-hazard', 'hazard strip height on paper'],
  ['cardRadiusMm', '--doc-card-radius', 'quick-info card radius'],
];

const css = readFileSync(cssPath, 'utf8');

/** Collect `--name: value;` declarations, split by the context they sit in. */
function parse(css) {
  const base = new Map();
  const print = new Map();
  const lines = css.split('\n');
  let context = 'base';
  let depth = 0;

  for (const line of lines) {
    if (/@media\s+print/.test(line)) { context = 'print'; continue; }
    if (/@media/.test(line) && !/print/.test(line)) { if (!/prefers-reduced-motion/.test(line)) context = 'other'; }
    if (/\.dark\s*\{/.test(line)) context = 'dark';
    if (/\{/.test(line)) depth += 1;

    const decls = line.matchAll(/--([\w-]+)\s*:\s*([^;]+);/g);
    for (const [, name, raw] of decls) {
      const value = raw.trim();
      if (context === 'print') print.set(name, value);
      else if (context === 'base') base.set(name, value);
    }

    if (/\}/.test(line)) {
      depth -= 1;
      if (depth <= 0) { depth = 0; if (context !== 'base') context = 'base'; }
    }
  }
  return { base, print };
}

function lookup(name, tables) {
  for (const table of [tables.print, tables.base]) {
    if (table.has(name)) return table.get(name);
  }
  throw new Error(`design/tokens.css has no --${name}`);
}

function hslToRgb(h, s, l) {
  const sat = s / 100;
  const lig = l / 100;
  const c = (1 - Math.abs(2 * lig - 1)) * sat;
  const hp = ((h % 360) + 360) % 360 / 60;
  const x = c * (1 - Math.abs((hp % 2) - 1));
  const [r1, g1, b1] =
    hp < 1 ? [c, x, 0] : hp < 2 ? [x, c, 0] : hp < 3 ? [0, c, x]
    : hp < 4 ? [0, x, c] : hp < 5 ? [x, 0, c] : [c, 0, x];
  const m = lig - c / 2;
  return [r1, g1, b1].map((v) => Math.round((v + m) * 255));
}

function hexToRgb(hex) {
  const clean = hex.replace('#', '');
  const full = clean.length === 3 ? clean.split('').map((c) => c + c).join('') : clean;
  return [0, 2, 4].map((i) => parseInt(full.slice(i, i + 2), 16));
}

/** Resolve a token to RGB, following hsl(var(--x)) chains. */
function toRgb(value, tables, depth = 0) {
  if (depth > 8) throw new Error(`token chain too deep at ${value}`);
  const v = value.trim();

  const ref = v.match(/^hsl\(\s*var\(--([\w-]+)\)\s*\)$/);
  if (ref) return toRgb(lookup(ref[1], tables), tables, depth + 1);

  if (v.startsWith('#')) return hexToRgb(v);

  const triplet = v.match(/^([\d.]+)\s+([\d.]+)%\s+([\d.]+)%$/);
  if (triplet) return hslToRgb(+triplet[1], +triplet[2], +triplet[3]);

  const literal = v.match(/^hsl\(\s*([\d.]+)\s+([\d.]+)%\s+([\d.]+)%\s*\)$/);
  if (literal) return hslToRgb(+literal[1], +literal[2], +literal[3]);

  throw new Error(`cannot resolve colour value: ${value}`);
}

/** Resolve a length to millimetres. */
function toMm(value, tables) {
  const v = value.trim();
  const num = v.match(/^([\d.]+)\s*(mm|cm|px|pt)?$/);
  if (!num) throw new Error(`cannot resolve measure: ${value}`);
  const n = parseFloat(num[1]);
  switch (num[2] ?? 'mm') {
    case 'mm': return n;
    case 'cm': return n * 10;
    case 'px': return +(n * 25.4 / 96).toFixed(3);
    case 'pt': return +(n * 25.4 / 72).toFixed(3);
    default: return n;
  }
}

const tables = parse(css);

const colors = COLORS.map(([key, token, note]) => {
  const [r, g, b] = toRgb(lookup(token.replace('--', ''), tables), tables);
  return `  /** ${token} — ${note} */\n  ${key}: [${r}, ${g}, ${b}],`;
});

const measures = MEASURES.map(([key, token, note]) => {
  const mm = toMm(lookup(token.replace('--', ''), tables), tables);
  return `  /** ${token} — ${note} */\n  ${key}: ${mm},`;
});

const header = `/**
 * GENERATED FILE — do not edit.
 * Source: design/tokens.css (Sitely design system v1.0, document layer).
 * Regenerate: node scripts/gen-pdf-tokens.mjs
 *
 * Colours are RGB tuples for jsPDF; measures are millimetres. The sheet always
 * prints light, so the .dark block is ignored and the @media print overrides
 * win where they exist.
 */

export type Rgb = readonly [number, number, number];

export const pdfColors = {
${colors.join('\n')}
} as const satisfies Record<string, Rgb>;

export const pdfMeasures = {
${measures.join('\n')}
} as const;
`;

mkdirSync(dirname(outPath), { recursive: true });
writeFileSync(outPath, header);
console.log(`wrote ${outPath}`);
for (const [key, token] of COLORS) console.log(`  ${key.padEnd(12)} ${token}`);
