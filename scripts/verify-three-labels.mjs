import { chromium } from "playwright";

const browser = await chromium.launch({ headless: true });
const mobileMode = process.env.E2E_MOBILE === "1";
const page = await browser.newPage({ viewport: mobileMode ? { width: 390, height: 844 } : { width: 1280, height: 720 } });
const objects = [
  { button: "ISS", id: "iss", label: "ISS" },
  { button: "Hubble", id: "hubble", label: "Hubble" },
  { button: "Tiangong", id: "tiangong", label: "Tiangong" },
  { button: "NOAA 19", id: "noaa19", label: "NOAA 19" },
];

try {
  await page.goto("http://localhost:3000/", { waitUntil: "domcontentloaded" });
  await page.waitForSelector(".three-globe canvas", { timeout: 20_000 });
  const results = [];
  for (const object of objects) {
    await page.getByRole("button", { name: object.button, exact: true }).click();
    await page.waitForFunction(expected => document.querySelector(".three-globe")?.getAttribute("data-active-marker") === expected, object.id, { timeout: 10_000 });
    const layout = await page.evaluate(() => {
      const labels = document.querySelectorAll(".three-marker-label").length;
      const badge = document.querySelector(".globe-badge")?.textContent?.replace(/\s+/g, " ").trim();
      const globeNode = document.querySelector(".three-globe");
      const globe = globeNode?.getBoundingClientRect();
      const markers = JSON.parse(globeNode?.getAttribute("data-marker-geometry") || "[]");
      const selectedId = globeNode?.getAttribute("data-active-marker");
      const selected = markers.find(marker => marker.id === selectedId);
      const radians = value => value * Math.PI / 180;
      const rotation = -radians(selected?.longitude || 0);
      const projected = markers.map(marker => {
        const latitude = radians(marker.latitude);
        const longitude = radians(marker.longitude);
        const x = Math.cos(latitude) * Math.sin(longitude);
        const y = Math.sin(latitude);
        const z = Math.cos(latitude) * Math.cos(longitude);
        const rotatedX = Math.cos(rotation) * x + Math.sin(rotation) * z;
        const rotatedZ = -Math.sin(rotation) * x + Math.cos(rotation) * z;
        return { id: marker.id, x: globe.left + globe.width * (0.5 + rotatedX * 0.46), y: globe.top + globe.height * (0.5 - y * 0.46), depth: rotatedZ };
      });
      const active = projected.find(marker => marker.id === selectedId);
      const activeInside = active && active.x > globe.left && active.x < globe.right && active.y > globe.top && active.y < globe.bottom && active.depth > 0;
      const visible = projected.filter(marker => marker.depth > 0);
      const closePairs = visible.flatMap((marker, index) => visible.slice(index + 1).filter(other => Math.hypot(marker.x - other.x, marker.y - other.y) < 16).map(other => `${marker.id}/${other.id}`));
      return { labels, badge, markerCount: markers.length, activeInside, closePairs };
    });
    if (layout.labels !== 0 || layout.markerCount !== 4 || !layout.activeInside || layout.closePairs.length || !layout.badge?.includes(object.label)) throw new Error(`Estado de marcador inesperado para ${object.label}: ${JSON.stringify(layout)}`);
    results.push({ object: object.label, canvasLabels: layout.labels, markerCount: layout.markerCount, activeInsideGlobe: layout.activeInside, closePairs: layout.closePairs, focusBadge: layout.badge });
  }

  await page.screenshot({ path: `/home/ubuntu/webdev-static-assets/globe-label-clamp-e2e-${mobileMode ? "mobile" : "desktop"}.png`, fullPage: false });
  console.log(JSON.stringify({ verification: "passed", viewport: mobileMode ? "mobile" : "desktop", canvasLabelCount: 0, results }, null, 2));
} finally {
  await browser.close();
}
