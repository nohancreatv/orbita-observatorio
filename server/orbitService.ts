/**
 * Camada de dados pública para o observatório.
 * Nenhuma coordenada do visitante é persistida; cacheia somente respostas públicas de provedores externos.
 */
import * as satellite from "satellite.js";

const celesTrakTelemetry = (noradId: number) => ({
  provider: "CelesTrak GP/TLE",
  endpoint: `https://celestrak.org/NORAD/elements/gp.php?CATNR=${noradId}&FORMAT=TLE`,
  format: "TLE" as const,
});

export const SATELLITE_CATALOG = {
  iss: {
    id: "iss",
    name: "Estação Espacial Internacional",
    shortName: "ISS",
    noradId: 25544,
    category: "laboratório orbital",
    source: "Where the ISS at?",
    telemetry: { provider: "Where the ISS at?", endpoint: "https://api.wheretheiss.at/v1/satellites/25544", format: "JSON" as const },
  },
  hubble: {
    id: "hubble",
    name: "Telescópio Espacial Hubble",
    shortName: "Hubble",
    noradId: 20580,
    category: "observatório espacial",
    source: "CelesTrak",
    telemetry: celesTrakTelemetry(20580),
  },
  tiangong: {
    id: "tiangong",
    name: "Estação Espacial Tiangong",
    shortName: "Tiangong",
    noradId: 48274,
    category: "estação espacial",
    source: "CelesTrak",
    telemetry: celesTrakTelemetry(48274),
  },
  noaa19: {
    id: "noaa19",
    name: "NOAA 19",
    shortName: "NOAA 19",
    noradId: 33591,
    category: "satélite meteorológico",
    source: "CelesTrak",
    telemetry: celesTrakTelemetry(33591),
  },
  noaa20: {
    id: "noaa20",
    name: "NOAA 20 (JPSS-1)",
    shortName: "NOAA 20",
    noradId: 43013,
    category: "satélite meteorológico",
    source: "CelesTrak",
    telemetry: celesTrakTelemetry(43013),
  },
  noaa21: {
    id: "noaa21",
    name: "NOAA 21 (JPSS-2)",
    shortName: "NOAA 21",
    noradId: 54234,
    category: "satélite meteorológico",
    source: "CelesTrak",
    telemetry: celesTrakTelemetry(54234),
  },
  sentinel1a: {
    id: "sentinel1a",
    name: "Sentinel-1A",
    shortName: "Sentinel-1A",
    noradId: 39634,
    category: "observação da Terra",
    source: "CelesTrak",
    telemetry: celesTrakTelemetry(39634),
  },
  landsat9: {
    id: "landsat9",
    name: "Landsat 9",
    shortName: "Landsat 9",
    noradId: 49260,
    category: "observação da Terra",
    source: "CelesTrak",
    telemetry: celesTrakTelemetry(49260),
  },
  terra: {
    id: "terra",
    name: "Terra (EOS AM-1)",
    shortName: "Terra",
    noradId: 25994,
    category: "observação da Terra",
    source: "CelesTrak",
    telemetry: celesTrakTelemetry(25994),
  },
  aqua: {
    id: "aqua",
    name: "Aqua (EOS PM-1)",
    shortName: "Aqua",
    noradId: 27424,
    category: "observação da Terra",
    source: "CelesTrak",
    telemetry: celesTrakTelemetry(27424),
  },
} as const;

export type SatelliteId = keyof typeof SATELLITE_CATALOG;

type IssProviderData = {
  latitude: number;
  longitude: number;
  altitude: number;
  velocity: number;
  visibility: string;
  footprint: number;
  timestamp: number;
};

type ReverseGeocodeData = {
  city?: string;
  locality?: string;
  principalSubdivision?: string;
  countryName?: string;
  countryCode?: string;
  localityInfo?: { administrative?: Array<{ name?: string }> };
};

type ApodProviderData = {
  title?: string;
  date?: string;
  explanation?: string;
  url?: string;
  hdurl?: string;
  media_type?: string;
  copyright?: string;
};

type NasaImageLibraryItem = {
  data?: Array<{
    nasa_id?: string;
    title?: string;
    description?: string;
    date_created?: string;
    media_type?: string;
  }>;
  links?: Array<{ href?: string; rel?: string; render?: string }>;
};

type NasaImageLibraryProviderData = {
  collection?: { items?: NasaImageLibraryItem[] };
};

type TranslationProviderData = {
  responseStatus?: number;
  responseData?: { translatedText?: string };
};

type WeatherProviderData = {
  current?: { time?: string; cloud_cover?: number; visibility?: number; weather_code?: number };
  timezone_abbreviation?: string;
};

type LaunchProviderData = {
  results?: Array<{
    id?: string;
    name?: string;
    net?: string;
    status?: { name?: string };
    launch_service_provider?: { name?: string };
    pad?: { location?: { name?: string } };
    image?: { image_url?: string };
  }>;
};

