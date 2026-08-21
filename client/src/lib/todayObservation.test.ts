import { describe, expect, it } from "vitest";
import { getTodayObservationState } from "./todayObservation";

describe("getTodayObservationState", () => {
  it("solicita o horizonte quando a localização não foi concedida", () => {
    expect(getTodayObservationState({ hasLocation: false, hasPassPrediction: false }).tone).toBe("waiting");
  });

  it("classifica uma passagem favorável com céu limpo como boa janela", () => {
    expect(getTodayObservationState({ hasLocation: true, hasPassPrediction: true, passDistanceKm: 420, cloudCover: 18, visibilityKm: 11 })).toMatchObject({ tone: "ready", label: "boa janela" });
  });

  it("rebaixa a leitura quando nuvens ou visibilidade limitam a observação", () => {
    expect(getTodayObservationState({ hasLocation: true, hasPassPrediction: true, passDistanceKm: 420, cloudCover: 86, visibilityKm: 10 })).toMatchObject({ tone: "limited", label: "céu limitado" });
  });

  it("distingue uma passagem distante de uma janela favorável", () => {
    expect(getTodayObservationState({ hasLocation: true, hasPassPrediction: true, passDistanceKm: 2800, cloudCover: 12, visibilityKm: 12 })).toMatchObject({ tone: "limited", label: "passagem distante" });
  });
});
