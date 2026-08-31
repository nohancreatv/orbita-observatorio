import { afterEach, describe, expect, it, vi } from "vitest";
import { getSpaceStory, resetOrbitServiceCacheForTests } from "./orbitService";

afterEach(() => {
  resetOrbitServiceCacheForTests();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("tradução da curiosidade astronômica", () => {
  it("traduz o conteúdo da NASA Image Library para português", async () => {
    vi.stubEnv("NASA_API_KEY", "");
    const fetchMock = vi.fn(async (input: string | URL) => {
      const url = String(input);
      if (url.includes("images-api.nasa.gov/search")) {
        return new Response(JSON.stringify({
          collection: {
            items: [{
              data: [{
                nasa_id: "story-pt-123",
                title: "A window into the cosmos",
                description: "This image shows a colorful nebula surrounded by distant stars.",
                date_created: "2026-08-31T00:00:00Z",
                media_type: "image",
              }],
              links: [{ href: "https://images-assets.nasa.gov/image/story-pt-123/story-pt-123~orig.jpg", rel: "canonical", render: "image" }],
            }],
          },
        }), { status: 200, headers: { "Content-Type": "application/json" } });
      }
      const query = new URL(url).searchParams.get("q");
      if (query === "A window into the cosmos") {
        return new Response(JSON.stringify({
          responseStatus: 200,
          responseData: { translatedText: "Uma janela para o cosmos" },
        }), { status: 200, headers: { "Content-Type": "application/json" } });
      }
      if (query === "This image shows a colorful nebula surrounded by distant stars.") {
        return new Response(JSON.stringify({
          responseStatus: 200,
          responseData: { translatedText: "Esta imagem mostra uma nebulosa colorida cercada por estrelas distantes." },
        }), { status: 200, headers: { "Content-Type": "application/json" } });
      }
      throw new Error(`URL inesperada no teste: ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    await expect(getSpaceStory()).resolves.toMatchObject({
      title: "Uma janela para o cosmos",
      explanation: "Esta imagem mostra uma nebulosa colorida cercada por estrelas distantes.",
      credit: "Biblioteca de imagens e vídeos da NASA",
      sourceUrl: "https://images.nasa.gov/details/story-pt-123",
    });
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(fetchMock.mock.calls.some(([input]) => String(input).includes("langpair=en%7Cpt"))).toBe(true);
  });
});
