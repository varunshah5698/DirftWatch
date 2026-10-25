import { chromium } from 'playwright';

const url = process.argv[2];
const out = process.argv[3];
const full = process.argv.includes('full');
const TOKEN =
  'eyJlbWFpbCI6ImFuYWx5c3RAZHJpZnR3YXRjaC5kZXYiLCJyb2xlIjoiYW5hbHlzdCIsIm5hbWUiOiJBLiBBbmFseXN0IiwiaW5pdGlhbHMiOiJBQSIsImNvbG9yIjoiIzdjNWNmZiIsImV4cCI6MTc5Mjk2NTU0OTg1OX0.LbFNYPzZHtwauGlWz2lf7yKWpaBZfZz0F7u1CpbP0nE';

const browser = await chromium.launch();
const page = await browser.newPage({
  viewport: { width: 1440, height: 900 },
  deviceScaleFactor: 2,
});
page.on('console', (m) => {
  if (m.type() === 'error') console.log('console.error:', m.text());
});
page.on('pageerror', (e) => console.log('pageerror:', e.message));

const { hostname } = new URL(url);
await page.context().addCookies([
  { name: 'dw_session', value: TOKEN, url: `http://${hostname}` },
]);

const res = await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 });
console.log('status:', res && res.status(), 'finalUrl:', page.url());

// report any element overflowing horizontally
const overflow = await page.evaluate(() => {
  const de = document.documentElement;
  const wide = [];
  document.querySelectorAll('*').forEach((el) => {
    const r = el.getBoundingClientRect();
    if (r.right > de.clientWidth + 4) {
      wide.push(
        `${el.tagName.toLowerCase()}${el.className && typeof el.className === 'string' ? '.' + el.className.split(' ').filter(Boolean).slice(0, 3).join('.') : ''} right=${Math.round(r.right)}`
      );
    }
  });
  return { clientWidth: de.clientWidth, scrollWidth: de.scrollWidth, wide: wide.slice(0, 15) };
});
console.log('overflow:', JSON.stringify(overflow, null, 2));

await page.waitForTimeout(800);
await page.screenshot({ path: out, fullPage: full });
console.log('saved', out);
await browser.close();
