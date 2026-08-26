// Capture worklog detail + signed view
const { chromium } = require('/Users/meletis/.hermes/hermes-agent/node_modules/playwright');

const BASE = 'http://localhost:3100';
const OUT = '/Users/meletis/Construction_worker_log_new/public/screenshots';
const fs = require('fs');

(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({
    viewport: { width: 1280, height: 1000 },
    deviceScaleFactor: 2,
  });
  const page = await ctx.newPage();

  // Login
  await page.goto(`${BASE}/login`, { waitUntil: 'networkidle' });
  await page.fill('input[type="email"], input[name="email"]', 'test@local.dev');
  await page.fill('input[type="password"], input[name="password"]', 'test1234');
  await page.click('button[type="submit"]');
  await page.waitForTimeout(2000);

  // Worklogs list — grab first worklog link
  await page.goto(`${BASE}/worklogs`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1200);
  const link = await page.evaluate(() => {
    const a = document.querySelector('a[href*="/worklogs/"]');
    return a ? a.getAttribute('href') : null;
  });
  console.log('first worklog link:', link);

  if (link) {
    await page.goto(`${BASE}${link}`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(1500);
    await page.screenshot({ path: `${OUT}/05-worklog-detail.png` });
    console.log('05-worklog-detail.png done');
  }

  await browser.close();
  console.log('DONE');
})().catch((e) => { console.error('FAILED:', e.message); process.exit(1); });
