import { afterEach, describe, expect, it, vi } from "vitest";
import { getSpaceStory } from "./orbitService";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("credencial opcional da NASA Open APIs", () => {
  it("usa a NASA Image Library sem exigir uma chave", async () => {
    vi.stubEnv("NASA_API_KEY", "");
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({
      collection: {
        items: [{
          data: [{
            nasa_id: "story-123",
            title: "Uma janela para o cosmos",
            description: "Uma imagem pública do arquivo astronômico da NASA.",
            date_created: "2026-08-26T00:00:00Z",
            media_type: "image",
          }],
          links: [{ href: "https://images-assets.nasa.gov/image/story-123/story-123~orig.jpg", rel: "canonical", render: "image" }],
        }],
      },
    }), { status: 200, headers: { "Content-Type": "application/json" } })));

    await expect(getSpaceStory()).resolves.toMatchObject({
      title: "Uma janela para o cosmos",
      sourceUrl: "https://images.nasa.gov/details/story-123",
      imageUrl: "https://images-assets.nasa.gov/image/story-123/story-123~orig.jpg",
      credit: "NASA Image and Video Library",
    });
  });
});
