import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { memo, Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { getGlobeFocusRotation } from "@/lib/globeFocus";
import type { Texture } from "three";
import { AdditiveBlending, BackSide, Color, DoubleSide, Group, MathUtils, MeshStandardMaterial, ShaderMaterial, SRGBColorSpace, TextureLoader, Vector3 } from "three";

// ─── Constants ─────────────────────────────────────────────────────────
const DAY_MAP = "/assets/earth-day-atlas_ee47322f.jpg";
const NIGHT_MAP = "/assets/earth-night-atlas_06d895db.jpg";
const CLOUD_MAP = "/assets/earth-clouds-atlas_8c506c86.png";
const FOCUS_DURATION_MS = 500;
const ROTATION_SENSITIVITY = 0.006;
const INERTIA_DAMPING = 0.93;
const AUTO_ROTATE_SPEED = 0.0004;
const AUTO_ROTATE_DELAY_MS = 4000;
const MAX_TILT = Math.PI / 3;

// ─── Shaders ───────────────────────────────────────────────────────────
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

// ─── Types ─────────────────────────────────────────────────────────────
type Marker = { id: string; shortName: string; name: string; latitude: number; longitude: number };
type MarkerTransition = { fromId: string | null; toId: string; startedAt: number };

export type EarthGlobeProps = {
  markers: Marker[];
  selectedId: string;
  onSelect: (id: string) => void;
  className?: string;
  userLocation?: { latitude: number; longitude: number } | null;
};

// ─── Utilities ─────────────────────────────────────────────────────────
function toCartesian(latitude: number, longitude: number, radius: number) {
  const lat = MathUtils.degToRad(latitude);
  const lon = MathUtils.degToRad(longitude);
  return new Vector3(
    radius * Math.cos(lat) * Math.sin(lon),
    radius * Math.sin(lat),
    radius * Math.cos(lat) * Math.cos(lon),
  );
}

function useReducedMotion() {
  const [reducedMotion, setReducedMotion] = useState(false);
  useEffect(() => {
    const q = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReducedMotion(q.matches);
    update();
    q.addEventListener("change", update);
    return () => q.removeEventListener("change", update);
  }, []);
  return reducedMotion;
}

// ─── Safe Texture Loader ───────────────────────────────────────────────
function useSafeTexture(url: string) {
  const [texture, setTexture] = useState<Texture | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    const loader = new TextureLoader();
    let cancelled = false;
    loader.load(
      url,
      (loaded) => {
        if (cancelled) return;
        loaded.colorSpace = SRGBColorSpace;
        loaded.anisotropy = 2;
        setTexture(loaded);
      },
      undefined,
      () => {
        if (cancelled) return;
        console.warn(`[Globe] Failed to load texture: ${url}`);
        setError(true);
      },
    );
    return () => { cancelled = true; };
  }, [url]);

  return { texture, error };
}

// ─── Globe Surface ─────────────────────────────────────────────────────
function EarthSurface() {
  const { texture: dayMap, error: dayError } = useSafeTexture(DAY_MAP);
  const { texture: nightMap, error: nightError } = useSafeTexture(NIGHT_MAP);

  const material = useMemo(() => {
    if (dayError && nightError) {
      return new MeshStandardMaterial({
        color: new Color("#1a5276"),
        emissive: new Color("#0a2a3f"),
        emissiveIntensity: 0.3,
        roughness: 0.8,
        metalness: 0.05,
      });
    }
    if (!dayMap || !nightMap) {
      return new MeshStandardMaterial({ transparent: true, opacity: 0 });
    }
    return new MeshStandardMaterial({
      map: dayMap,
      emissiveMap: nightMap,
      emissive: new Color("#193b58"),
      emissiveIntensity: 0.36,
      roughness: 0.76,
      metalness: 0.04,
    });
  }, [dayMap, nightMap, dayError, nightError]);

  return (
    <mesh material={material} rotation={[0, -Math.PI / 2, 0]}>
      <sphereGeometry args={[1, 56, 56]} />
    </mesh>
  );
}

function CloudLayer() {
  const { texture: cloudMap, error: cloudError } = useSafeTexture(CLOUD_MAP);
  if (cloudError || !cloudMap) return null;
  return (
    <mesh rotation={[0, -Math.PI / 2, 0]}>
      <sphereGeometry args={[1.012, 44, 44]} />
      <meshPhongMaterial map={cloudMap} transparent opacity={0.28} depthWrite={false} blending={AdditiveBlending} />
    </mesh>
  );
}

