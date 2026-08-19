/**
 * CARTOGRAFIA DO CREPÚSCULO — observatório editorial assimétrico.
 * O globo, a telemetria e o Verde Aurora conduzem a hierarquia; detalhes espaciais permanecem discretos.
 */
import { useCallback, useEffect, useMemo, useState } from "react";
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
} from "lucide-react";

const ISS_ENDPOINT = "https://api.wheretheiss.at/v1/satellites/25544";
const ISS_POSITIONS_ENDPOINT = `${ISS_ENDPOINT}/positions`;

type IssData = {
  latitude: number;
  longitude: number;
  altitude: number;
  velocity: number;
  visibility: string;
  footprint: number;
  timestamp: number;
};

type UserLocation = {
  latitude: number;
  longitude: number;
  label: string;
};

type Prediction = IssData & {
  distance: number;
};

function formatNumber(value: number, maximumFractionDigits = 0) {
  return new Intl.NumberFormat("pt-BR", { maximumFractionDigits }).format(value);
}

function formatCoordinate(value: number, isLatitude: boolean) {
  const direction = isLatitude ? (value >= 0 ? "N" : "S") : value >= 0 ? "L" : "O";
  return `${Math.abs(value).toFixed(2)}° ${direction}`;
}

function formatDate(timestamp: number) {
  return new Intl.DateTimeFormat("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
    day: "2-digit",
    month: "short",
  }).format(new Date(timestamp * 1000));
}

