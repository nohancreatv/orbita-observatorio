import { chromium } from "playwright";

const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROMIUM_PATH || "/usr/bin/chromium", args: ["--no-sandbox"] });
const mobileMode = process.env.E2E_MOBILE === "1";
const baseUrl = process.env.BASE_URL || "http://localhost:3000/";
const page = await browser.newPage({ viewport: mobileMode ? { width: 390, height: 844 } : { width: 1280, height: 720 } });

try {
  await page.goto(baseUrl, { waitUntil: "domcontentloaded" });
  await page.waitForSelector(".three-globe canvas", { timeout: 25_000 });
  await page.waitForFunction(() => document.querySelector(".three-globe")?.getAttribute("data-marker-count") === "10", undefined, { timeout: 30_000 });

  const switchButton = page.getByRole("tab", { name: /órbita 2D/i });
  await switchButton.click();
  await page.waitForSelector(".orbit-comparison-2d", { timeout: 15_000 });
  await page.waitForFunction(() => Number(document.querySelector(".orbit-comparison-2d")?.getAttribute("data-trajectory-count")) >= 2, undefined, { timeout: 40_000 });

  const initial = await page.evaluate(() => {
    const panel = document.querySelector(".orbit-comparison-2d");
    return {
      mode: panel?.getAttribute("data-view-mode"),
      trajectoryCount: Number(panel?.getAttribute("data-trajectory-count")),
      selectedCount: Number(panel?.getAttribute("data-selected-trajectory-count")),
      chipCount: document.querySelectorAll(".orbit-comparison-chip").length,
      pathCount: document.querySelectorAll(".orbit-comparison-2d__path").length,
      svg: Boolean(document.querySelector(".orbit-comparison-2d__plot")),
      overflow: document.documentElement.scrollWidth > document.documentElement.clientWidth,
    };
  });
  if (initial.mode !== "2d" || initial.trajectoryCount < 2 || initial.selectedCount !== 2 || initial.chipCount !== 10 || initial.pathCount < 2 || !initial.svg || initial.overflow) {
    throw new Error(`Modo 2D inicial inválido: ${JSON.stringify(initial)}`);
  }

  const noaaButton = page.getByRole("button", { name: /Adicionar NOAA 19/i });
  await noaaButton.click();
  await page.waitForFunction(() => Number(document.querySelector(".orbit-comparison-2d")?.getAttribute("data-selected-trajectory-count")) === 3, undefined, { timeout: 3_000 });
  await page.waitForFunction(() => Number(document.querySelector(".orbit-comparison-2d")?.getAttribute("data-trajectory-count")) >= 3, undefined, { timeout: 40_000 });
  await page.waitForFunction(() => document.querySelector(".orbit-comparison-legend-item.is-active")?.textContent?.includes("NOAA 19"), undefined, { timeout: 3_000 });
  const compared = await page.evaluate(() => ({
    selectedCount: Number(document.querySelector(".orbit-comparison-2d")?.getAttribute("data-selected-trajectory-count")),
    trajectoryCount: Number(document.querySelector(".orbit-comparison-2d")?.getAttribute("data-trajectory-count")),
    activeLegend: document.querySelector(".orbit-comparison-legend-item.is-active")?.textContent?.replace(/\s+/g, " ").trim(),
    pathCount: document.querySelectorAll(".orbit-comparison-2d__path").length,
  }));
  if (compared.selectedCount !== 3 || compared.trajectoryCount < 3 || !compared.activeLegend?.includes("NOAA 19") || compared.pathCount < 3) {
    throw new Error(`Comparação 2D não atualizou: ${JSON.stringify(compared)}`);
  }

  await page.getByRole("tab", { name: /globo 3D/i }).click();
  await page.waitForSelector(".three-globe canvas", { timeout: 15_000 });
  await page.waitForFunction(() => document.querySelector(".three-globe")?.getAttribute("data-marker-count") === "10", undefined, { timeout: 15_000 });
  const restored = await page.evaluate(() => ({
    mode: document.querySelector(".three-globe") ? "3d" : "unknown",
    markerCount: Number(document.querySelector(".three-globe")?.getAttribute("data-marker-count")),
    activeMarker: document.querySelector(".three-globe")?.getAttribute("data-active-marker"),
  }));
  if (restored.mode !== "3d" || restored.markerCount !== 10) throw new Error(`Retorno ao globo 3D inválido: ${JSON.stringify(restored)}`);

  const screenshotPath = `/home/ubuntu/webdev-static-assets/orbit-comparison-${mobileMode ? "mobile" : "desktop"}.png`;
  await page.getByRole("tab", { name: /órbita 2D/i }).click();
  await page.waitForSelector(".orbit-comparison-2d__plot", { timeout: 15_000 });
  await page.screenshot({ path: screenshotPath, fullPage: false });
  console.log(JSON.stringify({ verification: "passed", viewport: mobileMode ? "mobile" : "desktop", screenshotPath, initial, compared, restored }, null, 2));
} finally {
  await browser.close();
}