function Atmosphere() {
  const material = useMemo(() => new ShaderMaterial({
    vertexShader: atmosphereVertexShader,
    fragmentShader: atmosphereFragmentShader,
    transparent: true,
    side: BackSide,
    depthWrite: false,
    blending: AdditiveBlending,
  }), []);
  return <mesh material={material}><sphereGeometry args={[1.045, 44, 44]} /></mesh>;
}

// ─── Marker Glow ───────────────────────────────────────────────────────
function MarkerGlow() {
  const material = useMemo(() => new ShaderMaterial({
    vertexShader: "varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }",
    fragmentShader: "varying vec2 vUv; void main() { float dist = length(vUv - vec2(0.5)); float glow = smoothstep(0.5, 0.0, dist); glow = pow(glow, 2.0); vec3 color = mix(vec3(0.99, 0.61, 0.43), vec3(1.0, 0.82, 0.62), glow); gl_FragColor = vec4(color, glow * 0.55); }",
    transparent: true, depthWrite: false, blending: AdditiveBlending, side: DoubleSide,
  }), []);
  return <mesh material={material}><planeGeometry args={[0.28, 0.28]} /></mesh>;
}

// ─── Satellite Marker ──────────────────────────────────────────────────
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

  return (
    <group position={position} onClick={(e) => { e.stopPropagation(); onSelect(marker.id); }}>
      {isLeaving && <group ref={outgoingRing}><mesh><ringGeometry args={[0.065, 0.09, 32]} /><meshBasicMaterial color="#ffb38d" transparent opacity={0.7} side={DoubleSide} /></mesh></group>}
      {isEntering && <group ref={incomingRing}><mesh><ringGeometry args={[0.07, 0.085, 32]} /><meshBasicMaterial color="#ffb38d" transparent opacity={0.85} side={DoubleSide} /></mesh></group>}
      {active && <group ref={pulseRef}><mesh><ringGeometry args={[0.068, 0.082, 32]} /><meshBasicMaterial color="#ffb38d" transparent opacity={0.9} side={DoubleSide} /></mesh></group>}
      {active && <group ref={glowRef}><MarkerGlow /></group>}
      <mesh><sphereGeometry args={[active ? 0.042 : 0.03, 16, 16]} /><meshBasicMaterial color={active ? "#ff9c6d" : "#63e6be"} /></mesh>
      {active && <mesh><sphereGeometry args={[0.018, 10, 10]} /><meshBasicMaterial color="#fff5ee" /></mesh>}
    </group>
  );
}

// ─── User Location Marker ──────────────────────────────────────────────
function UserLocationMarker({ location }: { location: { latitude: number; longitude: number } }) {
  const pos = useMemo(() => toCartesian(location.latitude, location.longitude, 1.055), [location.latitude, location.longitude]);
  const beacon = useRef<Group>(null);
  useFrame(() => {
    if (!beacon.current) return;
    const t = performance.now() / 1000;
    beacon.current.scale.setScalar(1 + Math.sin(t * Math.PI * 2) * 0.2);
  });
  return (
    <group position={pos}>
      <mesh><sphereGeometry args={[0.025, 10, 10]} /><meshBasicMaterial color="#4ade80" /></mesh>
      <mesh position={[0, 0, 0.04]}><cylinderGeometry args={[0.003, 0.003, 0.08, 6]} /><meshBasicMaterial color="#4ade80" transparent opacity={0.5} /></mesh>
      <group ref={beacon}><mesh><ringGeometry args={[0.035, 0.045, 24]} /><meshBasicMaterial color="#4ade80" transparent opacity={0.4} side={DoubleSide} /></mesh></group>
    </group>
  );
}

