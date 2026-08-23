import { ArrowLeft, Database } from "lucide-react";

const sources = [
  ["Where the ISS at?", "Posição, velocidade, altitude e iluminação da ISS.", "https://wheretheiss.at/w/developer"],
  ["CelesTrak", "Elementos orbitais públicos propagados para Hubble, Tiangong e NOAA 19.", "https://celestrak.org/NORAD/documentation/gp-data-formats.php"],
  ["NASA Open APIs", "Curiosidade astronômica diária e crédito de conteúdo.", "https://api.nasa.gov/"],
  ["BigDataCloud", "Geocodificação reversa do ponto suborbital e do horizonte local.", "https://www.bigdatacloud.com/"],
];

export default function Sources() {
  return <main className="legal-shell"><header className="legal-header"><a href="/" className="brand-mark"><img src="/manus-storage/orbita-logo_99dcd0cb.svg" alt="" className="brand-symbol" /><span>órbita</span></a><a href="/" className="legal-back"><ArrowLeft size={16} /> voltar ao observatório</a></header><article className="legal-document"><p className="eyebrow"><Database size={15} /> Metodologia</p><h1>Fontes e limites</h1><p className="legal-lede">A Órbita agrega sinais de fontes públicas e apresenta uma leitura editorial. Cada fonte segue seu próprio ritmo de atualização e disponibilidade.</p><div className="source-table">{sources.map(([name, description, url]) => <a key={name} href={url} target="_blank" rel="noreferrer"><strong>{name}</strong><span>{description}</span></a>)}</div><section><h2>Como interpretamos a localização</h2><p>O ponto mostrado é uma projeção aproximada do satélite sobre a superfície da Terra. Cidade e país são retornados por geocodificação reversa e podem ser imprecisos sobre oceanos, regiões remotas, fronteiras ou áreas sem localidade identificada.</p></section><section><h2>Atualização e continuidade</h2><p>O servidor aplica cache, tempo máximo de resposta e limites de consulta para respeitar as fontes públicas e reduzir falhas. Quando uma fonte não responder, o observatório informa a indisponibilidade em vez de mostrar uma leitura inventada.</p></section></article></main>;
}
