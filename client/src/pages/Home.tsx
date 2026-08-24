/** CARTOGRAFIA DO CREPÚSCULO — leitura espacial de múltiplos objetos orbitais. */
import { useEffect, useMemo, useState } from "react";
import type { inferRouterOutputs } from "@trpc/server";
import {
  ArrowUpRight,
  Clock3,
  Crosshair,
  CloudSun,
  Eye,
  Globe,
  Gauge,
  AlertTriangle,
  LocateFixed,
  MapPin,
  Orbit,
  Radio,
  RefreshCw,
  Rocket,
  Ruler,
  Satellite,
  Sparkles,
  Telescope,
  Flame,
} from "lucide-react";
import type { AppRouter } from "../../../server/routers";
import { EarthGlobe } from "@/components/EarthGlobe";
import { trpc } from "@/lib/trpc";
import "../multi-orbit.css";

type RouterOutputs = inferRouterOutputs<AppRouter>;
type SatelliteId = "iss" | "hubble" | "tiangong" | "noaa19";
type UserLocation = { latitude: number; longitude: number; label: string };
type PassPrediction = RouterOutputs["orbit"]["issClosestPass"];
type OrbitSnapshot = RouterOutputs["orbit"]["allSnapshots"][number];

const OBJECT_IMAGES: Record<SatelliteId, string> = {
  iss: "/manus-storage/orbita-iss-card_4ac52eb9.jpg",
  hubble: "/manus-storage/orbita-hubble-card_dc8bbcaf.jpg",
  tiangong: "/manus-storage/orbita-tiangong-card_81d63320.jpg",
  noaa19: "/manus-storage/orbita-noaa19-card_2732cd63.jpg",
};

function formatNumber(value: number | null | undefined, maximumFractionDigits = 0) {
  if (value === null || value === undefined || Number.isNaN(value)) return "—";
  return new Intl.NumberFormat("pt-BR", { maximumFractionDigits }).format(value);
}

function formatCoordinate(value: number, isLatitude: boolean) {
  const direction = isLatitude ? (value >= 0 ? "N" : "S") : value >= 0 ? "L" : "O";
  return `${Math.abs(value).toFixed(2)}° ${direction}`;
}

function formatDate(timestamp: number) {
  return new Intl.DateTimeFormat("pt-BR", { hour: "2-digit", minute: "2-digit", day: "2-digit", month: "short" }).format(new Date(timestamp * 1000));
}

function formatTimeFromNow(timestamp: number) {
  const minutes = Math.round(Math.max(0, timestamp * 1000 - Date.now()) / 60000);
  if (minutes < 2) return "agora";
  if (minutes < 60) return `em ${minutes} min`;
  return `em ${Math.floor(minutes / 60)}h${String(minutes % 60).padStart(2, "0")}`;
}

function getVisibilityCopy(visibility?: string) {
  if (visibility === "daylight") return "sob luz solar";
  if (visibility === "eclipsed") return "na sombra da Terra";
  if (visibility === "estimativa orbital") return "posição propagada";
  return visibility || "aguardando sinal";
}

