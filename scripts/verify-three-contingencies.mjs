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

  const denied = await browser.newPage();
  await denied.addInitScript(() => {
    navigator.geolocation.getCurrentPosition = (_success, error) => error?.({ code: 1, message: 'denied' });
  });
  await denied.goto(baseUrl, { waitUntil: 'domcontentloaded' });
  await verifyCanvas(denied, 'geolocalização negada');
  await denied.locator('.locate-button').click();
  await denied.waitForFunction(() => document.body.textContent?.includes('Não foi possível acessar a sua localização.'), undefined, { timeout: 12_000 });
  checks.push('geolocalização negada');

  const geocode = await browser.newPage();
  await geocode.addInitScript(() => {
    navigator.geolocation.getCurrentPosition = success => success({ coords: { latitude: -23.55, longitude: -46.63 } });
  });
  await geocode.route('**/api/trpc/orbit.userPlace**', route => route.abort());
  await geocode.goto(baseUrl, { waitUntil: 'domcontentloaded' });
  await verifyCanvas(geocode, 'geocodificação indisponível');
  await geocode.locator('.locate-button').click();
  await geocode.waitForFunction(() => document.body.textContent?.includes('Horizonte definido; a cidade não pôde ser identificada agora.'), undefined, { timeout: 15_000 });
  checks.push('geocodificação indisponível');

  console.log(JSON.stringify({ verification: 'passed', renderer: 'react-three-fiber', contingencies: checks }, null, 2));
} finally {
  await browser.close();
}
