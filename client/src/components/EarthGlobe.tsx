import { Canvas, useFrame, useLoader, useThree } from "@react-three/fiber";
import { memo, Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AdditiveBlending, BackSide, Color, DoubleSide, Group, MathUtils, MeshStandardMaterial, ShaderMaterial, SRGBColorSpace, TextureLoader, Vector3 } from "three";

const DAY_MAP = "/manus-storage/earth-day-atlas_ee47322f.jpg";
const NIGHT_MAP = "/manus-storage/earth-night-atlas_06d895db.jpg";
const CLOUD_MAP = "/manus-storage/earth-clouds-atlas_8c506c86.png";
const FOCUS_DURATION_MS = 500;
const ROTATION_SENSITIVITY = 0.005;

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
type MarkerTransition = { fromId: string | null; toId: string; startedAt: number };
type UserLocation = { latitude: number; longitude: number; label: string } | null;

export type EarthGlobeProps = {
  markers: Marker[];
  selectedId: string;
  onSelect: (id: string) => void;
  userLocation?: UserLocation;
  className?: string;
};

function toCartesian(latitude: number, longitude: number, radius: number) {
  const latitudeRadians = MathUtils.degToRad(latitude);
  const longitudeRadians = MathUtils.degToRad(longitude);
  return new Vector3(
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

// ─── Orbit Controls (manual, no drei dependency) ────────────────────────
function OrbitControls({ groupRef, onInteract }: { groupRef: React.RefObject<Group | null>; onInteract?: () => void }) { const onInteractRef = useRef(onInteract); useEffect(() => { onInteractRef.current = onInteract; }, [onInteract]);
  const { gl, camera } = useThree();
  const isDragging = useRef(false);
  const prevPointer = useRef({ x: 0, y: 0 });
  const velocity = useRef({ x: 0, y: 0 });
  const spherical = useRef({ theta: 0, phi: Math.PI / 2 });
  const autoRotate = useRef(true);

  useEffect(() => {
    const dom = gl.domElement;

    const onPointerDown = (e: PointerEvent) => {
      isDragging.current = true;
      autoRotate.current = false;
      prevPointer.current = { x: e.clientX, y: e.clientY };
      velocity.current = { x: 0, y: 0 };
      onInteractRef.current?.();
    };

    const onPointerMove = (e: PointerEvent) => {
      if (!isDragging.current || !groupRef.current) return;
      const dx = e.clientX - prevPointer.current.x;
      const dy = e.clientY - prevPointer.current.y;
      prevPointer.current = { x: e.clientX, y: e.clientY };
      velocity.current = { x: dx * ROTATION_SENSITIVITY, y: dy * ROTATION_SENSITIVITY };
      groupRef.current.rotation.y += velocity.current.x;
      groupRef.current.rotation.x = MathUtils.clamp(
        groupRef.current.rotation.x + velocity.current.y,
        -Math.PI / 3,
        Math.PI / 3,
      );
    };

    const onPointerUp = () => {
      isDragging.current = false;
    };

    // Touch support
    const onTouchStart = (e: TouchEvent) => {
      if (e.touches.length === 1) {
        isDragging.current = true;
        autoRotate.current = false;
        prevPointer.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
        velocity.current = { x: 0, y: 0 };
        onInteractRef.current?.();
      }
    };

    const onTouchMove = (e: TouchEvent) => {
      if (!isDragging.current || !groupRef.current || e.touches.length !== 1) return;
      e.preventDefault();
      const dx = e.touches[0].clientX - prevPointer.current.x;
      const dy = e.touches[0].clientY - prevPointer.current.y;
      prevPointer.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
      velocity.current = { x: dx * ROTATION_SENSITIVITY, y: dy * ROTATION_SENSITIVITY };
      groupRef.current.rotation.y += velocity.current.x;
      groupRef.current.rotation.x = MathUtils.clamp(
        groupRef.current.rotation.x + velocity.current.y,
        -Math.PI / 3,
        Math.PI / 3,
      );
    };

    const onTouchEnd = () => { isDragging.current = false; };

    dom.addEventListener("pointerdown", onPointerDown);
    dom.addEventListener("pointermove", onPointerMove);
    dom.addEventListener("pointerup", onPointerUp);
    dom.addEventListener("touchstart", onTouchStart, { passive: false });
    dom.addEventListener("touchmove", onTouchMove, { passive: false });
    dom.addEventListener("touchend", onTouchEnd);

    return () => {
      dom.removeEventListener("pointerdown", onPointerDown);
      dom.removeEventListener("pointermove", onPointerMove);
      dom.removeEventListener("pointerup", onPointerUp);
      dom.removeEventListener("touchstart", onTouchStart);
      dom.removeEventListener("touchmove", onTouchMove);
      dom.removeEventListener("touchend", onTouchEnd);
    };
  }, [gl, groupRef]);

  // Apply inertia + auto-rotate recovery
  useFrame(() => {
    if (!groupRef.current) return;
    if (isDragging.current) return;

    // Inertia decay
    if (!autoRotate.current && (Math.abs(velocity.current.x) > 0.0001 || Math.abs(velocity.current.y) > 0.0001)) {
      velocity.current.x *= 0.92;
      velocity.current.y *= 0.92;
      groupRef.current.rotation.y += velocity.current.x;
      groupRef.current.rotation.x = MathUtils.clamp(
        groupRef.current.rotation.x + velocity.current.y,
        -Math.PI / 3,
        Math.PI / 3,
      );
    }

    // Resume auto-rotate after 4 seconds of inactivity
    if (!autoRotate.current && Math.abs(velocity.current.x) < 0.0001) {
      autoRotate.current = true;
    }
  });

  return null;
}

// ─── Globe Components ───────────────────────────────────────────────────
function EarthSurface() {
  const [dayMap, nightMap] = useLoader(TextureLoader, [DAY_MAP, NIGHT_MAP]);
  useMemo(() => {
    [dayMap, nightMap].forEach(texture => {
      texture.colorSpace = SRGBColorSpace;
      texture.anisotropy = 2;
    });
  }, [dayMap, nightMap]);
  const material = useMemo(() => new MeshStandardMaterial({
    map: dayMap, emissiveMap: nightMap, emissive: new Color("#193b58"),
    emissiveIntensity: 0.36, roughness: 0.76, metalness: 0.04,
  }), [dayMap, nightMap]);
  return <mesh material={material} rotation={[0, -Math.PI / 2, 0]}>
    <sphereGeometry args={[1, 56, 56]} />
  </mesh>;
}

function CloudLayer() {
  const cloudMap = useLoader(TextureLoader, CLOUD_MAP);
  useMemo(() => { cloudMap.colorSpace = SRGBColorSpace; cloudMap.anisotropy = 2; }, [cloudMap]);
  return <mesh rotation={[0, -Math.PI / 2, 0]}>
    <sphereGeometry args={[1.012, 44, 44]} />
    <meshPhongMaterial map={cloudMap} transparent opacity={0.28} depthWrite={false} blending={AdditiveBlending} />
  </mesh>;
}

function Atmosphere() {
  const material = useMemo(() => new ShaderMaterial({
    vertexShader: atmosphereVertexShader, fragmentShader: atmosphereFragmentShader,
    transparent: true, side: BackSide, depthWrite: false, blending: AdditiveBlending,
  }), []);
  return <mesh material={material}><sphereGeometry args={[1.045, 44, 44]} /></mesh>;
}

// ─── Glow Halo ──────────────────────────────────────────────────────────
function MarkerGlow() {
  const material = useMemo(() => new ShaderMaterial({
    vertexShader: "varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }",
    fragmentShader: "varying vec2 vUv; void main() { float dist = length(vUv - vec2(0.5)); float glow = smoothstep(0.5, 0.0, dist); glow = pow(glow, 2.0); vec3 color = mix(vec3(0.99, 0.61, 0.43), vec3(1.0, 0.82, 0.62), glow); gl_FragColor = vec4(color, glow * 0.55); }",
    transparent: true, depthWrite: false, blending: AdditiveBlending, side: DoubleSide,
  }), []);
  return <mesh material={material}><planeGeometry args={[0.28, 0.28]} /></mesh>;
}

// ─── Satellite Marker ───────────────────────────────────────────────────
function SatelliteMarker({ marker, active, transition, onSelect }: { marker: Marker; active: boolean; transition: MarkerTransition; onSelect: (id: string) => void }) {
  const position = useMemo(() => toCartesian(marker.latitude, marker.longitude, 1.065), [marker.latitude, marker.longitude]);
  const outgoingRing = useRef<Group>(null);
  const incomingRing = useRef<Group>(null);
  const glowRef = useRef<Group>(null);
  const pulseRef = useRef<Group>(null);
  const isLeaving = transition.fromId === marker.id;
  const isEntering = transition.fromId !== null && transition.toId === marker.id;

  useFrame(({ invalidate }) => {
    if (isLeaving && outgoingRing.current) {
      const p = Math.min(1, (performance.now() - transition.startedAt) / FOCUS_DURATION_MS);
      outgoingRing.current.scale.setScalar(Math.max(.01, 1 - p));
      invalidate();
    }
    if (isEntering && incomingRing.current) {
      const p = Math.min(1, (performance.now() - transition.startedAt) / FOCUS_DURATION_MS);
      incomingRing.current.scale.setScalar(.6 + p * .4);
      invalidate();
    }
    if (active && pulseRef.current) {
      const t = performance.now() / 800;
      pulseRef.current.scale.setScalar(1 + Math.sin(t * Math.PI * 2) * 0.12);
    }
    if (active && glowRef.current) {
      const t = performance.now() / 1200;
      glowRef.current.scale.setScalar(0.85 + Math.sin(t * Math.PI * 2) * 0.15);
      glowRef.current.lookAt(0, 0, 0);
    }
  });

  // Larger click target for better UX
  return <group position={position} onClick={event => { event.stopPropagation(); onSelect(marker.id); }}>
    {isLeaving && <group ref={outgoingRing}>
      <mesh><ringGeometry args={[0.065, 0.09, 32]} /><meshBasicMaterial color="#ffb38d" transparent opacity={0.7} side={DoubleSide} /></mesh>
    </group>}
    {isEntering && <group ref={incomingRing}>
      <mesh><ringGeometry args={[0.07, 0.085, 32]} /><meshBasicMaterial color="#ffb38d" transparent opacity={0.85} side={DoubleSide} /></mesh>
    </group>}
    {active && <group ref={pulseRef}>
      <mesh><ringGeometry args={[0.068, 0.082, 32]} /><meshBasicMaterial color="#ffb38d" transparent opacity={0.9} side={DoubleSide} /></mesh>
    </group>}
    {active && <group ref={glowRef}><MarkerGlow /></group>}
    <mesh>
      <sphereGeometry args={[active ? 0.042 : 0.03, 16, 16]} />
      <meshBasicMaterial color={active ? "#ff9c6d" : "#63e6be"} />
    </mesh>
    {active && <mesh>
      <sphereGeometry args={[0.018, 10, 10]} />
      <meshBasicMaterial color="#fff5ee" />
    </mesh>}
    {/* Invisible larger click target */}
    <mesh visible={false}>
      <sphereGeometry args={[0.08, 8, 8]} />
      <meshBasicMaterial />
    </mesh>
  </group>;
}

// ─── User Location Marker ───────────────────────────────────────────────
function UserLocationMarker({ location }: { location: { latitude: number; longitude: number } }) {
  const position = useMemo(() => toCartesian(location.latitude, location.longitude, 1.07), [location.latitude, location.longitude]);
  const pulseRef = useRef<Group>(null);

  useFrame(() => {
    if (pulseRef.current) {
      const t = performance.now() / 1000;
      pulseRef.current.scale.setScalar(1 + Math.sin(t * Math.PI * 2) * 0.15);
    }
  });

  return <group position={position}>
    {/* Pulsing ring */}
    <group ref={pulseRef}>
      <mesh>
        <ringGeometry args={[0.05, 0.065, 32]} />
        <meshBasicMaterial color="#4ade80" transparent opacity={0.8} side={DoubleSide} />
      </mesh>
    </group>
    {/* Core dot */}
    <mesh>
      <sphereGeometry args={[0.028, 12, 12]} />
      <meshBasicMaterial color="#4ade80" />
    </mesh>
    {/* White inner */}
    <mesh>
      <sphereGeometry args={[0.012, 8, 8]} />
      <meshBasicMaterial color="#f0fdf4" />
    </mesh>
    {/* Beam pointing outward */}
    <mesh position={[0, 0, 0.04]}>
      <cylinderGeometry args={[0.003, 0.003, 0.08, 6]} />
      <meshBasicMaterial color="#4ade80" transparent opacity={0.5} />
    </mesh>
  </group>;
}

// ─── Globe Scene ────────────────────────────────────────────────────────
function GlobeScene({ markers, selectedId, markerTransition, onSelect, userLocation, reducedMotion }: Omit<EarthGlobeProps, "className"> & { reducedMotion: boolean; markerTransition: MarkerTransition }) {
  const group = useRef<Group>(null);
  const selected = markers.find(marker => marker.id === selectedId);
  const targetRotation = selected ? MathUtils.degToRad(-selected.longitude) : 0;
  const transition = useRef({ from: targetRotation, to: targetRotation, startedAt: performance.now() });
  const invalidate = useThree(state => state.invalidate);

  useEffect(() => {
    if (!group.current) return;
    const currentY = group.current.rotation.y;
    transition.current = { from: currentY, to: targetRotation, startedAt: performance.now() };
  }, [targetRotation]);

  // Always render (fixes desktop animation)
  useFrame(() => {
    if (!group.current) return;

    // Smooth rotation to target satellite
    const elapsed = Math.min(1, (performance.now() - transition.current.startedAt) / FOCUS_DURATION_MS);
    if (elapsed < 1) {
      const eased = elapsed < .5 ? 2 * elapsed * elapsed : 1 - Math.pow(-2 * elapsed + 2, 2) / 2;
      group.current.rotation.y = MathUtils.lerp(transition.current.from, transition.current.to, eased);
      invalidate();
    }

    // Gentle auto-rotate when idle (very slow)
    // Handled by OrbitControls
  });

  const handleInteract = useCallback(() => {
    // Reset transition when user manually rotates
    if (group.current) {
      transition.current = { from: group.current.rotation.y, to: group.current.rotation.y, startedAt: performance.now() };
    }
  }, []);

  return <>
    <ambientLight intensity={0.34} color="#6cb7d8" />
    <directionalLight position={[4, 2.5, 5]} intensity={1.6} color="#d7f5ff" />
    <pointLight position={[-3, -1.5, -2]} intensity={0.24} color="#0a4d88" />
    <group ref={group}>
      <EarthSurface />
      <CloudLayer />
      <Atmosphere />
      {markers.map(marker => <SatelliteMarker key={marker.id} marker={marker} active={marker.id === selectedId} transition={markerTransition} onSelect={onSelect} />)}
      {userLocation && <UserLocationMarker location={userLocation} />}
    </group>
    <OrbitControls groupRef={group} onInteract={handleInteract} />
  </>;
}

function GlobeFallback() {
  return <div className="three-globe-fallback" aria-hidden="true"><span /></div>;
}

// ─── Main Component ─────────────────────────────────────────────────────
export const EarthGlobe = memo(function EarthGlobe({ markers, selectedId, onSelect, userLocation, className = "" }: EarthGlobeProps) {
  const selectedMarker = markers.find(marker => marker.id === selectedId);
  const reducedMotion = useReducedMotion();
  const previousSelectedId = useRef(selectedId);
  const [markerTransition, setMarkerTransition] = useState<MarkerTransition>({ fromId: null, toId: selectedId, startedAt: 0 });
  useEffect(() => {
    const fromId = previousSelectedId.current;
    if (fromId === selectedId) return;
    previousSelectedId.current = selectedId;
    const startedAt = performance.now();
    setMarkerTransition({ fromId, toId: selectedId, startedAt });
    const timer = window.setTimeout(() => setMarkerTransition({ fromId: null, toId: selectedId, startedAt: 0 }), FOCUS_DURATION_MS);
    return () => window.clearTimeout(timer);
  }, [selectedId]);
  const markerGeometry = JSON.stringify(markers.map(marker => ({ id: marker.id, latitude: marker.latitude, longitude: marker.longitude })));
  const isTransitioning = Boolean(markerTransition.fromId) && !reducedMotion;
  return <div className={`three-globe ${className}`} data-renderer="react-three-fiber" data-active-marker={selectedId} data-transition-from={markerTransition.fromId || ""} data-transition-to={markerTransition.toId} data-is-transitioning={isTransitioning} data-marker-count={markers.length} data-marker-geometry={markerGeometry} data-focus-longitude={selectedMarker?.longitude ?? 0} data-focus-duration={FOCUS_DURATION_MS} data-reduced-motion={reducedMotion} aria-label={`Globo 3D com foco em ${selectedMarker?.name || "objeto orbital"}`}>
    <Canvas dpr={[1, 1.25]} frameloop="always" camera={{ position: [0, 0, 3.2], fov: 38 }} gl={{ alpha: true, antialias: true, powerPreference: "high-performance" }} fallback={<GlobeFallback />}>
      <Suspense fallback={null}><GlobeScene markers={markers} selectedId={selectedId} markerTransition={markerTransition} onSelect={onSelect} userLocation={userLocation} reducedMotion={reducedMotion} /></Suspense>
    </Canvas>
  </div>;
});
