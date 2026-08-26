import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { CookieConsentBanner } from "./components/CookieConsentBanner";
import Privacy from "@/pages/Privacy";
import Sources from "@/pages/Sources";
import Terms from "@/pages/Terms";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { SeoHead } from "./components/SeoHead";
import { ConsentProvider } from "./contexts/ConsentContext";
import { ThemeProvider } from "./contexts/ThemeContext";
import Home from "./pages/Home";

const pages = {
  home: { title: "Órbita — ISS acima de você", description: "Acompanhe a posição da Estação Espacial Internacional e descubra sua próxima aproximação.", path: "/" },
  privacy: { title: "Privacidade — Órbita", description: "Como o observatório Órbita trata localização, publicidade e preferências de privacidade.", path: "/privacidade" },
  terms: { title: "Termos de uso — Órbita", description: "Termos e limites de uso do observatório orbital Órbita.", path: "/termos" },
  sources: { title: "Fontes e limites — Órbita", description: "Fontes públicas e limites dos dados orbitais apresentados pelo Órbita.", path: "/fontes" },
  notFound: { title: "Página não encontrada — Órbita", description: "A rota solicitada não existe no observatório Órbita.", path: "/404", noIndex: true },
} as const;

function withSeo(Page: typeof Home | typeof Privacy | typeof Sources | typeof Terms | typeof NotFound, meta: typeof pages[keyof typeof pages]) {
  return () => <><SeoHead {...meta} /><Page /></>;
}

const HomeRoute = withSeo(Home, pages.home);
const PrivacyRoute = withSeo(Privacy, pages.privacy);
const TermsRoute = withSeo(Terms, pages.terms);
const SourcesRoute = withSeo(Sources, pages.sources);
const NotFoundRoute = withSeo(NotFound, pages.notFound);

function DevelopmentCrashProbe() {
  if (import.meta.env.DEV && new URLSearchParams(window.location.search).has("force-error-boundary")) throw new Error("Falha controlada de auditoria");
  return null;
}

function Router() {
  return <Switch><Route path="/" component={HomeRoute} /><Route path="/privacidade" component={PrivacyRoute} /><Route path="/termos" component={TermsRoute} /><Route path="/fontes" component={SourcesRoute} /><Route path="/404" component={NotFoundRoute} /><Route component={NotFoundRoute} /></Switch>;
}

function App() { return <ErrorBoundary><DevelopmentCrashProbe /><ThemeProvider defaultTheme="dark"><ConsentProvider><TooltipProvider><Toaster /><CookieConsentBanner /><Router /></TooltipProvider></ConsentProvider></ThemeProvider></ErrorBoundary>; }

export default App;
