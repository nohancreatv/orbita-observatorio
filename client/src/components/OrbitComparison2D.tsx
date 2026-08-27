import { useId, useMemo } from "react";
import type { CSSProperties } from "react";
import type { inferRouterOutputs } from "@trpc/server";
import type { AppRouter } from "../../../server/routers";
import { MapPin, Orbit, Radio, Satellite } from "lucide-react";

 type RouterOutputs = inferRouterOutputs<AppRouter>;
 type SatelliteId = RouterOutputs["orbit"]["catalog"][number]["id"];
 type CatalogSatellite = RouterOutputs["orbit"]["catalog"][number];
 type OrbitTrajectory = RouterOutputs["orbit"]["trajectories"][number];

 type OrbitComparison2DProps = {
  satellites: CatalogSatellite[];
  selectedIds: SatelliteId[];
  activeId: SatelliteId;
  trajectories: OrbitTrajectory[];
  isLoading: boolean;
  isError: boolean;
  onToggle: (satelliteId: SatelliteId) => void;
  onPrimarySelect: (satelliteId: SatelliteId) => void;
 };

 const TRAJECTORY_COLORS = ["#ffb38d", "#63e6be", "#8dd7ff", "#d9b8ff"];
 const WORLD_LEFT = 42;
 const WORLD_RIGHT = 958;
 const WORLD_TOP = 40;
 const WORLD_BOTTOM = 392;

 function longitudeX(longitude: number) {
  return WORLD_LEFT + ((longitude + 180) / 360) * (WORLD_RIGHT - WORLD_LEFT);
 }

 function latitudeY(latitude: number) {
  return WORLD_TOP + ((90 - latitude) / 180) * (WORLD_BOTTOM - WORLD_TOP);
 }

 function formatCoordinate(value: number, isLatitude: boolean) {
  const direction = isLatitude ? (value >= 0 ? "N" : "S") : value >= 0 ? "L" : "O";
  return `${Math.abs(value).toFixed(1)}° ${direction}`;
 }

 function toPath(points: OrbitTrajectory["points"]) {
  const segments: string[] = [];
  let segment: string[] = [];
  let previousLongitude: number | null = null;

  for (const point of points) {
    const x = longitudeX(point.longitude);
    const y = latitudeY(point.latitude);
    const crossedDateLine = previousLongitude !== null && Math.abs(point.longitude - previousLongitude) > 180;
    if (crossedDateLine && segment.length) {
      segments.push(segment.join(" "));
      segment = [];
    }
    segment.push(`${segment.length ? "L" : "M"}${x.toFixed(2)},${y.toFixed(2)}`);
    previousLongitude = point.longitude;
  }
  if (segment.length) segments.push(segment.join(" "));
  return segments.join(" ");
 }

 function currentPoint(trajectory: OrbitTrajectory) {
  return trajectory.points[0] || trajectory.points[Math.floor(trajectory.points.length / 2)];
 }

 export function OrbitComparison2D({ satellites, selectedIds, activeId, trajectories, isLoading, isError, onToggle, onPrimarySelect }: OrbitComparison2DProps) {
  const titleId = useId();
  const descriptionId = useId();
  const trajectoryById = useMemo(() => new Map(trajectories.map(trajectory => [trajectory.satellite.id, trajectory])), [trajectories]);
  const selectedCatalog = satellites.filter(satellite => selectedIds.includes(satellite.id as SatelliteId));
  const hasData = trajectories.some(trajectory => trajectory.points.length > 1);

  return (
    <section className="orbit-comparison-2d" aria-labelledby={titleId} aria-describedby={descriptionId} data-view-mode="2d" data-trajectory-count={trajectories.length} data-selected-trajectory-count={selectedIds.length}>
      <div className="orbit-comparison-2d__header">
        <div>
          <p className="orbit-comparison-2d__eyebrow"><Orbit size={14} aria-hidden="true" /> comparação de trajetórias</p>
          <h2 id={titleId}>A mesma órbita, em outra escala.</h2>
          <p id={descriptionId}>Cada linha mostra o ground track previsto nas próximas {trajectories[0]?.durationMinutes || 120} minutos. Compare até quatro objetos usando os dados TLE propagados.</p>
        </div>
        <div className="orbit-comparison-2d__readout" aria-live="polite">
          <span className="orbit-comparison-2d__readout-dot" aria-hidden="true" />
          <span>{isLoading ? "calculando trajetórias…" : isError ? "fonte orbital em contingência" : hasData ? `${trajectories.length} trajetória${trajectories.length === 1 ? "" : "s"} em leitura` : "selecione objetos para comparar"}</span>
        </div>
      </div>

      <div className="orbit-comparison-2d__controls" role="group" aria-label="Satélites incluídos na comparação">
        {satellites.map((satellite, index) => {
          const id = satellite.id as SatelliteId;
          const selected = selectedIds.includes(id);
          const loaded = Boolean(trajectoryById.get(id));
          return (
            <button
              type="button"
              key={satellite.id}
              className={`orbit-comparison-chip${selected ? " is-selected" : ""}${id === activeId ? " is-active" : ""}`}
              style={{ "--trajectory-color": TRAJECTORY_COLORS[index % TRAJECTORY_COLORS.length] } as CSSProperties}
              aria-pressed={selected}
              aria-label={`${selected ? "Remover" : "Adicionar"} ${satellite.shortName} da comparação${id === activeId ? "; objeto em foco" : ""}`}
              onClick={() => {
                if (!selected) {
                  onPrimarySelect(id);
                  onToggle(id);
                  return;
                }
                if (id !== activeId && selectedIds.length > 1) {
                  onToggle(id);
                  return;
                }
                onPrimarySelect(id);
              }}
            >
              <span className="orbit-comparison-chip__dot" aria-hidden="true" />
              <span>{satellite.shortName}</span>
              {selected && <small>{loaded ? "trilha" : "lendo"}</small>}
            </button>
          );
        })}
      </div>

      <div className="orbit-comparison-2d__plot-wrap">
        <svg className="orbit-comparison-2d__plot" viewBox="0 0 1000 440" role="img" aria-labelledby={`${titleId} ${descriptionId}`}>
          <defs>
            <linearGradient id={`${titleId}-ocean`} x1="0" x2="1" y1="0" y2="1">
              <stop offset="0" stopColor="#123f59" stopOpacity=".82" />
              <stop offset=".5" stopColor="#0b2a45" stopOpacity=".5" />
              <stop offset="1" stopColor="#06182d" stopOpacity=".9" />
            </linearGradient>
            <linearGradient id={`${titleId}-grid`} x1="0" x2="1">
              <stop offset="0" stopColor="#8fded0" stopOpacity=".16" />
              <stop offset=".5" stopColor="#fff2d8" stopOpacity=".3" />
              <stop offset="1" stopColor="#8fded0" stopOpacity=".16" />
            </linearGradient>
            <filter id={`${titleId}-glow`} x="-100%" y="-100%" width="300%" height="300%">
              <feGaussianBlur stdDeviation="5" result="blur" />
              <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
            </filter>
          </defs>
          <rect x="18" y="18" width="964" height="404" rx="4" fill={`url(#${titleId}-ocean)`} />
          <rect x={WORLD_LEFT} y={WORLD_TOP} width={WORLD_RIGHT - WORLD_LEFT} height={WORLD_BOTTOM - WORLD_TOP} fill="none" stroke="rgba(196,235,229,.24)" strokeDasharray="3 8" />
          {[-60, -30, 0, 30, 60].map(latitude => <line key={`lat-${latitude}`} x1={WORLD_LEFT} x2={WORLD_RIGHT} y1={latitudeY(latitude)} y2={latitudeY(latitude)} stroke="url(#${titleId}-grid)" strokeWidth="1" strokeDasharray={latitude === 0 ? "none" : "2 9"} />)}
          {[-120, -60, 0, 60, 120].map(longitude => <line key={`lon-${longitude}`} x1={longitudeX(longitude)} x2={longitudeX(longitude)} y1={WORLD_TOP} y2={WORLD_BOTTOM} stroke="url(#${titleId}-grid)" strokeWidth="1" strokeDasharray="2 9" />)}
          <text x={WORLD_LEFT} y="28" fill="#a5c7c5" fontSize="11" fontFamily="IBM Plex Mono, monospace" letterSpacing="1">180° O</text>
          <text x="500" y="28" textAnchor="middle" fill="#a5c7c5" fontSize="11" fontFamily="IBM Plex Mono, monospace" letterSpacing="1">0° · MERIDIANO CENTRAL</text>
          <text x={WORLD_RIGHT} y="28" textAnchor="end" fill="#a5c7c5" fontSize="11" fontFamily="IBM Plex Mono, monospace" letterSpacing="1">180° L</text>
          <text x="24" y={WORLD_TOP + 4} fill="#a5c7c5" fontSize="10" fontFamily="IBM Plex Mono, monospace">90° N</text>
          <text x="24" y={WORLD_BOTTOM + 4} fill="#a5c7c5" fontSize="10" fontFamily="IBM Plex Mono, monospace">90° S</text>
          <text x="500" y="414" textAnchor="middle" fill="#87acae" fontSize="10" fontFamily="IBM Plex Mono, monospace" letterSpacing="1">GROUND TRACK · LONGITUDE / LATITUDE</text>
          {!isLoading && trajectories.map((trajectory, index) => {
            const point = currentPoint(trajectory);
            if (!point) return null;
            const color = TRAJECTORY_COLORS[satellites.findIndex(item => item.id === trajectory.satellite.id) % TRAJECTORY_COLORS.length];
            const active = trajectory.satellite.id === activeId;
            return (
              <g key={trajectory.satellite.id} className={active ? "is-active" : ""} style={{ "--trajectory-color": color } as CSSProperties}>
                <path className="orbit-comparison-2d__path-glow" d={toPath(trajectory.points)} fill="none" stroke={color} strokeWidth={active ? 7 : 5} strokeLinecap="round" strokeLinejoin="round" opacity={active ? .32 : .18} filter={`url(#${titleId}-glow)`} />
                <path className="orbit-comparison-2d__path" d={toPath(trajectory.points)} fill="none" stroke={color} strokeWidth={active ? 2.5 : 1.7} strokeLinecap="round" strokeLinejoin="round" strokeDasharray={active ? "none" : "7 5"} />
                <circle cx={longitudeX(point.longitude)} cy={latitudeY(point.latitude)} r={active ? 8 : 6} fill={color} className="orbit-comparison-2d__current" />
                <circle cx={longitudeX(point.longitude)} cy={latitudeY(point.latitude)} r={active ? 14 : 11} fill="none" stroke={color} strokeWidth="1" opacity={active ? .76 : .42} className="orbit-comparison-2d__current-ring" />
                <text x={longitudeX(point.longitude) + 12} y={latitudeY(point.latitude) - 12} fill={color} fontSize={active ? 13 : 11} fontFamily="IBM Plex Mono, monospace" fontWeight={active ? 700 : 500}>{trajectory.satellite.shortName}</text>
              </g>
            );
          })}
          {isError && <text x="500" y="225" textAnchor="middle" fill="#ffb38d" fontSize="15" fontFamily="IBM Plex Mono, monospace">trajetórias indisponíveis · tente atualizar em instantes</text>}
          {!isLoading && !isError && !hasData && <text x="500" y="225" textAnchor="middle" fill="#a9c4c3" fontSize="15" fontFamily="IBM Plex Mono, monospace">adicione ao menos um satélite para iniciar a comparação</text>}
        </svg>
        {isLoading && <div className="orbit-comparison-2d__loading"><Radio size={16} aria-hidden="true" /> propagando elementos orbitais públicos…</div>}
      </div>

      <div className="orbit-comparison-2d__legend" aria-label="Legenda das trajetórias selecionadas">
        {selectedCatalog.map((satellite, index) => {
          const trajectory = trajectoryById.get(satellite.id as SatelliteId);
          const point = trajectory ? currentPoint(trajectory) : null;
          const color = TRAJECTORY_COLORS[satellites.findIndex(item => item.id === satellite.id) % TRAJECTORY_COLORS.length];
          return (
            <button type="button" key={satellite.id} className={`orbit-comparison-legend-item${satellite.id === activeId ? " is-active" : ""}`} onClick={() => onPrimarySelect(satellite.id as SatelliteId)}>
              <span className="orbit-comparison-legend-swatch" style={{ backgroundColor: color }} aria-hidden="true" />
              <span className="orbit-comparison-legend-copy"><strong>{satellite.shortName}</strong><small>{point ? `${formatCoordinate(point.latitude, true)} · ${formatCoordinate(point.longitude, false)}` : "trilha em leitura"}</small></span>
              <MapPin size={14} aria-hidden="true" />
            </button>
          );
        })}
        <span className="orbit-comparison-legend-note"><Satellite size={14} aria-hidden="true" /> TLE público · amostras de 1 min</span>
      </div>
    </section>
  );
 }

 export default OrbitComparison2D;
