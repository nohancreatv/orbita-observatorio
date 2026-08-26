import { useEffect } from "react";
import { useLocation } from "wouter";
import { useConsent } from "@/contexts/ConsentContext";

const MEASUREMENT_ID = "G-4EQ06VWWVE";
const SCRIPT_ID = "orbita-google-analytics";

declare global {
  interface Window {
    dataLayer?: unknown[][];
    gtag?: (...args: unknown[]) => void;
  }
}

function ensureGtagStub() {
  window.dataLayer = window.dataLayer || [];
  window.gtag = window.gtag || ((...args: unknown[]) => window.dataLayer?.push(args));
}

function loadGoogleAnalytics() {
  ensureGtagStub();
  if (document.getElementById(SCRIPT_ID)) return;

  window.gtag?.("js", new Date());
  window.gtag?.("config", MEASUREMENT_ID, { send_page_view: false });

  const script = document.createElement("script");
  script.id = SCRIPT_ID;
  script.async = true;
  script.src = `https://www.googletagmanager.com/gtag/js?id=${MEASUREMENT_ID}`;
  document.head.append(script);
}

function sendPageView(pathname: string) {
  if (!window.gtag) return;
  window.gtag("event", "page_view", {
    page_path: pathname,
    page_location: window.location.href,
    page_title: document.title,
  });
}

/**
 * O script fica uma única vez no head para verificação do Google; pageviews
 * só são enviados depois da escolha explícita de medição no banner.
 */
export function GoogleAnalytics() {
  const { preferences } = useConsent();
  const [location] = useLocation();

  useEffect(() => {
    if (!preferences?.analytics) return;
    loadGoogleAnalytics();
    sendPageView(location);
  }, [location, preferences?.analytics]);

  return null;
}
