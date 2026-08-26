import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { memo, Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { getGlobeFocusRotation, getShortestRotationTarget } from "@/lib/globeFocus";
import type { Texture } from "three";
import { AdditiveBlending, BackSide, Color, DoubleSide, Group, MathUtils, MeshStandardMaterial, ShaderMaterial, SRGBColorSpace, TextureLoader, Vector3 } from "three";

// ─── Constants ─────────────────────────────────────────────────────────
const DAY_MAP = "/assets/earth-day-atlas_ee47322f.jpg";
const NIGHT_MAP = "/assets/earth-night-atlas_06d895db.jpg";
const CLOUD_MAP = "/assets/earth-clouds-atlas_8c506c86.png";
const FOCUS_DURATION_MS = 500;
const ROTATION_SENSITIVITY = 0.006;
const INERTIA_DAMPING = 0.93;
const AUTO_ROTATE_SPEED = 0.0016;
const AUTO_ROTATE_DELAY_MS = 900;
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
    let loadedTexture: Texture | null = null;
    loader.load(
      url,
      (loaded) => {
        if (cancelled) {
          loaded.dispose();
          return;
        }
        loadedTexture = loaded;
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
    return () => {
      cancelled = true;
      loadedTexture?.dispose();
    };
  }, [url]);

  return { texture, error };
}

