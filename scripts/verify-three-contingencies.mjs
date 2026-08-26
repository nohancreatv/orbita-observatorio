import { chromium } from "playwright";

const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROMIUM_PATH || "/usr/bin/chromium", args: ["--no-sandbox"] });
const baseUrl = "http://localhost:3000/";

async function verifyCanvas(page, name, { expectCatalog = true } = {}) {
  await page.waitForSelector(".three-globe canvas", { timeout: 20_000 });
  const renderer = await page.locator(".three-globe").getAttribute("data-renderer");
  if (renderer !== "react-three-fiber") throw new Error(`${name}: Canvas não permaneceu ativo (${renderer})`);
  if (expectCatalog) {
    await page.waitForFunction(() => document.querySelector(".three-globe")?.getAttribute("data-marker-count") === "10", undefined, { timeout: 30_000 });
  }
  const markerCount = await page.locator(".three-globe").getAttribute("data-marker-count");
}

const checks = [];
try {
  const telemetry = await browser.newPage();
  await telemetry.route("**/api/trpc/orbit.allSnapshots**", route => route.abort());
  await telemetry.goto(baseUrl, { waitUntil: "domcontentloaded" });
  await verifyCanvas(telemetry, "telemetria indisponível", { expectCatalog: false });
  await telemetry.waitForFunction(() => document.body.textContent?.includes("O rastreador está indisponível agora."), undefined, { timeout: 30_000 });
  checks.push("telemetria indisponível");

  const nasa = await browser.newPage();
  await nasa.goto(`${baseUrl}?simular-falha-nasa`, { waitUntil: "domcontentloaded" });
  await verifyCanvas(nasa, "NASA simulada");
  await nasa.waitForFunction(() => document.body.textContent?.includes("A janela do cosmos está temporariamente fechada."), undefined, { timeout: 15_000 });
  checks.push("NASA indisponível");

  const nasaAborted = await browser.newPage();
  await nasaAborted.route("**/api/trpc/**", route => {
    const requestUrl = decodeURIComponent(route.request().url());
    if (requestUrl.includes("space.story")) return route.abort();
    return route.continue();
  });
  await nasaAborted.goto(baseUrl, { waitUntil: "domcontentloaded" });
  await verifyCanvas(nasaAborted, "NASA abortada");
  await nasaAborted.waitForFunction(() => document.body.textContent?.includes("A janela do cosmos está temporariamente fechada."), undefined, { timeout: 30_000 });
  checks.push("NASA abortada");

  const denied = await browser.newPage();
  await denied.addInitScript(() => {
    navigator.geolocation.getCurrentPosition = (_success, error) => error?.({ code: 1, message: "denied" });
  });
  await denied.goto(baseUrl, { waitUntil: "domcontentloaded" });
  await verifyCanvas(denied, "geolocalização negada");
  await denied.locator(".hero-section .locate-button").click();
  await denied.waitForFunction(() => document.body.textContent?.includes("Não foi possível acessar a sua localização."), undefined, { timeout: 12_000 });
  checks.push("geolocalização negada");

  const geocode = await browser.newPage();
  await geocode.addInitScript(() => {
    navigator.geolocation.getCurrentPosition = success => success({ coords: { latitude: -23.55, longitude: -46.63 } });
  });
  await geocode.route("**/api/trpc/orbit.userPlace**", route => route.abort());
  await geocode.goto(baseUrl, { waitUntil: "domcontentloaded" });
  await verifyCanvas(geocode, "geocodificação indisponível");
  await geocode.locator(".hero-section .locate-button").click();
  await geocode.waitForFunction(() => document.body.textContent?.includes("Horizonte definido; a cidade não pôde ser identificada agora."), undefined, { timeout: 15_000 });
  checks.push("geocodificação indisponível");

  const horizon = await browser.newPage();
  await horizon.addInitScript(() => {
    navigator.geolocation.getCurrentPosition = success => success({ coords: { latitude: -23.55, longitude: -46.63, accuracy: 18 } });
  });
  await horizon.goto(baseUrl, { waitUntil: "domcontentloaded" });
  await verifyCanvas(horizon, "horizonte local");
  await horizon.locator(".hero-section .locate-button").click();
  await horizon.waitForFunction(() => document.body.textContent?.includes("Horizonte definido para") && document.querySelector(".ground-location-card strong")?.textContent?.trim(), undefined, { timeout: 15_000 });
  checks.push("horizonte local");

  console.log(JSON.stringify({ verification: "passed", renderer: "react-three-fiber", markerCount: 10, contingencies: checks }, null, 2));
} finally {
  await browser.close();
}
