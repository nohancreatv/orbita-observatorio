import { chromium } from "playwright";

const browser = await chromium.launch({ headless: true });
const mobileMode = process.env.E2E_MOBILE === "1";
const page = await browser.newPage({ viewport: mobileMode ? { width: 390, height: 844 } : { width: 1280, height: 720 } });
if (process.env.E2E_REDUCED_MOTION === "1") await page.emulateMedia({ reducedMotion: "reduce" });

try {
  await page.goto("http://localhost:3000/", { waitUntil: "domcontentloaded" });
  await page.waitForSelector(".three-globe canvas", { timeout: 25_000 });
  await page.waitForFunction(() => document.querySelector(".three-globe")?.getAttribute("data-renderer") === "react-three-fiber", undefined, { timeout: 25_000 });

  const beforeRotation = await page.locator(".three-globe").getAttribute("data-focus-longitude");
  await page.getByRole("button", { name: "Hubble", exact: true }).click();
  await page.waitForFunction(() => {
    const activeMarker = document.querySelector(".three-globe")?.getAttribute("data-active-marker");
    const title = document.querySelector(".object-focus-copy h2")?.textContent;
    const imageAlt = document.querySelector(".object-focus-image img")?.getAttribute("alt");
    return activeMarker === "hubble" && title?.includes("Hubble") && imageAlt?.includes("Hubble");
  }, undefined, { timeout: 12_000 });

  const after = await page.evaluate(() => ({
    activeMarker: document.querySelector(".three-globe")?.getAttribute("data-active-marker"),
    title: document.querySelector(".object-focus-copy h2")?.textContent?.trim(),
    imageAlt: document.querySelector(".object-focus-image img")?.getAttribute("alt"),
    rotation: document.querySelector(".three-globe")?.getAttribute("data-focus-longitude"),
    rotationDuration: document.querySelector(".three-globe")?.getAttribute("data-focus-duration"),
    reducedMotion: document.querySelector(".three-globe")?.getAttribute("data-reduced-motion"),
    telemetry: document.querySelector(".telemetry-strip")?.textContent?.replace(/\s+/g, " ").trim(),
    groundLocation: document.querySelector(".ground-location-card strong")?.textContent?.trim(),
  }));

  const hasTelemetry = Boolean(after.telemetry?.includes("altitude") && after.telemetry?.includes("velocidade") && !after.telemetry?.includes("—"));
  const hasGroundLocation = Boolean(after.groundLocation && !after.groundLocation.includes("identificando"));
  const expectedReducedMotion = process.env.E2E_REDUCED_MOTION === "1" ? "true" : "false";
  if (after.activeMarker !== "hubble" || !after.title?.includes("Hubble") || !after.imageAlt?.includes("Hubble") || beforeRotation === after.rotation || after.rotationDuration !== "500" || after.reducedMotion !== expectedReducedMotion || !hasTelemetry || !hasGroundLocation) {
    throw new Error(`A interação de foco não atualizou todos os elementos: ${JSON.stringify({ beforeRotation, after })}`);
  }

  const screenshotPath = mobileMode ? "/home/ubuntu/webdev-static-assets/hubble-focus-e2e-mobile.png" : "/home/ubuntu/webdev-static-assets/hubble-focus-e2e.png";
  await page.screenshot({ path: screenshotPath, fullPage: false });
  console.log(JSON.stringify({ verification: "passed", viewport: mobileMode ? "mobile" : "desktop", screenshotPath, beforeRotation, after }, null, 2));
} finally {
  await browser.close();
}
