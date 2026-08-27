import { chromium } from "playwright";

const baseUrl = process.env.BASE_URL || "http://localhost:3000/";
const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROMIUM_PATH || "/usr/bin/chromium", args: ["--no-sandbox"] });

try {
  const staticPage = await browser.newPage({ javaScriptEnabled: false, viewport: { width: 790, height: 313 } });
  await staticPage.goto(baseUrl, { waitUntil: "domcontentloaded" });
  const staticState = await staticPage.evaluate(() => {
    const root = document.querySelector("#root");
    const shell = document.querySelector("#orbita-critical-shell");
    const nav = document.querySelector(".seo-static-content nav");
    const link = document.querySelector('link[rel="stylesheet"]');
    const preload = document.querySelector('link[rel="preload"][as="style"]');
    const rootStyle = root ? getComputedStyle(root) : null;
    const navStyle = nav ? getComputedStyle(nav) : null;
    return {
      criticalStyle: Boolean(shell),
      stylesheet: link?.getAttribute("href") || null,
      preload: preload?.getAttribute("href") || null,
      background: rootStyle?.backgroundColor || null,
      navDisplay: navStyle?.display || null,
      navGap: navStyle?.columnGap || null,
      rawTextJoined: document.body.innerText.includes("fontes e limitespolítica de privacidade"),
    };
  });
  if (!staticState.criticalStyle || !staticState.stylesheet || staticState.preload !== staticState.stylesheet || staticState.navDisplay !== "flex" || staticState.rawTextJoined) {
    throw new Error(`Cold load sem CSS crítico: ${JSON.stringify(staticState)}`);
  }
  await staticPage.screenshot({ path: "/home/ubuntu/webdev-static-assets/orbit-cold-load-fallback.png" });
  await staticPage.close();

  const appPage = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  await appPage.goto(baseUrl, { waitUntil: "networkidle" });
  await appPage.waitForSelector(".three-globe canvas", { timeout: 30_000 });
  const appState = await appPage.evaluate(() => ({
    canvas: Boolean(document.querySelector(".three-globe canvas")),
    markerCount: Number(document.querySelector(".three-globe")?.getAttribute("data-marker-count")),
    cssLoaded: Boolean(document.querySelector('link[rel="stylesheet"]')),
    title: document.querySelector("h1")?.textContent?.trim() || null,
  }));
  if (!appState.canvas || appState.markerCount !== 10 || !appState.cssLoaded) throw new Error(`Aplicação não montou após cold load: ${JSON.stringify(appState)}`);
  console.log(JSON.stringify({ verification: "passed", staticState, appState, screenshot: "/home/ubuntu/webdev-static-assets/orbit-cold-load-fallback.png" }, null, 2));
} finally {
  await browser.close();
}
