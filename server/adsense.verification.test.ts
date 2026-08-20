import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const root = resolve(import.meta.dirname, "..");
const publisherId = "ca-pub-5884730150482896";

describe("verificação estática do Google AdSense", () => {
  it("expõe o Publisher ID no HTML e no ads.txt público", () => {
    const html = readFileSync(resolve(root, "client/index.html"), "utf8");
    const adsTxt = readFileSync(resolve(root, "client/public/ads.txt"), "utf8");

    expect(html).toContain(`<meta name="google-adsense-account" content="${publisherId}"`);
    expect(html).toContain(`adsbygoogle.js?client=${publisherId}`);
    expect(adsTxt).toContain("google.com, pub-5884730150482896, DIRECT, f08c47fec0942fa0");
  });

  it("inicializa a pausa de solicitações antes do consentimento", () => {
    const bootstrap = readFileSync(resolve(root, "client/public/adsense-consent-bootstrap.js"), "utf8");
    expect(bootstrap).toContain("pauseAdRequests = 1");
  });
});
