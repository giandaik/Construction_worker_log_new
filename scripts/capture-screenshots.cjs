// Capture real app screenshots for the Sitely landing page
const { chromium } = require('/Users/meletis/.hermes/hermes-agent/node_modules/playwright');

const BASE = 'http://localhost:3100';
const OUT = '/Users/meletis/Construction_worker_log_new/public/screenshots';
const fs = require('fs');
fs.mkdirSync(OUT, { recursive: true });

(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({
    viewport: { width: 1280, height: 900 },
    deviceScaleFactor: 2,
  });
  const page = await ctx.newPage();

  // 1. Login page
  await page.goto(`${BASE}/login`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(800);
  await page.screenshot({ path: `${OUT}/01-login.png` });
  console.log('login.png done');

  // 2. Log in as test admin
  await page.fill('input[type="email"], input[name="email"]', 'test@local.dev');
  await page.fill('input[type="password"], input[name="password"]', 'test1234');
  await page.click('button[type="submit"]');
  await page.waitForTimeout(2500);
  console.log('after login URL:', page.url());

  // 3. Dashboard
  await page.screenshot({ path: `${OUT}/02-dashboard.png` });
  console.log('dashboard.png done');

  // 4. New log form
  await page.goto(`${BASE}/logs/new`, { waitUntil: 'networkidle' }).catch(() => {});
  await page.waitForTimeout(2000);
  await page.screenshot({ path: `${OUT}/03-new-log.png` });
  console.log('new-log.png done');

  // 5. Worklogs list
  await page.goto(`${BASE}/worklogs`, { waitUntil: 'networkidle' }).catch(() => {});
  await page.waitForTimeout(1500);
  await page.screenshot({ path: `${OUT}/04-worklogs.png` });
  console.log('worklogs.png done');

  await browser.close();
  console.log('ALL DONE');
})().catch((e) => { console.error('FAILED:', e.message); process.exit(1); });
