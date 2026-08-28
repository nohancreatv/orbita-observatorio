import { chromium } from "playwright";

const baseUrl = process.env.BASE_URL || "http://localhost:3000/";
const viewports = [
  { name: "desktop", width: 1280, height: 720 },
  { name: "user-capture", width: 792, height: 892 },
  { name: "mobile", width: 390, height: 844 },
];
const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROMIUM_PATH || "/usr/bin/chromium", args: ["--no-sandbox"] });

function measureTitle() {
  const title = document.querySelector(".hero-section h1");
  const words = Array.from(title?.querySelectorAll(".word-reveal") || []).map(word => {
    const inner = word.querySelector(".word-reveal__inner");
    const wordBox = word.getBoundingClientRect();
    const innerBox = inner?.getBoundingClientRect();
    const innerStyle = inner ? getComputedStyle(inner) : null;
    return {
      text: word.textContent?.trim() || "",
      contained: Boolean(innerBox && wordBox.top <= innerBox.top + 0.5 && wordBox.bottom + 0.5 >= innerBox.bottom),
      revealed: innerStyle?.opacity === "1" && innerStyle.clipPath === "inset(0px)",
    };
  });
  const titleBox = title?.getBoundingClientRect();
  const style = title ? getComputedStyle(title) : null;
  return {
    exists: Boolean(title),
    text: title?.textContent?.trim() || null,
    wordCount: words.length,
    revealedWords: words.filter(word => word.revealed).length,
    containedWords: words.filter(word => word.contained).length,
    h1Overflow: style?.overflow || null,
    h1ScrollHeight: title?.scrollHeight ?? null,
    h1ClientHeight: title?.clientHeight ?? null,
    box: titleBox ? { top: titleBox.top, bottom: titleBox.bottom, height: titleBox.height } : null,
  };
}

try {
  const results = [];
  for (const viewport of viewports) {
    const page = await browser.newPage({ viewport });
    await page.goto(`${baseUrl}${baseUrl.includes("?") ? "&" : "?"}title_verify=${viewport.name}`, { waitUntil: "networkidle", timeout: 45_000 });
    await page.waitForSelector(".hero-section h1", { timeout: 30_000 });
    await page.evaluate(() => document.fonts?.ready);
    await page.waitForTimeout(1500);
    const metrics = await page.evaluate(measureTitle);
    if (!metrics.exists || metrics.wordCount !== 9 || metrics.revealedWords !== 9 || metrics.containedWords !== 9 || metrics.h1Overflow !== "visible" || metrics.h1ScrollHeight !== metrics.h1ClientHeight) {
      throw new Error(`Título incompleto em ${viewport.name}: ${JSON.stringify(metrics)}`);
    }
    results.push({ viewport, metrics });
    await page.close();
  }
  console.log(JSON.stringify({ verification: "passed", results }, null, 2));
} finally {
  await browser.close();
}
