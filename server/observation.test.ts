import { afterEach, describe, expect, it, vi } from "vitest";
import { getObservingConditions, getUpcomingLaunches } from "./orbitService";

const originalFetch = global.fetch;

afterEach(() => {
  global.fetch = originalFetch;
  vi.restoreAllMocks();
});

describe("camadas públicas de observação", () => {
  it("normaliza cobertura de nuvens e visibilidade em quilômetros", async () => {
    global.fetch = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      current: { time: "2026-08-19T21:00", cloud_cover: 18, visibility: 12400, weather_code: 1 },
      timezone_abbreviation: "BRT",
    }), { status: 200 })) as typeof fetch;

    const result = await getObservingConditions(-22.91, -43.17);

    expect(result).toMatchObject({ cloudCover: 18, visibilityKm: 12.4, weatherCode: 1, timezone: "BRT" });
    expect(result.sourceUrl).toContain("open-meteo.com");
  });

  it("remove lançamentos passados e mantém somente os próximos em ordem cronológica", async () => {
    const past = new Date(Date.now() - 60_000).toISOString();
    const firstFuture = new Date(Date.now() + 60 * 60_000).toISOString();
    const secondFuture = new Date(Date.now() + 2 * 60 * 60_000).toISOString();
    global.fetch = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      results: [
        { id: "past-mission", name: "Old Mission", net: past, status: { name: "Launch Successful" } },
        { id: "mission-2", name: "Later Mission", net: secondFuture, status: { name: "Go for Launch" }, launch_service_provider: { name: "Orbital Labs" }, pad: { location: { name: "Costa do Cabo" } } },
        { id: "mission-1", name: "Aurora Test Mission", net: firstFuture, status: { name: "Go for Launch" }, launch_service_provider: { name: "Orbital Labs" }, pad: { location: { name: "Costa do Cabo" } }, image: { image_url: "https://images.example.com/launch.jpg" } },
      ],
    }), { status: 200 })) as typeof fetch;

    const launches = await getUpcomingLaunches();

    expect(launches.map(launch => launch.id)).toEqual(["mission-1", "mission-2"]);
    expect(launches[0]).toMatchObject({ provider: "Orbital Labs", location: "Costa do Cabo", status: "Go for Launch" });
    expect(launches[0]?.imageUrl).toBe("https://images.example.com/launch.jpg");
  });
});
