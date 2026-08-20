import { chromium } from "playwright";

const baseUrl = "http://localhost:3000/";

async function inspectDesktop(browser) {
  const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
  await page.goto(baseUrl, { waitUntil: "domcontentloaded" });
  await page.waitForSelector(".three-globe canvas", { timeout: 20_000 });

  const result = await page.evaluate(() => {
    const getSlot = placement => {
      const element = document.querySelector(`[data-ad-slot="${placement}"]`);
      if (!(element instanceof HTMLElement)) return null;
      const style = window.getComputedStyle(element);
      const rect = element.getBoundingClientRect();
      return { display: style.display, width: rect.width, height: rect.height, label: element.getAttribute("aria-label") };
    };
    const content = document.querySelector(".observatory-content")?.getBoundingClientRect();
    return {
      left: getSlot("sidebar-left"),
      right: getSlot("sidebar-right"),
      contentWidth: content?.width ?? 0,
      mainCount: document.querySelectorAll("main").length,
      headerCount: document.querySelectorAll("header").length,
      unnamedButtons: [...document.querySelectorAll("button")].filter(button => !(button.getAttribute("aria-label") || button.textContent?.trim())).length,
    };
  });
  await page.close();

  if (!result.left || !result.right || result.left.display === "none" || result.right.display === "none" || result.left.width < 159 || result.right.width < 159 || result.left.height < 599 || result.right.height < 599 || !result.left.label || !result.right.label || result.contentWidth < 900 || result.mainCount !== 1 || result.headerCount !== 1 || result.unnamedButtons !== 0) {
    throw new Error(`Layout desktop inválido: ${JSON.stringify(result)}`);
  }
  return result;
}

async function inspectMobile(browser) {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  await page.goto(baseUrl, { waitUntil: "domcontentloaded" });
  await page.waitForSelector(".three-globe canvas", { timeout: 20_000 });

  const result = await page.evaluate(() => {
    const left = document.querySelector('[data-ad-slot="sidebar-left"]');
    const right = document.querySelector('[data-ad-slot="sidebar-right"]');
    const feed = document.querySelector('[data-ad-slot="feed-mobile"]');
    if (!(left instanceof HTMLElement) || !(right instanceof HTMLElement) || !(feed instanceof HTMLElement)) return null;
    const feedStyle = window.getComputedStyle(feed);
    const feedRect = feed.getBoundingClientRect();
    return {
      leftDisplay: window.getComputedStyle(left).display,
      rightDisplay: window.getComputedStyle(right).display,
      feedDisplay: feedStyle.display,
      feedWidth: feedRect.width,
      feedHeight: feedRect.height,
      feedLabel: feed.getAttribute("aria-label"),
      horizontalOverflow: document.documentElement.scrollWidth > document.documentElement.clientWidth,
    };
  });
  await page.close();

  if (!result || result.leftDisplay !== "none" || result.rightDisplay !== "none" || result.feedDisplay === "none" || result.feedWidth > 358 || result.feedHeight < 131 || !result.feedLabel || result.horizontalOverflow) {
    throw new Error(`Layout móvel inválido: ${JSON.stringify(result)}`);
  }
  return result;
}

const browser = await chromium.launch({ headless: true });
try {
  const desktop = await inspectDesktop(browser);
  const mobile = await inspectMobile(browser);
  console.log(JSON.stringify({ verification: "passed", desktop, mobile }, null, 2));
} finally {
  await browser.close();
}
