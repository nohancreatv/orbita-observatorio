import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

type ConsentPreferences = { advertising: boolean; updatedAt: string; version: 1 };
type AdsbygoogleQueue = unknown[] & { pauseAdRequests?: number };
type ConsentContextValue = {
  isReady: boolean;
  preferences: ConsentPreferences | null;
  savePreferences: (advertising: boolean) => void;
  clearPreferences: () => void;
};

const STORAGE_KEY = "orbita-cookie-consent-v1";
const ConsentContext = createContext<ConsentContextValue | null>(null);

declare global {
  interface Window {
    dataLayer?: unknown[][];
    gtag?: (...args: unknown[]) => void;
    adsbygoogle?: AdsbygoogleQueue;
  }
}

function updateGoogleConsent(advertising: boolean, mode: "default" | "update") {
  window.dataLayer = window.dataLayer || [];
  window.gtag = window.gtag || ((...args: unknown[]) => window.dataLayer?.push(args));
  window.gtag("consent", mode, {
    ad_storage: advertising ? "granted" : "denied",
    ad_user_data: advertising ? "granted" : "denied",
    ad_personalization: advertising ? "granted" : "denied",
    analytics_storage: "denied",
    ads_data_redaction: !advertising,
  });
}

function updateAdRequestPause(advertising: boolean) {
  const publisherId = import.meta.env.VITE_ADSENSE_PUBLISHER_ID?.trim();
  const ads = (window.adsbygoogle = window.adsbygoogle || []);
  ads.pauseAdRequests = advertising ? 0 : 1;
  document.documentElement.dataset.adsRequests = advertising ? "resumed" : "paused";

  if (advertising && publisherId) window.dispatchEvent(new Event("orbita:adsense-ready"));
}

export function ConsentProvider({ children }: { children: ReactNode }) {
  const [isReady, setIsReady] = useState(false);
  const [preferences, setPreferences] = useState<ConsentPreferences | null>(null);

  useEffect(() => {
    updateGoogleConsent(false, "default");
    updateAdRequestPause(false);
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored) as ConsentPreferences;
        if (parsed.version === 1 && typeof parsed.advertising === "boolean") setPreferences(parsed);
      }
    } catch {
      localStorage.removeItem(STORAGE_KEY);
    } finally {
      setIsReady(true);
    }
  }, []);

  useEffect(() => {
    if (!preferences) return;
    updateGoogleConsent(preferences.advertising, "update");
    updateAdRequestPause(preferences.advertising);
  }, [preferences]);

  const savePreferences = useCallback((advertising: boolean) => {
    const next = { advertising, updatedAt: new Date().toISOString(), version: 1 } as const;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    setPreferences(next);
  }, []);

  const clearPreferences = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY);
    setPreferences(null);
    updateGoogleConsent(false, "update");
    updateAdRequestPause(false);
  }, []);

  const value = useMemo(() => ({ isReady, preferences, savePreferences, clearPreferences }), [clearPreferences, isReady, preferences, savePreferences]);
  return <ConsentContext.Provider value={value}>{children}</ConsentContext.Provider>;
}

export function useConsent() {
  const context = useContext(ConsentContext);
  if (!context) throw new Error("useConsent deve ser usado dentro de ConsentProvider");
  return context;
}
