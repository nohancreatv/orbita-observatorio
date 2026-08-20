import { useEffect, useRef } from "react";
import { useConsent } from "@/contexts/ConsentContext";

type AdSlotProps = {
  placement: "sidebar-left" | "sidebar-right" | "feed-mobile";
  className?: string;
};

const placementCopy: Record<AdSlotProps["placement"], string> = {
  "sidebar-left": "Lateral esquerda",
  "sidebar-right": "Lateral direita",
  "feed-mobile": "Conteúdo patrocinado",
};

const placementSlotId: Record<AdSlotProps["placement"], string | undefined> = {
  "sidebar-left": import.meta.env.VITE_ADSENSE_SLOT_SIDEBAR_LEFT,
  "sidebar-right": import.meta.env.VITE_ADSENSE_SLOT_SIDEBAR_RIGHT,
  "feed-mobile": import.meta.env.VITE_ADSENSE_SLOT_FEED_MOBILE,
};

/**
 * Inventário publicitário estável e livre de scripts de terceiros.
 * A integração com Google Ads deve preencher este contêiner somente após a
 * configuração do publisher ID e da política de consentimento.
 */
export function AdSlot({ placement, className = "" }: AdSlotProps) {
  const { preferences } = useConsent();
  const adElement = useRef<HTMLModElement>(null);
  const publisherId = import.meta.env.VITE_ADSENSE_PUBLISHER_ID?.trim();
  const slotId = placementSlotId[placement];
  const canRequestAd = Boolean(preferences?.advertising && publisherId && slotId);
  const autoAdsEnabled = Boolean(preferences?.advertising && publisherId && !slotId);
  const adMode = canRequestAd ? "manual" : autoAdsEnabled ? "auto" : "blocked";

  useEffect(() => {
    if (!canRequestAd || !adElement.current || adElement.current.dataset.requested === "true") return;
    const requestAd = () => {
      if (!adElement.current || adElement.current.dataset.requested === "true" || !Array.isArray(window.adsbygoogle)) return;
      try {
        window.adsbygoogle.push({});
        adElement.current.dataset.requested = "true";
      } catch {
        // O inventário reservado continua estável se o provedor não responder.
      }
    };
    requestAd();
    window.addEventListener("orbita:adsense-ready", requestAd, { once: true });
    return () => window.removeEventListener("orbita:adsense-ready", requestAd);
  }, [canRequestAd]);

  const placeholderCopy = autoAdsEnabled ? "Publicidade automática habilitada" : preferences?.advertising ? "Publicidade autorizada" : preferences ? "Publicidade desativada" : placementCopy[placement];

  return <section className={`ad-slot ad-slot--${placement} ${canRequestAd ? "ad-slot--eligible" : ""} ${className}`} data-ad-slot={placement} data-ad-consent={preferences?.advertising ? "granted" : "denied"} data-ad-mode={adMode} aria-label={`Espaço publicitário: ${placementCopy[placement]}`}>
    {canRequestAd ? <ins ref={adElement} className="adsbygoogle" data-ad-client={publisherId} data-ad-slot={slotId} data-ad-format="auto" data-full-width-responsive="true" /> : <><span className="ad-slot__eyebrow">Espaço publicitário</span><span className="ad-slot__placement">{placeholderCopy}</span></>}
  </section>;
}
