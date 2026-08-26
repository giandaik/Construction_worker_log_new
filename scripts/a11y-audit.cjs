// Accessibility audit for the Sitelty landing page (EN + EL) using axe-core 4.11.4
// Usage: node scripts/a11y-audit.cjs
const { chromium } = require('/Users/meletis/.hermes/hermes-agent/node_modules/playwright');
const fs = require('fs');
const path = require('path');

const BASE = process.env.BASE_URL || 'http://localhost:3100';
const OUT = '/tmp/a11y-audit';
fs.mkdirSync(OUT, { recursive: true });

const axeSource = fs.readFileSync(
  path.join(__dirname, '..', 'node_modules', 'axe-core', 'axe.min.js'),
  'utf8'
);

const pages = [
  { name: 'landing-en', url: `${BASE}/`, lang: 'en' },
  { name: 'landing-el', url: `${BASE}/?lang=el`, lang: 'el' },
];

async function run() {
  const browser = await chromium.launch();
  const results = [];
  for (const p of pages) {
    const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
    await page.goto(p.url, { waitUntil: 'networkidle' });
    await page.addScriptTag({ content: axeSource });
    const res = await page.evaluate(async () => {
      const r = await axe.run(document, {
        runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'] },
      });
      return { violations: r.violations, passes: r.passes.length };
    });
    // Also capture console errors
    const consoleErrors = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });
    await page.reload({ waitUntil: 'networkidle' });
    await new Promise(r => setTimeout(r, 500));

    const violations = res.violations.map(v => ({
      id: v.id,
      impact: v.impact,
      description: v.description,
      help: v.help,
      helpUrl: v.helpUrl,
      nodes: v.nodes.map(n => ({
        target: n.target.join(' '),
        html: n.html.slice(0, 200),
        summary: n.failureSummary?.slice(0, 300),
        any: n.any.map(a => a.message).slice(0, 3),
      })),
    }));
    console.log(`\n=== ${p.name} (${p.url}) — ${res.violations.length} violations, ${res.passes} passed checks ===`);
    for (const v of violations) {
      console.log(`\n[${v.impact}] ${v.id}: ${v.help}`);
      console.log(`  ${v.description}`);
      for (const n of v.nodes.slice(0, 6)) {
        console.log(`  - ${n.target}`);
        console.log(`    HTML: ${n.html}`);
        if (n.any?.length) console.log(`    ANY: ${n.any.join(' | ')}`);
      }
    }
    if (consoleErrors.length) {
      console.log(`\nConsole errors (${consoleErrors.length}):`);
      console.log(consoleErrors.slice(0, 5).join('\n'));
    }
    await page.screenshot({ path: path.join(OUT, `${p.name}.png`), fullPage: true });
    results.push({ name: p.name, violations: res.violations.length, consoleErrors });
    await page.close();
  }
  await browser.close();
  fs.writeFileSync(path.join(OUT, 'summary.json'), JSON.stringify(results, null, 2));
}

run().catch(e => { console.error(e); process.exit(1); });
