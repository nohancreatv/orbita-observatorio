import { describe, expect, it } from "vitest";
import { focusRotation, markerClassName, projectOnGlobe } from "../client/src/lib/orbitVisual";

describe("interação visual do globo multiobjetos", () => {
  it("centraliza o objeto selecionado e aplica o estado visual ativo", () => {
    const hubble = projectOnGlobe(28.5, -41.2, -41.2);

    expect(hubble.left).toBe("50%");
    expect(markerClassName("hubble", "hubble")).toBe("orbit-marker is-selected");
    expect(markerClassName("iss", "hubble")).toBe("orbit-marker");
  });

  it("calcula rotações distintas conforme a longitude do foco", () => {
    expect(parseFloat(focusRotation(-41.2))).toBeCloseTo(41.2);
    expect(focusRotation(-41.2)).not.toBe(focusRotation(106.6));
  });
});
