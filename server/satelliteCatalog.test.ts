import { afterEach, describe, expect, it, vi } from "vitest";
import { getOrbitSnapshot, getOrbitSnapshots, resetOrbitServiceCacheForTests, SATELLITE_CATALOG } from "./orbitService";

const originalFetch = global.fetch;

afterEach(() => {
  global.fetch = originalFetch;
  resetOrbitServiceCacheForTests();
  vi.restoreAllMocks();
});

describe("catálogo de satélites", () => {
  it("mantém dez objetos rastreáveis com IDs NORAD únicos", () => {
    const satellites = Object.values(SATELLITE_CATALOG);
    const noradIds = satellites.map(satellite => satellite.noradId);

    expect(satellites).toHaveLength(10);
    expect(new Set(noradIds).size).toBe(noradIds.length);
    expect(satellites.map(satellite => satellite.id)).toEqual(expect.arrayContaining([
      "iss",
      "hubble",
      "tiangong",
      "noaa19",
      "noaa20",
      "noaa21",
      "sentinel1a",
      "landsat9",
      "terra",
      "aqua",
    ]));
  });

  it("configura Where the ISS at para a ISS e CelesTrak TLE para os demais", () => {
    expect(SATELLITE_CATALOG.iss.telemetry).toMatchObject({ provider: "Where the ISS at?", format: "JSON" });

    const nonIss = Object.values(SATELLITE_CATALOG).filter(satellite => satellite.id !== "iss");
    for (const satellite of nonIss) {
      expect(satellite.telemetry).toMatchObject({ provider: "CelesTrak GP/TLE", format: "TLE" });
      expect(satellite.telemetry.endpoint).toContain(`CATNR=${satellite.noradId}`);
      expect(satellite.telemetry.endpoint).toContain("FORMAT=TLE");
    }
  });

  it("mantém os dez satélites quando os provedores orbitais estão indisponíveis", async () => {
    const fetchMock = vi.fn(async (input: string | URL | Request) => {
      const url = String(input);
      if (url.includes("wheretheiss.at") || url.includes("celestrak.org")) {
        throw new Error("fonte orbital indisponível");
      }
      if (url.includes("bigdatacloud.net")) {
        return new Response(JSON.stringify({ city: "contingência", countryName: "Brasil", countryCode: "BR" }), { status: 200 });
      }
      throw new Error(`URL inesperada no teste: ${url}`);
    });
    global.fetch = fetchMock as typeof fetch;

    const snapshots = await getOrbitSnapshots();

    expect(snapshots).toHaveLength(10);
    expect(new Set(snapshots.map(snapshot => snapshot.satellite.id)).size).toBe(10);
    expect(snapshots.every(snapshot => Number.isFinite(snapshot.latitude) && Number.isFinite(snapshot.longitude))).toBe(true);
    expect(snapshots.every(snapshot => snapshot.visibility === "estimativa orbital")).toBe(true);
  });

  it("propaga o Landsat 9 a partir de um TLE e resolve seu ponto terrestre", async () => {
    const fetchMock = vi.fn(async (input: string | URL | Request) => {
      const url = String(input);
      if (url.includes("celestrak.org")) {
        return new Response([
          "LANDSAT 9",
          "1 49260U 21088A   26237.69043066  .00000222  00000+0  55655-4 0  9991",
          "2 49260  98.2231 307.0075 0001339 105.3510 254.7836 14.57100759261127",
        ].join("\n"), { status: 200 });
      }
      if (url.includes("bigdatacloud.net")) {
        return new Response(JSON.stringify({ city: "Flagstaff", countryName: "Estados Unidos", countryCode: "US" }), { status: 200 });
      }
      throw new Error(`URL inesperada no teste: ${url}`);
    });
    global.fetch = fetchMock as typeof fetch;

    const snapshot = await getOrbitSnapshot("landsat9");

    expect(snapshot.satellite).toMatchObject({ id: "landsat9", noradId: 49260 });
    expect(snapshot.sourceUrl).toContain("CATNR=49260");
    expect(snapshot.groundLocation).toMatchObject({ label: "Flagstaff, Estados Unidos", countryCode: "US" });
    expect(Number.isFinite(snapshot.latitude)).toBe(true);
    expect(Number.isFinite(snapshot.longitude)).toBe(true);
    expect(snapshot.altitude).toBeGreaterThan(0);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
