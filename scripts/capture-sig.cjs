// Capture completed worklog with signatures section visible
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

  // Completed log id
  await page.goto(`${BASE}/worklogs/6a8ed02c3d3c00df345b283c`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1500);

  // Check where the signatures section is
  const sigInfo = await page.evaluate(() => {
    const text = document.body.innerText;
    const sigIdx = text.indexOf('Signatures');
    const sections = Array.from(document.querySelectorAll('h3, h2')).map((h) => h.innerText);
    return { sigIdx, sections };
  });
  console.log('signature info:', JSON.stringify(sigInfo, null, 1));

  // Scroll signatures into view and screenshot
  const scrolled = await page.evaluate(() => {
    const els = Array.from(document.querySelectorAll('h2, h3, section, div'));
    const sig = els.find((el) => el.textContent && el.textContent.trim() === 'Signatures');
    if (sig) {
      sig.scrollIntoView({ block: 'center' });
      return true;
    }
    return false;
  });
  console.log('scrolled to signatures:', scrolled);
  await page.waitForTimeout(800);
  await page.screenshot({ path: `${OUT}/14-signatures.png` });
  console.log('14-signatures done');

  await browser.close();
  console.log('DONE');
})().catch((e) => { console.error('FAILED:', e.message); process.exit(1); });