// ─── Orbit Controls ────────────────────────────────────────────────────
// Manages the OUTER group: drag, inertia, auto-rotate.
// Independent from satellite focus transition.
function OrbitControls({ groupRef, onInteract }: { groupRef: React.RefObject<Group | null>; onInteract?: () => void }) {
  const onInteractRef = useRef(onInteract);
  useEffect(() => { onInteractRef.current = onInteract; }, [onInteract]);
  const { gl } = useThree();
  const isDragging = useRef(false);
  const prevPointer = useRef({ x: 0, y: 0 });
  const velocity = useRef({ x: 0, y: 0 });
  const autoRotate = useRef(true);
  const autoRotateTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const dom = gl.domElement;

    const onPointerDown = (e: PointerEvent) => {
      isDragging.current = true;
      autoRotate.current = false;
      if (autoRotateTimer.current) clearTimeout(autoRotateTimer.current);
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
        -MAX_TILT, MAX_TILT,
      );
    };

    const onPointerUp = () => {
      isDragging.current = false;
      autoRotateTimer.current = setTimeout(() => { autoRotate.current = true; }, AUTO_ROTATE_DELAY_MS);
    };

    const onTouchStart = (e: TouchEvent) => {
      if (e.touches.length !== 1) return;
      isDragging.current = true;
      autoRotate.current = false;
      if (autoRotateTimer.current) clearTimeout(autoRotateTimer.current);
      prevPointer.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
      velocity.current = { x: 0, y: 0 };
      onInteractRef.current?.();
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
        -MAX_TILT, MAX_TILT,
      );
    };

    const onTouchEnd = () => {
      isDragging.current = false;
      autoRotateTimer.current = setTimeout(() => { autoRotate.current = true; }, AUTO_ROTATE_DELAY_MS);
    };

    dom.addEventListener("pointerdown", onPointerDown);
    dom.addEventListener("pointermove", onPointerMove);
    dom.addEventListener("pointerup", onPointerUp);
    dom.addEventListener("pointercancel", onPointerUp);
    dom.addEventListener("touchstart", onTouchStart, { passive: false });
    dom.addEventListener("touchmove", onTouchMove, { passive: false });
    dom.addEventListener("touchend", onTouchEnd);

    return () => {
      if (autoRotateTimer.current) clearTimeout(autoRotateTimer.current);
      dom.removeEventListener("pointerdown", onPointerDown);
      dom.removeEventListener("pointermove", onPointerMove);
      dom.removeEventListener("pointerup", onPointerUp);
      dom.removeEventListener("pointercancel", onPointerUp);
      dom.removeEventListener("touchstart", onTouchStart);
      dom.removeEventListener("touchmove", onTouchMove);
      dom.removeEventListener("touchend", onTouchEnd);
    };
  }, [gl, groupRef]);

  // Inertia + auto-rotate every frame on the OUTER group
  useFrame(() => {
    if (!groupRef.current) return;
    if (isDragging.current) return;

    if (!autoRotate.current && (Math.abs(velocity.current.x) > 0.0001 || Math.abs(velocity.current.y) > 0.0001)) {
      velocity.current.x *= INERTIA_DAMPING;
      velocity.current.y *= INERTIA_DAMPING;
      groupRef.current.rotation.y += velocity.current.x;
      groupRef.current.rotation.x = MathUtils.clamp(
        groupRef.current.rotation.x + velocity.current.y,
        -MAX_TILT, MAX_TILT,
      );
    }

    if (autoRotate.current) {
      groupRef.current.rotation.y += AUTO_ROTATE_SPEED;
    }
  });

  return null;
}

