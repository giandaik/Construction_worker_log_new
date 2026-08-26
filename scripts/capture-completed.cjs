// Capture the COMPLETED worklog detail (both signatures) for step 3
const { chromium } = require('/Users/meletis/.hermes/hermes-agent/node_modules/playwright');

const BASE = 'http://localhost:3100';
const OUT = '/Users/meletis/Construction_worker_log_new/public/screenshots';

(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({
    viewport: { width: 1280, height: 1000 },
    deviceScaleFactor: 2,
  });
  const page = await ctx.newPage();

  await page.goto(`${BASE}/login`, { waitUntil: 'networkidle' });
  await page.fill('input[type="email"], input[name="email"]', 'test@local.dev');
  await page.fill('input[type="password"], input[name="password"]', 'test1234');
  await page.click('button[type="submit"]');
  await page.waitForTimeout(2500);

  // The completed log is the FIRST one in the list (sorted newest first?) — check both
  await page.goto(`${BASE}/worklogs`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1200);

  // Find the link whose detail page shows "ΟΛΟΚΛΗΡΩΜΕΝΟ" (completed)
  const links = await page.evaluate(() =>
    Array.from(document.querySelectorAll('a[href*="/worklogs/"]')).map((a) => a.getAttribute('href'))
  );
  console.log('links:', links);

  let captured = false;
  for (const link of links) {
    await page.goto(`${BASE}${link}`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(1200);
    const badge = await page.evaluate(() => document.body.innerText.match(/ΟΛΟΚΛΗΡΩΜΕΝΟ|Ολοκληρωμεν|ΟΛΟΚΛΗΡΩΜΕΝ/i));
    if (badge) {
      await page.screenshot({ path: `${OUT}/12-worklog-completed.png` });
      console.log('COMPLETED log captured at', link);
      captured = true;
      break;
    }
  }
  if (!captured) console.log('no completed log found!');
  await browser.close();
  console.log('DONE');
})().catch((e) => { console.error('FAILED:', e.message); process.exit(1); });
