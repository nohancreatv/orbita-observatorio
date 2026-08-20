import { Html, useTexture } from "@react-three/drei";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { memo, Suspense, useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";

const DAY_MAP = "/manus-storage/earth-day-atlas_ee47322f.jpg";
const NIGHT_MAP = "/manus-storage/earth-night-atlas_06d895db.jpg";
const CLOUD_MAP = "/manus-storage/earth-clouds-atlas_8c506c86.png";
const FOCUS_DURATION_MS = 500;

const atmosphereVertexShader = `
  varying vec3 vNormal;
  varying vec3 vViewDirection;
  void main() {
    vec4 worldPosition = modelMatrix * vec4(position, 1.0);
    vNormal = normalize(mat3(modelMatrix) * normal);
    vViewDirection = normalize(cameraPosition - worldPosition.xyz);
    gl_Position = projectionMatrix * viewMatrix * worldPosition;
  }
`;

const atmosphereFragmentShader = `
  varying vec3 vNormal;
  varying vec3 vViewDirection;
  void main() {
    float fresnel = pow(1.0 - max(dot(normalize(vNormal), normalize(vViewDirection)), 0.0), 3.25);
    vec3 auroraBlue = vec3(0.17, 0.66, 0.95);
    gl_FragColor = vec4(auroraBlue, fresnel * 0.28);
  }
`;

type Marker = { id: string; shortName: string; name: string; latitude: number; longitude: number };

export type EarthGlobeProps = {
  markers: Marker[];
  selectedId: string;
  onSelect: (id: string) => void;
  className?: string;
};

function toCartesian(latitude: number, longitude: number, radius: number) {
  const latitudeRadians = THREE.MathUtils.degToRad(latitude);
  const longitudeRadians = THREE.MathUtils.degToRad(longitude);
  return new THREE.Vector3(
    radius * Math.cos(latitudeRadians) * Math.sin(longitudeRadians),
    radius * Math.sin(latitudeRadians),
    radius * Math.cos(latitudeRadians) * Math.cos(longitudeRadians),
  );
}

function useReducedMotion() {
  const [reducedMotion, setReducedMotion] = useState(false);
  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReducedMotion(query.matches);
    update();
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);
  return reducedMotion;
}

function EarthSurface() {
  const [dayMap, nightMap] = useTexture([DAY_MAP, NIGHT_MAP]);

  useMemo(() => {
    [dayMap, nightMap].forEach(texture => {
      texture.colorSpace = THREE.SRGBColorSpace;
      texture.anisotropy = 4;
    });
  }, [dayMap, nightMap]);

  const material = useMemo(() => new THREE.MeshStandardMaterial({
    map: dayMap,
    emissiveMap: nightMap,
    emissive: new THREE.Color("#193b58"),
    emissiveIntensity: 0.36,
    roughness: 0.76,
    metalness: 0.04,
  }), [dayMap, nightMap]);

  return <mesh material={material} rotation={[0, -Math.PI / 2, 0]}>
    <sphereGeometry args={[1, 72, 72]} />
  </mesh>;
}

function CloudLayer() {
  const cloudMap = useTexture(CLOUD_MAP);
  useMemo(() => {
    cloudMap.colorSpace = THREE.SRGBColorSpace;
    cloudMap.anisotropy = 4;
  }, [cloudMap]);
  return <mesh rotation={[0, -Math.PI / 2, 0]}>
    <sphereGeometry args={[1.012, 56, 56]} />
    <meshPhongMaterial map={cloudMap} transparent opacity={0.28} depthWrite={false} blending={THREE.AdditiveBlending} />
  </mesh>;
}

function Atmosphere() {
  const material = useMemo(() => new THREE.ShaderMaterial({
    vertexShader: atmosphereVertexShader,
    fragmentShader: atmosphereFragmentShader,
    transparent: true,
    side: THREE.BackSide,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  }), []);
  return <mesh material={material}>
    <sphereGeometry args={[1.045, 56, 56]} />
  </mesh>;
}

