import puppeteer from "puppeteer-core";
import { mkdir } from "node:fs/promises";

const base = process.env.LAYOUT_BASE || "http://127.0.0.1:3000";
const out = "/opt/cursor/artifacts";
await mkdir(out, { recursive: true });

const browser = await puppeteer.launch({
  executablePath: process.env.CHROME_PATH || "/usr/bin/google-chrome",
  headless: true,
  args: ["--no-sandbox", "--disable-dev-shm-usage"],
});

const routes = [
  ["home", "/"],
  ["campaigns", "/campaigns"],
  ["campaign", "/campaigns/strahd"],
  ["session", "/campaigns/strahd/sessions/strahd-2026-10-231830"],
  ["polls", "/polls"],
  ["poll", "/polls/frost-dec"],
  ["invites", "/invites"],
  ["signin", "/signin"],
];
const people = ["guest", "giada", "newcomer"];
const sizes = [
  ["390", { width: 390, height: 844 }],
  ["1280", { width: 1280, height: 800 }],
];
const schemes = ["dark", "light"];

const failures = [];
let checks = 0;

function withAs(path, person) {
  const url = new URL(path, base);
  url.searchParams.set("as", person);
  return url.toString();
}

async function settle(page) {
  await page.waitForFunction(() => document.body?.dataset.ready === "1", { timeout: 20000 });
  await new Promise((r) => setTimeout(r, 150));
}

async function measure(page) {
  return page.evaluate(() => {
    const header = document.querySelector(".top");
    const headerBox = header.getBoundingClientRect();
    const offenders = [];
    for (const el of document.querySelectorAll("body *")) {
      if (el.closest(".top") && !el.closest(".menu")) continue;
      if (el.closest(".tabbar") || el.closest(".toasts")) continue;
      const style = getComputedStyle(el);
      if (style.display === "none" || style.visibility === "hidden" || Number(style.opacity) === 0) continue;
      const rect = el.getBoundingClientRect();
      if (rect.width < 2 || rect.height < 2) continue;
      if (rect.bottom < headerBox.bottom - 0.5) continue;
      if (rect.top < headerBox.bottom - 0.5) {
        const label = `${el.tagName.toLowerCase()}.${String(el.className || "").toString().slice(0, 48)} "${(el.textContent || "").trim().slice(0, 40)}"`;
        offenders.push({ top: Math.round(rect.top), headerBottom: Math.round(headerBox.bottom), label });
      }
    }
    const root = document.documentElement;
    return {
      overflow: root.scrollWidth - root.clientWidth,
      headerBottom: headerBox.bottom,
      logoLines: (() => {
        const logo = document.querySelector(".logo");
        if (!logo) return 1;
        const range = document.createRange();
        range.selectNodeContents(logo);
        const rects = [...range.getClientRects()];
        if (!rects.length) return 1;
        const min = Math.min(...rects.map((rect) => rect.top));
        return new Set(rects.map((rect) => Math.round((rect.top - min) / 14))).size;
      })(),
      offenders: offenders.slice(0, 8),
      offenderCount: offenders.length,
    };
  });
}

const page = await browser.newPage();
const consoleErrors = [];
page.on("pageerror", (error) => consoleErrors.push(String(error)));
page.on("console", (msg) => {
  if (msg.type() === "error") consoleErrors.push(msg.text());
});

for (const scheme of schemes) {
  await page.emulateMediaFeatures([{ name: "prefers-color-scheme", value: scheme }]);
  for (const [sizeName, viewport] of sizes) {
    await page.setViewport({ ...viewport, deviceScaleFactor: 1 });
    for (const person of people) {
      for (const [name, path] of routes) {
        consoleErrors.length = 0;
        await page.goto(withAs(path, person), { waitUntil: "domcontentloaded", timeout: 30000 });
        await settle(page);
        const result = await measure(page);
        checks += 1;
        const problems = [];
        if (result.offenderCount) problems.push(`${result.offenderCount} under header: ${result.offenders.map((o) => o.label).join(" | ")}`);
        if (result.overflow > 1) problems.push(`horizontal overflow ${result.overflow}px`);
        if (result.logoLines > 1) problems.push(`wordmark wraps onto ${result.logoLines} lines`);
        if (consoleErrors.length) problems.push(`console: ${consoleErrors.join(" | ").slice(0, 300)}`);
        if (problems.length) failures.push(`${scheme} ${sizeName} ${person} ${name}: ${problems.join("; ")}`);
      }
    }
  }
}

