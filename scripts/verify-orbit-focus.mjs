import { chromium } from "playwright";

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });

try {
  await page.goto("http://localhost:3000/", { waitUntil: "domcontentloaded" });
  await page.waitForSelector(".orbit-marker", { timeout: 25_000 });
  await page.waitForFunction(() => document.querySelectorAll(".orbit-marker").length === 4, undefined, { timeout: 25_000 });

  const beforeRotation = await page.locator(".globe-frame-interactive").evaluate(node => node.style.getPropertyValue("--globe-rotation"));
  await page.getByRole("button", { name: "Hubble", exact: true }).click();
  await page.waitForFunction(() => {
    const activeMarker = document.querySelector(".orbit-marker.is-selected")?.getAttribute("aria-label");
    const title = document.querySelector(".object-focus-copy h2")?.textContent;
    const imageAlt = document.querySelector(".object-focus-image img")?.getAttribute("alt");
    return activeMarker?.includes("Hubble") && title?.includes("Hubble") && imageAlt?.includes("Hubble");
  }, undefined, { timeout: 12_000 });

  const after = await page.evaluate(() => ({
    activeMarker: document.querySelector(".orbit-marker.is-selected")?.getAttribute("aria-label"),
    title: document.querySelector(".object-focus-copy h2")?.textContent?.trim(),
    imageAlt: document.querySelector(".object-focus-image img")?.getAttribute("alt"),
    rotation: document.querySelector(".globe-frame-interactive")?.getAttribute("style"),
    telemetry: document.querySelector(".telemetry-strip")?.textContent?.replace(/\s+/g, " ").trim(),
    groundLocation: document.querySelector(".ground-location-card strong")?.textContent?.trim(),
  }));

  const hasTelemetry = Boolean(after.telemetry?.includes("altitude") && after.telemetry?.includes("velocidade") && !after.telemetry?.includes("—"));
  const hasGroundLocation = Boolean(after.groundLocation && !after.groundLocation.includes("identificando"));
  if (!after.activeMarker?.includes("Hubble") || !after.title?.includes("Hubble") || !after.imageAlt?.includes("Hubble") || beforeRotation === after.rotation || !hasTelemetry || !hasGroundLocation) {
    throw new Error(`A interação de foco não atualizou todos os elementos: ${JSON.stringify({ beforeRotation, after })}`);
  }

  await page.screenshot({ path: "/home/ubuntu/webdev-static-assets/hubble-focus-e2e.png", fullPage: false });
  console.log(JSON.stringify({ verification: "passed", beforeRotation, after }, null, 2));
} finally {
  await browser.close();
}
