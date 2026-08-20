import { chromium } from "playwright";

const browser = await chromium.launch({ headless: true });
const viewports = [
  { name: 'desktop', width: 1280, height: 720 },
  { name: 'mobile', width: 390, height: 844 },
];
const results = [];

try {
  for (const viewport of viewports) {
    const page = await browser.newPage({ viewport });
    await page.goto('http://localhost:3000/', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('.three-globe canvas', { timeout: 20_000 });
    await page.waitForTimeout(1200);
    const metrics = await page.evaluate(async () => {
      const frames = [];
      let previous = performance.now();
      for (let index = 0; index < 45; index += 1) {
        await new Promise(requestAnimationFrame);
        const current = performance.now();
        frames.push(current - previous);
        previous = current;
      }
      const sorted = [...frames].sort((a, b) => a - b);
      const averageFrameMs = frames.reduce((sum, value) => sum + value, 0) / frames.length;
      const percentile95FrameMs = sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * .95))];
      return {
        averageFrameMs: Number(averageFrameMs.toFixed(2)),
        percentile95FrameMs: Number(percentile95FrameMs.toFixed(2)),
        canvasCount: document.querySelectorAll('.three-globe canvas').length,
        markerCount: document.querySelector('.three-globe')?.getAttribute('data-active-marker') ? 4 : 0,
      };
    });
    if (metrics.canvasCount !== 1 || metrics.averageFrameMs > 42 || metrics.percentile95FrameMs > 70) {
      throw new Error(`${viewport.name}: orçamento de renderização excedido: ${JSON.stringify(metrics)}`);
    }
    results.push({ viewport: viewport.name, ...metrics });
    await page.close();
  }
  console.log(JSON.stringify({ verification: 'passed', renderer: 'react-three-fiber', results }, null, 2));
} finally {
  await browser.close();
}
