import { chromium } from "playwright";

const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROMIUM_PATH || "/usr/bin/chromium", args: ["--no-sandbox"] });
const viewports = [
  { name: "desktop", width: 1440, height: 900 },
  { name: "tablet", width: 768, height: 900 },
  { name: "mobile", width: 390, height: 844 },
];

try {
  const results = [];
  for (const viewport of viewports) {
    const context = await browser.newContext({ viewport: { width: viewport.width, height: viewport.height } });
    const page = await context.newPage();
    await page.addInitScript(() => localStorage.setItem("orbita-cookie-consent-v1", JSON.stringify({ advertising: false, analytics: false, updatedAt: new Date().toISOString(), version: 1 })));
    await page.goto("http://localhost:3000/", { waitUntil: "domcontentloaded" });
    await page.waitForSelector(".three-globe canvas", { timeout: 25_000 });
    await page.waitForFunction(() => document.querySelector(".three-globe")?.getAttribute("data-marker-count") === "10", undefined, { timeout: 30_000 });
    await page.waitForTimeout(900);

    const metrics = await page.evaluate(() => {
      const stage = document.querySelector(".orbital-stage")?.getBoundingClientRect();
      const globe = document.querySelector(".three-globe")?.getBoundingClientRect();
      const badge = document.querySelector(".globe-badge")?.getBoundingClientRect();
      const captions = [...document.querySelectorAll(".orbit-caption")].map(element => {
        const rect = element.getBoundingClientRect();
        return { left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom };
      });
      const epsilon = 1;
      const inside = (rect, parent) => Boolean(rect && parent && rect.left >= parent.left - epsilon && rect.right <= parent.right + epsilon && rect.top >= parent.top - epsilon && rect.bottom <= parent.bottom + epsilon);
      return {
        viewport: { width: innerWidth, height: innerHeight },
        renderer: document.querySelector(".three-globe")?.getAttribute("data-renderer"),
        markerCount: Number(document.querySelector(".three-globe")?.getAttribute("data-marker-count")),
        stage: stage && { width: stage.width, height: stage.height },
        globe: globe && { width: globe.width, height: globe.height, insideHorizontalStage: Boolean(globe && stage && globe.left >= stage.left - epsilon && globe.right <= stage.right + epsilon), insideStageEnvelope: Boolean(globe && stage && globe.top >= stage.top - 80 && globe.bottom <= stage.bottom + 80) },
        badge: badge && { width: badge.width, height: badge.height, insideStage: inside(badge, stage) },
        captions: captions.filter(rect => rect.width > 0 && rect.height > 0).map(rect => ({ ...rect, insideStage: inside(rect, stage) })),
        documentWidth: document.documentElement.scrollWidth,
        bodyWidth: document.body.scrollWidth,
      };
    });

    await page.screenshot({ path: `/home/ubuntu/webdev-static-assets/orbit-layout-${viewport.name}.png`, fullPage: false });
    if (metrics.renderer !== "react-three-fiber" || metrics.markerCount !== 10 || !metrics.globe || metrics.globe.width <= 0 || metrics.globe.height <= 0 || !metrics.globe.insideHorizontalStage || !metrics.globe.insideStageEnvelope || !metrics.badge?.insideStage || metrics.captions.some(caption => !caption.insideStage) || metrics.documentWidth > viewport.width + 1 || metrics.bodyWidth > viewport.width + 1) {
      throw new Error(`Layout inválido em ${viewport.name}: ${JSON.stringify(metrics)}`);
    }
    results.push({ name: viewport.name, ...metrics, screenshot: `/home/ubuntu/webdev-static-assets/orbit-layout-${viewport.name}.png` });
    await context.close();
  }

  const interactionContext = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const interactionPage = await interactionContext.newPage();
  await interactionPage.addInitScript(() => localStorage.setItem("orbita-cookie-consent-v1", JSON.stringify({ advertising: false, analytics: false, updatedAt: new Date().toISOString(), version: 1 })));
  await interactionPage.goto("http://localhost:3000/", { waitUntil: "domcontentloaded" });
  await interactionPage.waitForFunction(() => document.querySelector(".three-globe")?.getAttribute("data-marker-count") === "10", undefined, { timeout: 30_000 });
  const box = await interactionPage.locator(".three-globe").boundingBox();
  if (!box) throw new Error("Globo sem bounding box para o teste de drag.");
  const beforeDrag = await interactionPage.locator(".three-globe").screenshot({ type: "png" });
  await interactionPage.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await interactionPage.mouse.down();
  await interactionPage.mouse.move(box.x + box.width / 2 + 120, box.y + box.height / 2 + 24, { steps: 8 });
  await interactionPage.mouse.up();
  await interactionPage.waitForTimeout(180);
  const afterDrag = await interactionPage.locator(".three-globe").screenshot({ type: "png" });
  const dragChanged = !beforeDrag.equals(afterDrag);
  if (!dragChanged) throw new Error("Drag não alterou a renderização visual do globo.");
  await interactionContext.close();

  console.log(JSON.stringify({ verification: "passed", layouts: results, dragInteraction: { changed: dragChanged } }, null, 2));
} finally {
  await browser.close();
}
