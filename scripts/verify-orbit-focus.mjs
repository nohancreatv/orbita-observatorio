import { chromium } from "playwright";

const browser = await chromium.launch({ headless: true, executablePath: "/usr/bin/chromium", args: ["--no-sandbox"] });
const baseUrl = process.env.BASE_URL || "http://localhost:3000/";
const mobileMode = process.env.E2E_MOBILE === "1";
const page = await browser.newPage({ viewport: mobileMode ? { width: 390, height: 844 } : { width: 1280, height: 720 } });
if (process.env.E2E_REDUCED_MOTION === "1") await page.emulateMedia({ reducedMotion: "reduce" });

try {
  await page.goto(baseUrl, { waitUntil: "domcontentloaded" });
  await page.waitForSelector(".three-globe canvas", { timeout: 25_000 });
  await page.waitForFunction(() => document.querySelector(".three-globe")?.getAttribute("data-renderer") === "react-three-fiber", undefined, { timeout: 25_000 });

  const beforeRotation = await page.locator(".three-globe").getAttribute("data-focus-longitude");
  await page.getByRole("button", { name: "Hubble", exact: true }).click();
  await page.waitForFunction(() => document.querySelector(".three-globe")?.getAttribute("data-transition-from") === "iss" && document.querySelector(".three-globe")?.getAttribute("data-transition-to") === "hubble", undefined, { timeout: 2_000 });
  // Medir o eixo interno imediatamente; a validação do HUD ocorre em seguida
  // e não pode consumir a janela visual de 500 ms.
  const focusMotionStart = await page.locator(".three-globe").getAttribute("data-focus-rotation-y-current");
  const focusProgressAtMotion = await page.locator(".three-globe").getAttribute("data-focus-progress");
  await page.waitForTimeout(140);
  const focusMotionEnd = await page.locator(".three-globe").getAttribute("data-focus-rotation-y-current");
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
    focusRotationYCurrent: document.querySelector(".three-globe")?.getAttribute("data-focus-rotation-y-current"),
    focusProgress: document.querySelector(".three-globe")?.getAttribute("data-focus-progress"),
    activeScreenX: document.querySelector(".three-globe")?.getAttribute("data-active-screen-x"),
    activeScreenY: document.querySelector(".three-globe")?.getAttribute("data-active-screen-y"),
    activeScreenDepth: document.querySelector(".three-globe")?.getAttribute("data-active-screen-depth"),
    rotationDuration: document.querySelector(".three-globe")?.getAttribute("data-focus-duration"),
    reducedMotion: document.querySelector(".three-globe")?.getAttribute("data-reduced-motion"),
    telemetry: document.querySelector(".telemetry-strip")?.textContent?.replace(/\s+/g, " ").trim(),
    groundLocation: document.querySelector(".ground-location-card strong")?.textContent?.trim(),
  }));

  await page.waitForTimeout(650);
  const settledTransition = await page.evaluate(() => ({
    from: document.querySelector(".three-globe")?.getAttribute("data-transition-from"),
    to: document.querySelector(".three-globe")?.getAttribute("data-transition-to"),
  }));

  const hasTelemetry = Boolean(after.telemetry?.includes("altitude") && after.telemetry?.includes("velocidade") && !after.telemetry?.includes("—"));
  const hasGroundLocation = Boolean(after.groundLocation && !after.groundLocation.includes("identificando"));
  const expectedReducedMotion = process.env.E2E_REDUCED_MOTION === "1" ? "true" : "false";
  const focusMotionChanged = Boolean(focusMotionStart && focusMotionEnd && focusMotionStart !== focusMotionEnd);
  const progressIsActive = Number(focusProgressAtMotion) > 0 && Number(focusProgressAtMotion) < 1;
  const activeCentered = Math.abs(Number(after.activeScreenX)) < 0.08 && Math.abs(Number(after.activeScreenY)) < 0.08 && Number(after.activeScreenDepth) < 1;
  if (after.activeMarker !== "hubble" || !after.title?.includes("Hubble") || !after.imageAlt?.includes("Hubble") || beforeRotation === after.rotation || !focusMotionChanged || !progressIsActive || !activeCentered || after.rotationDuration !== "500" || after.reducedMotion !== expectedReducedMotion || settledTransition.from || settledTransition.to !== "hubble" || !hasTelemetry || !hasGroundLocation) {
    throw new Error(`A interação de foco não atualizou todos os elementos: ${JSON.stringify({ beforeRotation, focusMotionStart, focusMotionEnd, focusProgressAtMotion, after, settledTransition })}`);
  }

  const screenshotPath = mobileMode ? "/home/ubuntu/webdev-static-assets/hubble-focus-e2e-mobile.png" : "/home/ubuntu/webdev-static-assets/hubble-focus-e2e.png";
  await page.screenshot({ path: screenshotPath, fullPage: false });
  console.log(JSON.stringify({ verification: "passed", viewport: mobileMode ? "mobile" : "desktop", screenshotPath, beforeRotation, focusMotion: { start: focusMotionStart, end: focusMotionEnd, progressAtMotion: focusProgressAtMotion, changed: focusMotionChanged }, centered: activeCentered, after, transition: { from: "iss", to: "hubble", settled: settledTransition } }, null, 2));
} finally {
  await browser.close();
}
