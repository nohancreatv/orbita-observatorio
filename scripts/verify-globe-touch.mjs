import { chromium } from "playwright";

const browser = await chromium.launch({ headless: true, executablePath: "/usr/bin/chromium", args: ["--no-sandbox"] });
const baseUrl = process.env.BASE_URL || "http://localhost:3000/";
const page = await browser.newPage({ viewport: { width: 390, height: 1400 }, hasTouch: true, isMobile: true });
try {
  await page.goto(baseUrl, { waitUntil: "domcontentloaded" });
  const canvas = page.locator(".three-globe canvas");
  await canvas.waitFor({ state: "visible", timeout: 25_000 });
  await page.waitForFunction(() => document.querySelector(".three-globe")?.getAttribute("data-marker-count") === "10", undefined, { timeout: 30_000 });
  await page.waitForTimeout(800);
  const rect = await canvas.boundingBox();
  const initial = await page.locator(".three-globe").getAttribute("data-active-marker");
  if (!rect) throw new Error("Canvas sem bounding box em mobile");

  let selectedByTouch = null;
  for (let y = rect.y + 10; y < rect.y + rect.height - 10 && !selectedByTouch; y += 12) {
    for (let x = rect.x + 10; x < rect.x + rect.width - 10 && !selectedByTouch; x += 12) {
      await page.touchscreen.tap(x, y);
      await page.waitForTimeout(20);
      const active = await page.locator(".three-globe").getAttribute("data-active-marker");
      if (active !== initial) selectedByTouch = { x: Math.round(x), y: Math.round(y), active };
    }
  }
  if (!selectedByTouch) throw new Error(`Toque no Canvas não alterou o marker ativo: ${JSON.stringify({ rect, initial })}`);

  const beforeDrag = await page.locator(".three-globe").getAttribute("data-rotation-y");
  const startX = rect.x + rect.width * 0.48;
  const startY = rect.y + rect.height * 0.52;
  const endX = startX + 58;
  const endY = startY + 12;
  await page.evaluate(({ startX, startY }) => {
    const target = document.querySelector(".three-globe canvas");
    if (!target) throw new Error("Canvas não encontrado para touch drag");
    const touch = new Touch({ identifier: 1, target, clientX: startX, clientY: startY, pageX: startX, pageY: startY, screenX: startX, screenY: startY, radiusX: 1, radiusY: 1, rotationAngle: 0, force: 1 });
    target.dispatchEvent(new TouchEvent("touchstart", { bubbles: true, cancelable: true, touches: [touch], targetTouches: [touch], changedTouches: [touch] }));
  }, { startX, startY });
  await page.evaluate(({ startX, startY, endX, endY }) => {
    const target = document.querySelector(".three-globe canvas");
    if (!target) throw new Error("Canvas não encontrado para touch move");
    const touch = new Touch({ identifier: 1, target, clientX: endX, clientY: endY, pageX: endX, pageY: endY, screenX: endX, screenY: endY, radiusX: 1, radiusY: 1, rotationAngle: 0, force: 1 });
    target.dispatchEvent(new TouchEvent("touchmove", { bubbles: true, cancelable: true, touches: [touch], targetTouches: [touch], changedTouches: [touch] }));
  }, { startX, startY, endX, endY });
  await page.evaluate(({ endX, endY }) => {
    const target = document.querySelector(".three-globe canvas");
    if (!target) throw new Error("Canvas não encontrado para touch end");
    const touch = new Touch({ identifier: 1, target, clientX: endX, clientY: endY, pageX: endX, pageY: endY, screenX: endX, screenY: endY, radiusX: 1, radiusY: 1, rotationAngle: 0, force: 0 });
    target.dispatchEvent(new TouchEvent("touchend", { bubbles: true, cancelable: true, touches: [], targetTouches: [], changedTouches: [touch] }));
  }, { endX, endY });
  await page.waitForTimeout(80);
  const afterDrag = await page.locator(".three-globe").getAttribute("data-rotation-y");
  if (beforeDrag === afterDrag) throw new Error(`Touch drag não alterou a rotação: ${JSON.stringify({ beforeDrag, afterDrag })}`);

  console.log(JSON.stringify({ verification: "passed", viewport: "mobile-touch", initial, selectedByTouch, drag: { before: beforeDrag, after: afterDrag, changed: beforeDrag !== afterDrag } }, null, 2));
} finally {
  await browser.close();
}
