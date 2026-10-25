import puppeteer from "puppeteer-core";

const base = process.env.LAYOUT_BASE || "http://127.0.0.1:3000";

const browser = await puppeteer.launch({
  executablePath: process.env.CHROME_PATH || "/usr/bin/google-chrome",
  headless: true,
  args: ["--no-sandbox", "--disable-dev-shm-usage"],
});

const routes = [
  ["home", "/"],
  ["schedule", "/?view=schedule"],
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
  await new Promise((r) => setTimeout(r, 200));
}

async function measure(page) {
  return page.evaluate(() => {
    const header = document.querySelector(".hdr");
    const headerBox = header.getBoundingClientRect();
    const landing = header.classList.contains("clear");
    const offenders = [];
    if (!landing) {
      for (const el of document.querySelectorAll("body *")) {
        if (el.closest(".hdr") || el.closest(".tabs") || el.closest("#menu") || el.closest(".toasts") || el.closest(".offline")) continue;
        const style = getComputedStyle(el);
        if (style.display === "none" || style.visibility === "hidden" || Number(style.opacity) === 0) continue;
        const rect = el.getBoundingClientRect();
        if (rect.width < 2 || rect.height < 2) continue;
        if (rect.bottom < headerBox.bottom - 0.5) continue;
        if (rect.top < headerBox.bottom - 0.5) {
          offenders.push(`${el.tagName.toLowerCase()}.${String(el.className || "").slice(0, 40)}`);
        }
      }
    }
    const titles = [...document.querySelectorAll("h1")].map((el) => {
      const rect = el.getBoundingClientRect();
      return { top: rect.top, text: (el.textContent || "").trim().slice(0, 40) };
    });
    const titleUnder = titles.filter((t) => t.top < headerBox.bottom - 1);
    const brand = document.querySelector(".brand > span") || document.querySelector(".brand");
    let logoLines = 1;
    if (brand) {
      const range = document.createRange();
      range.selectNodeContents(brand);
      const rects = [...range.getClientRects()];
      if (rects.length) {
        const min = Math.min(...rects.map((rect) => rect.top));
        logoLines = new Set(rects.map((rect) => Math.round((rect.top - min) / 14))).size;
      }
    }
    const logos = document.querySelectorAll(".brand").length;
    const signIns = [...document.querySelectorAll("a,button")].filter((el) => {
      const text = (el.textContent || "").replace(/\s+/g, " ").trim().toLowerCase();
      return text === "sign in" || text === "sign in with email" || el.getAttribute("href") === "/signin";
    }).length;
    const small = [];
    for (const el of document.querySelectorAll("a,button")) {
      const style = getComputedStyle(el);
      if (style.display === "none" || style.visibility === "hidden") continue;
      if (el.closest(".ov")) continue;
      const rect = el.getBoundingClientRect();
      if (rect.width < 2 || rect.height < 2) continue;
      if (rect.height < 44 && rect.width < 44) small.push(`${el.tagName.toLowerCase()} ${(el.textContent || "").trim().slice(0, 24)} ${Math.round(rect.width)}x${Math.round(rect.height)}`);
    }
    return {
      overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      theme: document.documentElement.dataset.theme,
      offenders: offenders.slice(0, 6),
      offenderCount: offenders.length,
      titleUnder,
      logoLines,
      logos,
      signIns,
      small: small.slice(0, 6),
      smallCount: small.length,
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
        if (result.theme !== "night") problems.push(`theme ${result.theme} followed the OS`);
        if (result.offenderCount) problems.push(`${result.offenderCount} under header: ${result.offenders.join(" | ")}`);
        if (result.titleUnder.length) problems.push(`h1 under header: ${result.titleUnder.map((t) => t.text).join(", ")}`);
        if (result.overflow > 1) problems.push(`horizontal overflow ${result.overflow}px`);
        if (result.logoLines > 1) problems.push(`wordmark wraps onto ${result.logoLines} lines`);
        if (result.logos !== 1) problems.push(`${result.logos} logos`);
        // /?view=schedule redirects to /sessions, so only the real home route is the signed-out landing.
        const guestLanding = person === "guest" && path === "/";
        if (guestLanding && result.signIns !== 1) problems.push(`${result.signIns} sign-in entries on landing`);
        if (person !== "guest" && result.signIns !== 0) problems.push(`${result.signIns} sign-in entries while signed in`);
        if (person === "guest" && !guestLanding && result.signIns !== 0) problems.push(`${result.signIns} extra sign-in entries`);
        if (result.smallCount) problems.push(`tap targets under 44px: ${result.small.join(" | ")}`);
        if (consoleErrors.length) problems.push(`console: ${consoleErrors.join(" | ").slice(0, 240)}`);
        if (problems.length) failures.push(`${scheme} ${sizeName} ${person} ${name}: ${problems.join("; ")}`);
      }
    }
  }
}

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
console.log("almanac ink stays default when the OS is light or dark");
