import { chromium } from "playwright";

const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROMIUM_PATH || "/usr/bin/chromium", args: ["--no-sandbox"] });
const baseUrl = process.env.BASE_URL || "http://localhost:3000/";
const mobileMode = process.env.E2E_MOBILE === "1";
const page = await browser.newPage({ viewport: mobileMode ? { width: 390, height: 844 } : { width: 1280, height: 720 } });
const sequence = [
  { button: "Hubble", id: "hubble", label: "Hubble" },
  { button: "Tiangong", id: "tiangong", label: "Tiangong" },
  { button: "NOAA 19", id: "noaa19", label: "NOAA 19" },
  { button: "ISS", id: "iss", label: "ISS" },
];

try {
  await page.goto(baseUrl, { waitUntil: "domcontentloaded" });
  await page.waitForSelector(".three-globe canvas", { timeout: 20_000 });
  await page.waitForFunction(() => document.querySelector(".three-globe")?.getAttribute("data-active-marker") === "iss", undefined, { timeout: 12_000 });

  let previous = "iss";
  const results = [];
  for (const target of sequence) {
    const beforeLongitude = await page.locator(".three-globe").getAttribute("data-focus-longitude");
    await page.getByRole("button", { name: target.button, exact: true }).click();
    // A troca de estado pai é síncrona, mas o efeito que abre a janela visual de
    // 500 ms é aplicado após o commit React. Esperar um frame estável evita que a
    // sondagem por RAF perca essa janela em WebGL headless sob carga.
    await page.waitForTimeout(100);
    const transitionSnapshot = await page.waitForFunction(({ from, to }) => {
      const globe = document.querySelector(".three-globe");
      const isTransitioning = globe?.getAttribute("data-transition-from") === from && globe?.getAttribute("data-transition-to") === to && globe?.getAttribute("data-is-transitioning") === "true" && globe?.getAttribute("data-active-marker") === to;
      if (!isTransitioning) return false;
      return {
        longitude: globe?.getAttribute("data-focus-longitude"),
        focusRotationY: globe?.getAttribute("data-focus-rotation-y-current"),
        focusProgress: globe?.getAttribute("data-focus-progress"),
        marker: globe?.getAttribute("data-active-marker"),
        transitionFrom: globe?.getAttribute("data-transition-from"),
        transitionTo: globe?.getAttribute("data-transition-to"),
        isTransitioning: globe?.getAttribute("data-is-transitioning"),
        badge: document.querySelector(".globe-badge")?.textContent?.replace(/\s+/g, " ").trim(),
        telemetry: document.querySelector(".telemetry-strip")?.textContent?.replace(/\s+/g, " ").trim(),
        groundDetails: document.querySelector(".ground-portrait-details")?.textContent?.replace(/\s+/g, " ").trim(),
      };
    }, { from: previous, to: target.id }, { timeout: 5_000 });
    const current = await transitionSnapshot.jsonValue();
    const focusRotationAtStart = current.focusRotationY;
    await page.waitForTimeout(140);
    const focusRotationAtEnd = await page.locator(".three-globe").getAttribute("data-focus-rotation-y-current");
    const focusMotionChanged = Boolean(focusRotationAtStart && focusRotationAtEnd && focusRotationAtStart !== focusRotationAtEnd);
    const focusProgressIsActive = Number(current.focusProgress) > 0 && Number(current.focusProgress) < 1;
    if (current.marker !== target.id || current.transitionFrom !== previous || current.transitionTo !== target.id || current.isTransitioning !== "true" || current.longitude === beforeLongitude || !focusMotionChanged || !focusProgressIsActive || !current.badge?.includes(target.label) || !current.telemetry?.includes("altitude") || current.telemetry.includes("—") || !current.groundDetails?.includes("superfície") || !current.groundDetails?.includes("retrato")) {
      throw new Error(`Transição inválida para ${target.label}: ${JSON.stringify({ previous, target, beforeLongitude, current, focusRotationAtStart, focusRotationAtEnd })}`);
    }
    await page.waitForFunction(({ expected }) => {
      const globe = document.querySelector(".three-globe");
      return globe?.getAttribute("data-transition-from") === "" && globe?.getAttribute("data-transition-to") === expected && globe?.getAttribute("data-is-transitioning") === "false";
    }, { expected: target.id }, { timeout: 3_000 });
    const settled = await page.evaluate(() => ({ from: document.querySelector(".three-globe")?.getAttribute("data-transition-from"), to: document.querySelector(".three-globe")?.getAttribute("data-transition-to"), isTransitioning: document.querySelector(".three-globe")?.getAttribute("data-is-transitioning") }));
    if (settled.from || settled.to !== target.id || settled.isTransitioning !== "false") throw new Error(`Transição não estabilizou para ${target.label}: ${JSON.stringify(settled)}`);
    results.push({ from: previous, to: target.id, longitudeChanged: current.longitude !== beforeLongitude, focusMotion: { start: focusRotationAtStart, end: focusRotationAtEnd, changed: focusMotionChanged }, animated: current.isTransitioning === "true", marker: current.marker, telemetryUpdated: true, groundDetailsPresent: Boolean(current.groundDetails), settled });
    previous = target.id;
  }

  await page.screenshot({ path: `/home/ubuntu/webdev-static-assets/orbit-transition-${mobileMode ? "mobile" : "desktop"}.png`, fullPage: false });
  console.log(JSON.stringify({ verification: "passed", viewport: mobileMode ? "mobile" : "desktop", transitions: results }, null, 2));
} finally {
  await browser.close();
}
