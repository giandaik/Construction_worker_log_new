// Accessibility audit for the Sitely landing page (EN + EL) using axe-core.
// Usage:
//   node scripts/a11y-audit.cjs                 # audit http://localhost:3100 (or $BASE_URL)
//   node scripts/a11y-audit.cjs --strict      # same, but exit 1 if any violation
const { chromium } = require('playwright');
const { AxeBuilder } = require('@axe-core/playwright');
const fs = require('fs');
const path = require('path');

const BASE = process.env.BASE_URL || 'http://localhost:3100';
const STRICT = process.argv.includes('--strict');
const OUT = '/tmp/a11y-audit';
fs.mkdirSync(OUT, { recursive: true });

const pages = [
  { name: 'landing-en', url: `${BASE}/`, lang: 'en' },
  { name: 'landing-el', url: `${BASE}/?lang=el`, lang: 'el' },
];

async function run() {
  const browser = await chromium.launch();
  const results = [];
  let totalViolations = 0;

  for (const p of pages) {
    const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    const page = await context.newPage();
    await page.goto(p.url, { waitUntil: 'networkidle' });

    const res = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa', 'best-practice'])
      .analyze();

    const violations = res.violations.map((v) => ({
      id: v.id,
      impact: v.impact,
      help: v.help,
      nodes: v.nodes.map((n) => ({
        target: n.target.join(' '),
        html: n.html.slice(0, 200),
        summary: n.failureSummary?.slice(0, 300),
      })),
    }));

    totalViolations += violations.length;
    console.log(`\n=== ${p.name} (${p.url}) — ${violations.length} violations, ${res.passes.length} passed checks ===`);
    for (const v of violations) {
      console.log(`\n[${v.impact}] ${v.id}: ${v.help}`);
      for (const n of v.nodes.slice(0, 6)) {
        console.log(`  - ${n.target}`);
        console.log(`    HTML: ${n.html}`);
      }
    }

    await page.screenshot({ path: path.join(OUT, `${p.name}.png`), fullPage: true });
    results.push({ name: p.name, violations: violations.length });
    await context.close();
  }

  await browser.close();

  console.log(`\n=== TOTAL: ${totalViolations} violations across ${results.length} pages ===`);
  if (STRICT && totalViolations > 0) {
    console.error('A11Y CHECK FAILED — fix violations before committing.');
    process.exit(1);
  }
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
