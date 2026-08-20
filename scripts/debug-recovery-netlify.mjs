import { chromium } from "playwright";

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const issues = [];
const warnings = [];

page.on("pageerror", error => issues.push({ type: "pageerror", message: error.message }));
page.on("console", message => {
  if (message.type() !== "error") return;
  const text = message.text();
  if (text.includes("google") || text.includes("googlesyndication") || text.includes("ERR_NAME_NOT_RESOLVED") || text.includes("inline script violates")) {
    warnings.push(text);
    return;
  }
  issues.push({ type: "console", message: text });
});

for (let attempt = 0; attempt < 6; attempt += 1) {
  await page.goto(`https://satellite-now.netlify.app/?recovery-probe=${attempt}`, { waitUntil: "domcontentloaded", timeout: 45_000 });
  await page.waitForFunction(() => document.body.textContent?.includes("4 RASTREADOS") || document.body.textContent?.includes("O observatório encontrou uma interferência."), undefined, { timeout: 20_000 }).catch(() => undefined);
  const state = await page.evaluate(() => ({
    recoveryVisible: document.body.textContent?.includes("O observatório encontrou uma interferência.") ?? false,
    trackedObjects: document.body.textContent?.includes("4 RASTREADOS") ?? false,
    renderer: document.querySelector(".three-globe")?.getAttribute("data-renderer") ?? null,
    markerCount: document.querySelector(".three-globe")?.getAttribute("data-marker-count") ?? null,
    title: document.title,
  }));
  if (state.recoveryVisible) issues.push({ type: "state", attempt, ...state });
}

await browser.close();
console.log(JSON.stringify({ verification: issues.length === 0 ? "passed" : "failed", issues, warningCount: warnings.length }, null, 2));
if (issues.length) process.exitCode = 1;