export default function Home() {
  const [selectedSatellite, setSelectedSatellite] = useState<SatelliteId>("iss");
  const [userLocation, setUserLocation] = useState<UserLocation | null>(null);
  const [isLocating, setIsLocating] = useState(false);
  const [statusMessage, setStatusMessage] = useState("Conectando à constelação orbital…");
  const [clock, setClock] = useState(() => new Date());

  const catalogQuery = trpc.orbit.catalog.useQuery(undefined, { staleTime: 60 * 60_000 });
  const allSnapshotsQuery = trpc.orbit.allSnapshots.useQuery(undefined, { refetchInterval: 15_000, retry: 1 });
  const storyQuery = trpc.space.story.useQuery(undefined, { staleTime: 6 * 60 * 60_000, retry: 1 });
  const launchesQuery = trpc.space.launches.useQuery(undefined, { staleTime: 20 * 60_000, retry: 1 });
  const userPlace = trpc.orbit.userPlace.useMutation();
  const closestPass = trpc.orbit.issClosestPass.useMutation();

  const allSnapshots = allSnapshotsQuery.data || [];
  const snapshot = allSnapshots.find(item => item.satellite.id === selectedSatellite);
  const prediction: PassPrediction | undefined = closestPass.data;
  const satellites = catalogQuery.data || [];
  const observingInput = useMemo(() => userLocation ? { latitude: userLocation.latitude, longitude: userLocation.longitude } : { latitude: 0, longitude: 0 }, [userLocation]);
  const observingQuery = trpc.observation.conditions.useQuery(observingInput, { enabled: Boolean(userLocation), staleTime: 15 * 60_000, retry: 1 });
  const epicQuery = trpc.space.epic.useQuery(undefined, { staleTime: 30 * 60_000, retry: 1 });
  const spaceWeatherQuery = trpc.space.weather.useQuery(undefined, { staleTime: 30 * 60_000, retry: 1 });
  const asteroidsQuery = trpc.space.asteroids.useQuery(undefined, { staleTime: 60 * 60_000, retry: 1 });

  // Consulta a imagem do local baseada nas coordenadas do satélite
  const placeImageInput = useMemo(() => 
    snapshot ? { latitude: snapshot.latitude, longitude: snapshot.longitude } : null,
    [snapshot]
  );
  const placeImageQuery = trpc.space.placeImage.useQuery(
    placeImageInput!,
    { enabled: Boolean(placeImageInput), staleTime: 30 * 60_000, retry: 1 }
  );

  useEffect(() => {
    const interval = window.setInterval(() => setClock(new Date()), 1000);
    return () => window.clearInterval(interval);
  }, []);

  useEffect(() => {
    if (allSnapshotsQuery.isSuccess && allSnapshots.length) {
      const instant = new Intl.DateTimeFormat("pt-BR", { hour: "2-digit", minute: "2-digit", second: "2-digit" }).format(new Date());
      setStatusMessage(`${allSnapshots.length} objetos orbitais sincronizados às ${instant}.`);
    }
    if (allSnapshotsQuery.isError) setStatusMessage("O rastreador está indisponível agora. Tente atualizar em instantes.");
  }, [allSnapshots.length, allSnapshotsQuery.isError, allSnapshotsQuery.isSuccess]);

  useEffect(() => {
    if (selectedSatellite === "iss" && userLocation) {
      closestPass.mutate({ latitude: userLocation.latitude, longitude: userLocation.longitude });
    }
    // A previsão local depende da posição do visitante e é dedicada à ISS.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedSatellite, userLocation]);

  const requestLocation = () => {
    if (!navigator.geolocation) {
      setStatusMessage("O seu navegador não oferece geolocalização para esta consulta.");
      return;
    }
    setIsLocating(true);
    setStatusMessage("Lendo seu horizonte local para procurar a próxima passagem…");
    navigator.geolocation.getCurrentPosition(
      position => {
        const coordinates = { latitude: position.coords.latitude, longitude: position.coords.longitude };
        userPlace.mutate(coordinates, {
          onSuccess: place => {
            setUserLocation({ ...coordinates, label: place.label });
            setStatusMessage(`Horizonte definido para ${place.label}.`);
            setIsLocating(false);
          },
          onError: () => {
            setUserLocation({ ...coordinates, label: "sua região" });
            setStatusMessage("Horizonte definido; a cidade não pôde ser identificada agora.");
            setIsLocating(false);
          },
        });
      },
      () => {
        setStatusMessage("Não foi possível acessar a sua localização. Você pode tentar novamente quando quiser.");
        setIsLocating(false);
      },
      { enableHighAccuracy: false, timeout: 12000, maximumAge: 300000 },
    );
  };

  const selectedShortName = snapshot?.satellite.shortName || "satélite";
  const selectedName = snapshot?.satellite.name || "objeto orbital";
  const centerLongitude = snapshot?.longitude || 0;
  const centerLatitude = snapshot?.latitude || 0;
  const selectedImage = OBJECT_IMAGES[selectedSatellite];
  // URL da imagem do local: usa Google Maps/ArcGIS se disponível, senão fallback
  const groundPortraitUrl = placeImageQuery.data || "/manus-storage/iss-map-texture_2bd39705.jpg";
  const currentTime = new Intl.DateTimeFormat("pt-BR", { hour: "2-digit", minute: "2-digit", second: "2-digit" }).format(clock);
  const proximityState = prediction && prediction.distance < 2500;
  const previewStoryFailure = import.meta.env.DEV && new URLSearchParams(window.location.search).has("simular-falha-nasa");
  const storyFailed = storyQuery.isError || previewStoryFailure;
  const storyTitle = storyFailed ? "A janela do cosmos está temporariamente fechada." : storyQuery.data?.title || "Abrindo o diário de bordo da NASA…";
  const storyExplanation = storyFailed ? "A fonte de curiosidades não respondeu agora. O rastreamento orbital continua disponível e você pode tentar novamente em instantes." : storyQuery.data?.explanation || "A leitura científica do dia aparecerá aqui assim que a fonte pública responder.";
  const observingConditions = observingQuery.data;
  const skyReadout = observingConditions?.cloudCover === null || observingConditions?.cloudCover === undefined ? "céu em leitura" : observingConditions.cloudCover < 25 ? "céu favorável" : observingConditions.cloudCover < 60 ? "nuvens variáveis" : "céu encoberto";
  const launchDate = (value: string | null | undefined) => value ? new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }).format(new Date(value)) : "horário a confirmar";
  const globeMarkers = useMemo(() => allSnapshots.map(item => ({ id: item.satellite.id, shortName: item.satellite.shortName, name: item.satellite.name, latitude: item.latitude, longitude: item.longitude })), [allSnapshots]);

  return (
    <main className="observatory-shell">
      <div className="star-surface" aria-hidden="true" />
      <header className="site-header">
        <a href="#inicio" className="brand-mark" aria-label="Órbita, início"><img src="/manus-storage/orbita-logo_99dcd0cb.svg" alt="" className="brand-symbol" /><span>órbita</span></a>
        <div className="header-meta"><span className="signal-dot" aria-hidden="true" /><span>observatório orbital</span><span className="meta-divider" /><time dateTime={clock.toISOString()}>{currentTime} local</time></div>
      </header>

      <section id="inicio" className="hero-section" aria-labelledby="hero-title">
        <div className="intro-column">
          <p className="eyebrow"><Satellite size={15} aria-hidden="true" /> {snapshot?.satellite.category || "objeto orbital"}</p>
          <h1 id="hero-title">O que está passando <em>em cima</em> de mim agora?</h1>
          <p className="hero-description">Observe a constelação em movimento, compare seus objetos e descubra qual território está diretamente abaixo de cada órbita.</p>
          <div className="satellite-selector" aria-label="Selecionar objeto orbital">
            <span className="selector-label">na constelação · {allSnapshots.length || "—"} rastreados</span>
            <div className="selector-options">
              {satellites.length ? satellites.map(satellite => <button key={satellite.id} type="button" onClick={() => setSelectedSatellite(satellite.id as SatelliteId)} className={selectedSatellite === satellite.id ? "satellite-option is-active" : "satellite-option"} aria-pressed={selectedSatellite === satellite.id}>{satellite.shortName}</button>) : <span className="catalog-loading">carregando satélites…</span>}
            </div>
          </div>
          <div className="action-row"><button type="button" onClick={requestLocation} className="locate-button" disabled={isLocating}><LocateFixed size={18} aria-hidden="true" />{isLocating ? "localizando…" : userLocation ? "atualizar horizonte" : "usar minha localização"}<ArrowUpRight size={17} aria-hidden="true" /></button><p className="privacy-note">A posição é usada apenas para esta consulta e não é salva.</p></div>
          <div className="live-readout" role="status" aria-live="polite"><Radio size={15} aria-hidden="true" /><span>{statusMessage}</span></div>
        </div>

        <div className="orbital-stage multi-orbit-stage" aria-label={`Globo terrestre com a posição atual de ${allSnapshots.length} objetos orbitais`}>
          <img src="/manus-storage/iss-hero-earth_dc590d13.jpg" alt="Terra vista do espaço" className="hero-earth-art" />
          <div className="orbit-caption orbit-caption-top"><span /> globo orbital em rotação</div>
          <EarthGlobe
            markers={globeMarkers}
            selectedId={selectedSatellite}
            onSelect={id => setSelectedSatellite(id as SatelliteId)}
            className="three-globe-interactive"
            userLocation={userLocation ? { latitude: userLocation.latitude, longitude: userLocation.longitude } : null}
          />
          <div className="globe-badge globe-badge-wide"><div className="badge-icon"><Crosshair size={17} aria-hidden="true" /></div><div><span>{selectedShortName} agora</span><strong>{snapshot ? `${formatCoordinate(snapshot.latitude, true)} · ${formatCoordinate(snapshot.longitude, false)}` : "sincronizando coordenadas"}</strong><small><MapPin size={11} aria-hidden="true" /> {snapshot?.groundLocation.label || "localização terrestre em leitura"}</small></div></div>
          <div className="orbit-caption orbit-caption-bottom"><span /> foco: {selectedShortName}</div>
        </div>
      </section>

      <section className="object-focus-section" aria-labelledby="object-focus-title">
        <div className="object-focus-image"><img src={selectedImage} alt={`Imagem orbital de ${selectedName}`} /><div className="object-image-caption">imagem de referência · {selectedShortName}</div></div>
        <div className="object-focus-copy"><p className="eyebrow"><Crosshair size={15} aria-hidden="true" /> Objeto em foco</p><h2 id="object-focus-title">{selectedName}</h2><p>{snapshot?.satellite.category || "Objeto orbital"} · NORAD {snapshot?.satellite.noradId || "—"}. Ao selecionar outro marcador, o globo percorre a longitude correspondente e preserva todos os demais objetos na mesma leitura.</p><div className="object-focus-data"><span><MapPin size={14} aria-hidden="true" /> {snapshot?.groundLocation.label || "localização em leitura"}</span><span><Orbit size={14} aria-hidden="true" /> {getVisibilityCopy(snapshot?.visibility)}</span></div></div>
        <aside className="object-ground-portrait"><img src={groundPortraitUrl} alt={snapshot ? `Mapa do ponto suborbital de ${selectedName} em ${snapshot.groundLocation.label}` : "Mapa do ponto suborbital em leitura"} onError={event => { event.currentTarget.src = "/manus-storage/iss-map-texture_2bd39705.jpg"; }} /><div className="ground-portrait-overlay"><span className="ground-portrait-details">retrato da superfície terrestre</span><strong>{snapshot?.groundLocation.label || "localização em leitura"}</strong><small>{snapshot ? `${formatCoordinate(snapshot.latitude, true)} · ${formatCoordinate(snapshot.longitude, false)}` : "—"}</small><a href={snapshot?.sourceUrl || "/fontes"} target={snapshot?.sourceUrl ? "_blank" : undefined} rel="noreferrer">fonte orbital <ArrowUpRight size={13} aria-hidden="true" /></a></div></aside>
      </section>

      <section className="telemetry-strip" aria-label={`Telemetria atual de ${selectedShortName}`}>
        <article className="telemetry-item telemetry-primary"><div className="telemetry-icon"><Orbit size={18} aria-hidden="true" /></div><div><span className="telemetry-label">estado da órbita</span><strong>{getVisibilityCopy(snapshot?.visibility)}</strong></div></article>
        <article className="telemetry-item"><Ruler size={18} aria-hidden="true" /><div><span className="telemetry-label">altitude</span><strong>{snapshot ? `${formatNumber(snapshot.altitude, 1)} km` : "—"}</strong></div></article>
        <article className="telemetry-item"><Gauge size={18} aria-hidden="true" /><div><span className="telemetry-label">velocidade</span><strong>{snapshot ? `${formatNumber(snapshot.velocity)} km/h` : "—"}</strong></div></article>
        <article className="telemetry-item"><MapPin size={18} aria-hidden="true" /><div><span className="telemetry-label">abaixo da órbita</span><strong>{snapshot?.groundLocation.city || snapshot?.groundLocation.country || "oceano / região remota"}</strong></div></article>
        <button type="button" className="refresh-button" onClick={() => allSnapshotsQuery.refetch()} disabled={allSnapshotsQuery.isFetching} aria-label="Atualizar a telemetria"><RefreshCw size={18} className={allSnapshotsQuery.isFetching ? "spin" : ""} aria-hidden="true" /></button>
      </section>

      <section className="ground-location-section" aria-labelledby="ground-title"><div className="ground-location-title"><p className="eyebrow"><MapPin size={15} aria-hidden="true" /> Da coordenada ao território</p><h2 id="ground-title">Onde está <em>{selectedShortName}</em> neste instante?</h2></div><div className="ground-location-card"><span className="location-label">ponto suborbital aproximado</span><strong>{snapshot?.groundLocation.label || "identificando cidade e país…"}</strong><div className="location-coordinates">{snapshot ? `${formatCoordinate(snapshot.latitude, true)} · ${formatCoordinate(snapshot.longitude, false)}` : "—"}</div><p>{snapshot?.groundLocation.isOceanOrRemote ? "Este ponto pode estar sobre oceano, áreas remotas ou uma região onde uma cidade não foi identificada." : "A localização indica o ponto da superfície terrestre mais diretamente abaixo do satélite; não representa uma rota de sobrevoo visível."}</p></div><a href="#fontes" className="source-link ground-source-link">como lemos o ponto terrestre <ArrowUpRight size={16} aria-hidden="true" /></a></section>

      <section className="passage-section" aria-labelledby="passage-title"><div className="passage-art" aria-hidden="true"><img src="/manus-storage/iss-passage-panel_d049613e.jpg" alt="" /><div className="art-annotation annotation-one">linha de passagem</div><div className="art-annotation annotation-two">horizonte local</div></div><div className="passage-copy"><p className="eyebrow"><Sparkles size={15} aria-hidden="true" /> O seu horizonte</p><h2 id="passage-title">A próxima chance de ver a ISS começa pela sua cidade.</h2>{userLocation ? <div className="passage-result"><div className="location-line"><MapPin size={18} aria-hidden="true" /><span>{userLocation.label}</span></div>{selectedSatellite !== "iss" ? <p className="result-detail">A previsão local de passagem é calculada para a ISS. Selecione-a na constelação para consultar o seu horizonte.</p> : prediction ? <><p className={proximityState ? "result-status is-good" : "result-status"}>{proximityState ? "Boa aproximação prevista" : "Passagem mais próxima no período"}</p><strong className="passage-time">{formatTimeFromNow(prediction.timestamp)}</strong><p className="result-detail">A ISS deve passar a cerca de {formatNumber(prediction.distance)} km da sua posição, por volta de {formatDate(prediction.timestamp)}.</p></> : <p className="result-detail">Estamos consultando a rota das próximas duas horas.</p>}</div> : <div className="passage-empty"><p>Conte onde você está e calcularemos a aproximação mais promissora da ISS nas próximas duas horas.</p><button type="button" className="text-button" onClick={requestLocation}>definir meu horizonte <ArrowUpRight size={16} aria-hidden="true" /></button></div>}<p className="visibility-caveat">A observação a olho nu depende também da iluminação solar, da elevação e das condições de nuvens.</p></div></section>

      <section className="sky-conditions-section" aria-labelledby="sky-title">
        <div className="sky-conditions-heading"><p className="eyebrow"><CloudSun size={15} aria-hidden="true" /> Janela de observação</p><h2 id="sky-title">O céu do seu horizonte.</h2><p>Depois de autorizar a localização, estimamos as condições que ajudam a planejar uma observação a olho nu.</p></div>
        <div className="sky-condition-panel">
          {userLocation ? <><div className="sky-condition-state"><span className={observingConditions && observingConditions.cloudCover !== null && observingConditions.cloudCover < 25 ? "sky-status-dot is-clear" : "sky-status-dot"} /><strong>{observingQuery.isError ? "condições indisponíveis" : skyReadout}</strong><small>{userLocation.label}</small></div><div className="sky-condition-metrics"><span><CloudSun size={16} aria-hidden="true" /> nuvens <b>{observingConditions?.cloudCover === null || observingConditions?.cloudCover === undefined ? "—" : `${formatNumber(observingConditions.cloudCover)}%`}</b></span><span><Eye size={16} aria-hidden="true" /> visibilidade <b>{observingConditions?.visibilityKm === null || observingConditions?.visibilityKm === undefined ? "—" : `${formatNumber(observingConditions.visibilityKm, 1)} km`}</b></span></div><a href={observingConditions?.sourceUrl || "https://open-meteo.com/en/docs"} target="_blank" rel="noreferrer" className="conditions-source">dados meteorológicos <ArrowUpRight size={13} aria-hidden="true" /></a></> : <div className="sky-condition-empty"><p>O diagnóstico local será exibido aqui quando você definir o seu horizonte.</p><button type="button" onClick={requestLocation} className="text-button">usar minha localização <ArrowUpRight size={16} aria-hidden="true" /></button></div>}
        </div>
      </section>

      <section className="launches-section" aria-labelledby="launches-title"><div className="launches-heading"><p className="eyebrow"><Rocket size={15} aria-hidden="true" /> Agenda espacial</p><h2 id="launches-title">Próximas partidas do planeta.</h2><a href="https://ll.thespacedevs.com/" target="_blank" rel="noreferrer">ver agenda completa <ArrowUpRight size={15} aria-hidden="true" /></a></div><div className="launch-list">{launchesQuery.data?.length ? launchesQuery.data.map((launch, index) => <a key={launch.id} href={launch.sourceUrl} target="_blank" rel="noreferrer" className="launch-entry"><span className="launch-index">0{index + 1}</span><div><strong>{launch.name}</strong><p>{launch.provider} · {launch.location}</p></div><time dateTime={launch.timestamp || undefined}>{launchDate(launch.timestamp)}<small>{launch.status}</small></time></a>) : <div className="launch-entry launch-loading"><span className="launch-index">—</span><div><strong>{launchesQuery.isError ? "Agenda temporariamente indisponível" : "Carregando a agenda espacial…"}</strong><p>{launchesQuery.isError ? "A constelação e o horizonte continuam disponíveis." : "Consultando os próximos lançamentos públicos."}</p></div></div>}</div></section>

      <section className="space-story-section" aria-labelledby="story-title"><div className={storyQuery.data?.imageUrl ? "story-image has-image" : "story-image"} style={storyQuery.data?.imageUrl ? { backgroundImage: `linear-gradient(90deg, rgba(7,17,31,.16), rgba(7,17,31,.72)), url(${storyQuery.data.imageUrl})` } : undefined}><span>arquivo do cosmos</span></div><div className="story-copy"><p className="eyebrow"><Telescope size={15} aria-hidden="true" /> Curiosidade de hoje</p><h2 id="story-title">{storyTitle}</h2><p>{storyExplanation}</p><div className="story-footer"><span>{storyQuery.data?.credit && !storyFailed ? `Crédito: ${storyQuery.data.credit}` : storyFailed ? "NASA Open APIs indisponível" : "Fonte: NASA Open APIs"}</span><a href={storyQuery.data?.sourceUrl || "https://api.nasa.gov/"} target="_blank" rel="noreferrer">ver fonte <ArrowUpRight size={14} aria-hidden="true" /></a></div></div></section>

      {/* ═══════════════════════════════════════════════════════
          EPIC — Fotos diárias da Terra (DSCOVR satellite)
      ═══════════════════════════════════════════════════════ */}
      <section className="epic-section" aria-labelledby="epic-title">
        <div className="epic-heading"><p className="eyebrow"><Globe size={15} aria-hidden="true" /> Terra em tempo real</p><h2 id="epic-title">A Terra fotografada do espaço profundo.</h2><p>Fotos diárias capturadas pela câmera EPIC a bordo do satélite DSCOVR, a 1,5 milhão de km da Terra.</p></div>
        <div className="epic-gallery">
          {epicQuery.data?.length ? epicQuery.data.map(image => (
            <a key={image.id} href={image.imageUrl} target="_blank" rel="noreferrer" className="epic-card" aria-label={`Foto da Terra: ${image.caption}`}>
              <img src={image.imageUrl} alt={image.caption} loading="lazy" decoding="async" />
              <div className="epic-card-overlay"><span>{image.caption.slice(0, 60)}</span><small>{image.date}</small></div>
            </a>
          )) : <div className="epic-empty"><p>{epicQuery.isError ? "Galeria da Terra temporariamente indisponível" : "Carregando imagens da Terra…"}</p></div>}
        </div>
        <a href="https://epic.gsfc.nasa.gov/" target="_blank" rel="n noreferrer" className="epic-source">ver galeria completa no EPIC <ArrowUpRight size={14} aria-hidden="true" /></a>
      </section>

      {/* ═══════════════════════════════════════════════════════
          DONKI — Clima Espacial (solar flares, CMEs, storms)
      ═══════════════════════════════════════════════════════ */}
      <section className="space-weather-section" aria-labelledby="weather-title">
        <div className="weather-heading"><p className="eyebrow"><Flame size={15} aria-hidden="true" /> Clima espacial</p><h2 id="weather-title">O que o Sol está fazendo agora.</h2><p>Alertas de clima espacial da NASA: erupções solares, ejeções de massa coronal e tempestades geomagnéticas que afetam satélites e observação.</p></div>
        <div className="weather-events">
          {spaceWeatherQuery.data?.length ? spaceWeatherQuery.data.map(event => (
            <article key={event.id} className="weather-event-card">
              <div className="weather-event-type"><AlertTriangle size={14} aria-hidden="true" /><span>{event.typeLabel}</span></div>
              <p className="weather-event-summary">{event.summary.slice(0, 180)}…</p>
              <time dateTime={event.timestamp}>{new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }).format(new Date(event.timestamp))}</time>
            </article>
          )) : <div className="weather-empty"><p>{spaceWeatherQuery.isError ? "Dados de clima espacial indisponíveis" : "Consultando o banco de dados de clima espacial da NASA…"}</p></div>}
        </div>
        <a href="https://api.nasa.gov/" target="_blank" rel="noreferrer" className="weather-source">dados via NASA DONKI <ArrowUpRight size={14} aria-hidden="true" /></a>
      </section>

      {/* ═══════════════════════════════════════════════════════
          Asteroides Próximos (NeoWs)
      ═══════════════════════════════════════════════════════ */}
      <section className="asteroids-section" aria-labelledby="asteroids-title">
        <div className="asteroids-heading"><p className="eyebrow"><Crosshair size={15} aria-hidden="true" /> Objetos próximos</p><h2 id="asteroids-title">Asteroides passando perto da Terra.</h2><p>Dados do Near Earth Object Web Service da NASA — asteroides com passagem mais próxima nos próximos dias.</p></div>
        <div className="asteroids-list">
          {asteroidsQuery.data?.length ? asteroidsQuery.data.map(asteroid => (
            <a key={asteroid.id} href={asteroid.nasaUrl} target="_blank" rel="noreferrer" className="asteroid-entry">
              <span className="asteroid-hazard" data-hazard={asteroid.isHazardous}>{asteroid.isHazardous ? "⚠" : "○"}</span>
              <div><strong>{asteroid.name}</strong><p>{formatNumber(asteroid.diameterKmMax * 1000, 1)} m · {formatNumber(asteroid.missDistanceKm)} km de distância</p></div>
              <time dateTime={asteroid.approachDate}>{new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short" }).format(new Date(asteroid.approachDate))}<small>{formatNumber(asteroid.velocityKmh)} km/h</small></time>
            </a>
          )) : <div className="asteroid-loading"><p>{asteroidsQuery.isError ? "Lista de asteroides indisponível" : "Carregando asteroides próximos…"}</p></div>}
        </div>
        <a href="https://neo.jpl.nasa.gov/" target="_blank" rel="noreferrer" className="asteroids-source">explorar no JPL <ArrowUpRight size={14} aria-hidden="true" /></a>
      </section>

      <section id="fontes" className="context-section" aria-label="Fontes e limites do observatório"><div className="context-image">          <img src="/manus-storage/iss-map-texture_2bd39705.jpg" alt="Textura cartográfica da Terra vista da órbita" /></div><div className="context-copy"><span className="section-index">01 — LEITURA DO CÉU</span><p>Dados de posição vêm de fontes públicas especializadas. Cidade e país indicam o subponto aproximado da órbita, e não uma confirmação de visibilidade local.</p></div><a href="/fontes" className="source-link">fontes, limites e privacidade <ArrowUpRight size={16} aria-hidden="true" /></a></section>
      <footer className="site-footer"><span>Órbita — um pequeno observatório para grandes distâncias.</span><div className="footer-links"><a href="/privacidade">privacidade</a><a href="/termos">termos</a><a href="/fontes">fontes</a></div><span>{allSnapshots.length} objetos · foco: {selectedShortName}</span></footer>
    </main>
  );
}
