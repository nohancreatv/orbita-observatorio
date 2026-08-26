const DEGREES_TO_RADIANS = Math.PI / 180;

export type GlobeFocusRotation = {
  rotationX: number;
  rotationY: number;
};

/**
 * Centraliza um ponto da superfície no eixo frontal do globo.
 * Longitude gira o globo no eixo Y; latitude corrige a inclinação vertical no eixo X.
 */
export function getGlobeFocusRotation(latitude: number, longitude: number): GlobeFocusRotation {
  const safeLatitude = Math.max(-90, Math.min(90, latitude));
  return {
    rotationX: safeLatitude * DEGREES_TO_RADIANS,
    rotationY: -longitude * DEGREES_TO_RADIANS,
  };
}
