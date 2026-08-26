// Re-capture screenshots with realistic demo data
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

  // Login
  await page.goto(`${BASE}/login`, { waitUntil: 'networkidle' });
  await page.fill('input[type="email"], input[name="email"]', 'test@local.dev');
  await page.fill('input[type="password"], input[name="password"]', 'test1234');
  await page.click('button[type="submit"]');
  await page.waitForTimeout(2500);

  // Dashboard
  await page.screenshot({ path: `${OUT}/10-dashboard.png` });
  console.log('10-dashboard done');

  // Worklogs list
  await page.goto(`${BASE}/worklogs`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1500);
  await page.screenshot({ path: `${OUT}/11-worklogs.png` });
  console.log('11-worklogs done');

  // Completed worklog detail (signed & filed) — find by navigating
  const completedLink = await page.evaluate(() => {
    const items = Array.from(document.querySelectorAll('a[href*="/worklogs/"]'));
    return items.map((a) => a.getAttribute('href')).find((h) => h && !h.includes('/edit'));
  });
  console.log('detail link:', completedLink);
  // The first in list is the newest (log B signed). We want the completed one.
  await page.goto(`${BASE}/worklogs`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);
  const links = await page.evaluate(() =>
    Array.from(document.querySelectorAll('a[href*="/worklogs/"]')).map((a) => a.getAttribute('href'))
  );
  console.log('all links:', links);
  // Pick a link; detail pages show status badge. Grab second one (completed, older date).
  if (links && links[1]) {
    await page.goto(`${BASE}${links[1]}`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(1800);
    await page.screenshot({ path: `${OUT}/12-worklog-detail.png` });
    console.log('12-worklog-detail done');
  }

  // New log — project selection (step 1: log it at the site)
  await page.goto(`${BASE}/logs/new`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1500);
  await page.screenshot({ path: `${OUT}/13-new-log.png` });
  console.log('13-new-log done');

  await browser.close();
  console.log('ALL DONE');
})().catch((e) => { console.error('FAILED:', e.message); process.exit(1); });
