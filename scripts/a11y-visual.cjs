// Visual check of the a11y fixes: step numbers + footer
const { chromium } = require('/Users/meletis/.hermes/hermes-agent/node_modules/playwright');
async function run() {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  await page.goto('http://localhost:3100/', { waitUntil: 'networkidle' });
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await page.waitForTimeout(300);
  await page.screenshot({ path: '/tmp/a11y-how-footer.png' });
  // step numbers section
  await page.evaluate(() => document.getElementById('how')?.scrollIntoView({ block: 'center' }));
  await page.waitForTimeout(300);
  await page.screenshot({ path: '/tmp/a11y-how.png' });
  await browser.close();
  console.log('done');
}
run().catch(e => { console.error(e); process.exit(1); });
