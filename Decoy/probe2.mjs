import { chromium } from "playwright";

const url = process.argv[2] || "http://localhost:3001/evidence";
const cookie = process.argv[3];

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
const eq = cookie.indexOf("=");
await ctx.addCookies([
  { name: cookie.slice(0, eq), value: cookie.slice(eq + 1), url: "http://localhost:3001" },
]);
const page = await ctx.newPage();
await page.goto(url, { waitUntil: "networkidle" });
await page.waitForTimeout(800);

const info = await page.evaluate(() => {
  const out = [];
  document.querySelectorAll("section,article,div").forEach((el) => {
    const cs = getComputedStyle(el);
    if (cs.display === "none") return;
    const r = el.getBoundingClientRect();
    if (r.height < 120) return;
    // count direct text-bearing children lines
    const txt = (el.innerText || "").trim();
    const lines = txt ? txt.split("\n").filter((s) => s.trim()).length : 0;
    // only leaf-ish panels: card-like
    const isCard = el.className.includes("rounded-xl") || el.tagName === "SECTION" || el.tagName === "ARTICLE";
    if (!isCard) return;
    const parentR = el.parentElement?.getBoundingClientRect();
    out.push({
      tag: el.tagName,
      cls: (el.className || "").slice(0, 70),
      h: Math.round(r.height),
      w: Math.round(r.width),
      lines,
      textStart: txt.slice(0, 60).replace(/\n/g, " | "),
      parentH: parentR ? Math.round(parentR.height) : null,
    });
  });
  return out;
});

for (const i of info) {
  console.log(`${i.tag} h=${i.h} w=${i.w} lines=${i.lines} parentH=${i.parentH} :: ${i.textStart}`);
}

await browser.close();
