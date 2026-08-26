import { chromium } from "playwright";

const browser = await chromium.launch({ headless: true, executablePath: "/usr/bin/chromium", args: ["--no-sandbox"] });
const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
const page = await context.newPage();

try {
  await page.goto("http://localhost:3000/", { waitUntil: "domcontentloaded" });
  await page.getByRole("dialog", { name: "" }).waitFor({ timeout: 10_000 });

  const beforeConsent = await page.evaluate(() => ({
    adsScriptLoaded: Boolean(document.getElementById("orbita-adsense-script")),
    analyticsScriptLoaded: document.querySelectorAll('script[src*="googletagmanager.com/gtag/js?id=G-4EQ06VWWVE"]').length,
    adRequestsPaused: document.documentElement.dataset.adsRequests === "paused",
    slotStates: [...document.querySelectorAll("[data-ad-slot]")].map(element => element.getAttribute("data-ad-consent")),
  }));
  if (beforeConsent.adsScriptLoaded || beforeConsent.analyticsScriptLoaded !== 0 || !beforeConsent.adRequestsPaused || beforeConsent.slotStates.some(state => state !== "denied")) throw new Error(`Consentimento antecipado: ${JSON.stringify(beforeConsent)}`);

  await page.getByRole("button", { name: "aceitar publicidade" }).click();
  await page.waitForFunction(() => Boolean(document.getElementById("orbita-adsense-script")), { timeout: 10_000 });
  const afterConsent = await page.evaluate(() => ({
    bannerVisible: Boolean(document.querySelector(".cookie-consent")),
    adsScriptLoaded: Boolean(document.getElementById("orbita-adsense-script")),
    analyticsScriptLoaded: document.querySelectorAll('script[src*="googletagmanager.com/gtag/js?id=G-4EQ06VWWVE"]').length,
    adRequestsResumed: document.documentElement.dataset.adsRequests === "resumed",
    slotStates: [...document.querySelectorAll("[data-ad-slot]")].map(element => element.getAttribute("data-ad-consent")),
    slotModes: [...document.querySelectorAll("[data-ad-slot]")].map(element => element.getAttribute("data-ad-mode")),
    manualSlotRequests: document.querySelectorAll("[data-ad-slot] ins.adsbygoogle").length,
  }));
  if (afterConsent.bannerVisible || !afterConsent.adsScriptLoaded || afterConsent.analyticsScriptLoaded !== 1 || !afterConsent.adRequestsResumed || afterConsent.slotStates.some(state => state !== "granted") || afterConsent.slotModes.some(mode => mode !== "auto") || afterConsent.manualSlotRequests !== 0) throw new Error(`Consentimento não aplicado: ${JSON.stringify(afterConsent)}`);

  await page.locator("footer .footer-links button").click({ force: true });
  await page.getByRole("dialog", { name: "" }).waitFor({ timeout: 5_000 });
  console.log(JSON.stringify({ verification: "passed", beforeConsent, afterConsent }, null, 2));
} finally {
  await context.close();
  await browser.close();
}
