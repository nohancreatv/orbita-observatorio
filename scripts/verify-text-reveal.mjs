import { chromium } from "playwright";

const baseUrl = "http://localhost:3000";
const routes = ["/", "/fontes", "/privacidade", "/termos", "/rota-inexistente"];
const browser = await chromium.launch({ headless: true, executablePath: "/usr/bin/chromium", args: ["--no-sandbox"] });

try {
  const regular = await browser.newContext({ viewport: { width: 1280, height: 900 }, reducedMotion: "no-preference" });
  const regularResults = [];
  for (const route of routes) {
    const page = await regular.newPage();
    await page.goto(`${baseUrl}${route}`, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(700);
    const aboveFold = await page.evaluate(() => [...document.querySelectorAll(".text-reveal")].map(element => ({ visible: element.classList.contains("is-visible"), tag: element.tagName, top: element.getBoundingClientRect().top })));
    await page.evaluate(async () => {
      const step = Math.max(240, Math.floor(window.innerHeight * 0.78));
      for (let top = 0; top < document.body.scrollHeight; top += step) {
        window.scrollTo({ top, behavior: "instant" });
        await new Promise(resolve => setTimeout(resolve, 180));
      }
      window.scrollTo({ top: document.body.scrollHeight, behavior: "instant" });
    });
    await page.waitForTimeout(700);
    const afterScroll = await page.evaluate(() => {
      const reveals = [...document.querySelectorAll(".text-reveal")];
      const children = reveals.flatMap(element => [...element.children]);
      return {
        revealCount: reveals.length,
        visibleCount: reveals.filter(element => element.classList.contains("is-visible")).length,
        childStates: children.map(element => ({ opacity: window.getComputedStyle(element).opacity, transform: window.getComputedStyle(element).transform, clipPath: window.getComputedStyle(element).clipPath })),
        telemetryAnimated: Boolean(document.querySelector(".telemetry-strip.text-reveal")),
      };
    });
    regularResults.push({ route, aboveFold, afterScroll });
    await page.close();
  }
  await regular.close();

  const reduced = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: "reduce" });
  const reducedResults = [];
  for (const route of routes) {
    const page = await reduced.newPage();
    await page.goto(`${baseUrl}${route}`, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(200);
    const result = await page.evaluate(() => [...document.querySelectorAll(".text-reveal")].map(element => {
      const style = window.getComputedStyle(element);
      return { visible: element.classList.contains("is-visible"), opacity: style.opacity, transform: style.transform };
    }));
    reducedResults.push({ route, result });
    await page.close();
  }
  await reduced.close();

  const allRegularValid = regularResults.every(({ afterScroll }) => afterScroll.revealCount > 0 && afterScroll.visibleCount === afterScroll.revealCount && afterScroll.childStates.every(item => item.opacity === "1" && item.transform !== "none") && !afterScroll.telemetryAnimated);
  const allReducedValid = reducedResults.every(({ result }) => result.length > 0 && result.every(item => item.opacity === "1" && item.transform === "none"));
  if (!allRegularValid || !allReducedValid) throw new Error(JSON.stringify({ regularResults, reducedResults }));
  console.log(JSON.stringify({ verification: "passed", regularResults, reducedResults }, null, 2));
} finally {
  await browser.close();
}