// ─── Globe Scene ───────────────────────────────────────────────────────
// TWO nested groups to prevent rotation conflicts:
//   outerGroup ← OrbitControls (drag, inertia, auto-rotate)
//   innerGroup ← satellite focus transition (lerp to latitude/longitude)
function GlobeScene({ markers, selectedId, markerTransition, onSelect, userLocation, reducedMotion }: Omit<EarthGlobeProps, "className"> & { reducedMotion: boolean; markerTransition: MarkerTransition }) {
  const outerGroup = useRef<Group>(null);
  const innerGroup = useRef<Group>(null);
  const selected = markers.find(m => m.id === selectedId);
  const targetRotation = selected ? getGlobeFocusRotation(selected.latitude, selected.longitude) : { rotationX: 0, rotationY: 0 };
  const transition = useRef({ fromX: targetRotation.rotationX, fromY: targetRotation.rotationY, toX: targetRotation.rotationX, toY: targetRotation.rotationY, startedAt: 0 });
  const invalidate = useThree(state => state.invalidate);

  useEffect(() => {
    if (!innerGroup.current) return;
    const currentX = innerGroup.current.rotation.x;
    const currentY = innerGroup.current.rotation.y;
    transition.current = {
      fromX: currentX,
      fromY: currentY,
      toX: targetRotation.rotationX,
      toY: targetRotation.rotationY,
      startedAt: performance.now(),
    };
  }, [targetRotation.rotationX, targetRotation.rotationY]);

  useFrame(() => {
    if (!innerGroup.current) return;
    const elapsed = Math.min(1, (performance.now() - transition.current.startedAt) / FOCUS_DURATION_MS);
    if (elapsed < 1) {
      const eased = elapsed < .5 ? 2 * elapsed * elapsed : 1 - Math.pow(-2 * elapsed + 2, 2) / 2;
      innerGroup.current.rotation.x = MathUtils.lerp(transition.current.fromX, transition.current.toX, eased);
      innerGroup.current.rotation.y = MathUtils.lerp(transition.current.fromY, transition.current.toY, eased);
      invalidate();
    }
  });

  const handleInteract = useCallback(() => {
    if (innerGroup.current) {
      transition.current = {
        fromX: innerGroup.current.rotation.x,
        fromY: innerGroup.current.rotation.y,
        toX: innerGroup.current.rotation.x,
        toY: innerGroup.current.rotation.y,
        startedAt: performance.now(),
      };
    }
  }, []);

  return <>
    <ambientLight intensity={0.34} color="#6cb7d8" />
    <directionalLight position={[4, 2.5, 5]} intensity={1.6} color="#d7f5ff" />
    <pointLight position={[-3, -1.5, -2]} intensity={0.24} color="#0a4d88" />

    <group ref={outerGroup}>
      <OrbitControls groupRef={outerGroup} onInteract={handleInteract} />
      <group ref={innerGroup}>
        <EarthSurface />
        <CloudLayer />
        <Atmosphere />
        {markers.map(marker => (
          <SatelliteMarker key={marker.id} marker={marker} active={marker.id === selectedId} transition={markerTransition} onSelect={onSelect} />
        ))}
        {userLocation && <UserLocationMarker location={userLocation} />}
      </group>
    </group>
  </>;
}

// ─── Fallback ──────────────────────────────────────────────────────────
function GlobeFallback() {
  return <div className="three-globe-fallback" aria-hidden="true"><span /></div>;
}

// ─── Export ─────────────────────────────────────────────────────────────
export const EarthGlobe = memo(function EarthGlobe({ markers, selectedId, onSelect, className = "", userLocation }: EarthGlobeProps) {
  const selectedMarker = markers.find(m => m.id === selectedId);
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

  const markerGeometry = JSON.stringify(markers.map(m => ({ id: m.id, latitude: m.latitude, longitude: m.longitude })));
  const isTransitioning = Boolean(markerTransition.fromId) && !reducedMotion;

  return (
    <div
      className={`three-globe ${className}`}
      data-renderer="react-three-fiber"
      data-active-marker={selectedId}
      data-transition-from={markerTransition.fromId || ""}
      data-transition-to={markerTransition.toId}
      data-is-transitioning={isTransitioning}
      data-marker-count={markers.length}
      data-marker-geometry={markerGeometry}
      data-focus-latitude={selectedMarker?.latitude ?? 0}
      data-focus-longitude={selectedMarker?.longitude ?? 0}
      data-focus-rotation-x={selectedMarker ? getGlobeFocusRotation(selectedMarker.latitude, selectedMarker.longitude).rotationX : 0}
      data-focus-rotation-y={selectedMarker ? getGlobeFocusRotation(selectedMarker.latitude, selectedMarker.longitude).rotationY : 0}
      data-focus-duration={FOCUS_DURATION_MS}
      data-reduced-motion={reducedMotion}
      aria-label={`Globo 3D com foco em ${selectedMarker?.name || "objeto orbital"}`}
    >
      <Canvas
        dpr={[1, 1.25]}
        frameloop="always"
        camera={{ position: [0, 0, 3.2], fov: 38 }}
        gl={{ alpha: true, antialias: true, powerPreference: "high-performance" }}
        fallback={<GlobeFallback />}
      >
        <Suspense fallback={null}>
          <GlobeScene
            markers={markers}
            selectedId={selectedId}
            markerTransition={markerTransition}
            onSelect={onSelect}
            reducedMotion={reducedMotion}
            userLocation={userLocation}
          />
        </Suspense>
      </Canvas>
    </div>
  );
});
