import { chromium } from "playwright";

const browser = await chromium.launch({ headless: true });
const mobileMode = process.env.E2E_MOBILE === "1";
const page = await browser.newPage({ viewport: mobileMode ? { width: 390, height: 844 } : { width: 1280, height: 720 } });
const sequence = [
  { button: "Hubble", id: "hubble", label: "Hubble" },
  { button: "Tiangong", id: "tiangong", label: "Tiangong" },
  { button: "NOAA 19", id: "noaa19", label: "NOAA 19" },
  { button: "ISS", id: "iss", label: "ISS" },
];

try {
  await page.goto("http://localhost:3000/", { waitUntil: "domcontentloaded" });
  await page.waitForSelector(".three-globe canvas", { timeout: 20_000 });
  await page.waitForFunction(() => document.querySelector(".three-globe")?.getAttribute("data-active-marker") === "iss", undefined, { timeout: 12_000 });

  let previous = "iss";
  const results = [];
  for (const target of sequence) {
    const beforeLongitude = await page.locator(".three-globe").getAttribute("data-focus-longitude");
    await page.getByRole("button", { name: target.button, exact: true }).click();
    await page.waitForFunction(({ from, to }) => document.querySelector(".three-globe")?.getAttribute("data-transition-from") === from && document.querySelector(".three-globe")?.getAttribute("data-transition-to") === to, { from: previous, to: target.id }, { timeout: 2_000 });
    await page.waitForFunction(expected => document.querySelector(".three-globe")?.getAttribute("data-active-marker") === expected, target.id, { timeout: 8_000 });
    const current = await page.evaluate(() => ({
      longitude: document.querySelector(".three-globe")?.getAttribute("data-focus-longitude"),
      marker: document.querySelector(".three-globe")?.getAttribute("data-active-marker"),
      transitionFrom: document.querySelector(".three-globe")?.getAttribute("data-transition-from"),
      transitionTo: document.querySelector(".three-globe")?.getAttribute("data-transition-to"),
      badge: document.querySelector(".globe-badge")?.textContent?.replace(/\s+/g, " ").trim(),
      telemetry: document.querySelector(".telemetry-strip")?.textContent?.replace(/\s+/g, " ").trim(),
    }));
    if (current.marker !== target.id || current.transitionFrom !== previous || current.transitionTo !== target.id || current.longitude === beforeLongitude || !current.badge?.includes(target.label) || !current.telemetry?.includes("altitude") || current.telemetry.includes("—")) {
      throw new Error(`Transição inválida para ${target.label}: ${JSON.stringify({ previous, target, beforeLongitude, current })}`);
    }
    await page.waitForTimeout(650);
    const settled = await page.evaluate(() => ({ from: document.querySelector(".three-globe")?.getAttribute("data-transition-from"), to: document.querySelector(".three-globe")?.getAttribute("data-transition-to") }));
    if (settled.from || settled.to !== target.id) throw new Error(`Transição não estabilizou para ${target.label}: ${JSON.stringify(settled)}`);
    results.push({ from: previous, to: target.id, longitudeChanged: current.longitude !== beforeLongitude, marker: current.marker, telemetryUpdated: true, settled });
    previous = target.id;
  }

  await page.screenshot({ path: `/home/ubuntu/webdev-static-assets/orbit-transition-${mobileMode ? "mobile" : "desktop"}.png`, fullPage: false });
  console.log(JSON.stringify({ verification: "passed", viewport: mobileMode ? "mobile" : "desktop", transitions: results }, null, 2));
} finally {
  await browser.close();
}
