import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { memo, Suspense, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
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
// Incremento fixo por frame: a rotação autônoma é linear e não depende de easing.
const AUTO_ROTATE_INCREMENT = 0.0016;
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
    float fresnel = pow(1.0 - abs(dot(normalize(vNormal), normalize(vViewDirection))), 3.25);
    vec3 auroraBlue = vec3(0.17, 0.66, 0.95);
    gl_FragColor = vec4(auroraBlue, fresnel * 0.22);
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
  onSwitchTo2D?: () => void;
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
  const { gl } = useThree();
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
        loaded.anisotropy = Math.min(8, gl.capabilities.getMaxAnisotropy());
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
  }, [url, gl]);

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
      emissive: new Color("#c9ddff"),
      emissiveIntensity: 0.45,
      roughness: 0.95,
      metalness: 0,
    });
  }, [dayMap, nightMap, dayError, nightError]);
  useEffect(() => () => material.dispose(), [material]);

  return (
    <mesh material={material} rotation={[0, -Math.PI / 2, 0]}>
      <sphereGeometry args={[1, 96, 64]} />
    </mesh>
  );
}

function CloudLayer() {
  const { texture: cloudMap, error: cloudError } = useSafeTexture(CLOUD_MAP);
  if (cloudError || !cloudMap) return null;
  return (
    <mesh rotation={[0, -Math.PI / 2, 0]}>
      <sphereGeometry args={[1.008, 80, 56]} />
      <meshPhongMaterial map={cloudMap} transparent opacity={0.16} depthWrite={false} blending={AdditiveBlending} />
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
  useEffect(() => () => material.dispose(), [material]);
  return <mesh material={material}><sphereGeometry args={[1.025, 96, 64]} /></mesh>;
}

function GlobeOrbitRing() {
  return <mesh rotation={[MathUtils.degToRad(64), MathUtils.degToRad(-8), MathUtils.degToRad(18)]}>
    <torusGeometry args={[1.095, 0.003, 8, 160]} />
    <meshBasicMaterial color="#55cfff" transparent opacity={0.16} blending={AdditiveBlending} depthWrite={false} />
  </mesh>;
}

// ─── Marker Glow ───────────────────────────────────────────────────────
function MarkerGlow() {
  const material = useMemo(() => new ShaderMaterial({
    vertexShader: "varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }",
    fragmentShader: "varying vec2 vUv; void main() { float dist = length(vUv - vec2(0.5)); float glow = smoothstep(0.5, 0.0, dist); glow = pow(glow, 2.0); vec3 color = mix(vec3(0.99, 0.61, 0.43), vec3(1.0, 0.82, 0.62), glow); gl_FragColor = vec4(color, glow * 0.55); }",
    transparent: true, depthTest: true, depthWrite: false, blending: AdditiveBlending, side: DoubleSide,
  }), []);
  useEffect(() => () => material.dispose(), [material]);
  return <mesh material={material}><planeGeometry args={[0.16, 0.16]} /></mesh>;
}

// ─── Satellite Marker ──────────────────────────────────────────────────
function SatelliteMarker({ marker, active, transition, onSelect, reducedMotion, onVisibilityChange }: { marker: Marker; active: boolean; transition: MarkerTransition; onSelect: (id: string) => void; reducedMotion: boolean; onVisibilityChange?: (markerId: string, visible: boolean) => void }) {
  const position = useMemo(() => toCartesian(marker.latitude, marker.longitude, 1.065), [marker.latitude, marker.longitude]);
  const markerRoot = useRef<Group>(null);
  const markerVisual = useRef<Group>(null);
  const outgoingRing = useRef<Group>(null);
  const incomingRing = useRef<Group>(null);
  const glowRef = useRef<Group>(null);
  const pulseRef = useRef<Group>(null);
  const pulseWaveRef = useRef<Group>(null);
  const wasFrontVisible = useRef<boolean | null>(null);
  const worldMarkerPosition = useRef(new Vector3());
  const worldCameraPosition = useRef(new Vector3());
  const isLeaving = transition.fromId === marker.id;
  const isEntering = transition.fromId !== null && transition.toId === marker.id;

  useFrame(({ camera, invalidate }) => {
    if (markerRoot.current && markerVisual.current) {
      markerRoot.current.getWorldPosition(worldMarkerPosition.current);
      camera.getWorldPosition(worldCameraPosition.current);
      // O produto escalar entre o vetor radial do marker e a posição da câmera
      // identifica o hemisfério frontal. O pequeno limiar evita pontos instáveis
      // exatamente na linha do horizonte da esfera.
      const frontVisible = worldMarkerPosition.current.dot(worldCameraPosition.current) > 0.03;
      markerVisual.current.visible = frontVisible;
      // Face the camera so the focus rings remain circular while dragging.
      markerVisual.current.lookAt(worldCameraPosition.current);
      const focusProgress = Math.min(1, Math.max(0, (performance.now() - transition.startedAt) / FOCUS_DURATION_MS));
      const smoothProgress = focusProgress * focusProgress * (3 - 2 * focusProgress);
      const handoffScale = isEntering ? 0.78 + smoothProgress * 0.22 : isLeaving ? 1.14 - smoothProgress * 0.14 : 1;
      markerVisual.current.scale.setScalar(handoffScale);
      if (wasFrontVisible.current !== frontVisible) {
        wasFrontVisible.current = frontVisible;
        onVisibilityChange?.(marker.id, frontVisible);
      }
    }
    if (reducedMotion) {
      markerVisual.current?.scale.setScalar(1);
      return;
    }
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
    if (active) {
      const now = performance.now();
      if (pulseRef.current) {
        const t = now / 800;
        pulseRef.current.scale.setScalar(1 + Math.sin(t * Math.PI * 2) * 0.12);
      }
      if (pulseWaveRef.current) {
        // O segundo anel se expande continuamente e volta ao início,
        // destacando o marker sem alterar sua posição nem bloquear o raycast.
        const cycle = (now % 1400) / 1400;
        pulseWaveRef.current.scale.setScalar(0.72 + cycle * 0.95);
      }
    }
    if (active && glowRef.current) {
      const t = performance.now() / 1200;
      glowRef.current.scale.setScalar(0.85 + Math.sin(t * Math.PI * 2) * 0.15);

    }
  });

  const selectMarker = (event: { stopPropagation: () => void }) => {
    event.stopPropagation();
    onSelect(marker.id);
  };

  return (
    <group ref={markerRoot} position={position} renderOrder={active ? 6 : 5}>
      <group ref={markerVisual}>
        {/* Área de raycast maior que o ponto visual: melhora o clique/touch sem
            aumentar o marker exibido nem alterar a leitura do globo. Como todo
            o conjunto fica invisível atrás da esfera, markers traseiros também
            deixam de receber cliques. */}
        <mesh onClick={selectMarker} renderOrder={active ? 8 : 7}>
          <sphereGeometry args={[active ? 0.085 : 0.07, 16, 16]} />
          <meshBasicMaterial transparent opacity={0} depthTest={true} depthWrite={false} side={DoubleSide} />
        </mesh>
        {isLeaving && <group ref={outgoingRing}><mesh><ringGeometry args={[0.04, 0.052, 48]} /><meshBasicMaterial color="#ffb38d" transparent opacity={0.7} depthTest={true} depthWrite={false} side={DoubleSide} /></mesh></group>}
        {isEntering && <group ref={incomingRing}><mesh><ringGeometry args={[0.042, 0.05, 48]} /><meshBasicMaterial color="#ffb38d" transparent opacity={0.85} depthTest={true} depthWrite={false} side={DoubleSide} /></mesh></group>}
        {active && <group ref={pulseWaveRef}><mesh><ringGeometry args={[0.036, 0.04, 48]} /><meshBasicMaterial color="#ffd0ba" transparent opacity={0.42} depthTest={true} depthWrite={false} side={DoubleSide} /></mesh></group>}
        {active && <group ref={pulseRef}><mesh><ringGeometry args={[0.042, 0.048, 48]} /><meshBasicMaterial color="#ffb38d" transparent opacity={0.9} depthTest={true} depthWrite={false} side={DoubleSide} /></mesh></group>}
        {active && <group ref={glowRef}><MarkerGlow /></group>}
        <mesh><sphereGeometry args={[active ? 0.018 : 0.012, 20, 16]} /><meshBasicMaterial color={active ? "#ff9c6d" : "#63e6be"} depthTest={true} depthWrite={false} /></mesh>
        {active && <mesh><sphereGeometry args={[0.007, 16, 12]} /><meshBasicMaterial color="#fff5ee" depthTest={true} depthWrite={false} /></mesh>}
      </group>
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
  const touchMoved = useRef(false);
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
      // Um toque simples deve permanecer um clique R3F, não um drag de zero
      // pixels. O arraste só começa depois do limiar de movimento.
      touchMoved.current = false;
      isDragging.current = false;
      autoRotate.current = false;
      if (autoRotateTimer.current) clearTimeout(autoRotateTimer.current);
      prevPointer.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
      velocity.current = { x: 0, y: 0 };
      onInteractRef.current?.();
    };

    const onTouchMove = (e: TouchEvent) => {
      if (activeInput.current !== "touch" || !groupRef.current || e.touches.length !== 1) return;
      const dx = e.touches[0].clientX - prevPointer.current.x;
      const dy = e.touches[0].clientY - prevPointer.current.y;
      if (!touchMoved.current && Math.hypot(dx, dy) < 4) return;
      touchMoved.current = true;
      isDragging.current = true;
      e.preventDefault();
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
      touchMoved.current = false;
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
    dom.addEventListener("touchcancel", onTouchEnd);

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
      dom.removeEventListener("touchcancel", onTouchEnd);
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
      // Rotação autônoma linear, executada dentro do loop principal do R3F.
      // Não usar easing nem um tween pontual aqui: cada frame acrescenta o
      // mesmo valor ao eixo Y do grupo que contém o globo.
      groupRef.current.rotation.y += AUTO_ROTATE_INCREMENT * frameScale;
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
function GlobeScene({ markers, selectedId, markerTransition, onSelect, userLocation, reducedMotion, onRotationFrame, onMarkerVisibilityChange }: Omit<EarthGlobeProps, "className"> & { reducedMotion: boolean; markerTransition: MarkerTransition; onRotationFrame?: (rotationY: number, focusRotationY: number, progress: number, activeScreenX: number, activeScreenY: number, activeDepth: number) => void; onMarkerVisibilityChange?: (markerId: string, visible: boolean) => void }) {
  const outerGroup = useRef<Group>(null);
  const innerGroup = useRef<Group>(null);
  const selected = markers.find(m => m.id === selectedId);
  const targetRotation = selected ? getGlobeFocusRotation(selected.latitude, selected.longitude) : { rotationX: 0, rotationY: 0 };
  const transition = useRef({ fromX: targetRotation.rotationX, fromY: targetRotation.rotationY, toX: targetRotation.rotationX, toY: targetRotation.rotationY, outerFromX: 0, outerFromY: 0, outerToX: 0, outerToY: 0, startedAt: 0 });
  const transitionSettled = useRef(true);
  const rotationProbeAt = useRef(0);
  const activeWorldPosition = useMemo(() => selected ? toCartesian(selected.latitude, selected.longitude, 1.065) : null, [selected?.latitude, selected?.longitude]);
  const activeProjectedPosition = useRef(new Vector3());
  const camera = useThree(state => state.camera);
  const invalidate = useThree(state => state.invalidate);

  useEffect(() => {
    if (!innerGroup.current) return;
    // A fórmula de foco calcula longitude no eixo Y e latitude no eixo X.
    // O Three.js aplica essa combinação com a ordem XYZ, que coloca qualquer
    // coordenada selecionada exatamente no eixo frontal da câmera.
    innerGroup.current.rotation.order = "XYZ";
    const currentX = innerGroup.current.rotation.x;
    const currentY = innerGroup.current.rotation.y;
    const outerCurrentX = outerGroup.current?.rotation.x || 0;
    const outerCurrentY = outerGroup.current?.rotation.y || 0;
    if (reducedMotion) {
      innerGroup.current.rotation.set(targetRotation.rotationX, targetRotation.rotationY, 0);
      outerGroup.current?.rotation.set(0, 0, 0);
      transition.current = { fromX: targetRotation.rotationX, fromY: targetRotation.rotationY, toX: targetRotation.rotationX, toY: targetRotation.rotationY, outerFromX: 0, outerFromY: 0, outerToX: 0, outerToY: 0, startedAt: performance.now() - FOCUS_DURATION_MS };
      transitionSettled.current = true;
      return;
    }
    transition.current = {
      fromX: currentX,
      fromY: currentY,
      toX: targetRotation.rotationX,
      // O alvo absoluto podia fazer o globo percorrer o caminho longo (ou quase
      // não produzir uma mudança perceptível quando a longitude cruzava ±180°).
      // Mantemos a mesma orientação geográfica, mas escolhemos o arco menor.
      toY: getShortestRotationTarget(currentY, targetRotation.rotationY),
      outerFromX: outerCurrentX,
      outerFromY: outerCurrentY,
      outerToX: 0,
      outerToY: getShortestRotationTarget(outerCurrentY, 0),
      startedAt: performance.now(),
    };
    transitionSettled.current = false;
  }, [targetRotation.rotationX, targetRotation.rotationY, reducedMotion]);

  useFrame(() => {
    if (!innerGroup.current || !outerGroup.current) return;
    const now = performance.now();
    const reportFrame = (progress: number) => {
      if (!onRotationFrame || now - rotationProbeAt.current < 80) return;
      const inner = innerGroup.current;
      const outer = outerGroup.current;
      if (!inner || !outer) return;
      rotationProbeAt.current = now;
      let screenX = 0;
      let screenY = 0;
      let depth = 0;
      if (activeWorldPosition) {
        activeProjectedPosition.current.copy(activeWorldPosition);
        inner.localToWorld(activeProjectedPosition.current);
        activeProjectedPosition.current.project(camera);
        screenX = activeProjectedPosition.current.x;
        screenY = activeProjectedPosition.current.y;
        depth = activeProjectedPosition.current.z;
      }
      onRotationFrame(outer.rotation.y, inner.rotation.y, progress, screenX, screenY, depth);
    };
    const progress = Math.min(1, Math.max(0, (now - transition.current.startedAt) / FOCUS_DURATION_MS));
    if (progress >= 1) {
      if (!transitionSettled.current) {
        // Escreve o ponto final uma única vez para não deixar o marker alguns
        // pixels fora do centro por arredondamento do último frame. Depois
        // disso, o OrbitControls volta a conduzir o outerGroup e o auto-rotate.
        innerGroup.current.rotation.x = transition.current.toX;
        innerGroup.current.rotation.y = transition.current.toY;
        outerGroup.current.rotation.x = transition.current.outerToX;
        outerGroup.current.rotation.y = transition.current.outerToY;
        transitionSettled.current = true;
      }
      reportFrame(1);
      return;
    }
    const eased = progress < .5 ? 2 * progress * progress : 1 - Math.pow(-2 * progress + 2, 2) / 2;
    innerGroup.current.rotation.x = MathUtils.lerp(transition.current.fromX, transition.current.toX, eased);
    innerGroup.current.rotation.y = MathUtils.lerp(transition.current.fromY, transition.current.toY, eased);
    outerGroup.current.rotation.x = MathUtils.lerp(transition.current.outerFromX, transition.current.outerToX, eased);
    outerGroup.current.rotation.y = MathUtils.lerp(transition.current.outerFromY, transition.current.outerToY, eased);
    reportFrame(progress);
    invalidate();
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
      transitionSettled.current = true;
    }
  }, []);

  return <>
    <ambientLight intensity={0.48} color="#dbe9f5" />
    <directionalLight position={[4, 2.5, 5]} intensity={2} color="#fff5e7" />
    <pointLight position={[-3, -1.5, -2]} intensity={0.3} color="#4c9bdb" />

    <group ref={outerGroup}>
        <OrbitControls groupRef={outerGroup} onInteract={handleInteract} focusActive={Boolean(markerTransition.fromId)} reducedMotion={reducedMotion} />
      <GlobeOrbitRing />
      <group ref={innerGroup}>
        <EarthSurface />
        <CloudLayer />
        <Atmosphere />
        {markers.map(marker => (
            <SatelliteMarker key={marker.id} marker={marker} active={marker.id === selectedId} transition={markerTransition} onSelect={onSelect} reducedMotion={reducedMotion} onVisibilityChange={onMarkerVisibilityChange} />
        ))}
        {userLocation && <UserLocationMarker location={userLocation} reducedMotion={reducedMotion} />}
      </group>
    </group>
  </>;
}

// ─── Fallback ──────────────────────────────────────────────────────────
function GlobeFallback({ onSwitchTo2D }: { onSwitchTo2D?: () => void }) {
  return <div className="three-globe-fallback" role="status"><div className="globe-unavailable"><p>O globo 3D precisa de WebGL, indisponível neste navegador.</p>{onSwitchTo2D && <button type="button" className="locate-button" onClick={onSwitchTo2D}>explorar órbitas em 2D</button>}</div></div>;
}

// ─── Export ─────────────────────────────────────────────────────────────
export const EarthGlobe = memo(function EarthGlobe({ markers, selectedId, onSelect, className = "", userLocation, onSwitchTo2D }: EarthGlobeProps) {
  const [webglAvailable, setWebglAvailable] = useState<boolean | null>(null);
  useEffect(() => {
    const canvas = document.createElement("canvas");
    try {
      const context = canvas.getContext("webgl2");
      setWebglAvailable(Boolean(context));
      context?.getExtension("WEBGL_lose_context")?.loseContext();
    } catch {
      setWebglAvailable(false);
    }
  }, []);
  const selectedMarker = markers.find(m => m.id === selectedId);
  const globeElementRef = useRef<HTMLDivElement>(null);
  const reducedMotion = useReducedMotion();
  const previousSelectedId = useRef(selectedId);
  const [markerTransition, setMarkerTransition] = useState<MarkerTransition>({ fromId: null, toId: selectedId, startedAt: 0 });

  useLayoutEffect(() => {
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
  const handleMarkerVisibility = useCallback((markerId: string, visible: boolean) => {
    const element = globeElementRef.current;
    if (!element) return;
    const visibleMarkers = new Set((element.getAttribute("data-visible-marker-ids") || "").split(",").filter(Boolean));
    if (visible) visibleMarkers.add(markerId);
    else visibleMarkers.delete(markerId);
    element.setAttribute("data-visible-marker-ids", Array.from(visibleMarkers).sort().join(","));
    element.setAttribute("data-visible-marker-count", String(visibleMarkers.size));
  }, []);

  const handleRotationFrame = useCallback((rotationY: number, focusRotationY: number, progress: number, activeScreenX: number, activeScreenY: number, activeDepth: number) => {
    const element = globeElementRef.current;
    if (!element) return;
    // `data-rotation-y` continua representando o grupo externo para o gate de
    // auto-rotate. Os atributos adicionais medem o grupo interno, que é o que
    // realmente percorre a longitude durante a centralização do satélite.
    element.setAttribute("data-rotation-y", rotationY.toFixed(6));
    element.setAttribute("data-focus-rotation-y-current", focusRotationY.toFixed(6));
    element.setAttribute("data-focus-progress", progress.toFixed(3));
    element.setAttribute("data-active-screen-x", activeScreenX.toFixed(6));
    element.setAttribute("data-active-screen-y", activeScreenY.toFixed(6));
    element.setAttribute("data-active-screen-depth", activeDepth.toFixed(6));
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
      data-visible-marker-count="0"
      data-visible-marker-ids=""
      data-front-hemisphere-only="true"
      data-marker-geometry={markerGeometry}
      data-focus-latitude={selectedMarker?.latitude ?? 0}
      data-focus-longitude={selectedMarker?.longitude ?? 0}
      data-focus-rotation-x={selectedMarker ? getGlobeFocusRotation(selectedMarker.latitude, selectedMarker.longitude).rotationX : 0}
      data-focus-rotation-y={selectedMarker ? getGlobeFocusRotation(selectedMarker.latitude, selectedMarker.longitude).rotationY : 0}
      data-focus-rotation-order="XYZ"
      data-active-screen-x="0"
      data-active-screen-y="0"
      data-active-screen-depth="0"
      data-focus-duration={FOCUS_DURATION_MS}
      data-reduced-motion={reducedMotion}
      aria-label={`Globo 3D com foco em ${selectedMarker?.name || "objeto orbital"}`}
    >
      {webglAvailable === false ? <GlobeFallback onSwitchTo2D={onSwitchTo2D} /> : webglAvailable ? <Canvas
        dpr={[1, 1.75]}
        frameloop="always"
        camera={{ position: [0, 0, 3.2], fov: 38 }}
        gl={{ alpha: true, antialias: true, powerPreference: "high-performance" }}
        fallback={<GlobeFallback onSwitchTo2D={onSwitchTo2D} />}
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
            onMarkerVisibilityChange={handleMarkerVisibility}
          />
        </Suspense>
      </Canvas> : null}
    </div>
  );
});
