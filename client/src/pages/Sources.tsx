import { ArrowLeft, Database } from "lucide-react";
import { TextReveal } from "@/components/TextReveal";
import { RevealText } from "@/components/RevealText";

const sources = [
  ["Where the ISS at?", "Posição, velocidade, altitude e iluminação da ISS.", "https://wheretheiss.at/w/developer"],
  ["CelesTrak", "Elementos orbitais públicos propagados para Hubble, Tiangong, NOAA 19, NOAA 20, NOAA 21, Sentinel-1A, Landsat 9, Terra e Aqua.", "https://celestrak.org/NORAD/documentation/gp-data-formats.php"],
  ["NASA / NOAA JPSS", "Imagens de referência dos satélites meteorológicos NOAA 20 (JPSS-1) e NOAA 21 (JPSS-2).", "https://science.nasa.gov/mission/jpss/"],
  ["ESA Sentinel-1", "Imagem de referência do radar de observação da Terra Sentinel-1A.", "https://www.esa.int/Applications/Observing_the_Earth/Copernicus/Sentinel-1/Time_to_say_goodbye_to_Sentinel-1A"],
  ["NASA / USGS Landsat", "Imagem de referência do satélite de observação da Terra Landsat 9.", "https://www.usgs.gov/landsat-missions/landsat-9"],
  ["NASA Earth Science", "Imagens de referência dos satélites Terra (EOS AM-1) e Aqua (EOS PM-1).", "https://earthobservatory.nasa.gov/features/Orbits"],
  ["NASA EPIC", "Fotografias diárias da Terra capturadas pelo satélite DSCOVR a 1,5 milhão de km.", "https://epic.gsfc.nasa.gov/"],
  ["NASA DONKI", "Alertas de clima espacial: erupções solares, ejeções de massa coronal e tempestades geomagnéticas.", "https://api.nasa.gov/"],
  ["NASA NeoWs", "Asteroides e objetos próximos da Terra com dados de diâmetro, velocidade e distância.", "https://neo.jpl.nasa.gov/"],
  ["NASA Open APIs", "Curiosidade astronômica diária e crédito de conteúdo.", "https://images.nasa.gov/"],
  ["MyMemory Translation API", "Tradução automática opcional do título e da explicação da curiosidade para português.", "https://mymemory.translated.net/doc/spec.php"],
  ["Open-Meteo", "Condições meteorológicas locais: cobertura de nuvens e visibilidade.", "https://open-meteo.com/en/docs"],
  ["BigDataCloud", "Geocodificação reversa do ponto suborbital e do horizonte local.", "https://www.bigdatacloud.com/"],
  ["The Space Devs", "Agenda de próximos lançamentos espaciais.", "https://ll.thespacedevs.com/"],
  ["ArcGIS World Imagery", "Imagem de satélite e camada transparente de fronteiras e nomes de países para o retrato terrestre.", "https://www.esri.com/en-us/legal/terms/data-attributions"],
];

export default function Sources() {
  return <main className="legal-shell"><TextReveal as="header" className="legal-header" delay={20}><a href="/" className="brand-mark"><img src="/assets/orbita-logo_99dcd0cb.svg" alt="" className="brand-symbol" /><span>órbita</span></a><a href="/" className="legal-back"><ArrowLeft size={16} /> voltar ao observatório</a></TextReveal><TextReveal as="article" className="legal-document" delay={80}><p className="eyebrow"><Database size={15} /> Metodologia</p><RevealText as="h1" segments={[{ text: "Fontes e limites" }]} /><p className="legal-lede">A Órbita agrega sinais de fontes públicas e apresenta uma leitura editorial. Cada fonte segue seu próprio ritmo de atualização e disponibilidade.</p><div className="source-table stagger-list">{sources.map(([name, description, url]) => <a key={name} href={url} target="_blank" rel="noreferrer"><strong>{name}</strong><span>{description}</span></a>)}</div><section><RevealText as="h2" segments={[{ text: "Como interpretamos a localização" }]} /><p>O ponto mostrado é uma projeção aproximada do satélite sobre a superfície da Terra. Cidade e país são retornados por geocodificação reversa e podem ser imprecisos sobre oceanos, regiões remotas, fronteiras ou áreas sem localidade identificada.</p></section><section><RevealText as="h2" segments={[{ text: "Atualização e continuidade" }]} /><p>O servidor aplica cache, tempo máximo de resposta e limites de consulta para respeitar as fontes públicas e reduzir falhas. As imagens terrestres combinam o ArcGIS World Imagery com a camada transparente World Boundaries and Places, que adiciona fronteiras e nomes de países. Quando uma fonte não responder, o observatório informa a indisponibilidade em vez de mostrar uma leitura inventada.</p></section></TextReveal></main>;
}
