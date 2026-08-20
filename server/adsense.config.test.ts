import { describe, expect, it } from "vitest";

const publisherIdPattern = /^ca-pub-\d{16}$/;

describe("configuração do Google AdSense", () => {
  it("expõe um Publisher ID no formato público esperado", () => {
    expect(process.env.VITE_ADSENSE_PUBLISHER_ID ?? "").toMatch(publisherIdPattern);
  });
});
