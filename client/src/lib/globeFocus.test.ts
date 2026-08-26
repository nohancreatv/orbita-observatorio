import { describe, expect, it } from "vitest";
import { getGlobeFocusRotation, getShortestRotationTarget } from "./globeFocus";

describe("foco do globo", () => {
  it("converte latitude positiva em rotação X positiva e longitude em rotação Y inversa", () => {
    const rotation = getGlobeFocusRotation(40, 70);

    expect(rotation.rotationX).toBeCloseTo((40 * Math.PI) / 180);
    expect(rotation.rotationY).toBeCloseTo((-70 * Math.PI) / 180);
  });

  it("mantém o sentido correspondente no hemisfério sul e oeste", () => {
    const rotation = getGlobeFocusRotation(-35, -120);

    expect(rotation.rotationX).toBeCloseTo((-35 * Math.PI) / 180);
    expect(rotation.rotationY).toBeCloseTo((120 * Math.PI) / 180);
  });

  it("limita latitudes inválidas aos polos", () => {
    expect(getGlobeFocusRotation(120, 0).rotationX).toBeCloseTo(Math.PI / 2);
    expect(getGlobeFocusRotation(-120, 0).rotationX).toBeCloseTo(-Math.PI / 2);
  });

  it("escolhe o caminho angular curto para o meridiano neutro", () => {
    expect(getShortestRotationTarget((179 * Math.PI) / 180, 0)).toBeCloseTo(0);
    expect(getShortestRotationTarget((-179 * Math.PI) / 180, 0)).toBeCloseTo(0);
  });
});
