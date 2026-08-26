import { chromium } from "playwright";

const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROMIUM_PATH || "/usr/bin/chromium", args: ["--no-sandbox"] });
const baseUrl = process.env.BASE_URL || "http://localhost:3000";
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
await page.addInitScript(() => {
  const originalRequestAnimationFrame = window.requestAnimationFrame.bind(window);
  let frameCount = 0;
  window.requestAnimationFrame = callback => originalRequestAnimationFrame(timestamp => {
    frameCount += 1;
    callback(timestamp);
  });
  Object.defineProperty(window, "__orbitFrameCount", { get: () => frameCount });
});

try {
  await page.goto(`${baseUrl}/`, { waitUntil: "domcontentloaded" });
  const globe = page.locator(".three-globe");
  const canvas = page.locator(".three-globe canvas");
  await canvas.waitFor({ timeout: 25_000 });
  await page.waitForFunction(() => document.querySelector(".three-globe")?.getAttribute("data-renderer") === "react-three-fiber", undefined, { timeout: 25_000 });
  await page.waitForFunction(() => document.querySelector(".three-globe")?.getAttribute("data-marker-count") === "10", undefined, { timeout: 30_000 });
  await page.waitForTimeout(500);
  const before = await globe.screenshot({ type: "png" });
  const rotationBefore = await globe.getAttribute("data-rotation-y");
  const frameCountBefore = await page.evaluate(() => window.__orbitFrameCount || 0);
  await page.waitForTimeout(1200);
  const after = await globe.screenshot({ type: "png" });
  const rotationAfter = await globe.getAttribute("data-rotation-y");
  const rotationChanged = rotationBefore !== null && rotationAfter !== null && rotationBefore !== rotationAfter;
  const result = await page.evaluate(() => ({
    renderer: document.querySelector(".three-globe")?.getAttribute("data-renderer"),
    markerCount: Number(document.querySelector(".three-globe")?.getAttribute("data-marker-count")),
    reducedMotion: document.querySelector(".three-globe")?.getAttribute("data-reduced-motion"),
    canvasWidth: document.querySelector(".three-globe canvas")?.width || 0,
    canvasHeight: document.querySelector(".three-globe canvas")?.height || 0,
    frameCount: window.__orbitFrameCount || 0,
  }));
  const changed = !before.equals(after);
  if (result.renderer !== "react-three-fiber" || result.markerCount !== 10 || result.canvasWidth <= 0 || result.canvasHeight <= 0 || result.reducedMotion !== "false" || result.frameCount - frameCountBefore < 30 || !changed || !rotationChanged) {
    throw new Error(`Rotação/renderização inválida: ${JSON.stringify({ result, frameCountBefore, changed, rotationBefore, rotationAfter, rotationChanged })}`);
  }
  console.log(JSON.stringify({ verification: "passed", automaticLoop: true, visualCanvasChanged: changed, rotationChanged, rotationBefore, rotationAfter, framesDuringWindow: result.frameCount - frameCountBefore, renderer: result.renderer, markerCount: result.markerCount, canvas: { width: result.canvasWidth, height: result.canvasHeight } }, null, 2));
} finally {
  await browser.close();
}