function SatelliteMarker({ marker, active, onSelect }: { marker: Marker; active: boolean; onSelect: (id: string) => void }) {
  const position = useMemo(() => toCartesian(marker.latitude, marker.longitude, 1.065), [marker.latitude, marker.longitude]);
  return <group position={position} onClick={event => { event.stopPropagation(); onSelect(marker.id); }}>
    {active && <mesh>
      <ringGeometry args={[0.075, 0.09, 32]} />
      <meshBasicMaterial color="#ffb38d" transparent opacity={0.85} side={THREE.DoubleSide} />
    </mesh>}
    <mesh>
      <sphereGeometry args={[active ? 0.045 : 0.032, 16, 16]} />
      <meshBasicMaterial color={active ? "#ff9c6d" : "#63e6be"} />
    </mesh>
    <Html center distanceFactor={6.2} zIndexRange={[5, 0]} style={{ pointerEvents: "none" }}>
      <span className={active ? "three-marker-label is-active" : "three-marker-label"}>{marker.shortName}</span>
    </Html>
  </group>;
}

function GlobeScene({ markers, selectedId, onSelect, reducedMotion }: Omit<EarthGlobeProps, "className"> & { reducedMotion: boolean }) {
  const group = useRef<THREE.Group>(null);
  const selected = markers.find(marker => marker.id === selectedId);
  const targetRotation = selected ? THREE.MathUtils.degToRad(-selected.longitude) : 0;
  const transition = useRef({ from: 0, to: targetRotation, startedAt: 0 });
  const previousTarget = useRef(targetRotation);
  const invalidate = useThree(state => state.invalidate);

  useEffect(() => {
    if (!group.current) return;
    transition.current = { from: group.current.rotation.y, to: targetRotation, startedAt: performance.now() };
    previousTarget.current = targetRotation;
    invalidate();
  }, [invalidate, targetRotation]);

  useFrame(() => {
    if (!group.current) return;
    if (reducedMotion) {
      group.current.rotation.y = transition.current.to;
      return;
    }
    const elapsed = Math.min(1, (performance.now() - transition.current.startedAt) / FOCUS_DURATION_MS);
    const eased = elapsed < .5 ? 2 * elapsed * elapsed : 1 - Math.pow(-2 * elapsed + 2, 2) / 2;
    group.current.rotation.y = THREE.MathUtils.lerp(transition.current.from, transition.current.to, eased);
    if (elapsed < 1) invalidate();
  });

  return <>
    <ambientLight intensity={0.34} color="#6cb7d8" />
    <directionalLight position={[4, 2.5, 5]} intensity={1.6} color="#d7f5ff" />
    <pointLight position={[-3, -1.5, -2]} intensity={0.24} color="#0a4d88" />
    <group ref={group}>
      <EarthSurface />
      <CloudLayer />
      <Atmosphere />
      {markers.map(marker => <SatelliteMarker key={marker.id} marker={marker} active={marker.id === selectedId} onSelect={onSelect} />)}
    </group>
  </>;
}

function GlobeFallback() {
  return <div className="three-globe-fallback" aria-hidden="true"><span /></div>;
}

export const EarthGlobe = memo(function EarthGlobe({ markers, selectedId, onSelect, className = "" }: EarthGlobeProps) {
  const selectedMarker = markers.find(marker => marker.id === selectedId);
  const reducedMotion = useReducedMotion();
  return <div className={`three-globe ${className}`} data-renderer="react-three-fiber" data-active-marker={selectedId} data-focus-longitude={selectedMarker?.longitude ?? 0} data-focus-duration={FOCUS_DURATION_MS} data-reduced-motion={reducedMotion} aria-label={`Globo 3D com foco em ${selectedMarker?.name || "objeto orbital"}`}>
    <Canvas dpr={[1, 1.25]} frameloop="demand" camera={{ position: [0, 0, 3.2], fov: 38 }} gl={{ alpha: true, antialias: true, powerPreference: "high-performance" }} fallback={<GlobeFallback />}>
      <Suspense fallback={null}><GlobeScene markers={markers} selectedId={selectedId} onSelect={onSelect} reducedMotion={reducedMotion} /></Suspense>
    </Canvas>
  </div>;
});
