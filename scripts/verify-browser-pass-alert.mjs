import { chromium } from "playwright";

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 1280, height: 900 }, geolocation: { latitude: -23.5505, longitude: -46.6333 }, permissions: ["geolocation"] });
const page = await context.newPage();

await page.addInitScript(() => {
  window.__orbitaNotifications = [];
  class TestNotification {
    static permission = "default";
    static async requestPermission() {
      TestNotification.permission = "granted";
      return "granted";
    }
    constructor(title, options) {
      window.__orbitaNotifications.push({ title, options });
    }
  }
  window.Notification = TestNotification;
});

try {
  await page.goto("http://localhost:3000/?simular-alerta-passagem", { waitUntil: "domcontentloaded" });
  await page.getByRole("button", { name: "recusar publicidade" }).click();
  await page.locator("button.locate-button").click();
  const alertButton = page.getByRole("button", { name: "avisar quando estiver próximo" });
  await alertButton.waitFor({ timeout: 20_000 });
  await alertButton.click();
  await page.getByRole("button", { name: "alerta ativo nesta sessão" }).waitFor({ timeout: 5_000 });
  await page.waitForTimeout(1_500);
  const state = await page.evaluate(() => ({ permission: Notification.permission, notificationCount: window.__orbitaNotifications.length, status: document.querySelector(".live-readout span")?.textContent }));
  if (state.permission !== "granted" || state.notificationCount !== 1) throw new Error(`Alerta inválido: ${JSON.stringify(state)}`);
  console.log(JSON.stringify({ verification: "passed", ...state }, null, 2));
} finally {
  await context.close();
  await browser.close();
}
