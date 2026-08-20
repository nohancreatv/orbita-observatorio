import { describe, expect, it } from "vitest";
import { productionSecurityHeaders } from "./security";

describe("cabeçalhos HTTP de produção", () => {
  it("restringe conteúdo e recursos sensíveis no modo de produção", () => {
    const previousEnvironment = process.env.NODE_ENV;
    process.env.NODE_ENV = "production";
    const headers = new Map<string, string>();
    let nextCalled = false;

    productionSecurityHeaders({} as never, { setHeader: (name: string, value: string) => headers.set(name, value) } as never, () => { nextCalled = true; });

    expect(headers.get("Content-Security-Policy")).toContain("default-src 'self'");
    expect(headers.get("Content-Security-Policy")).toContain("object-src 'none'");
    expect(headers.get("Content-Security-Policy")).toContain("https://staticmap.openstreetmap.de");
    expect(headers.get("Content-Security-Policy")).toContain("https://pagead2.googlesyndication.com");
    expect(headers.get("Content-Security-Policy")).toContain("frame-src https://*.googlesyndication.com");
    expect(headers.get("Permissions-Policy")).toContain("geolocation=(self)");
    expect(headers.get("X-Frame-Options")).toBe("DENY");
    expect(headers.get("Strict-Transport-Security")).toContain("max-age=31536000");
    expect(nextCalled).toBe(true);

    process.env.NODE_ENV = previousEnvironment;
  });
});
