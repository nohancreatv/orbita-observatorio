/**
 * CARTOGRAFIA DO CREPÚSCULO — o globo é a superfície de leitura principal;
 * a constelação de dados e a história espacial surgem como camadas editoriais secundárias.
 */
import { useEffect, useMemo, useState } from "react";
import type { inferRouterOutputs } from "@trpc/server";
import {
  ArrowUpRight,
  Clock3,
  Crosshair,
  Gauge,
  LocateFixed,
  MapPin,
  Orbit,
  Radio,
  RefreshCw,
  Ruler,
  Satellite,
  Sparkles,
  Telescope,
} from "lucide-react";
import type { AppRouter } from "../../../server/routers";
import { trpc } from "@/lib/trpc";

type RouterOutputs = inferRouterOutputs<AppRouter>;
type SatelliteId = "iss" | "hubble" | "tiangong" | "noaa19";
type UserLocation = { latitude: number; longitude: number; label: string };
type PassPrediction = RouterOutputs["orbit"]["issClosestPass"];

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
  const diff = Math.max(0, timestamp * 1000 - Date.now());
  const minutes = Math.round(diff / 60000);
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
  const [statusMessage, setStatusMessage] = useState("Conectando ao observatório orbital…");
  const [clock, setClock] = useState(() => new Date());

  const catalogQuery = trpc.orbit.catalog.useQuery(undefined, { staleTime: 60 * 60_000 });
  const snapshotQuery = trpc.orbit.snapshot.useQuery({ satelliteId: selectedSatellite }, { refetchInterval: 10_000, retry: 1 });
  const storyQuery = trpc.space.story.useQuery(undefined, { staleTime: 6 * 60 * 60_000, retry: 1 });
  const userPlace = trpc.orbit.userPlace.useMutation();
  const closestPass = trpc.orbit.issClosestPass.useMutation();

  const snapshot = snapshotQuery.data;
  const prediction: PassPrediction | undefined = closestPass.data;
  const satellites = catalogQuery.data || [];

  useEffect(() => {
    const interval = window.setInterval(() => setClock(new Date()), 1000);
    return () => window.clearInterval(interval);
  }, []);

  useEffect(() => {
    if (snapshotQuery.isSuccess && snapshot) {
      setStatusMessage(`Sinal de ${snapshot.satellite.shortName} recebido às ${new Intl.DateTimeFormat("pt-BR", { hour: "2-digit", minute: "2-digit", second: "2-digit" }).format(new Date(snapshot.timestamp * 1000))}`);
    }
    if (snapshotQuery.isError) setStatusMessage("O rastreador está indisponível agora. Tente atualizar em instantes.");
  }, [snapshot, snapshotQuery.isError, snapshotQuery.isSuccess]);

  useEffect(() => {
    if (selectedSatellite === "iss" && userLocation) {
      closestPass.mutate({ latitude: userLocation.latitude, longitude: userLocation.longitude });
    }
  // A previsão só depende da posição local e da seleção de ISS.
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

  const markerPosition = useMemo(() => {
    if (!snapshot) return { left: "50%", top: "50%" };
    return { left: `${50 + (snapshot.longitude / 180) * 34}%`, top: `${50 - (snapshot.latitude / 90) * 34}%` };
  }, [snapshot]);

  const currentTime = new Intl.DateTimeFormat("pt-BR", { hour: "2-digit", minute: "2-digit", second: "2-digit" }).format(clock);
  const proximityState = prediction && prediction.distance < 2500;
  const selectedShortName = snapshot?.satellite.shortName || "satélite";
  const selectedName = snapshot?.satellite.name || "objeto orbital";
  const previewStoryFailure = import.meta.env.DEV && new URLSearchParams(window.location.search).has("simular-falha-nasa");
  const storyFailed = storyQuery.isError || previewStoryFailure;
  const storyTitle = storyFailed ? "A janela do cosmos está temporariamente fechada." : storyQuery.data?.title || "Abrindo o diário de bordo da NASA…";
  const storyExplanation = storyFailed ? "A fonte de curiosidades não respondeu agora. O rastreamento orbital continua disponível e você pode tentar novamente em instantes." : storyQuery.data?.explanation || "A leitura científica do dia aparecerá aqui assim que a fonte pública responder.";

  return (
    <main className="observatory-shell">
      <div className="star-surface" aria-hidden="true" />
      <header className="site-header">
        <a href="#inicio" className="brand-mark" aria-label="Órbita, início">
          <img src="/manus-storage/orbita-logo_99dcd0cb.png" alt="" className="brand-symbol" />
          <span>órbita</span>
        </a>
        <div className="header-meta">
          <span className="signal-dot" aria-hidden="true" />
          <span>observatório orbital</span>
          <span className="meta-divider" />
          <time dateTime={clock.toISOString()}>{currentTime} local</time>
        </div>
      </header>

      <section id="inicio" className="hero-section" aria-labelledby="hero-title">
        <div className="intro-column">
          <p className="eyebrow"><Satellite size={15} aria-hidden="true" /> {snapshot?.satellite.category || "objeto orbital"}</p>
          <h1 id="hero-title">O que está passando <em>em cima</em> de mim agora?</h1>
          <p className="hero-description">Acompanhe satélites que cruzam a Terra em tempo real, descubra o território abaixo da órbita e encontre a próxima passagem da ISS no seu céu.</p>
          <div className="satellite-selector" aria-label="Selecionar objeto orbital">
            <span className="selector-label">na constelação</span>
            <div className="selector-options">
              {satellites.length ? satellites.map(satellite => (
                <button key={satellite.id} type="button" onClick={() => setSelectedSatellite(satellite.id as SatelliteId)} className={selectedSatellite === satellite.id ? "satellite-option is-active" : "satellite-option"} aria-pressed={selectedSatellite === satellite.id}>
                  {satellite.shortName}
                </button>
              )) : <span className="catalog-loading">carregando satélites…</span>}
            </div>
          </div>
          <div className="action-row">
            <button type="button" onClick={requestLocation} className="locate-button" disabled={isLocating}>
              <LocateFixed size={18} aria-hidden="true" />
              {isLocating ? "localizando…" : userLocation ? "atualizar horizonte" : "usar minha localização"}
              <ArrowUpRight size={17} aria-hidden="true" />
            </button>
            <p className="privacy-note">A posição é usada apenas para esta consulta e não é salva.</p>
          </div>
          <div className="live-readout" role="status" aria-live="polite"><Radio size={15} aria-hidden="true" /><span>{statusMessage}</span></div>
        </div>

        <div className="orbital-stage" aria-label={`Globo terrestre com a posição atual aproximada de ${selectedName}`}>
          <img src="/manus-storage/iss-hero-earth_dc590d13.png" alt="Terra vista do espaço com uma rota orbital" className="hero-earth-art" />
          <div className="orbit-caption orbit-caption-top"><span /> posição atual</div>
          <div className="globe-frame">
            <div className="globe-grid globe-grid-longitude" aria-hidden="true" />
            <div className="globe-grid globe-grid-latitude" aria-hidden="true" />
            <div className="globe-terminator" aria-hidden="true" />
            <div className="continental-shape continent-one" aria-hidden="true" />
            <div className="continental-shape continent-two" aria-hidden="true" />
            <div className="orbital-path" aria-hidden="true" />
            <div className="iss-ping" style={markerPosition} aria-label={`Posição aproximada de ${selectedShortName}`}><span className="ping-ripple" /><Satellite size={17} strokeWidth={2.3} /></div>
          </div>
          <div className="globe-badge globe-badge-wide">
            <div className="badge-icon"><Crosshair size={17} aria-hidden="true" /></div>
            <div>
              <span>{selectedShortName} agora</span>
              <strong>{snapshot ? `${formatCoordinate(snapshot.latitude, true)} · ${formatCoordinate(snapshot.longitude, false)}` : "sincronizando coordenadas"}</strong>
              <small><MapPin size={11} aria-hidden="true" /> {snapshot?.groundLocation.label || "localização terrestre em leitura"}</small>
            </div>
          </div>
          <div className="orbit-caption orbit-caption-bottom"><span /> subponto terrestre</div>
        </div>
      </section>

      <section className="telemetry-strip" aria-label={`Telemetria atual de ${selectedShortName}`}>
        <article className="telemetry-item telemetry-primary"><div className="telemetry-icon"><Orbit size={18} aria-hidden="true" /></div><div><span className="telemetry-label">estado da órbita</span><strong>{getVisibilityCopy(snapshot?.visibility)}</strong></div></article>
        <article className="telemetry-item"><Ruler size={18} aria-hidden="true" /><div><span className="telemetry-label">altitude</span><strong>{snapshot ? `${formatNumber(snapshot.altitude, 1)} km` : "—"}</strong></div></article>
        <article className="telemetry-item"><Gauge size={18} aria-hidden="true" /><div><span className="telemetry-label">velocidade</span><strong>{snapshot ? `${formatNumber(snapshot.velocity)} km/h` : "—"}</strong></div></article>
        <article className="telemetry-item"><MapPin size={18} aria-hidden="true" /><div><span className="telemetry-label">abaixo da órbita</span><strong>{snapshot?.groundLocation.city || snapshot?.groundLocation.country || "oceano / região remota"}</strong></div></article>
        <button type="button" className="refresh-button" onClick={() => snapshotQuery.refetch()} disabled={snapshotQuery.isFetching} aria-label="Atualizar a telemetria"><RefreshCw size={18} className={snapshotQuery.isFetching ? "spin" : ""} aria-hidden="true" /></button>
      </section>

      <section className="ground-location-section" aria-labelledby="ground-title">
        <div className="ground-location-title"><p className="eyebrow"><MapPin size={15} aria-hidden="true" /> Da coordenada ao território</p><h2 id="ground-title">Onde está <em>{selectedShortName}</em> neste instante?</h2></div>
        <div className="ground-location-card">
          <span className="location-label">ponto suborbital aproximado</span>
          <strong>{snapshot?.groundLocation.label || "identificando cidade e país…"}</strong>
          <div className="location-coordinates">{snapshot ? `${formatCoordinate(snapshot.latitude, true)} · ${formatCoordinate(snapshot.longitude, false)}` : "—"}</div>
          <p>{snapshot?.groundLocation.isOceanOrRemote ? "Este ponto pode estar sobre oceano, áreas remotas ou uma região onde uma cidade não foi identificada." : "A localização indica o ponto da superfície terrestre mais diretamente abaixo do satélite; não representa uma rota de sobrevoo visível."}</p>
        </div>
        <a href="#fontes" className="source-link ground-source-link">como lemos o ponto terrestre <ArrowUpRight size={16} aria-hidden="true" /></a>
      </section>

      <section className="passage-section" aria-labelledby="passage-title">
        <div className="passage-art" aria-hidden="true"><img src="/manus-storage/iss-passage-panel_d049613e.png" alt="" /><div className="art-annotation annotation-one">linha de passagem</div><div className="art-annotation annotation-two">horizonte local</div></div>
        <div className="passage-copy">
          <p className="eyebrow"><Sparkles size={15} aria-hidden="true" /> O seu horizonte</p>
          <h2 id="passage-title">A próxima chance de ver a ISS começa pela sua cidade.</h2>
          {userLocation ? (
            <div className="passage-result">
              <div className="location-line"><MapPin size={18} aria-hidden="true" /><span>{userLocation.label}</span></div>
              {selectedSatellite !== "iss" ? <p className="result-detail">A previsão local de passagem é calculada para a ISS. Selecione-a na constelação para consultar o seu horizonte.</p> : prediction ? <><p className={proximityState ? "result-status is-good" : "result-status"}>{proximityState ? "Boa aproximação prevista" : "Passagem mais próxima no período"}</p><strong className="passage-time">{formatTimeFromNow(prediction.timestamp)}</strong><p className="result-detail">A ISS deve passar a cerca de {formatNumber(prediction.distance)} km da sua posição, por volta de {formatDate(prediction.timestamp)}.</p></> : <p className="result-detail">Estamos consultando a rota das próximas duas horas.</p>}
            </div>
          ) : <div className="passage-empty"><p>Conte onde você está e calcularemos a aproximação mais promissora da ISS nas próximas duas horas.</p><button type="button" className="text-button" onClick={requestLocation}>definir meu horizonte <ArrowUpRight size={16} aria-hidden="true" /></button></div>}
          <p className="visibility-caveat">A observação a olho nu depende também da iluminação solar, da elevação e das condições de nuvens.</p>
        </div>
      </section>

      <section className="space-story-section" aria-labelledby="story-title">
        <div className={storyQuery.data?.imageUrl ? "story-image has-image" : "story-image"} style={storyQuery.data?.imageUrl ? { backgroundImage: `linear-gradient(90deg, rgba(7,17,31,.16), rgba(7,17,31,.72)), url(${storyQuery.data.imageUrl})` } : undefined}><span>arquivo do cosmos</span></div>
        <div className="story-copy"><p className="eyebrow"><Telescope size={15} aria-hidden="true" /> Curiosidade de hoje</p><h2 id="story-title">{storyTitle}</h2><p>{storyExplanation}</p><div className="story-footer"><span>{storyQuery.data?.credit && !storyFailed ? `Crédito: ${storyQuery.data.credit}` : storyFailed ? "NASA Open APIs indisponível" : "Fonte: NASA Open APIs"}</span><a href={storyQuery.data?.sourceUrl || "https://api.nasa.gov/"} target="_blank" rel="noreferrer">ver fonte <ArrowUpRight size={14} aria-hidden="true" /></a></div></div>
      </section>

      <section id="fontes" className="context-section" aria-label="Fontes e limites do observatório">
        <div className="context-image"><img src="/manus-storage/iss-map-texture_2bd39705.png" alt="Textura cartográfica da Terra vista da órbita" /></div>
        <div className="context-copy"><span className="section-index">01 — LEITURA DO CÉU</span><p>Dados de posição vêm de fontes públicas especializadas. A cidade e o país indicam o subponto aproximado da órbita, e não uma confirmação de visibilidade local.</p></div>
        <a href="/fontes" className="source-link">fontes, limites e privacidade <ArrowUpRight size={16} aria-hidden="true" /></a>
      </section>

      <footer className="site-footer"><span>Órbita — um pequeno observatório para grandes distâncias.</span><div className="footer-links"><a href="/privacidade">privacidade</a><a href="/termos">termos</a><a href="/fontes">fontes</a></div><span>{selectedShortName} · NORAD {snapshot?.satellite.noradId || "—"}</span></footer>
    </main>
  );
}
