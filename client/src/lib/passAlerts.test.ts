import { describe, expect, it } from "vitest";
import { PASS_ALERT_WINDOW_MS, shouldSendPassAlert } from "./passAlerts";

describe("alertas de passagem", () => {
  const nowMs = 1_700_000_000_000;

  it("dispara somente para uma aproximação favorável dentro da janela escolhida", () => {
    expect(shouldSendPassAlert({ enabled: true, permission: "granted", timestampSeconds: (nowMs + PASS_ALERT_WINDOW_MS) / 1000, distanceKm: 800, nowMs, alreadyAlerted: false })).toBe(true);
  });

  it("bloqueia alertas sem permissão, fora da janela, desfavoráveis ou já emitidos", () => {
    expect(shouldSendPassAlert({ enabled: true, permission: "denied", timestampSeconds: (nowMs + 60_000) / 1000, distanceKm: 800, nowMs, alreadyAlerted: false })).toBe(false);
    expect(shouldSendPassAlert({ enabled: true, permission: "granted", timestampSeconds: (nowMs + PASS_ALERT_WINDOW_MS + 1) / 1000, distanceKm: 800, nowMs, alreadyAlerted: false })).toBe(false);
    expect(shouldSendPassAlert({ enabled: true, permission: "granted", timestampSeconds: (nowMs + 60_000) / 1000, distanceKm: 2500, nowMs, alreadyAlerted: false })).toBe(false);
    expect(shouldSendPassAlert({ enabled: true, permission: "granted", timestampSeconds: (nowMs + 60_000) / 1000, distanceKm: 800, nowMs, alreadyAlerted: true })).toBe(false);
  });
});
