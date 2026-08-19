import { describe, expect, it } from "vitest";
import { isRateLimited } from "./security";

describe("limite de consultas públicas", () => {
  it("bloqueia somente após ultrapassar a cota configurada", () => {
    const identity = `test-${Date.now()}`;
    expect(isRateLimited(identity, 2, 60_000)).toBe(false);
    expect(isRateLimited(identity, 2, 60_000)).toBe(false);
    expect(isRateLimited(identity, 2, 60_000)).toBe(true);
  });
});