function formatTimeFromNow(timestamp: number) {
  const diff = Math.max(0, timestamp * 1000 - Date.now());
  const minutes = Math.round(diff / 60000);
  if (minutes < 2) return "agora";
  if (minutes < 60) return `em ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  return `em ${hours}h${String(minutes % 60).padStart(2, "0")}`;
}

function getDistanceKm(first: UserLocation, second: IssData) {
  const rad = (angle: number) => (angle * Math.PI) / 180;
  const earthRadius = 6371;
  const dLatitude = rad(second.latitude - first.latitude);
  const dLongitude = rad(second.longitude - first.longitude);
  const a =
    Math.sin(dLatitude / 2) ** 2 +
    Math.cos(rad(first.latitude)) * Math.cos(rad(second.latitude)) * Math.sin(dLongitude / 2) ** 2;
  return earthRadius * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function getVisibilityCopy(visibility?: string) {
  if (visibility === "daylight") return "sob luz solar";
  if (visibility === "eclipsed") return "na sombra da Terra";
  return "em crepúsculo";
}

export default function Home() {
  const [iss, setIss] = useState<IssData | null>(null);
  const [userLocation, setUserLocation] = useState<UserLocation | null>(null);
  const [prediction, setPrediction] = useState<Prediction | null>(null);
  const [isLocating, setIsLocating] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [statusMessage, setStatusMessage] = useState("Conectando ao rastreador orbital…");
  const [clock, setClock] = useState(() => new Date());

  const loadIss = useCallback(async (manual = false) => {
    if (manual) setIsRefreshing(true);

    try {
      const response = await fetch(ISS_ENDPOINT);
      if (!response.ok) throw new Error("Falha ao consultar a posição orbital.");
      const data = (await response.json()) as IssData;
      setIss(data);
      setStatusMessage(`Sinal orbital recebido às ${new Intl.DateTimeFormat("pt-BR", { hour: "2-digit", minute: "2-digit", second: "2-digit" }).format(new Date(data.timestamp * 1000))}`);
    } catch {
      setStatusMessage("Não foi possível atualizar a telemetria agora. Tente novamente em instantes.");
    } finally {
      if (manual) setIsRefreshing(false);
    }
  }, []);

  const updatePrediction = useCallback(async (location: UserLocation) => {
    try {
      const start = Math.floor(Date.now() / 1000) + 60;
      const timestamps = Array.from({ length: 10 }, (_, index) => start + index * 720).join(",");
      const response = await fetch(`${ISS_POSITIONS_ENDPOINT}?timestamps=${timestamps}&units=kilometers`);
      if (!response.ok) throw new Error("Falha ao calcular aproximações.");
      const positions = (await response.json()) as IssData[];
      const candidates = positions.map(position => ({ ...position, distance: getDistanceKm(location, position) }));
      const nearest = candidates.reduce((best, candidate) => (candidate.distance < best.distance ? candidate : best));
      setPrediction(nearest);
    } catch {
      setPrediction(null);
    }
  }, []);

  useEffect(() => {
    loadIss();
    const updateInterval = window.setInterval(() => loadIss(), 10000);
    const clockInterval = window.setInterval(() => setClock(new Date()), 1000);
    return () => {
      window.clearInterval(updateInterval);
      window.clearInterval(clockInterval);
    };
  }, [loadIss]);

  useEffect(() => {
    if (userLocation) updatePrediction(userLocation);
  }, [userLocation, updatePrediction]);

  const requestLocation = () => {
    if (!navigator.geolocation) {
      setStatusMessage("O seu navegador não oferece geolocalização para esta consulta.");
      return;
    }

    setIsLocating(true);
    setStatusMessage("Lendo a sua posição para procurar a próxima passagem…");
    navigator.geolocation.getCurrentPosition(
      async position => {
        const latitude = position.coords.latitude;
        const longitude = position.coords.longitude;
        let label = "sua região";

        try {
          const placeResponse = await fetch(
            `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${latitude}&longitude=${longitude}&localityLanguage=pt-BR`,
          );
          if (placeResponse.ok) {
            const place = await placeResponse.json();
            label = place.city || place.locality || place.principalSubdivision || label;
          }
        } catch {
          // A previsão continua disponível apenas com as coordenadas locais.
        }

        setUserLocation({ latitude, longitude, label });
        setStatusMessage(`Horizonte definido para ${label}. Calculando a melhor aproximação…`);
        setIsLocating(false);
      },
      () => {
        setStatusMessage("Não foi possível acessar a sua localização. Você pode tentar novamente quando quiser.");
        setIsLocating(false);
      },
      { enableHighAccuracy: false, timeout: 12000, maximumAge: 300000 },
    );
  };

  const markerPosition = useMemo(() => {
    if (!iss) return { left: "50%", top: "50%" };
    return {
      left: `${50 + (iss.longitude / 180) * 34}%`,
      top: `${50 - (iss.latitude / 90) * 34}%`,
    };
  }, [iss]);

  const currentTime = new Intl.DateTimeFormat("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).format(clock);

  const proximityState = prediction && prediction.distance < 2500;

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
          <span>rastreador da ISS</span>
          <span className="meta-divider" />
          <time dateTime={clock.toISOString()}>{currentTime} local</time>
        </div>
      </header>

      <section id="inicio" className="hero-section" aria-labelledby="hero-title">
        <div className="intro-column">
          <p className="eyebrow"><Satellite size={15} aria-hidden="true" /> A estação acima da Terra</p>
          <h1 id="hero-title">O que está passando <em>em cima</em> de mim agora?</h1>
          <p className="hero-description">
            A Estação Espacial Internacional percorre o planeta a cerca de 28 mil km/h. Veja onde ela está e descubra quando olhar para o seu céu.
          </p>
          <div className="action-row">
            <button type="button" onClick={requestLocation} className="locate-button" disabled={isLocating}>
              <LocateFixed size={18} aria-hidden="true" />
              {isLocating ? "localizando…" : userLocation ? "atualizar horizonte" : "usar minha localização"}
              <ArrowUpRight size={17} aria-hidden="true" />
            </button>
            <p className="privacy-note">Sua posição fica apenas neste navegador.</p>
          </div>
          <div className="live-readout" role="status" aria-live="polite">
            <Radio size={15} aria-hidden="true" />
            <span>{statusMessage}</span>
          </div>
        </div>

        <div className="orbital-stage" aria-label="Globo terrestre com a posição atual aproximada da ISS">
          <img src="/manus-storage/iss-hero-earth_dc590d13.png" alt="Terra vista do espaço com a rota orbital da Estação Espacial Internacional" className="hero-earth-art" />
          <div className="orbit-caption orbit-caption-top"><span /> Posição atual</div>
          <div className="globe-frame">
            <div className="globe-grid globe-grid-longitude" aria-hidden="true" />
            <div className="globe-grid globe-grid-latitude" aria-hidden="true" />
            <div className="globe-terminator" aria-hidden="true" />
            <div className="continental-shape continent-one" aria-hidden="true" />
            <div className="continental-shape continent-two" aria-hidden="true" />
            <div className="orbital-path" aria-hidden="true" />
            <div className="iss-ping" style={markerPosition} aria-label="Posição aproximada da ISS">
              <span className="ping-ripple" />
              <Satellite size={17} strokeWidth={2.3} />
            </div>
          </div>
          <div className="globe-badge">
            <div className="badge-icon"><Crosshair size={17} aria-hidden="true" /></div>
            <div>
              <span>ISS agora</span>
              <strong>{iss ? `${formatCoordinate(iss.latitude, true)} · ${formatCoordinate(iss.longitude, false)}` : "sincronizando coordenadas"}</strong>
            </div>
          </div>
          <div className="orbit-caption orbit-caption-bottom"><span /> projeção orbital simplificada</div>
        </div>
      </section>

      <section className="telemetry-strip" aria-label="Telemetria atual da ISS">
        <article className="telemetry-item telemetry-primary">
          <div className="telemetry-icon"><Orbit size={18} aria-hidden="true" /></div>
          <div>
            <span className="telemetry-label">status da órbita</span>
            <strong>{iss ? getVisibilityCopy(iss.visibility) : "aguardando sinal"}</strong>
          </div>
        </article>
        <article className="telemetry-item">
          <Ruler size={18} aria-hidden="true" />
          <div><span className="telemetry-label">altitude</span><strong>{iss ? `${formatNumber(iss.altitude, 1)} km` : "—"}</strong></div>
        </article>
        <article className="telemetry-item">
          <Gauge size={18} aria-hidden="true" />
          <div><span className="telemetry-label">velocidade</span><strong>{iss ? `${formatNumber(iss.velocity)} km/h` : "—"}</strong></div>
        </article>
        <article className="telemetry-item">
          <Clock3 size={18} aria-hidden="true" />
          <div><span className="telemetry-label">última leitura</span><strong>{iss ? formatDate(iss.timestamp) : "—"}</strong></div>
        </article>
        <button type="button" className="refresh-button" onClick={() => loadIss(true)} disabled={isRefreshing} aria-label="Atualizar a telemetria">
          <RefreshCw size={18} className={isRefreshing ? "spin" : ""} aria-hidden="true" />
        </button>
      </section>

      <section className="passage-section" aria-labelledby="passage-title">
        <div className="passage-art" aria-hidden="true">
          <img src="/manus-storage/iss-passage-panel_d049613e.png" alt="" />
          <div className="art-annotation annotation-one">linha de passagem</div>
          <div className="art-annotation annotation-two">horizonte local</div>
        </div>
        <div className="passage-copy">
          <p className="eyebrow"><Sparkles size={15} aria-hidden="true" /> O seu horizonte</p>
          <h2 id="passage-title">A próxima chance de ver a ISS começa pela sua cidade.</h2>
          {userLocation ? (
            <div className="passage-result">
              <div className="location-line"><MapPin size={18} aria-hidden="true" /><span>{userLocation.label}</span></div>
              {prediction ? (
                <>
                  <p className={proximityState ? "result-status is-good" : "result-status"}>
                    {proximityState ? "Boa aproximação prevista" : "Passagem mais próxima no período"}
                  </p>
                  <strong className="passage-time">{formatTimeFromNow(prediction.timestamp)}</strong>
                  <p className="result-detail">
                    A ISS deve passar a cerca de {formatNumber(prediction.distance)} km da sua posição, por volta de {formatDate(prediction.timestamp)}.
                  </p>
                </>
              ) : (
                <p className="result-detail">Estamos consultando a rota das próximas duas horas.</p>
              )}
            </div>
          ) : (
            <div className="passage-empty">
              <p>Conte onde você está e calcularemos a aproximação mais promissora nas próximas duas horas.</p>
              <button type="button" className="text-button" onClick={requestLocation}>definir meu horizonte <ArrowUpRight size={16} aria-hidden="true" /></button>
            </div>
          )}
          <p className="visibility-caveat">A observação a olho nu depende também da iluminação solar, da elevação e das condições de nuvens.</p>
        </div>
      </section>

      <section className="context-section" aria-label="Como acompanhar a estação">
        <div className="context-image"><img src="/manus-storage/iss-map-texture_2bd39705.png" alt="Textura cartográfica da Terra vista da órbita" /></div>
        <div className="context-copy">
          <span className="section-index">01 — LEITURA DO CÉU</span>
          <p>A ISS contorna a Terra em cerca de 90 minutos. Quando a rota encontra o seu entardecer ou amanhecer, ela pode cruzar o céu como um ponto luminoso em movimento.</p>
        </div>
        <a href="https://wheretheiss.at/w/developer" target="_blank" rel="noreferrer" className="source-link">
          dados orbitais em tempo real <ArrowUpRight size={16} aria-hidden="true" />
        </a>
      </section>

      <footer className="site-footer">
        <span>Órbita — um pequeno observatório para grandes distâncias.</span>
        <span>ISS · NORAD 25544</span>
      </footer>
    </main>
  );
}