export type GroundLocation = {
  city: string | null;
  country: string | null;
  countryCode: string | null;
  label: string;
  isOceanOrRemote: boolean;
};

export type OrbitSnapshot = {
  satellite: (typeof SATELLITE_CATALOG)[SatelliteId];
  latitude: number;
  longitude: number;
  altitude: number | null;
  velocity: number | null;
  visibility: string;
  footprint: number | null;
  timestamp: number;
  groundLocation: GroundLocation;
  sourceUrl: string;
};

export type OrbitTrajectoryPoint = {
  latitude: number;
  longitude: number;
  altitude: number;
  timestamp: number;
};

export type OrbitTrajectory = {
  satellite: (typeof SATELLITE_CATALOG)[SatelliteId];
  points: OrbitTrajectoryPoint[];
  durationMinutes: number;
  generatedAt: number;
  sourceUrl: string;
};

type CacheEntry<T> = { value: T; expiresAt: number; staleUntil: number };
const cache = new Map<string, CacheEntry<unknown>>();
const inFlight = new Map<string, Promise<unknown>>();

/** Limpa caches entre cenários isolados de teste; o runtime normal nunca chama esta função. */
export function resetOrbitServiceCacheForTests() {
  cache.clear();
  inFlight.clear();
  latestSpaceStory = null;
  nasaRetryAfter = 0;
}

async function withCache<T>(key: string, ttlMs: number, producer: () => Promise<T>, staleMs = Math.max(ttlMs * 4, 60_000)): Promise<T> {
  const cached = cache.get(key) as CacheEntry<T> | undefined;
  const now = Date.now();
  if (cached && cached.expiresAt > now) return cached.value;

  const activeRequest = inFlight.get(key) as Promise<T> | undefined;
  if (activeRequest) return activeRequest;

  const request = producer()
    .then(value => {
      const storedAt = Date.now();
      cache.set(key, { value, expiresAt: storedAt + ttlMs, staleUntil: storedAt + ttlMs + staleMs });
      return value;
    })
    .catch(error => {
      if (cached && cached.staleUntil > Date.now()) return cached.value;
      throw error;
    })
    .finally(() => inFlight.delete(key));

  inFlight.set(key, request as Promise<unknown>);
  return request;
}

