import { chromium } from "playwright";

const browser = await chromium.launch({ headless: true });
const baseUrl = "http://localhost:3000/";

async function verifyCanvas(page, name) {
  await page.waitForSelector('.three-globe canvas', { timeout: 20_000 });
  const renderer = await page.locator('.three-globe').getAttribute('data-renderer');
  if (renderer !== 'react-three-fiber') throw new Error(`${name}: canvas 3D não permaneceu ativo`);
}

const checks = [];
try {
  const telemetry = await browser.newPage();
  await telemetry.goto(`${baseUrl}?simular-falha-telemetria`, { waitUntil: 'domcontentloaded' });
  await verifyCanvas(telemetry, 'telemetria');
  await telemetry.waitForFunction(() => document.body.textContent?.includes('O rastreador está indisponível agora.'), undefined, { timeout: 15_000 });
  checks.push('telemetria');

  const nasa = await browser.newPage();
  await nasa.goto(`${baseUrl}?simular-falha-nasa`, { waitUntil: 'domcontentloaded' });
  await verifyCanvas(nasa, 'NASA');
  await nasa.waitForFunction(() => document.body.textContent?.includes('A janela do cosmos está temporariamente fechada.'), undefined, { timeout: 15_000 });
  checks.push('NASA');

  const nasaEmpty = await browser.newPage();
  await nasaEmpty.goto(`${baseUrl}?simular-nasa-vazia`, { waitUntil: 'domcontentloaded' });
  await verifyCanvas(nasaEmpty, 'NASA sem conteúdo');
  await nasaEmpty.waitForFunction(() => document.body.textContent?.includes('A janela do cosmos está temporariamente fechada.'), undefined, { timeout: 15_000 });
  checks.push('NASA sem conteúdo');

  const denied = await browser.newPage();
  await denied.addInitScript(() => {
    navigator.geolocation.getCurrentPosition = (_success, error) => error?.({ code: 1, message: 'denied' });
  });
  await denied.goto(baseUrl, { waitUntil: 'domcontentloaded' });
  await verifyCanvas(denied, 'geolocalização negada');
  await denied.locator('.hero-section .locate-button').click();
  await denied.waitForFunction(() => document.body.textContent?.includes('A localização foi recusada.'), undefined, { timeout: 12_000 });
  checks.push('geolocalização negada');

  const geocode = await browser.newPage();
  await geocode.addInitScript(() => {
    navigator.geolocation.getCurrentPosition = success => success({ coords: { latitude: -23.55, longitude: -46.63 } });
  });
  await geocode.route('**/api/trpc/orbit.userPlace**', route => route.abort());
  await geocode.goto(baseUrl, { waitUntil: 'domcontentloaded' });
  await verifyCanvas(geocode, 'geocodificação indisponível');
  await geocode.locator('.hero-section .locate-button').click();
  await geocode.waitForFunction(() => document.body.textContent?.includes('Horizonte definido; a cidade não pôde ser identificada agora, mas a leitura local continua disponível.'), undefined, { timeout: 15_000 });
  checks.push('geocodificação indisponível');

  const horizon = await browser.newPage();
  await horizon.addInitScript(() => {
    navigator.geolocation.getCurrentPosition = success => success({ coords: { latitude: -23.55, longitude: -46.63, accuracy: 18 } });
  });
  await horizon.goto(baseUrl, { waitUntil: 'domcontentloaded' });
  await verifyCanvas(horizon, 'horizonte local detalhado');
  await horizon.locator('.hero-section .locate-button').click();
  await horizon.waitForFunction(() => document.body.textContent?.includes('seu posto de observação') && document.body.textContent?.includes('± 18 m'), undefined, { timeout: 15_000 });
  checks.push('horizonte local detalhado');

  await horizon.locator('a[href="#observar-hoje"]').click();
  await horizon.waitForFunction(() => document.querySelector('[data-testid="today-observation-panel"]')?.getAttribute('data-observation-state') !== "waiting" && document.body.textContent?.includes('Seu plano para observar hoje.'), undefined, { timeout: 15_000 });
  checks.push('aba observar hoje');

  console.log(JSON.stringify({ verification: 'passed', renderer: 'react-three-fiber', contingencies: checks }, null, 2));
} finally {
  await browser.close();
}
