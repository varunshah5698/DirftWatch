import { chromium } from 'playwright';

const TOKEN = 'eyJlbWFpbCI6ImFuYWx5c3RAZHJpZnR3YXRjaC5kZXYiLCJyb2xlIjoiYW5hbHlzdCIsIm5hbWUiOiJBLiBBbmFseXN0IiwiaW5pdGlhbHMiOiJBQSIsImNvbG9yIjoiIzdjNWNmZiIsImV4cCI6MTc5Mjk2NTU0OTg1OX0.LbFNYPzZHtwauGlWz2lf7yKWpaBZfZz0F7u1CpbP0nE';
const url = process.argv[2] || 'http://localhost:3001/evidence';

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
await ctx.addCookies([{ name: 'dw_session', value: TOKEN, domain: 'localhost', path: '/' }]);
const page = await ctx.newPage();
await page.goto(url, { waitUntil: 'networkidle' });

const data = await page.evaluate(() => {
  const out = [];
  const walk = (el, depth) => {
    if (depth > 6) return;
    const r = el.getBoundingClientRect();
    const cs = getComputedStyle(el);
    out.push({
      depth,
      tag: el.tagName.toLowerCase(),
      cls: (el.className && typeof el.className === 'string' ? el.className : '').slice(0, 70),
      top: Math.round(r.top + window.scrollY),
      h: Math.round(r.height),
      w: Math.round(r.width),
      mt: cs.marginTop, mb: cs.marginBottom, pt: cs.paddingTop, pb: cs.paddingBottom, gap: cs.gap,
    });
    for (const c of el.children) walk(c, depth + 1);
  };
  walk(document.body, 0);
  return out;
});

for (const d of data) {
  const pad = '  '.repeat(d.depth);
  console.log(`${pad}${d.tag} h=${d.h} w=${d.w} top=${d.top} mt=${d.mt} mb=${d.mb} pt=${d.pt} pb=${d.pb} gap=${d.gap} | ${d.cls}`);
}
console.log('docH', await page.evaluate(() => document.documentElement.scrollHeight));
await browser.close();