await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 1 });
await page.emulateMediaFeatures([{ name: "prefers-color-scheme", value: "dark" }]);
consoleErrors.length = 0;
await page.goto(withAs("/", "giada"), { waitUntil: "domcontentloaded" });
await settle(page);
await page.click(".av");
await page.waitForSelector(".menu");
const menu = await measure(page);
checks += 1;
if (menu.offenderCount || menu.overflow > 1 || consoleErrors.length) {
  failures.push(`account menu: ${menu.offenderCount} under header, overflow ${menu.overflow}, console ${consoleErrors.join(" | ").slice(0, 200)}`);
}

const shots = [
  ["craft-390-home.png", "/", "giada", 390, 844, true],
  ["craft-390-home-signed-out.png", "/", "guest", 390, 844, true],
  ["craft-390-home-empty.png", "/", "newcomer", 390, 844, true],
  ["craft-390-campaigns.png", "/campaigns", "giada", 390, 844, true],
  ["craft-390-campaigns-signed-out.png", "/campaigns", "guest", 390, 844, true],
  ["craft-390-campaigns-empty.png", "/campaigns", "newcomer", 390, 844, true],
  ["craft-390-campaign.png", "/campaigns/strahd", "giada", 390, 844, true],
  ["craft-390-session.png", "/campaigns/strahd/sessions/strahd-2026-10-231830", "giada", 390, 844, true],
  ["craft-390-polls.png", "/polls", "giada", 390, 844, true],
  ["craft-390-polls-empty.png", "/polls", "newcomer", 390, 844, true],
  ["craft-390-poll.png", "/polls/frost-dec", "giada", 390, 844, true],
  ["craft-390-invites.png", "/invites", "giada", 390, 844, true],
  ["craft-390-invites-signed-out.png", "/invites", "guest", 390, 844, true],
  ["craft-390-invites-empty.png", "/invites", "newcomer", 390, 844, true],
  ["craft-390-signin.png", "/signin", "guest", 390, 844, true],
  ["craft-1280-home.png", "/", "giada", 1280, 800, true],
  ["craft-1280-campaign.png", "/campaigns/strahd", "giada", 1280, 800, true],
  ["craft-1280-session.png", "/campaigns/strahd/sessions/strahd-2026-10-231830", "giada", 1280, 800, true],
];

for (const [file, path, person, width, height, fullPage] of shots) {
  await page.setViewport({ width, height, deviceScaleFactor: 1 });
  await page.emulateMediaFeatures([{ name: "prefers-color-scheme", value: "dark" }]);
  await page.goto(withAs(path, person), { waitUntil: "domcontentloaded" });
  await settle(page);
  await page.screenshot({ path: `${out}/${file}`, fullPage });
}
await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 1 });
await page.goto(withAs("/", "giada"), { waitUntil: "domcontentloaded" });
await settle(page);
await page.click(".av");
await page.waitForSelector(".menu");
await page.screenshot({ path: `${out}/craft-390-account-menu.png`, fullPage: false });

await browser.close();

console.log(`layout-qa: ${checks} page checks`);
if (failures.length) {
  console.error(failures.join("\n"));
  process.exit(1);
}
console.log("layout-qa: pass");
console.log("no element top sits under the sticky header");
console.log("no horizontal overflow");
console.log("no console errors");
console.log("wordmark stays on one line");
