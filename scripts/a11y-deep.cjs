// Deep a11y audit: track 401 sources + best-practice rules
const { chromium } = require('/Users/meletis/.hermes/hermes-agent/node_modules/playwright');
const fs = require('fs');
const path = require('path');

const BASE = process.env.BASE_URL || 'http://localhost:3100';
const axeSource = fs.readFileSync(path.join(__dirname, '..', 'node_modules', 'axe-core', 'axe.min.js'), 'utf8');

async function run() {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });

  // Track failed/401 requests
  const failed = [];
  page.on('response', (res) => {
    if (res.status() >= 400) {
      failed.push(`${res.status()} ${res.url()}`);
    }
  });
  page.on('requestfailed', (req) => {
    failed.push(`FAILED ${req.url()} (${req.failure()?.errorText})`);
  });

  await page.goto(`${BASE}/`, { waitUntil: 'networkidle' });
  await page.addScriptTag({ content: axeSource });
  const res = await page.evaluate(async () => {
    const r = await axe.run(document, {
      runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa', 'best-practice'] },
    });
    return { violations: r.violations, passes: r.passes.length, incomplete: r.incomplete.map(i => i.id) };
  });

  console.log(`=== Full run (incl. best-practice): ${res.violations.length} violations, ${res.passes} passed, incomplete: ${res.incomplete.join(', ')} ===`);
  for (const v of res.violations) {
    console.log(`\n[${v.impact}] ${v.id}: ${v.help}`);
    console.log(`  ${v.description} (${v.nodes.length} nodes)`);
    for (const n of v.nodes.slice(0, 4)) {
      console.log(`  - ${n.target.join(' ')}`);
      console.log(`    HTML: ${n.html.slice(0, 160)}`);
    }
  }
  console.log('\n=== Network errors (>=400) ===');
  console.log(failed.length ? failed.join('\n') : '(none)');
  await browser.close();
}
run().catch(e => { console.error(e); process.exit(1); });
