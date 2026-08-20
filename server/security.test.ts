import { describe, expect, it } from "vitest";
import { afterEach, describe, expect, it, vi } from "vitest";
import { isRateLimited } from "./security";

afterEach(() => vi.useRealTimers());

describe("limite de consultas públicas", () => {
  it("bloqueia somente após ultrapassar a cota configurada", () => {
    const identity = `test-${Date.now()}`;
    expect(isRateLimited(identity, 2, 60_000)).toBe(false);
    expect(isRateLimited(identity, 2, 60_000)).toBe(false);
    expect(isRateLimited(identity, 2, 60_000)).toBe(true);
  });

  it("libera uma identidade após a janela de limite", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-20T00:00:00.000Z"));
    const identity = "janela-temporal";

    expect(isRateLimited(identity, 1, 1_000)).toBe(false);
    expect(isRateLimited(identity, 1, 1_000)).toBe(true);
    vi.advanceTimersByTime(1_001);
    expect(isRateLimited(identity, 1, 1_000)).toBe(false);
  });
});
