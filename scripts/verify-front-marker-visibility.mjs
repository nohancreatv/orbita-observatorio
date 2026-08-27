import { chromium } from "playwright";

const baseUrl = process.env.BASE_URL || "http://localhost:3000/";
const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROMIUM_PATH || "/usr/bin/chromium", args: ["--no-sandbox"] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });

try {
  await page.goto(baseUrl, { waitUntil: "domcontentloaded" });
  await page.waitForSelector(".three-globe canvas", { timeout: 30_000 });
  await page.waitForFunction(() => document.querySelector(".three-globe")?.getAttribute("data-marker-count") === "10", undefined, { timeout: 30_000 });
  await page.waitForFunction(() => document.querySelector(".three-globe")?.getAttribute("data-visible-marker-ids")?.length > 0, undefined, { timeout: 10_000 });

  const initial = await page.evaluate(() => {
    const globe = document.querySelector(".three-globe");
    const ids = (globe?.getAttribute("data-visible-marker-ids") || "").split(",").filter(Boolean);
    return {
      frontOnly: globe?.getAttribute("data-front-hemisphere-only") === "true",
      markerCount: Number(globe?.getAttribute("data-marker-count")),
      visibleCount: Number(globe?.getAttribute("data-visible-marker-count")),
      visibleIds: ids,
      visibleLessThanTotal: ids.length < 10,
    };
  });
  if (!initial.frontOnly || initial.markerCount !== 10 || initial.visibleCount !== initial.visibleIds.length || !initial.visibleLessThanTotal) {
    throw new Error(`Oclusão inicial inválida: ${JSON.stringify(initial)}`);
  }

  const canvas = page.locator(".three-globe canvas");
  const box = await canvas.boundingBox();
  if (!box) throw new Error("Canvas do globo sem bounding box.");
  await page.mouse.move(box.x + box.width * .5, box.y + box.height * .5);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width * .9, box.y + box.height * .5, { steps: 12 });
  await page.mouse.up();
  await page.waitForTimeout(180);
  const after = await page.evaluate(() => {
    const globe = document.querySelector(".three-globe");
    return {
      visibleCount: Number(globe?.getAttribute("data-visible-marker-count")),
      visibleIds: (globe?.getAttribute("data-visible-marker-ids") || "").split(",").filter(Boolean),
      rotationY: globe?.getAttribute("data-rotation-y"),
    };
  });
  if (after.visibleCount !== after.visibleIds.length || initial.visibleIds.join(",") === after.visibleIds.join(",")) {
    throw new Error(`Oclusão não acompanhou a rotação: ${JSON.stringify({ initial, after })}`);
  }

  const selected = await page.evaluate(() => document.querySelector(".three-globe")?.getAttribute("data-active-marker"));
  console.log(JSON.stringify({ verification: "passed", initial, after, selected }, null, 2));
} finally {
  await browser.close();
}
