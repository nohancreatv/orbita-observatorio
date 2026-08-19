import { describe, expect, it } from "vitest";

describe("credencial NASA Open APIs", () => {
  it("autoriza uma consulta leve ao APOD", async () => {
    const apiKey = process.env.NASA_API_KEY;
    expect(apiKey, "NASA_API_KEY deve estar configurada no ambiente").toBeTruthy();

    const response = await fetch(`https://api.nasa.gov/planetary/apod?api_key=${encodeURIComponent(apiKey ?? "")}`);
    expect(response.status, "A chave da NASA deve autorizar a consulta APOD").toBe(200);

    const payload = (await response.json()) as { title?: string; explanation?: string };
    expect(payload.title).toBeTruthy();
    expect(payload.explanation).toBeTruthy();
  }, 15_000);
});