async function fetchJson<T>(url: string, timeoutMs = 8000): Promise<T> {
  const response = await fetch(url, {
    headers: { Accept: "application/json", "User-Agent": "Orbita-ISS-Observatory/1.0" },
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (!response.ok) throw new Error(`Fonte externa indisponível: ${response.status}`);
  return response.json() as Promise<T>;
}

function normaliseLongitude(longitude: number) {
  return ((longitude + 540) % 360) - 180;
}

function toGroundLocation(data: ReverseGeocodeData): GroundLocation {
  const city = data.city || data.locality || data.localityInfo?.administrative?.[0]?.name || null;
  const country = data.countryName || null;
  const isOceanOrRemote = !city || !country || /oceano|ocean|mar aberto|open sea|pacific|atlantic|indian ocean/i.test(city || "");
  const label = city && country ? `${city}, ${country}` : city || country || "sobre oceano ou região remota";
  return { city, country, countryCode: data.countryCode || null, label, isOceanOrRemote };
}

export async function resolveGroundLocation(latitude: number, longitude: number): Promise<GroundLocation> {
  const roundedLat = Math.round(latitude * 2) / 2;
  const roundedLon = Math.round(longitude * 2) / 2;
  return withCache(`place:${roundedLat}:${roundedLon}`, 15 * 60_000, async () => {
    try {
      const url = new URL("https://api.bigdatacloud.net/data/reverse-geocode-client");
      url.searchParams.set("latitude", String(roundedLat));
      url.searchParams.set("longitude", String(roundedLon));
      url.searchParams.set("localityLanguage", "pt-BR");
      const data = await fetchJson<ReverseGeocodeData>(url.toString(), 6000);
      return toGroundLocation(data);
    } catch {
      return { city: null, country: null, countryCode: null, label: "localização terrestre indisponível", isOceanOrRemote: true };
    }
  });
}

async function getIssProviderSnapshot(): Promise<IssProviderData> {
  return withCache("iss:live", 9000, () => fetchJson<IssProviderData>("https://api.wheretheiss.at/v1/satellites/25544", 12_000));
}

type CelesTrakElements = { line1: string; line2: string };

// TLEs públicos recentes usados somente como último fallback de disponibilidade.
// A fonte online continua sendo tentada primeiro; estes elementos impedem que
// uma falha transitória apague satélites da constelação visual.
const FALLBACK_TLE_ELEMENTS: Record<SatelliteId, CelesTrakElements> = {
  iss: {
    line1: "1 25544U 98067A   26237.66055539  .00007716  00000+0  14485-3 0  9994",
    line2: "2 25544  51.6329 316.2335 0007673  83.1052 277.0809 15.49625410582525",
  },
  hubble: {
    line1: "1 20580U 90037B   26237.62528960  .00006029  00000+0  18532-3 0  9990",
    line2: "2 20580  28.4736 325.7338 0001866 182.2613 177.7975 15.31455744799223",
  },
  tiangong: {
    line1: "1 48274U 21035A   26236.77270977  .00015469  00000+0  19527-3 0  9992",
    line2: "2 48274  41.4680 265.6655 0001614 251.2435 108.8228 15.59231012303878",
  },
  noaa19: {
    line1: "1 33591U 09005A   26189.92327367 -.00000002  00000+0  22819-4 0  9998",
    line2: "2 33591  98.9512 260.8130 0013169 332.9779  27.0706 14.13477619897556",
  },
  noaa20: {
    line1: "1 43013U 17073A   26237.85305610  .00000042  00000+0  40991-4 0  9999",
    line2: "2 43013  98.7790 176.7028 0001981  74.1229 286.0165 14.19522795454352",
  },
  noaa21: {
    line1: "1 54234U 22150A   26236.89789988  .00000005  00000+0  22897-4 0  9999",
    line2: "2 54234  98.7074 174.5360 0002193  31.2755 328.8551 14.19546432196297",
  },
  sentinel1a: {
    line1: "1 39634U 14016A   26237.96212367 -.00000039  00000+0  14167-5 0  9999",
    line2: "2 39634  98.1588 244.4108 0001414  85.7342 274.4020 14.59751896660194",
  },
  landsat9: {
    line1: "1 49260U 21088A   26237.69043066  .00000222  00000+0  59361-4 0  9997",
    line2: "2 49260  98.2231 307.0076 0001339 105.3510 254.7836 14.57100759261128",
  },
  terra: {
    line1: "1 25994U 99068A   26237.87787104  .00000296  00000+0  69194-4 0  9992",
    line2: "2 25994  97.9403 284.6419 0002834  40.1634  70.8131 14.61149167419781",
  },
  aqua: {
    line1: "1 27424U 02022A   26237.91631773  .00000630  00000+0  13496-3 0  9996",
    line2: "2 27424  98.4352 208.6178 0001818  83.3034 300.1915 14.62178439293461",
  },
};

function getFallbackTleElements(satelliteId: SatelliteId) {
  return FALLBACK_TLE_ELEMENTS[satelliteId];
}

async function getCelesTrakElements(satelliteId: Exclude<SatelliteId, "iss">): Promise<CelesTrakElements> {
  const selected = SATELLITE_CATALOG[satelliteId];
  return withCache(`tle-elements:${satelliteId}`, 2 * 60 * 60_000, async () => {
    const response = await fetch(selected.telemetry.endpoint, {
      headers: { Accept: "text/plain", "User-Agent": "Orbita-ISS-Observatory/1.0" },
      signal: AbortSignal.timeout(12_000),
    });
    if (!response.ok) throw new Error(`Elementos orbitais indisponíveis: ${response.status}`);
    const lines = (await response.text()).trim().split(/\r?\n/).filter(Boolean);
    if (lines.length < 3) throw new Error("Elementos orbitais inválidos.");
    return { line1: lines[1], line2: lines[2] };
  });
}

function trajectoryTleEndpoint(satelliteId: SatelliteId) {
  return `https://celestrak.org/NORAD/elements/gp.php?CATNR=${SATELLITE_CATALOG[satelliteId].noradId}&FORMAT=TLE`;
}

async function getTrajectoryElements(satelliteId: SatelliteId): Promise<CelesTrakElements> {
  return withCache(`trajectory-tle-elements:${satelliteId}`, 2 * 60 * 60_000, async () => {
    try {
      const response = await fetch(trajectoryTleEndpoint(satelliteId), {
        headers: { Accept: "text/plain", "User-Agent": "Orbita-ISS-Observatory/1.0" },
        signal: AbortSignal.timeout(12_000),
      });
      if (!response.ok) throw new Error(`Elementos orbitais indisponíveis: ${response.status}`);
      const lines = (await response.text()).trim().split(/\r?\n/).filter(Boolean);
      if (lines.length < 3) throw new Error("Elementos orbitais inválidos.");
      return { line1: lines[1], line2: lines[2] };
    } catch (error) {
      console.warn(`[Orbit] trajetória de ${satelliteId} usando TLE de contingência.`, error instanceof Error ? error.message : error);
      return getFallbackTleElements(satelliteId);
    }
  });
}

function propagateTlePoint(satrec: satellite.SatRec, date: Date): OrbitTrajectoryPoint & { velocity: number } {
  const propagated = satellite.propagate(satrec, date);
  const pos = propagated.position;
  const vel = propagated.velocity;
  if (!pos || !vel || typeof pos === "boolean" || typeof vel === "boolean") {
    throw new Error("Não foi possível propagar a órbita selecionada.");
  }

  const gmst = satellite.gstime(date);
  const geodetic = satellite.eciToGeodetic(pos, gmst);
  return {
    latitude: satellite.degreesLat(geodetic.latitude),
    longitude: normaliseLongitude(satellite.degreesLong(geodetic.longitude)),
    altitude: Math.max(0, geodetic.height),
    velocity: Math.sqrt(vel.x ** 2 + vel.y ** 2 + vel.z ** 2) * 3600,
    timestamp: Math.floor(date.getTime() / 1000),
  };
}

async function propagateTleSnapshot(satelliteId: SatelliteId, { line1, line2 }: CelesTrakElements): Promise<Omit<OrbitSnapshot, "groundLocation">> {
  const selected = SATELLITE_CATALOG[satelliteId];
  const now = new Date();
  const point = propagateTlePoint(satellite.twoline2satrec(line1, line2), now);

  return {
    satellite: selected,
    latitude: point.latitude,
    longitude: point.longitude,
    altitude: point.altitude,
    velocity: point.velocity,
    visibility: "estimativa orbital",
    footprint: null,
    timestamp: point.timestamp,
    sourceUrl: selected.telemetry.endpoint,
  };
}

async function getCelesTrakSnapshot(satelliteId: Exclude<SatelliteId, "iss">) {
  return propagateTleSnapshot(satelliteId, await getCelesTrakElements(satelliteId));
}

async function getFallbackSnapshot(satelliteId: SatelliteId): Promise<OrbitSnapshot> {
  const snapshot = await propagateTleSnapshot(satelliteId, getFallbackTleElements(satelliteId));
  const groundLocation = await resolveGroundLocation(snapshot.latitude, snapshot.longitude);
  return { ...snapshot, groundLocation };
}

export async function getOrbitSnapshot(satelliteId: SatelliteId): Promise<OrbitSnapshot> {
  if (satelliteId === "iss") {
    try {
      const iss = await getIssProviderSnapshot();
      const groundLocation = await resolveGroundLocation(iss.latitude, iss.longitude);
      return {
        satellite: SATELLITE_CATALOG.iss,
        latitude: iss.latitude,
        longitude: iss.longitude,
        altitude: iss.altitude,
        velocity: iss.velocity,
        visibility: iss.visibility,
        footprint: iss.footprint,
        timestamp: iss.timestamp,
        groundLocation,
        sourceUrl: SATELLITE_CATALOG.iss.telemetry.endpoint,
      };
    } catch (error) {
      console.warn(`[Orbit] ISS ao vivo indisponível; usando TLE de contingência.`, error instanceof Error ? error.message : error);
      return getFallbackSnapshot(satelliteId);
    }
  }

  try {
    const snapshot = await getCelesTrakSnapshot(satelliteId);
    const groundLocation = await resolveGroundLocation(snapshot.latitude, snapshot.longitude);
    return { ...snapshot, groundLocation };
  } catch (error) {
    console.warn(`[Orbit] ${satelliteId} indisponível no CelesTrak; usando TLE de contingência.`, error instanceof Error ? error.message : error);
    return getFallbackSnapshot(satelliteId);
  }
}

/**
 * Reúne a constelação disponível em uma única consulta de interface.
 * Falhas pontuais de uma fonte não escondem os demais objetos orbitais.
 */
export async function getOrbitSnapshots(): Promise<OrbitSnapshot[]> {
  const requested = Object.keys(SATELLITE_CATALOG) as SatelliteId[];
  const settled = await Promise.allSettled(requested.map(getOrbitSnapshot));
  return settled.flatMap(result => result.status === "fulfilled" ? [result.value] : []);
}

const TRAJECTORY_DURATION_MINUTES = 120;
const TRAJECTORY_STEP_SECONDS = 60;

export async function getOrbitTrajectory(satelliteId: SatelliteId): Promise<OrbitTrajectory> {
  const elements = await getTrajectoryElements(satelliteId);
  const satrec = satellite.twoline2satrec(elements.line1, elements.line2);
  const generatedAt = Date.now();
  const pointCount = Math.floor((TRAJECTORY_DURATION_MINUTES * 60) / TRAJECTORY_STEP_SECONDS) + 1;
  const points = Array.from({ length: pointCount }, (_, index) => {
    const date = new Date(generatedAt + index * TRAJECTORY_STEP_SECONDS * 1000);
    const point = propagateTlePoint(satrec, date);
    return {
      latitude: point.latitude,
      longitude: point.longitude,
      altitude: point.altitude,
      timestamp: point.timestamp,
    };
  });

  return {
    satellite: SATELLITE_CATALOG[satelliteId],
    points,
    durationMinutes: TRAJECTORY_DURATION_MINUTES,
    generatedAt,
    sourceUrl: trajectoryTleEndpoint(satelliteId),
  };
}

export async function getOrbitTrajectories(satelliteIds: SatelliteId[]): Promise<OrbitTrajectory[]> {
  const uniqueIds = Array.from(new Set(satelliteIds)).slice(0, 4);
  const settled = await Promise.allSettled(uniqueIds.map(getOrbitTrajectory));
  return settled.flatMap(result => result.status === "fulfilled" ? [result.value] : []);
}

export type ObservingConditions = {
  cloudCover: number | null;
  visibilityKm: number | null;
  weatherCode: number | null;
  observedAt: string | null;
  timezone: string | null;
  sourceUrl: string;
};

export async function getObservingConditions(latitude: number, longitude: number): Promise<ObservingConditions> {
  const roundedLat = Math.round(latitude * 10) / 10;
  const roundedLon = Math.round(longitude * 10) / 10;
  return withCache(`weather:${roundedLat}:${roundedLon}`, 15 * 60_000, async () => {
    const url = new URL("https://api.open-meteo.com/v1/forecast");
    url.searchParams.set("latitude", String(roundedLat));
    url.searchParams.set("longitude", String(roundedLon));
    url.searchParams.set("current", "cloud_cover,visibility,weather_code");
    url.searchParams.set("timezone", "auto");
    const data = await fetchJson<WeatherProviderData>(url.toString(), 10_000);
    return {
      cloudCover: typeof data.current?.cloud_cover === "number" ? data.current.cloud_cover : null,
      visibilityKm: typeof data.current?.visibility === "number" ? data.current.visibility / 1000 : null,
      weatherCode: typeof data.current?.weather_code === "number" ? data.current.weather_code : null,
      observedAt: data.current?.time || null,
      timezone: data.timezone_abbreviation || null,
      sourceUrl: "https://open-meteo.com/en/docs",
    };
  });
}

export type UpcomingLaunch = { id: string; name: string; timestamp: string | null; status: string; provider: string; location: string; imageUrl: string | null; sourceUrl: string };

function safeLaunchImage(url: string | undefined) {
  if (!url) return null;
  try {
    const parsed = new URL(url);
    return parsed.protocol === "https:" ? parsed.toString() : null;
  } catch {
    return null;
  }
}

function parseLaunchTime(value: string | undefined) {
  if (!value) return null;
  const timestamp = Date.parse(value);
  return Number.isNaN(timestamp) ? null : timestamp;
}

export async function getUpcomingLaunches(): Promise<UpcomingLaunch[]> {
  return withCache("launches:upcoming", 20 * 60_000, async () => {
    const data = await fetchJson<LaunchProviderData>("https://ll.thespacedevs.com/2.2.0/launch/upcoming/?limit=12", 12_000);
    const upcoming = (data.results || []).filter(launch => {
      const timestamp = parseLaunchTime(launch.net);
      return timestamp === null || timestamp > Date.now();
    });

    return upcoming
      .sort((left, right) => (parseLaunchTime(left.net) ?? Number.POSITIVE_INFINITY) - (parseLaunchTime(right.net) ?? Number.POSITIVE_INFINITY))
      .slice(0, 3)
      .map((launch, index) => ({
        id: launch.id || `launch-${index}`,
        name: launch.name?.slice(0, 180) || "Lançamento a confirmar",
        timestamp: parseLaunchTime(launch.net) === null ? null : launch.net || null,
        status: launch.status?.name || "horário a confirmar",
        provider: launch.launch_service_provider?.name || "provedor não informado",
        location: launch.pad?.location?.name || "local não informado",
        imageUrl: safeLaunchImage(launch.image?.image_url),
        sourceUrl: "https://ll.thespacedevs.com/",
      }));
  });
}

function distanceKm(latitudeA: number, longitudeA: number, latitudeB: number, longitudeB: number) {
  const radians = (angle: number) => (angle * Math.PI) / 180;
  const earthRadius = 6371;
  const deltaLat = radians(latitudeB - latitudeA);
  const deltaLon = radians(longitudeB - longitudeA);
  const a = Math.sin(deltaLat / 2) ** 2 + Math.cos(radians(latitudeA)) * Math.cos(radians(latitudeB)) * Math.sin(deltaLon / 2) ** 2;
  return earthRadius * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export async function getIssClosestPass(latitude: number, longitude: number) {
  const start = Math.floor(Date.now() / 1000) + 60;
  const timestamps = Array.from({ length: 10 }, (_, index) => start + index * 720).join(",");
  const positions = await withCache(`iss:forecast:${Math.floor(start / 600)}`, 60_000, () =>
    fetchJson<IssProviderData[]>(`https://api.wheretheiss.at/v1/satellites/25544/positions?timestamps=${timestamps}&units=kilometers`),
  );
  return positions
    .map(position => ({ ...position, distance: distanceKm(latitude, longitude, position.latitude, position.longitude) }))
    .reduce((closest, position) => (position.distance < closest.distance ? position : closest));
}

function safeNasaImage(url: string | undefined) {
  if (!url) return null;
  try {
    const parsed = new URL(url);
    return parsed.protocol === "https:" && (parsed.hostname.endsWith("nasa.gov") || parsed.hostname.endsWith("nasa.gov")) ? parsed.toString() : null;
  } catch {
    return null;
  }
}

export type SpaceStory = {
  title: string;
  date: string;
  explanation: string;
  imageUrl: string | null;
  credit: string;
  sourceUrl: string;
};

function nasaFallbackStory(date = new Date().toISOString().slice(0, 10)): SpaceStory {
  return {
    title: "O arquivo do cosmos está em pausa.",
    date,
    explanation: "As fontes astronômicas públicas não responderam agora. O rastreamento orbital continua disponível e esta leitura pode ser atualizada novamente mais tarde.",
    imageUrl: null,
    credit: "Fontes públicas NASA",
    sourceUrl: "https://images.nasa.gov/",
  };
}

let latestSpaceStory: SpaceStory | null = null;
let nasaRetryAfter = 0;

function isRateLimitError(error: unknown) {
  return error instanceof Error && (error.message.endsWith(": 429") || error.message.includes("429"));
}

function cleanStoryText(value: string | undefined, fallback: string) {
  return value?.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().slice(0, 560) || fallback;
}

function appearsToBePortuguese(value: string) {
  return /[ãõáéíóúàâêôç]/i.test(value) || /\b(arquivo|imagem|estrela|estrelas|galáxia|universo|telescópio|missão|nebulosa|planeta|observação|fotografia|para|uma|um|dos|das)\b/i.test(value);
}

async function translateStoryText(value: string) {
  const text = cleanStoryText(value, "");
  if (!text || appearsToBePortuguese(text)) return text;

  const cacheKey = `translation:pt:${text}`;
  return withCache(cacheKey, 24 * 60 * 60_000, async () => {
    try {
      const url = new URL("https://api.mymemory.translated.net/get");
      url.searchParams.set("q", text);
      url.searchParams.set("langpair", "en|pt");
      const data = await fetchJson<TranslationProviderData>(url.toString(), 5000);
      if (data.responseStatus !== undefined && data.responseStatus !== 200) throw new Error(`Tradutor indisponível: ${data.responseStatus}`);
      return cleanStoryText(data.responseData?.translatedText, text);
    } catch {
      // A curiosidade continua disponível no idioma original se o tradutor público falhar.
      return text;
    }
  });
}

async function localizeSpaceStory(story: SpaceStory): Promise<SpaceStory> {
  const [title, explanation] = await Promise.all([
    translateStoryText(story.title),
    translateStoryText(story.explanation),
  ]);
  const credit = story.credit === "NASA Image and Video Library" ? "Biblioteca de imagens e vídeos da NASA" : story.credit;
  return { ...story, title, explanation, credit };
}

async function getNasaImageLibraryStory(dateKey: string): Promise<SpaceStory> {
  const story = await withCache(`nasa:images:${dateKey}`, 24 * 60 * 60_000, async () => {
    const url = new URL("https://images-api.nasa.gov/search");
    url.searchParams.set("q", "space astronomy cosmos");
    url.searchParams.set("media_type", "image");
    url.searchParams.set("page_size", "50");
    const data = await fetchJson<NasaImageLibraryProviderData>(url.toString(), 8000);
    const candidates = (data.collection?.items || []).map(item => {
      const record = item.data?.find(entry => entry.media_type === "image") || item.data?.[0];
      const imageLink = item.links?.find(link => link.render === "image" && link.rel === "canonical") || item.links?.find(link => link.render === "image");
      return {
        id: record?.nasa_id,
        title: record?.title,
        date: record?.date_created?.slice(0, 10),
        explanation: record?.description,
        imageUrl: safeNasaImage(imageLink?.href),
      };
    }).filter(candidate => candidate.id && candidate.title && candidate.imageUrl);

    if (!candidates.length) throw new Error("A NASA Image Library não retornou imagens utilizáveis");
    const hash = dateKey.split("").reduce((total, character) => total + character.charCodeAt(0), 0);
    const selected = candidates[hash % candidates.length];
    return {
      title: selected.title!.slice(0, 160),
      date: selected.date || dateKey,
      explanation: cleanStoryText(selected.explanation, "Uma imagem selecionada do arquivo público da NASA para acompanhar a leitura do cosmos."),
      imageUrl: selected.imageUrl,
      credit: "NASA Image and Video Library",
      sourceUrl: `https://images.nasa.gov/details/${encodeURIComponent(selected.id!)}`,
    };
  });
  return localizeSpaceStory(story);
}

export async function getSpaceStory(): Promise<SpaceStory> {
  const dateKey = new Date().toISOString().slice(0, 10);
  const fallback = latestSpaceStory?.date === dateKey ? latestSpaceStory : nasaFallbackStory(dateKey);
  const apiKey = process.env.NASA_API_KEY?.trim();

  if (!apiKey) {
    try {
      const story = await getNasaImageLibraryStory(dateKey);
      latestSpaceStory = story;
      return story;
    } catch {
      return fallback;
    }
  }

  if (nasaRetryAfter > Date.now()) return fallback;

  try {
    const story = await withCache(`nasa:apod:${dateKey}`, 6 * 60 * 60_000, async () => {
      const data = await fetchJson<ApodProviderData>(`https://api.nasa.gov/planetary/apod?api_key=${encodeURIComponent(apiKey)}`, 8000);
      return {
        title: data.title?.slice(0, 160) || "Imagem astronômica do dia",
        date: data.date || dateKey,
        explanation: cleanStoryText(data.explanation, "A NASA não forneceu uma explicação para esta entrada."),
        imageUrl: data.media_type === "image" ? safeNasaImage(data.url) : null,
        credit: data.copyright?.slice(0, 160) || "NASA",
        sourceUrl: "https://api.nasa.gov/",
      };
    });
    const localizedStory = await localizeSpaceStory(story);
    latestSpaceStory = localizedStory;
    return localizedStory;
  } catch (error) {
    if (isRateLimitError(error)) nasaRetryAfter = Date.now() + 15 * 60_000;
    console.warn(`[NASA APOD] Fonte temporariamente indisponível${isRateLimitError(error) ? " (429)" : ""}.`);
    try {
      const story = await getNasaImageLibraryStory(dateKey);
      latestSpaceStory = story;
      return story;
    } catch {
      return fallback;
    }
  }
}

// ─────────────────────────────────────────────────────────────
// EPIC — Earth Polychromatic Imaging Camera (DSCOVR satellite)
// ─────────────────────────────────────────────────────────────

type EpicImage = {
  identifier: string;
  caption: string;
  image: string;
  version: string;
  centroid_coordinates: { lat: number; lon: number };
  dscovr_j2000_position: { x: number; y: number; z: number };
  lunar_j2000_position: { x: number; y: number; z: number };
  sun_j2000_position: { x: number; y: number; z: number };
  attitud: { q0: number; q1: number; q2: number; q3: number };
};

export type EpicImageInfo = {
  id: string;
  caption: string;
  imageUrl: string;
  date: string;
  centroidLat: number;
  centroidLon: number;
};

export async function getEpicImages(): Promise<EpicImageInfo[]> {
  return withCache("nasa:epic:daily", 30 * 60_000, async () => {
    const apiKey = process.env.NASA_API_KEY;
    if (!apiKey) return [];
    const data = await fetchJson<EpicImage[]>(
      `https://api.nasa.gov/EPIC/api/natural/images?api_key=${encodeURIComponent(apiKey)}`,
      10_000,
    );
    return (data || []).slice(0, 8).map(img => {
      // identifier format: "20240115004831" → extract date parts
      const id = img.identifier || "";
      const year = id.slice(0, 4) || new Date().getFullYear().toString();
      const month = id.slice(4, 6) || "01";
      const day = id.slice(6, 8) || "01";
      return {
        id: img.identifier,
        caption: img.caption?.slice(0, 200) || "Foto da Terra",
        imageUrl: `https://epic.gsfc.nasa.gov/archive/natural/${year}/${month}/${day}/png/${img.image}.png`,
        date: `${year}-${month}-${day}`,
        centroidLat: img.centroid_coordinates?.lat ?? 0,
        centroidLon: img.centroid_coordinates?.lon ?? 0,
      };
    });
  });
}

// ─────────────────────────────────────────────────────────────
// DONKI — Space Weather Database Of Notifications
// ─────────────────────────────────────────────────────────────

type DonkiNotification = {
  messageID: string;
  message_type: string;
  messageIssueTime: string;
  messageBody: string;
};

export type SpaceWeatherEvent = {
  id: string;
  type: string;
  typeLabel: string;
  summary: string;
  timestamp: string;
  sourceUrl: string;
};

const DONKI_TYPE_LABELS: Record<string, string> = {
  CME: "Ejeção de massa coronal",
  "IPS": "Interferência de plasma",
  GST: "Tempestade geomagnética",
  "FLR": "Explosão solar",
  "SEP": "Partículas solares energéticas",
  MPC: "Microwaveburst",
  NTE: "Evento de rádio terrestre",
  RBE: "Emissão de rádio",
};

export async function getSpaceWeather(): Promise<SpaceWeatherEvent[]> {
  return withCache("nasa:donki", 30 * 60_000, async () => {
    const apiKey = process.env.NASA_API_KEY;
    if (!apiKey) return [];
    const endDate = new Date().toISOString().slice(0, 10);
    const startDate = new Date(Date.now() - 7 * 86_400_000).toISOString().slice(0, 10);
    const data = await fetchJson<DonkiNotification[]>(
      `https://api.nasa.gov/DONKI/api/v2/notifications?start_date=${startDate}&end_date=${endDate}&type=all&api_key=${encodeURIComponent(apiKey)}`,
      12_000,
    );
    return (data || []).slice(0, 12).map(n => ({
      id: n.messageID,
      type: n.message_type,
      typeLabel: DONKI_TYPE_LABELS[n.message_type] || n.message_type,
      summary: n.messageBody?.replace(/\s+/g, " ").trim().slice(0, 280) || "Notificação de clima espacial",
      timestamp: n.messageIssueTime || new Date().toISOString(),
      sourceUrl: "https://api.nasa.gov/",
    }));
  });
}

// ─────────────────────────────────────────────────────────────
// NeoWs — Near Earth Object Web Service
// ─────────────────────────────────────────────────────────────

type NeoFeedData = {
  element_count: number;
  near_earth_objects: Record<string, Array<{
    id: string;
    name: string;
    nasa_jpl_url: string;
    absolute_magnitude_h: number;
    estimated_diameter: { kilometers: { estimated_diameter_min: number; estimated_diameter_max: number } };
    is_potentially_hazardous_asteroid: boolean;
    close_approach_data: Array<{
      close_approach_date: string;
      relative_velocity: { kilometers_per_hour: string };
      miss_distance: { kilometers: string };
    }>;
  }>>;
};

export type NearEarthAsteroid = {
  id: string;
  name: string;
  diameterKmMin: number;
  diameterKmMax: number;
  missDistanceKm: number;
  velocityKmh: number;
  approachDate: string;
  isHazardous: boolean;
  nasaUrl: string;
};

export async function getNearEarthAsteroids(): Promise<NearEarthAsteroid[]> {
  return withCache("nasa:neo:feed", 60 * 60_000, async () => {
    const apiKey = process.env.NASA_API_KEY;
    if (!apiKey) return [];
    const data = await fetchJson<NeoFeedData>(
      `https://api.nasa.gov/neo/rest/v1/feed?api_key=${encodeURIComponent(apiKey)}`,
      15_000,
    );
    const asteroids: NearEarthAsteroid[] = [];
    for (const [, objects] of Object.entries(data.near_earth_objects || {})) {
      for (const obj of objects) {
        const approach = obj.close_approach_data?.[0];
        if (!approach) continue;
        asteroids.push({
          id: obj.id,
          name: obj.name?.replace(/[()]/g, "").trim() || "Asteróide",
          diameterKmMin: obj.estimated_diameter?.kilometers?.estimated_diameter_min ?? 0,
          diameterKmMax: obj.estimated_diameter?.kilometers?.estimated_diameter_max ?? 0,
          missDistanceKm: parseFloat(approach.miss_distance?.kilometers || "0"),
          velocityKmh: parseFloat(approach.relative_velocity?.kilometers_per_hour || "0"),
          approachDate: approach.close_approach_date || new Date().toISOString().slice(0, 10),
          isHazardous: obj.is_potentially_hazardous_asteroid || false,
          nasaUrl: obj.nasa_jpl_url || "https://neo.jpl.nasa.gov/",
        });
      }
    }
    return asteroids
      .sort((a, b) => a.missDistanceKm - b.missDistanceKm)
      .slice(0, 10);
  });
}

export type PlaceImage = {
  imageUrl: string;
  labelsUrl: string | null;
  provider: "Google Maps" | "ArcGIS World Imagery";
  attribution: string;
  attributionUrl: string;
};

function arcGisExportUrl(service: string, latitude: number, longitude: number, format: "jpg" | "png", transparent: boolean) {
  const deltaLat = 3;
  const deltaLng = 5;
  const south = Math.max(-90, latitude - deltaLat);
  const north = Math.min(90, latitude + deltaLat);
  const west = Math.max(-180, longitude - deltaLng);
  const east = Math.min(180, longitude + deltaLng);
  const url = new URL(`https://server.arcgisonline.com/ArcGIS/rest/services/${service}/export`);
  url.searchParams.set("bbox", `${west},${south},${east},${north}`);
  url.searchParams.set("bboxSR", "4326");
  url.searchParams.set("size", "520,320");
  url.searchParams.set("imageSR", "4326");
  url.searchParams.set("format", format);
  url.searchParams.set("transparent", String(transparent));
  url.searchParams.set("f", "image");
  return url.toString();
}

/**
 * Gera a imagem terrestre em duas camadas: satélite e rótulos geográficos.
 * Sem chave, usa os endpoints públicos do ArcGIS World Imagery e World
 * Boundaries and Places; o cliente empilha a camada transparente sobre a base.
 */
export async function getPlaceImage(latitude: number, longitude: number): Promise<PlaceImage> {
  const googleKey = process.env.GOOGLE_MAPS_API_KEY;

  if (googleKey) {
    return {
      imageUrl: `https://maps.googleapis.com/maps/api/staticmap?center=${latitude},${longitude}&zoom=6&size=520x320&maptype=satellite&key=${encodeURIComponent(googleKey)}`,
      labelsUrl: null,
      provider: "Google Maps",
      attribution: "© Google Maps",
      attributionUrl: "https://developers.google.com/maps/documentation/maps-static/overview",
    };
  }

  return {
    imageUrl: arcGisExportUrl("World_Imagery/MapServer", latitude, longitude, "jpg", false),
    labelsUrl: arcGisExportUrl("Reference/World_Boundaries_and_Places/MapServer", latitude, longitude, "png", true),
    provider: "ArcGIS World Imagery",
    attribution: "© Esri · World Imagery · World Boundaries and Places",
    attributionUrl: "https://www.esri.com/en-us/legal/terms/data-attributions",
  };
}
