import { mkdirSync } from "node:fs";
import { createRequire } from "node:module";
import { setTimeout as delay } from "node:timers/promises";

const require = createRequire(import.meta.url);
const puppeteer = require("puppeteer-core");

const base = process.env.SHOT_BASE || "http://127.0.0.1:3000";
const out = process.env.SHOT_DIR || "/opt/cursor/artifacts/screenshots";
mkdirSync(out, { recursive: true });

const pages = [
  ["home", "/?as=giada"],
  ["campaign", "/campaigns/strahd?as=giada"],
  ["session", "/campaigns/strahd/sessions/strahd-2026-10-091830?as=giada"],
  ["poll", "/polls/frost-dec?as=giada"],
  ["invite", "/invite/beerovia-demo?as=giada"],
  ["invites", "/invites?as=seth"],
  ["signin", "/signin"],
  ["campaigns", "/campaigns?as=giada"],
  ["new-campaign", "/campaigns/new?as=seth"],
];

const browser = await puppeteer.launch({
  executablePath: process.env.CHROME || "/usr/bin/google-chrome",
  headless: true,
  args: ["--no-sandbox", "--disable-dev-shm-usage"],
});

for (const [width, height, label] of [[1280, 900, "1280"], [390, 844, "390"]]) {
  const page = await browser.newPage();
  await page.setViewport({ width, height, deviceScaleFactor: 1 });
  for (const [name, path] of pages) {
    await page.goto(base + path, { waitUntil: "networkidle0", timeout: 30000 });
    await page.waitForSelector("body[data-ready='1']", { timeout: 15000 });
    await delay(400);
    const file = `${out}/${name}-${label}.png`;
    await page.screenshot({ path: file, fullPage: true });
    console.log(file);
  }
  await page.close();
}

const editor = await browser.newPage();
await editor.setViewport({ width: 1280, height: 900, deviceScaleFactor: 1 });
await editor.goto(`${base}/campaigns/strahd/sessions/strahd-2026-10-091830?as=seth`, { waitUntil: "networkidle0" });
await editor.waitForSelector("body[data-ready='1']");
await editor.waitForSelector("button");
const buttons = await editor.$$("button");
for (const button of buttons) {
  const text = await button.evaluate((node) => node.textContent || "");
  if (text.includes("Edit recap")) {
    await button.click();
    break;
  }
}
await delay(300);
await editor.screenshot({ path: `${out}/session-editor-1280.png`, fullPage: true });
console.log(`${out}/session-editor-1280.png`);
await browser.close();
