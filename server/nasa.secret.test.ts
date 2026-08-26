import { afterEach, describe, expect, it, vi } from "vitest";
import { getSpaceStory } from "./orbitService";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("credencial opcional da NASA Open APIs", () => {
  it("mantém a curiosidade disponível sem uma chave configurada", async () => {
    vi.stubEnv("NASA_API_KEY", "");

    await expect(getSpaceStory()).resolves.toMatchObject({
      title: "O arquivo do cosmos está em pausa.",
      sourceUrl: "https://api.nasa.gov/",
    });
  });
});
