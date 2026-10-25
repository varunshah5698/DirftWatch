import { chromium } from "playwright";

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
page.on("console", (msg) => {
  if (msg.type() === "error" || msg.type() === "warning") {
    console.log(`[${msg.type()}] ${msg.text().slice(0, 500)}`);
  }
});
page.on("pageerror", (err) => console.log(`[pageerror] ${String(err).slice(0, 800)}`));
page.on("response", (res) => {
  if (res.status() >= 500) console.log(`[${res.status()}] ${res.url()}`);
});

await page.goto("http://localhost:3000/login", { waitUntil: "networkidle" });
await page.getByLabel("Email address").fill("analyst@driftwatch.dev");
await page.getByLabel("Password", { exact: true }).fill("driftwatch-demo");
await page.getByRole("button", { name: /enter the operations console/i }).click();
await page.waitForURL(/overview/, { timeout: 20000 }).catch(() => console.log("no redirect"));
await page.waitForTimeout(4000);

const info = await page.evaluate(() => ({
  height: document.body.scrollHeight,
  text: document.body.innerText.slice(0, 300),
}));
console.log(JSON.stringify(info, null, 2));
await browser.close();