// ─── Globe Surface ─────────────────────────────────────────────────────
function EarthSurface() {
  const { texture: dayMap, error: dayError } = useSafeTexture(DAY_MAP);
  const { texture: nightMap, error: nightError } = useSafeTexture(NIGHT_MAP);

  const material = useMemo(() => {
    if (dayError || nightError) {
      const availableMap = dayMap ?? nightMap;
      return new MeshStandardMaterial({
        map: availableMap || undefined,
        emissiveMap: nightMap || undefined,
        color: new Color("#1a5276"),
        emissive: new Color("#0a2a3f"),
        emissiveIntensity: 0.3,
        roughness: 0.8,
        metalness: 0.05,
      });
    }
    if (!dayMap || !nightMap) {
      return new MeshStandardMaterial({ color: new Color("#17496d"), emissive: new Color("#0a2a3f"), emissiveIntensity: 0.18, roughness: 0.8, metalness: 0.05 });
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

function GlobeOrbitRing() {
  return <mesh rotation={[MathUtils.degToRad(64), MathUtils.degToRad(-8), MathUtils.degToRad(18)]}>
    <torusGeometry args={[1.095, 0.007, 8, 96]} />
    <meshBasicMaterial color="#55cfff" transparent opacity={0.28} blending={AdditiveBlending} depthWrite={false} />
  </mesh>;
}

// ─── Marker Glow ───────────────────────────────────────────────────────
function MarkerGlow() {
  const material = useMemo(() => new ShaderMaterial({
    vertexShader: "varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }",
    fragmentShader: "varying vec2 vUv; void main() { float dist = length(vUv - vec2(0.5)); float glow = smoothstep(0.5, 0.0, dist); glow = pow(glow, 2.0); vec3 color = mix(vec3(0.99, 0.61, 0.43), vec3(1.0, 0.82, 0.62), glow); gl_FragColor = vec4(color, glow * 0.55); }",
    transparent: true, depthTest: false, depthWrite: false, blending: AdditiveBlending, side: DoubleSide,
  }), []);
  return <mesh material={material}><planeGeometry args={[0.28, 0.28]} /></mesh>;
}

// ─── Satellite Marker ──────────────────────────────────────────────────
function SatelliteMarker({ marker, active, transition, onSelect, reducedMotion }: { marker: Marker; active: boolean; transition: MarkerTransition; onSelect: (id: string) => void; reducedMotion: boolean }) {
  const position = useMemo(() => toCartesian(marker.latitude, marker.longitude, 1.065), [marker.latitude, marker.longitude]);
  const outgoingRing = useRef<Group>(null);
  const incomingRing = useRef<Group>(null);
  const glowRef = useRef<Group>(null);
  const pulseRef = useRef<Group>(null);
  const isLeaving = transition.fromId === marker.id;
  const isEntering = transition.fromId !== null && transition.toId === marker.id;

  useFrame(({ invalidate }) => {
    if (reducedMotion) return;
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
    <group position={position} renderOrder={active ? 6 : 5} onClick={(e) => { e.stopPropagation(); onSelect(marker.id); }}>
      {isLeaving && <group ref={outgoingRing}><mesh><ringGeometry args={[0.065, 0.09, 32]} /><meshBasicMaterial color="#ffb38d" transparent opacity={0.7} depthTest={false} side={DoubleSide} /></mesh></group>}
      {isEntering && <group ref={incomingRing}><mesh><ringGeometry args={[0.07, 0.085, 32]} /><meshBasicMaterial color="#ffb38d" transparent opacity={0.85} depthTest={false} side={DoubleSide} /></mesh></group>}
      {active && <group ref={pulseRef}><mesh><ringGeometry args={[0.068, 0.082, 32]} /><meshBasicMaterial color="#ffb38d" transparent opacity={0.9} depthTest={false} side={DoubleSide} /></mesh></group>}
      {active && <group ref={glowRef}><MarkerGlow /></group>}
      <mesh><sphereGeometry args={[active ? 0.042 : 0.03, 16, 16]} /><meshBasicMaterial color={active ? "#ff9c6d" : "#63e6be"} depthTest={false} /></mesh>
      {active && <mesh><sphereGeometry args={[0.018, 10, 10]} /><meshBasicMaterial color="#fff5ee" depthTest={false} /></mesh>}
    </group>
  );
}

// ─── User Location Marker ──────────────────────────────────────────────
function UserLocationMarker({ location, reducedMotion }: { location: { latitude: number; longitude: number }; reducedMotion: boolean }) {
  const pos = useMemo(() => toCartesian(location.latitude, location.longitude, 1.055), [location.latitude, location.longitude]);
  const beacon = useRef<Group>(null);
  useFrame(() => {
    if (reducedMotion || !beacon.current) return;
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
function OrbitControls({ groupRef, onInteract, focusActive = false, reducedMotion = false }: { groupRef: React.RefObject<Group | null>; onInteract?: () => void; focusActive?: boolean; reducedMotion?: boolean }) {
  const onInteractRef = useRef(onInteract);
  useEffect(() => { onInteractRef.current = onInteract; }, [onInteract]);
  const { gl } = useThree();
  const isDragging = useRef(false);
  const prevPointer = useRef({ x: 0, y: 0 });
  const velocity = useRef({ x: 0, y: 0 });
  const activeInput = useRef<"pointer" | "touch" | null>(null);
  const autoRotate = useRef(true);
  const autoRotateTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const wasFocusActive = useRef(false);
  const wasReducedMotion = useRef(reducedMotion);

  useEffect(() => {
    const dom = gl.domElement;

    const onPointerDown = (e: PointerEvent) => {
      if (activeInput.current === "touch") return;
      activeInput.current = "pointer";
      dom.setPointerCapture?.(e.pointerId);
      isDragging.current = true;
      autoRotate.current = false;
      if (autoRotateTimer.current) clearTimeout(autoRotateTimer.current);
      prevPointer.current = { x: e.clientX, y: e.clientY };
      velocity.current = { x: 0, y: 0 };
      onInteractRef.current?.();
    };

    const onPointerMove = (e: PointerEvent) => {
      if (activeInput.current !== "pointer" || !isDragging.current || !groupRef.current) return;
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

    const onPointerUp = (e: PointerEvent) => {
      if (activeInput.current !== "pointer") return;
      isDragging.current = false;
      activeInput.current = null;
      if (dom.hasPointerCapture?.(e.pointerId)) dom.releasePointerCapture?.(e.pointerId);
      autoRotateTimer.current = setTimeout(() => { autoRotate.current = true; }, AUTO_ROTATE_DELAY_MS);
    };

    const onTouchStart = (e: TouchEvent) => {
      if (activeInput.current === "pointer" || e.touches.length !== 1) return;
      activeInput.current = "touch";
      isDragging.current = true;
      autoRotate.current = false;
      if (autoRotateTimer.current) clearTimeout(autoRotateTimer.current);
      prevPointer.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
      velocity.current = { x: 0, y: 0 };
      onInteractRef.current?.();
    };

    const onTouchMove = (e: TouchEvent) => {
      if (activeInput.current !== "touch" || !isDragging.current || !groupRef.current || e.touches.length !== 1) return;
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
      if (activeInput.current !== "touch") return;
      isDragging.current = false;
      activeInput.current = null;
      autoRotateTimer.current = setTimeout(() => { autoRotate.current = true; }, AUTO_ROTATE_DELAY_MS);
    };

    const previousTouchAction = dom.style.touchAction;
    dom.style.touchAction = "none";

    dom.addEventListener("pointerdown", onPointerDown);
    dom.addEventListener("pointermove", onPointerMove);
    dom.addEventListener("pointerup", onPointerUp);
    dom.addEventListener("pointercancel", onPointerUp);
    dom.addEventListener("touchstart", onTouchStart, { passive: false });
    dom.addEventListener("touchmove", onTouchMove, { passive: false });
    dom.addEventListener("touchend", onTouchEnd);

    return () => {
      if (autoRotateTimer.current) clearTimeout(autoRotateTimer.current);
      activeInput.current = null;
      dom.style.touchAction = previousTouchAction;
      dom.removeEventListener("pointerdown", onPointerDown);
      dom.removeEventListener("pointermove", onPointerMove);
      dom.removeEventListener("pointerup", onPointerUp);
      dom.removeEventListener("pointercancel", onPointerUp);
      dom.removeEventListener("touchstart", onTouchStart);
      dom.removeEventListener("touchmove", onTouchMove);
      dom.removeEventListener("touchend", onTouchEnd);
    };
  }, [gl, groupRef]);

  useEffect(() => {
    if (reducedMotion) {
      autoRotate.current = false;
      velocity.current = { x: 0, y: 0 };
      if (autoRotateTimer.current) clearTimeout(autoRotateTimer.current);
    } else if (wasReducedMotion.current && !focusActive) {
      autoRotate.current = true;
    }
    wasReducedMotion.current = reducedMotion;
  }, [focusActive, reducedMotion]);

  useEffect(() => {
    if (focusActive) {
      wasFocusActive.current = true;
      autoRotate.current = false;
      velocity.current = { x: 0, y: 0 };
      if (autoRotateTimer.current) clearTimeout(autoRotateTimer.current);
      return;
    }
    if (!wasFocusActive.current) return;
    wasFocusActive.current = false;
    autoRotate.current = false;
    autoRotateTimer.current = setTimeout(() => { autoRotate.current = true; }, AUTO_ROTATE_DELAY_MS);
  }, [focusActive]);

  // Inertia + auto-rotate every frame on the OUTER group
  useFrame((_, delta) => {
    if (!groupRef.current) return;
    if (focusActive || isDragging.current || reducedMotion) return;

    // Normaliza a 60 Hz: a rotação não fica mais lenta em monitores de 120 Hz
    // nem dá saltos excessivos quando um frame demora mais que o esperado.
    const frameScale = Math.min(2, delta * 60);
    if (!autoRotate.current && (Math.abs(velocity.current.x) > 0.0001 || Math.abs(velocity.current.y) > 0.0001)) {
      const damping = Math.pow(INERTIA_DAMPING, frameScale);
      velocity.current.x *= damping;
      velocity.current.y *= damping;
      groupRef.current.rotation.y += velocity.current.x * frameScale;
      groupRef.current.rotation.x = MathUtils.clamp(
        groupRef.current.rotation.x + velocity.current.y * frameScale,
        -MAX_TILT, MAX_TILT,
      );
    }

    if (autoRotate.current) {
      groupRef.current.rotation.y += AUTO_ROTATE_SPEED * frameScale;
    }
  });

  return null;
}

// ─── Globe Scene ───────────────────────────────────────────────────────
// TWO nested groups with explicit focus normalization:
//   outerGroup ← drag, inertia, auto-rotate and accumulated orientation
//   innerGroup ← geographic focus transition (latitude/longitude)
// During a selection, the outer group returns to neutral so the selected marker
// cannot inherit a previous drag/auto-rotation offset.
function GlobeScene({ markers, selectedId, markerTransition, onSelect, userLocation, reducedMotion, onRotationFrame }: Omit<EarthGlobeProps, "className"> & { reducedMotion: boolean; markerTransition: MarkerTransition; onRotationFrame?: (rotationY: number) => void }) {
  const outerGroup = useRef<Group>(null);
  const innerGroup = useRef<Group>(null);
  const selected = markers.find(m => m.id === selectedId);
  const targetRotation = selected ? getGlobeFocusRotation(selected.latitude, selected.longitude) : { rotationX: 0, rotationY: 0 };
  const transition = useRef({ fromX: targetRotation.rotationX, fromY: targetRotation.rotationY, toX: targetRotation.rotationX, toY: targetRotation.rotationY, outerFromX: 0, outerFromY: 0, outerToX: 0, outerToY: 0, startedAt: 0 });
  const rotationProbeAt = useRef(0);
  const invalidate = useThree(state => state.invalidate);

  useEffect(() => {
    if (!innerGroup.current) return;
    const currentX = innerGroup.current.rotation.x;
    const currentY = innerGroup.current.rotation.y;
    const outerCurrentX = outerGroup.current?.rotation.x || 0;
    const outerCurrentY = outerGroup.current?.rotation.y || 0;
    if (reducedMotion) {
      innerGroup.current.rotation.set(targetRotation.rotationX, targetRotation.rotationY, 0);
      outerGroup.current?.rotation.set(0, 0, 0);
      transition.current = { fromX: targetRotation.rotationX, fromY: targetRotation.rotationY, toX: targetRotation.rotationX, toY: targetRotation.rotationY, outerFromX: 0, outerFromY: 0, outerToX: 0, outerToY: 0, startedAt: performance.now() - FOCUS_DURATION_MS };
      return;
    }
    transition.current = {
      fromX: currentX,
      fromY: currentY,
      toX: targetRotation.rotationX,
      toY: targetRotation.rotationY,
      outerFromX: outerCurrentX,
      outerFromY: outerCurrentY,
      outerToX: 0,
      outerToY: getShortestRotationTarget(outerCurrentY, 0),
      startedAt: performance.now(),
    };
  }, [targetRotation.rotationX, targetRotation.rotationY, reducedMotion]);

  useFrame(() => {
    if (!innerGroup.current || !outerGroup.current) return;
    const elapsed = Math.min(1, (performance.now() - transition.current.startedAt) / FOCUS_DURATION_MS);
    if (elapsed >= 1) {
      if (onRotationFrame && performance.now() - rotationProbeAt.current >= 120) {
        rotationProbeAt.current = performance.now();
        onRotationFrame(outerGroup.current.rotation.y);
      }
      return;
    }
    const eased = elapsed < .5 ? 2 * elapsed * elapsed : 1 - Math.pow(-2 * elapsed + 2, 2) / 2;
    innerGroup.current.rotation.x = MathUtils.lerp(transition.current.fromX, transition.current.toX, eased);
    innerGroup.current.rotation.y = MathUtils.lerp(transition.current.fromY, transition.current.toY, eased);
    outerGroup.current.rotation.x = MathUtils.lerp(transition.current.outerFromX, transition.current.outerToX, eased);
    outerGroup.current.rotation.y = MathUtils.lerp(transition.current.outerFromY, transition.current.outerToY, eased);
    if (onRotationFrame && performance.now() - rotationProbeAt.current >= 120) {
      rotationProbeAt.current = performance.now();
      onRotationFrame(outerGroup.current.rotation.y);
    }
    if (elapsed < 1) invalidate();
  });

  const handleInteract = useCallback(() => {
    if (innerGroup.current) {
      transition.current = {
        fromX: innerGroup.current.rotation.x,
        fromY: innerGroup.current.rotation.y,
        toX: innerGroup.current.rotation.x,
        toY: innerGroup.current.rotation.y,
        outerFromX: outerGroup.current?.rotation.x || 0,
        outerFromY: outerGroup.current?.rotation.y || 0,
        outerToX: outerGroup.current?.rotation.x || 0,
        outerToY: outerGroup.current?.rotation.y || 0,
        // A interação manual já está no estado final: não deixe o loop de foco
        // reescrever a rotação do drag durante os próximos frames.
        startedAt: performance.now() - FOCUS_DURATION_MS,
      };
    }
  }, []);

  return <>
    <ambientLight intensity={0.34} color="#6cb7d8" />
    <directionalLight position={[4, 2.5, 5]} intensity={1.6} color="#d7f5ff" />
    <pointLight position={[-3, -1.5, -2]} intensity={0.24} color="#0a4d88" />

    <group ref={outerGroup}>
        <OrbitControls groupRef={outerGroup} onInteract={handleInteract} focusActive={Boolean(markerTransition.fromId)} reducedMotion={reducedMotion} />
      <GlobeOrbitRing />
      <group ref={innerGroup}>
        <EarthSurface />
        <CloudLayer />
        <Atmosphere />
        {markers.map(marker => (
          <SatelliteMarker key={marker.id} marker={marker} active={marker.id === selectedId} transition={markerTransition} onSelect={onSelect} reducedMotion={reducedMotion} />
        ))}
        {userLocation && <UserLocationMarker location={userLocation} reducedMotion={reducedMotion} />}
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
  const globeElementRef = useRef<HTMLDivElement>(null);
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
  const handleRotationFrame = useCallback((rotationY: number) => {
    globeElementRef.current?.setAttribute("data-rotation-y", rotationY.toFixed(6));
  }, []);

  return (
    <div
      ref={globeElementRef}
      className={`three-globe ${className}`}
      data-renderer="react-three-fiber"
      data-auto-rotate="true"
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
            onRotationFrame={handleRotationFrame}
          />
        </Suspense>
      </Canvas>
    </div>
  );
});
