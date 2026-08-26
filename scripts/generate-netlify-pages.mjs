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
  return template.replace(/<!-- route-seo:start -->[\s\S]*?<!-- route-seo:end -->/, seoMarkup(route, metadata));
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
