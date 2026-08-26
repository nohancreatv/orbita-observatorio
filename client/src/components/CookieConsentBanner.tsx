import { useState } from "react";
import { Settings2, ShieldCheck } from "lucide-react";
import { TextReveal } from "@/components/TextReveal";
import { useConsent } from "@/contexts/ConsentContext";
import { useLocation } from "wouter";

export function CookieConsentBanner() {
  const { isReady, preferences, savePreferences } = useConsent();
  const [location] = useLocation();
  const [showDetails, setShowDetails] = useState(false);
  const [advertising, setAdvertising] = useState(false);
  const isKnownContentRoute = ["/", "/privacidade", "/termos", "/fontes"].includes(location);
  const isDevelopmentRecovery = import.meta.env.DEV && new URLSearchParams(window.location.search).has("force-error-boundary");
  if (!isReady || preferences || !isKnownContentRoute || isDevelopmentRecovery) return null;

  return <TextReveal as="aside" className="cookie-consent" delay={30} role="dialog" aria-modal="false" aria-labelledby="cookie-consent-title" aria-describedby="cookie-consent-copy">
    <div className="cookie-consent__icon"><ShieldCheck size={19} aria-hidden="true" /></div>
    <div className="cookie-consent__copy"><p className="eyebrow">Privacidade de bordo</p><h2 id="cookie-consent-title">Você controla a publicidade.</h2><p id="cookie-consent-copy">Usamos o armazenamento essencial para lembrar a sua escolha. A publicidade do Google só é carregada se você autorizar.</p>{showDetails && <label className="cookie-consent__choice"><input type="checkbox" checked={advertising} onChange={event => setAdvertising(event.target.checked)} /> <span>Permitir publicidade personalizada do Google</span></label>}<a href="/privacidade">ler política de privacidade</a></div>
    <div className="cookie-consent__actions"><button type="button" className="consent-button consent-button--quiet" onClick={() => savePreferences(false)}>recusar publicidade</button><button type="button" className="consent-button consent-button--settings" onClick={() => setShowDetails(current => !current)} aria-expanded={showDetails}><Settings2 size={15} aria-hidden="true" /> preferências</button>{showDetails ? <button type="button" className="consent-button consent-button--primary" onClick={() => savePreferences(advertising)}>salvar escolhas</button> : <button type="button" className="consent-button consent-button--primary" onClick={() => savePreferences(true)}>aceitar publicidade</button>}</div>
  </TextReveal>;
}
