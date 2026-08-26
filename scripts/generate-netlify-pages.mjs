import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const publicDir = path.resolve("dist/public");
const siteOrigin = "https://satellite-now.netlify.app";
const defaultImage = `${siteOrigin}/og-image.png`;

const routes = {
  "/": {
    title: "Órbita — ISS acima de você",
    description: "Acompanhe a posição da Estação Espacial Internacional e descubra sua próxima aproximação.",
    noIndex: false,
  },
  "/privacidade": {
    title: "Privacidade — Órbita",
    description: "Como o observatório Órbita trata localização, publicidade e preferências de privacidade.",
    noIndex: false,
  },
  "/termos": {
    title: "Termos de uso — Órbita",
    description: "Termos e limites de uso do observatório orbital Órbita.",
    noIndex: false,
  },
  "/fontes": {
    title: "Fontes e limites — Órbita",
    description: "Fontes públicas e limites dos dados orbitais apresentados pelo Órbita.",
    noIndex: false,
  },
  "/404": {
    title: "Página não encontrada — Órbita",
    description: "A rota solicitada não existe no observatório Órbita.",
    noIndex: true,
  },
};

const routeContent = {
  "/": `<main class="seo-static-content" aria-label="Órbita">
    <h1>Órbita — ISS acima de você</h1>
    <p>Acompanhe a posição da Estação Espacial Internacional e descubra sua próxima aproximação.</p>
    <p>Explore dados públicos de satélites, localização suborbital e fontes do observatório.</p>
    <nav aria-label="Páginas públicas"><a href="/fontes">fontes e limites</a><a href="/privacidade">política de privacidade</a><a href="/termos">termos de uso</a></nav>
  </main>`,
  "/privacidade": `<main class="seo-static-content" aria-label="Política de privacidade">
    <h1>Política de privacidade</h1>
    <p>A Órbita foi desenhada para consultar dados públicos de satélites sem criar um perfil de quem observa o céu.</p>
    <h2>Localização do dispositivo</h2><p>A localização só é solicitada após ação explícita e não é gravada em banco de dados.</p>
    <h2>Publicidade, analytics e preferências</h2><p>A publicidade e a medição opcional do uso são bloqueadas por padrão e dependem da escolha do visitante.</p>
  </main>`,
  "/termos": `<main class="seo-static-content" aria-label="Termos de uso">
    <h1>Termos de uso</h1>
    <p>A Órbita é uma ferramenta educativa e de acompanhamento visual de dados orbitais públicos.</p>
    <h2>Natureza da informação</h2><p>Posições, velocidades e estimativas de localidade podem sofrer atraso ou indisponibilidade da fonte.</p>
    <h2>Publicação responsável</h2><p>Não use o serviço para navegação, segurança operacional ou decisões críticas.</p>
  </main>`,
  "/fontes": `<main class="seo-static-content" aria-label="Fontes e limites">
    <h1>Fontes e limites</h1>
    <p>A Órbita agrega sinais de fontes públicas e apresenta uma leitura editorial.</p>
    <h2>Fontes principais</h2><nav aria-label="Fontes públicas"><a href="https://wheretheiss.at/w/developer">Where the ISS at?</a><a href="https://celestrak.org/NORAD/documentation/gp-data-formats.php">CelesTrak</a><a href="https://api.nasa.gov/">NASA Open APIs</a><a href="https://open-meteo.com/en/docs">Open-Meteo</a></nav>
  </main>`,
  "/404": `<main class="seo-static-content" aria-label="Página não encontrada">
    <h1>Página não encontrada — Órbita</h1>
    <p>A rota solicitada não existe no observatório Órbita.</p>
    <a href="/">voltar ao observatório</a>
  </main>`,
};

function escapeHtml(value) {
  return value.replace(/[&<>'"]/g, character => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "'": "&#39;",
    '"': "&quot;",
  })[character] || character);
}

function seoMarkup(route, metadata) {
  const title = escapeHtml(metadata.title);
  const description = escapeHtml(metadata.description);
  const canonical = `${siteOrigin}${route === "/404" ? "/404" : route}`;
  const robots = metadata.noIndex ? "noindex, nofollow" : "index, follow";
  return `<!-- route-seo:start -->
    <meta name="robots" content="${robots}" />
    <meta name="description" content="${description}" />
    <link rel="canonical" href="${canonical}" />
    <meta property="og:type" content="website" />
    <meta property="og:locale" content="pt_BR" />
    <meta property="og:site_name" content="Órbita" />
    <meta property="og:title" content="${title}" />
    <meta property="og:description" content="${description}" />
    <meta property="og:url" content="${canonical}" />
    <meta property="og:image" content="${defaultImage}" />
    <meta name="twitter:card" content="summary" />
    <meta name="twitter:title" content="${title}" />
    <meta name="twitter:description" content="${description}" />
    <meta name="twitter:image" content="${defaultImage}" />
    <title>${title}</title>
    <!-- route-seo:end -->`;
}

function render(template, route) {
  const metadata = routes[route];
  if (!metadata) throw new Error(`Rota sem metadados: ${route}`);
  const content = routeContent[route];
  if (!content) throw new Error(`Rota sem conteúdo estático: ${route}`);
  return template
    .replace(/<!-- route-seo:start -->[\s\S]*?<!-- route-seo:end -->/, seoMarkup(route, metadata))
    .replace(/<!-- route-content:start -->[\s\S]*?<!-- route-content:end -->/, `<!-- route-content:start -->\n      ${content}\n      <!-- route-content:end -->`);
}

const template = await readFile(path.join(publicDir, "index.html"), "utf8");
await writeFile(path.join(publicDir, "index.html"), render(template, "/"));
await writeFile(path.join(publicDir, "404.html"), render(template, "/404"));

for (const route of ["/privacidade", "/termos", "/fontes"]) {
  const routeDir = path.join(publicDir, route.slice(1));
  await mkdir(routeDir, { recursive: true });
  await writeFile(path.join(routeDir, "index.html"), render(template, route));
}

console.log("Páginas Netlify geradas: /, /privacidade, /termos, /fontes e /404.");
