import { describe, expect, it } from "vitest";
import { getObservationGuidance, getObservationReadiness, getWeatherDescription } from "./localHorizon";

describe("leitura local do horizonte", () => {
  it("classifica uma janela de observação favorável sem inventar previsão", () => {
    expect(getObservationReadiness({ cloudCover: 12, visibilityKm: 11, hasPassPrediction: true, passDistanceKm: 320 })).toEqual({ label: "janela favorável", tone: "good" });
  });

  it("prioriza limitações de céu antes de sugerir observação", () => {
    expect(getObservationGuidance({ cloudCover: 82, visibilityKm: 10, hasPassPrediction: true, passDistanceKm: 120 })).toContain("nuvens");
  });

  it("traduz o código de tempo sem depender de uma fonte visual", () => {
    expect(getWeatherDescription(45)).toBe("neblina ou névoa");
  });
});
