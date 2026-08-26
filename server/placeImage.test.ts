import { afterEach, describe, expect, it } from "vitest";
import { getPlaceImage } from "./orbitService";

const originalGoogleKey = process.env.GOOGLE_MAPS_API_KEY;

afterEach(() => {
  if (originalGoogleKey === undefined) delete process.env.GOOGLE_MAPS_API_KEY;
  else process.env.GOOGLE_MAPS_API_KEY = originalGoogleKey;
});

describe("imagem terrestre com rótulos geográficos", () => {
  it("usa ArcGIS público com camada transparente de países sem chave", async () => {
    delete process.env.GOOGLE_MAPS_API_KEY;

    const image = await getPlaceImage(-3.1, -60.0);

    expect(image.provider).toBe("ArcGIS World Imagery");
    expect(image.imageUrl).toContain("World_Imagery/MapServer/export");
    expect(image.labelsUrl).toContain("World_Boundaries_and_Places/MapServer/export");
    expect(image.labelsUrl).toContain("transparent=true");
    expect(image.attribution).toContain("Esri");
  });

  it("preserva o caminho Google quando uma chave for configurada", async () => {
    process.env.GOOGLE_MAPS_API_KEY = "test-key";

    const image = await getPlaceImage(40.7, -74.0);

    expect(image.provider).toBe("Google Maps");
    expect(image.imageUrl).toContain("maps.googleapis.com/maps/api/staticmap");
    expect(image.imageUrl).toContain("key=test-key");
    expect(image.labelsUrl).toBeNull();
  });
});
