import { afterEach, describe, expect, it, vi } from "vitest";
import { getSpaceStory } from "./orbitService";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("resiliência da curiosidade NASA", () => {
  it("converte 429 em estado sem erro e interrompe novas chamadas durante a pausa", async () => {
    vi.stubEnv("NASA_API_KEY", "test-key");
    const fetchMock = vi.fn().mockResolvedValue(new Response("rate limited", { status: 429 }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(getSpaceStory()).resolves.toBeNull();
    await expect(getSpaceStory()).resolves.toBeNull();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
