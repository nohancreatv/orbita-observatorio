import express, { type Express } from "express";
import fs from "fs";
import { type Server } from "http";
import { nanoid } from "nanoid";
import path from "path";
import { createServer as createViteServer } from "vite";
import viteConfig from "../../vite.config";

const SITE_ORIGIN = "https://satellite-now.netlify.app";
const DEFAULT_IMAGE = `${SITE_ORIGIN}/assets/orbita-logo_99dcd0cb.svg`;

type SeoMetadata = { title: string; description: string; path: string; noIndex?: boolean };

const seoRoutes: Record<string, SeoMetadata> = {
  "/": { title: "Órbita — ISS acima de você", description: "Acompanhe a posição da Estação Espacial Internacional e descubra sua próxima aproximação.", path: "/" },
  "/privacidade": { title: "Privacidade — Órbita", description: "Como o observatório Órbita trata localização, publicidade e preferências de privacidade.", path: "/privacidade" },
  "/termos": { title: "Termos de uso — Órbita", description: "Termos e limites de uso do observatório orbital Órbita.", path: "/termos" },
  "/fontes": { title: "Fontes e limites — Órbita", description: "Fontes públicas e limites dos dados orbitais apresentados pelo Órbita.", path: "/fontes" },
};

function responseStatus(pathname: string) {
  return seoRoutes[pathname] ? 200 : 404;
};

const routeContent: Record<string, string> = {
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

function escapeHtml(value: string) {
  return value.replace(/[&<>'"]/g, character => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[character] || character);
}

function routeSeo(pathname: string): SeoMetadata {
  return seoRoutes[pathname] || { title: "Página não encontrada — Órbita", description: "A rota solicitada não existe no observatório Órbita.", path: "/404", noIndex: true };
}

function seoMarkup(metadata: SeoMetadata) {
  const title = escapeHtml(metadata.title);
  const description = escapeHtml(metadata.description);
  const canonical = `${SITE_ORIGIN}${metadata.path}`;
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
    <meta property="og:image" content="${DEFAULT_IMAGE}" />
    <meta name="twitter:card" content="summary" />
    <meta name="twitter:title" content="${title}" />
    <meta name="twitter:description" content="${description}" />
    <meta name="twitter:image" content="${DEFAULT_IMAGE}" />
    <title>${title}</title>
    <!-- route-seo:end -->`;
}

function injectRouteSeo(template: string, pathname: string) {
  const route = seoRoutes[pathname] ? pathname : "/404";
  return template
    .replace(/<!-- route-seo:start -->[\s\S]*?<!-- route-seo:end -->/, seoMarkup(routeSeo(pathname)))
    .replace(/<!-- route-content:start -->[\s\S]*?<!-- route-content:end -->/, `<!-- route-content:start -->\n      ${routeContent[route]}\n      <!-- route-content:end -->`);
}

export async function setupVite(app: Express, server: Server) {
  const serverOptions = {
    middlewareMode: true,
    hmr: { server },
    allowedHosts: true as const,
  };

  const vite = await createViteServer({
    ...viteConfig,
    configFile: false,
    server: serverOptions,
    appType: "custom",
  });

  app.use(vite.middlewares);
  app.use("*", async (req, res, next) => {
    const url = req.originalUrl;

    try {
      const clientTemplate = path.resolve(
        import.meta.dirname,
        "../..",
        "client",
        "index.html"
      );

      // always reload the index.html file from disk incase it changes
      let template = await fs.promises.readFile(clientTemplate, "utf-8");
      template = injectRouteSeo(template, new URL(url, "http://localhost").pathname).replace(
        `src="/src/main.tsx"`,
        `src="/src/main.tsx?v=${nanoid()}"`
      );
      const page = await vite.transformIndexHtml(url, template);
      const pathname = new URL(url, "http://localhost").pathname;
      res.status(responseStatus(pathname)).set({ "Content-Type": "text/html" }).end(page);
    } catch (e) {
      vite.ssrFixStacktrace(e as Error);
      next(e);
    }
  });
}

export function serveStatic(app: Express) {
  const distPath =
    process.env.NODE_ENV === "development"
      ? path.resolve(import.meta.dirname, "../..", "dist", "public")
      : path.resolve(import.meta.dirname, "public");
  if (!fs.existsSync(distPath)) {
    console.error(
      `Could not find the build directory: ${distPath}, make sure to build the client first`
    );
  }

  app.use(express.static(distPath));

  // Fall through to index.html if the file does not exist, preserving route-specific SEO for crawlers.
  app.use("*", async (req, res, next) => {
    try {
      const template = await fs.promises.readFile(path.resolve(distPath, "index.html"), "utf-8");
      const pathname = new URL(req.originalUrl, "http://localhost").pathname;
      res.status(responseStatus(pathname)).set({ "Content-Type": "text/html" }).send(injectRouteSeo(template, pathname));
    } catch (error) {
      next(error);
    }
  });
}
