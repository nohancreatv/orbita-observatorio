import { describe, expect, it } from "vitest";

describe("credencial NASA Open APIs", () => {
  it("está disponível para o serviço no ambiente de execução", () => {
    const apiKey = process.env.NASA_API_KEY;
    expect(apiKey, "NASA_API_KEY deve estar configurada no ambiente").toBeTruthy();
    expect(apiKey?.trim().length, "NASA_API_KEY não deve estar em branco").toBeGreaterThan(0);
  });
});
