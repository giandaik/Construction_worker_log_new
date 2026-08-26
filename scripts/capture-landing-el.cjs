// Verify Greek landing page too
const { chromium } = require('/Users/meletis/.hermes/hermes-agent/node_modules/playwright');

(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 2 });
  const page = await ctx.newPage();
  await page.goto('http://localhost:3100/?lang=el', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1500);
  await page.evaluate(() => document.querySelector('#how').scrollIntoView({ block: 'start' }));
  await page.waitForTimeout(800);
  await page.screenshot({ path: '/tmp/landing-how-el.png' });
  console.log('done');
  await browser.close();
})().catch((e) => { console.error('FAILED:', e.message); process.exit(1); });
