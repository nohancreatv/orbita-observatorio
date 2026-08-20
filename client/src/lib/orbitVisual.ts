export type GlobeProjection = { left: string; top: string; depth: number; opacity: number; scale: number };

export function normaliseLongitude(longitude: number) {
  return ((longitude + 540) % 360) - 180;
}

/** Projeção ortográfica do alvo em relação ao meridiano central exibido. */
export function projectOnGlobe(latitude: number, longitude: number, centralLongitude: number): GlobeProjection {
  const latitudeRadians = latitude * Math.PI / 180;
  const deltaRadians = normaliseLongitude(longitude - centralLongitude) * Math.PI / 180;
  const x = Math.cos(latitudeRadians) * Math.sin(deltaRadians);
  const y = Math.sin(latitudeRadians);
  const depth = Math.cos(latitudeRadians) * Math.cos(deltaRadians);
  return {
    left: `${50 + x * 44}%`,
    top: `${50 - y * 43}%`,
    depth,
    opacity: Math.max(.18, Math.min(1, (depth + 1.16) / 2.16)),
    scale: .7 + Math.max(0, depth) * .32,
  };
}

export function focusRotation(longitude: number) {
  return `${Math.round(normaliseLongitude(-longitude) * 1_000_000) / 1_000_000}deg`;
}

export function markerClassName(markerId: string, selectedId: string) {
  return markerId === selectedId ? "orbit-marker is-selected" : "orbit-marker";
}
