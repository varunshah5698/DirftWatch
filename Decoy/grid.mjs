import { chromium } from "playwright";

const SESSION =
  "eyJlbWFpbCI6ImFuYWx5c3RAZHJpZnR3YXRjaC5kZXYiLCJyb2xlIjoiYW5hbHlzdCIsIm5hbWUiOiJBLiBBbmFseXN0IiwiaW5pdGlhbHMiOiJBQSIsImNvbG9yIjoiIzdjNWNmZiIsImV4cCI6MTc5Mjk2NTU0OTg1OX0.LbFNYPzZHtwauGlWz2lf7yKWpaBZfZz0F7u1CpbP0nE";

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
await ctx.addCookies([{ name: "dw_session", value: SESSION, domain: "localhost", path: "/" }]);
const page = await ctx.newPage();
await page.goto(process.argv[2], { waitUntil: "networkidle" });

const rows = await page.evaluate(() => {
  const out = [];
  const walk = (el, depth) => {
    const cls = typeof el.className === "string" ? el.className : "";
    if (cls.includes("grid") && cls.includes("grid-cols-12")) {
      const r = el.getBoundingClientRect();
      out.push({ tag: "ROW", cls, top: Math.round(r.top + scrollY), h: Math.round(r.height), depth });
      for (const child of el.children) {
        const cr = child.getBoundingClientRect();
        const cc = typeof child.className === "string" ? child.className : "";
        out.push({
          tag: "  CELL",
          cls: cc.slice(0, 110),
          top: Math.round(cr.top + scrollY),
          h: Math.round(cr.height),
          depth,
        });
        // one level deeper
        for (const g of child.children) {
          const gr = g.getBoundingClientRect();
          const gc = typeof g.className === "string" ? g.className : "";
          out.push({
            tag: "    inner",
            cls: gc.slice(0, 90),
            top: Math.round(gr.top + scrollY),
            h: Math.round(gr.height),
            depth,
          });
        }
      }
    }
    for (const c of el.children) walk(c, depth + 1);
  };
  walk(document.body, 0);
  return out;
});

for (const r of rows) console.log(`${r.tag} top=${r.top} h=${r.h} :: ${r.cls}`);
await browser.close();
