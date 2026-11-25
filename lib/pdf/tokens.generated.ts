/**
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
  /** --ink-900 — body copy, headings, rules above 2pt */
  ink: [26, 29, 35],
  /** --ink-600 — labels, captions, timestamps */
  inkSoft: [92, 99, 112],
  /** --paper-300 — unused text step kept for hairlines */
  inkFaint: [218, 216, 210],
  /** --paper-300 — card and table borders */
  rule: [218, 216, 210],
  /** --paper-200 — row separators */
  ruleSoft: [227, 225, 221],
  /** --paper-0 — the sheet itself */
  paper: [255, 255, 255],
  /** --paper-50 — description block ground */
  paperWarm: [249, 248, 246],
  /** --paper-100 — table heads, quick-info cards */
  sunken: [242, 240, 238],
  /** --ink-950 — hazard stripe ground */
  hazardDark: [17, 19, 23],
  /** --yellow-500 — hazard stripes, section rules, total row edge */
  accent: [245, 184, 0],
  /** --yellow-100 — total row fill */
  accentSoft: [253, 239, 195],
  /** --yellow-50 — callout ground */
  accentQuiet: [255, 250, 235],
  /** --ink-950 — ink on a yellow ground */
  onAccent: [17, 19, 23],
  /** --green-600 — signed */
  greenInk: [22, 126, 77],
  /** --green-100 — signed badge ground */
  greenSoft: [222, 247, 235],
  /** --amber-600 — awaiting signature */
  amberInk: [162, 89, 7],
  /** --amber-100 — awaiting signature ground */
  amberSoft: [254, 236, 215],
  /** --red-600 — rejected, returned log */
  redInk: [206, 28, 28],
  /** --red-100 — rejected ground */
  redSoft: [254, 231, 231],
  /** --ink-600 — draft badge ink */
  neutralInk: [92, 99, 112],
  /** --paper-100 — draft badge ground */
  neutralSoft: [242, 240, 238],
} as const satisfies Record<string, Rgb>;

export const pdfMeasures = {
  /** --doc-width — A4 width */
  pageWidthMm: 210,
  /** --doc-margin — document margin */
  marginMm: 15,
  /** --doc-hazard — hazard strip height on paper */
  hazardMm: 3,
  /** --doc-card-radius — quick-info card radius */
  cardRadiusMm: 2.646,
} as const;
