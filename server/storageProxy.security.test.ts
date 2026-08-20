import { describe, expect, it } from "vitest";
import { isSafeStorageKey } from "./_core/storageProxy";

describe("chaves públicas de armazenamento", () => {
  it("aceita nomes de ativos compatíveis e bloqueia traversal ou caracteres de controle", () => {
    expect(isSafeStorageKey("earth-day-atlas_ee47322f.jpg")).toBe(true);
    expect(isSafeStorageKey("maps/earth-night.png")).toBe(true);
    expect(isSafeStorageKey("../secrets.env")).toBe(false);
    expect(isSafeStorageKey("maps/../../secrets.env")).toBe(false);
    expect(isSafeStorageKey("maps\\secrets.env")).toBe(false);
    expect(isSafeStorageKey("<script>.png")).toBe(false);
  });
});
