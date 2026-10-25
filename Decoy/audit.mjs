/** Screenshot the control room (overview) at desktop width, section by section. */
import { chromium } from "playwright";
import { mkdirSync } from "node:fs";

const OUT = "ui-audit";
mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

// Sign in first so we land on the console.
await page.goto("http://localhost:3000/login", { waitUntil: "networkidle" });
await page.getByRole("button", { name: /security analyst/i }).click();
await page.waitForTimeout(3500);
console.log("landed:", page.url());

// Settle reveal animations.
await page.evaluate(() => {
  document.querySelectorAll(".reveal, .stagger > *").forEach((el) => {
    el.style.opacity = "1";
    el.style.transform = "none";
    el.style.animation = "none";
  });
});
await page.waitForTimeout(500);

await page.screenshot({ path: `${OUT}/ctrl-full.png`, fullPage: true });

const height = await page.evaluate(() => document.documentElement.scrollHeight);
console.log("page height:", height);

// Also grab viewport-sized slices for detail.
const slices = Math.ceil(height / 900);
for (let i = 0; i < slices; i++) {
  await page.evaluate((top) => window.scrollTo({ top, behavior: "instant" }), i * 880);
  await page.waitForTimeout(250);
  await page.screenshot({ path: `${OUT}/ctrl-${String(i).padStart(2, "0")}.png` });
}
console.log("slices:", slices);

await browser.close();