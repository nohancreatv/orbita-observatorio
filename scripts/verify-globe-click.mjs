import { chromium } from "playwright";

const browser = await chromium.launch({ headless: true, executablePath: "/usr/bin/chromium", args: ["--no-sandbox"] });
const baseUrl = process.env.BASE_URL || "http://localhost:3000/";
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
try {
  await page.goto(baseUrl, { waitUntil: "domcontentloaded" });
  const canvas = page.locator(".three-globe canvas");
  await canvas.waitFor({ state: "visible", timeout: 25_000 });
  await page.waitForFunction(() => document.querySelector(".three-globe")?.getAttribute("data-marker-count") === "10", undefined, { timeout: 30_000 });
  await page.waitForTimeout(800);
  const rect = await canvas.boundingBox();
  const initial = await page.locator(".three-globe").getAttribute("data-active-marker");
  if (!rect) throw new Error("Canvas sem bounding box");
  let found = null;
  for (let y = rect.y + 12; y < rect.y + rect.height - 12 && !found; y += 12) {
    for (let x = rect.x + 12; x < rect.x + rect.width - 12 && !found; x += 12) {
      await page.mouse.click(x, y);
      await page.waitForTimeout(12);
      const active = await page.locator(".three-globe").getAttribute("data-active-marker");
      if (active !== initial) found = { x: Math.round(x), y: Math.round(y), active };
    }
  }
  const finalActive = await page.locator(".three-globe").getAttribute("data-active-marker");
  if (!found || finalActive === initial) throw new Error(`Clique em marker 3D não alterou a seleção: ${JSON.stringify({ rect, initial, found, finalActive })}`);
  console.log(JSON.stringify({ verification: "passed", rect, initial, found, finalActive }, null, 2));
} finally {
  await browser.close();
}
