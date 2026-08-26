import { chromium } from "playwright";

const baseUrl = process.env.BASE_URL || "http://localhost:3000";
const siteOrigin = (process.env.SITE_ORIGIN || "https://satellite-now.netlify.app").replace(/\/+$/, "");
const routes = [
  ["/", "Órbita — ISS acima de você"],
  ["/privacidade", "Privacidade — Órbita"],
  ["/termos", "Termos de uso — Órbita"],
  ["/fontes", "Fontes e limites — Órbita"],
];

const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROMIUM_PATH || "/usr/bin/chromium", args: ["--no-sandbox"] });
const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
const page = await context.newPage();

try {
  const routeResults = [];
  for (const [path, title] of routes) {
    const response = await page.goto(`${baseUrl}${path}`, { waitUntil: "domcontentloaded" });
    await page.waitForSelector("main", { timeout: 10_000 });
    const metadata = await page.evaluate(() => ({
      title: document.title,
      lang: document.documentElement.lang,
      description: document.querySelector('meta[name="description"]')?.getAttribute("content"),
      canonical: document.querySelector('link[rel="canonical"]')?.getAttribute("href"),
      ogTitle: document.querySelector('meta[property="og:title"]')?.getAttribute("content"),
      h1Count: document.querySelectorAll("h1").length,
      unnamedButtons: [...document.querySelectorAll("button")].filter(button => !(button.textContent || "").trim() && !button.getAttribute("aria-label")).length,
      xRobotsTag: null,
    }));
    if (!response?.ok() || metadata.title !== title || metadata.lang !== "pt-BR" || !metadata.description || !metadata.canonical?.startsWith(`${siteOrigin}/`) || metadata.ogTitle !== title || metadata.h1Count !== 1 || metadata.unnamedButtons !== 0) throw new Error(`Rota inválida ${path}: ${JSON.stringify({ status: response?.status(), metadata })}`);
    routeResults.push({ path, status: response.status(), title: metadata.title });
  }

  await page.goto(`${baseUrl}/rota-inexistente`, { waitUntil: "domcontentloaded" });
  await page.getByRole("heading", { name: "404" }).waitFor();
  await page.getByRole("button", { name: "voltar ao observatório" }).waitFor();
  const notFoundMeta = await page.evaluate(() => ({ title: document.title, robots: document.querySelector('meta[name="robots"]')?.getAttribute("content"), consentVisible: Boolean(document.querySelector(".cookie-consent")) }));
  if (notFoundMeta.title !== "Página não encontrada — Órbita" || notFoundMeta.robots !== "noindex, nofollow" || notFoundMeta.consentVisible) throw new Error(`404 inválida: ${JSON.stringify(notFoundMeta)}`);

  await page.goto(`${baseUrl}/?force-error-boundary`, { waitUntil: "domcontentloaded" });
  await page.getByRole("alert").waitFor();
  const recovery = await page.evaluate(() => ({ copy: document.body.textContent, stackExposed: Boolean(document.querySelector("pre")), reloadControl: Boolean(document.querySelector("button")), consentVisible: Boolean(document.querySelector(".cookie-consent")) }));
  if (!recovery.copy.includes("interferência") || recovery.stackExposed || !recovery.reloadControl || recovery.consentVisible) throw new Error(`Recuperação de erro inválida: ${JSON.stringify(recovery)}`);

  const [sitemapResponse, manifestResponse, robotsResponse] = await Promise.all([page.request.get(`${baseUrl}/sitemap.xml`), page.request.get(`${baseUrl}/site.webmanifest`), page.request.get(`${baseUrl}/robots.txt`)]);
  const sitemap = await sitemapResponse.text();
  const manifest = await manifestResponse.json();
  const robots = await robotsResponse.text();
  if (!sitemapResponse.ok() || !manifestResponse.ok() || !robotsResponse.ok() || !sitemap.includes(`${siteOrigin}/`) || manifest.start_url !== "/" || manifest.scope !== "/" || !robots.includes(`Sitemap: ${siteOrigin}/sitemap.xml`) || robots.includes("Disallow: /")) throw new Error("Ativos públicos de SEO inválidos.");

  const rawHome = await page.request.get(`${baseUrl}/`);
  const rawPrivacy = await page.request.get(`${baseUrl}/privacidade`);
  const rawNotFound = await page.request.get(`${baseUrl}/rota-inexistente`);
  const [rawHomeHtml, rawPrivacyHtml, rawNotFoundHtml] = await Promise.all([rawHome.text(), rawPrivacy.text(), rawNotFound.text()]);
  const rawHeaders = [rawHome, rawPrivacy, rawNotFound].map(response => response.headers());
  if (!rawHome.ok() || !rawPrivacy.ok() || rawNotFound.status() !== 404 || rawHeaders.some(headers => headers["x-robots-tag"]) || !rawHomeHtml.includes("<h1>Órbita — ISS acima de você</h1>") || !rawPrivacyHtml.includes("<h1>Política de privacidade</h1>") || !rawPrivacyHtml.includes("<title>Privacidade — Órbita</title>") || !rawPrivacyHtml.includes(`href="${siteOrigin}/privacidade"`) || !rawNotFoundHtml.includes("<h1>Página não encontrada — Órbita</h1>") || !rawNotFoundHtml.includes('content="noindex, nofollow"')) throw new Error("Metadados ou conteúdo HTML pré-renderizado inválidos.");

  await page.goto(`${baseUrl}/`, { waitUntil: "domcontentloaded" });
  await page.getByRole("button", { name: "aceitar publicidade" }).click();
  await page.waitForTimeout(350);
  const analytics = await page.evaluate(() => ({ scriptCount: document.querySelectorAll('script[src*="googletagmanager.com/gtag/js?id=G-4EQ06VWWVE"]').length, dataLayerReady: Array.isArray(window.dataLayer), hasConfig: window.dataLayer?.some(entry => entry[0] === "config" && entry[1] === "G-4EQ06VWWVE") }));
  if (analytics.scriptCount !== 1 || !analytics.dataLayerReady || !analytics.hasConfig) throw new Error(`Google Analytics inválido: ${JSON.stringify(analytics)}`);

  console.log(JSON.stringify({ verification: "passed", routeResults, notFoundMeta, recovery: { stackExposed: recovery.stackExposed, reloadControl: recovery.reloadControl }, manifest: { startUrl: manifest.start_url, scope: manifest.scope }, analytics }, null, 2));
} finally {
  await context.close();
  await browser.close();
}
