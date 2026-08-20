import { describe, expect, it } from "vitest";
import { focusRotation, markerClassName, projectOnGlobe } from "./orbitVisual";

describe("foco do globo multiobjetos", () => {
  it("centraliza o objeto selecionado e atribui o marcador ativo em laranja", () => {
    const hubble = projectOnGlobe(28.5, -41.2, -41.2);

    expect(hubble.left).toBe("50%");
    expect(markerClassName("hubble", "hubble")).toBe("orbit-marker is-selected");
    expect(markerClassName("iss", "hubble")).toBe("orbit-marker");
  });

  it("produz uma rotação distinta para cada longitude de foco", () => {
    expect(focusRotation(-41.2)).toBe("41.2deg");
    expect(focusRotation(-41.2)).not.toBe(focusRotation(106.6));
  });
});
