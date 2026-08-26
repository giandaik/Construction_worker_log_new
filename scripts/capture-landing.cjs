// Capture the updated landing page (how-it-works with screenshots + email feature)
const { chromium } = require('/Users/meletis/.hermes/hermes-agent/node_modules/playwright');

(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 2 });
  const page = await ctx.newPage();
  await page.goto('http://localhost:3100/', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1500);

  // Features section
  await page.evaluate(() => document.querySelector('#features').scrollIntoView());
  await page.waitForTimeout(800);
  await page.screenshot({ path: '/tmp/landing-features.png' });

  // How it works section (with screenshots)
  await page.evaluate(() => document.querySelector('#how').scrollIntoView({ block: 'start' }));
  await page.waitForTimeout(800);
  await page.screenshot({ path: '/tmp/landing-how.png' });
  console.log('done');
  await browser.close();
})().catch((e) => { console.error('FAILED:', e.message); process.exit(1); });
