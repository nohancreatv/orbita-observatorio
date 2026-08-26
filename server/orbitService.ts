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

type CacheEntry<T> = { value: T; expiresAt: number; staleUntil: number };
const cache = new Map<string, CacheEntry<unknown>>();
const inFlight = new Map<string, Promise<unknown>>();

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

async function getCelesTrakSnapshot(satelliteId: Exclude<SatelliteId, "iss">): Promise<Omit<OrbitSnapshot, "groundLocation">> {
  const selected = SATELLITE_CATALOG[satelliteId];
  const { line1, line2 } = await getCelesTrakElements(satelliteId);
  const satrec = satellite.twoline2satrec(line1, line2);
  const now = new Date();
  const propagated = satellite.propagate(satrec, now);
  const pos = propagated.position;
  const vel = propagated.velocity;
  if (!pos || !vel || typeof pos === "boolean" || typeof vel === "boolean") {
    throw new Error("Não foi possível propagar a órbita selecionada.");
  }

  const gmst = satellite.gstime(now);
  const geodetic = satellite.eciToGeodetic(pos, gmst);
  const velocity = Math.sqrt(
    vel.x ** 2 + vel.y ** 2 + vel.z ** 2,
  ) * 3600;

  return {
    satellite: selected,
    latitude: satellite.degreesLat(geodetic.latitude),
    longitude: normaliseLongitude(satellite.degreesLong(geodetic.longitude)),
    altitude: Math.max(0, geodetic.height),
    velocity,
    visibility: "estimativa orbital",
    footprint: null,
    timestamp: Math.floor(now.getTime() / 1000),
    sourceUrl: selected.telemetry.endpoint,
  };
}

export async function getOrbitSnapshot(satelliteId: SatelliteId): Promise<OrbitSnapshot> {
  if (satelliteId === "iss") {
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
  }

  const snapshot = await getCelesTrakSnapshot(satelliteId);
  const groundLocation = await resolveGroundLocation(snapshot.latitude, snapshot.longitude);
  return { ...snapshot, groundLocation };
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
    explanation: "A NASA Open APIs não respondeu agora. O rastreamento orbital continua disponível e esta leitura pode ser atualizada novamente mais tarde.",
    imageUrl: null,
    credit: "NASA Open APIs",
    sourceUrl: "https://api.nasa.gov/",
  };
}

let latestSpaceStory: SpaceStory | null = null;
let nasaRetryAfter = 0;

function isRateLimitError(error: unknown) {
  return error instanceof Error && (error.message.endsWith(": 429") || error.message.includes("429"));
}

export async function getSpaceStory(): Promise<SpaceStory> {
  const dateKey = new Date().toISOString().slice(0, 10);
  const fallback = latestSpaceStory?.date === dateKey ? latestSpaceStory : nasaFallbackStory(dateKey);
  if (nasaRetryAfter > Date.now()) return fallback;

  try {
    const story = await withCache(`nasa:apod:${dateKey}`, 6 * 60 * 60_000, async () => {
      const apiKey = process.env.NASA_API_KEY;
      if (!apiKey?.trim()) return fallback;
      const data = await fetchJson<ApodProviderData>(`https://api.nasa.gov/planetary/apod?api_key=${encodeURIComponent(apiKey)}`, 8000);
      return {
        title: data.title?.slice(0, 160) || "Imagem astronômica do dia",
        date: data.date || dateKey,
        explanation: data.explanation?.replace(/\s+/g, " ").trim().slice(0, 560) || "A NASA não forneceu uma explicação para esta entrada.",
        imageUrl: data.media_type === "image" ? safeNasaImage(data.url) : null,
        credit: data.copyright?.slice(0, 160) || "NASA",
        sourceUrl: "https://api.nasa.gov/",
      };
    });
    latestSpaceStory = story;
    return story;
  } catch (error) {
    if (isRateLimitError(error)) nasaRetryAfter = Date.now() + 15 * 60_000;
    console.warn(`[NASA APOD] Fonte temporariamente indisponível${isRateLimitError(error) ? " (429)" : ""}.`);
    return fallback;
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
