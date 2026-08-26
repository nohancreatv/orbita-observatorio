import { describe, expect, it } from "vitest";
import { SATELLITE_CATALOG } from "./orbitService";

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
});
