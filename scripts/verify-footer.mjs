import { chromium } from "playwright";

const baseUrl = "http://localhost:3000";
const viewports = [
  { name: "desktop", width: 1440, height: 900 },
  { name: "tablet", width: 768, height: 900 },
  { name: "mobile", width: 390, height: 844 },
];
const browser = await chromium.launch({ headless: true, executablePath: "/usr/bin/chromium", args: ["--no-sandbox"] });
const results = [];

try {
  for (const viewport of viewports) {
    const page = await browser.newPage({ viewport: { width: viewport.width, height: viewport.height } });
    await page.goto(baseUrl, { waitUntil: "domcontentloaded" });
    await page.locator("footer.site-footer").scrollIntoViewIfNeeded();
    await page.waitForTimeout(650);
    const result = await page.evaluate(() => {
      const footer = document.querySelector("footer.site-footer");
      const rect = footer?.getBoundingClientRect();
      const text = footer?.textContent?.replace(/\s+/g, " ").trim() || "";
      const anchors = [...document.querySelectorAll("footer.site-footer a")].map(anchor => anchor.getAttribute("href"));
      return {
        footerVisible: Boolean(footer && rect && rect.height > 300),
        width: rect?.width || 0,
        hasLead: Boolean(document.querySelector(".footer-brand__meta")),
        hasConsole: Boolean(document.querySelector(".footer-console__data")),
        hasNavigationGroups: document.querySelectorAll(".footer-nav-group").length === 3,
        hasPreferences: document.querySelectorAll("footer.site-footer button").length >= 2,
        hasStatus: text.includes("canal orbital ativo") && text.includes("objetos rastreados"),
        hasUsefulLinks: ["#inicio", "#objeto", "#telemetria", "/privacidade", "/termos", "/fontes"].every(href => anchors.includes(href)),
        overflow: document.documentElement.scrollWidth > document.documentElement.clientWidth || document.body.scrollWidth > document.body.clientWidth,
        text,
      };
    });
    results.push({ ...viewport, result });
    await page.close();
  }

  if (results.some(({ result }) => !result.footerVisible || !result.hasLead || !result.hasConsole || !result.hasNavigationGroups || !result.hasPreferences || !result.hasStatus || !result.hasUsefulLinks || result.overflow)) {
    throw new Error(JSON.stringify(results));
  }
  console.log(JSON.stringify({ verification: "passed", results }, null, 2));
} finally {
  await browser.close();
}
