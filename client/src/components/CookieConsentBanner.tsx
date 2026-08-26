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
  const [analytics, setAnalytics] = useState(false);
  const isKnownContentRoute = ["/", "/privacidade", "/termos", "/fontes"].includes(location);
  const isDevelopmentRecovery = import.meta.env.DEV && new URLSearchParams(window.location.search).has("force-error-boundary");
  if (!isReady || preferences || !isKnownContentRoute || isDevelopmentRecovery) return null;

  return <TextReveal as="aside" className="cookie-consent" delay={30} role="dialog" aria-modal="false" aria-labelledby="cookie-consent-title" aria-describedby="cookie-consent-copy">
    <div className="cookie-consent__icon"><ShieldCheck size={19} aria-hidden="true" /></div>
    <div className="cookie-consent__copy"><p className="eyebrow">Privacidade de bordo</p><h2 id="cookie-consent-title">Você controla os dados opcionais.</h2><p id="cookie-consent-copy">Usamos o armazenamento essencial para lembrar a sua escolha. A medição do site e a publicidade do Google só são ativadas se você autorizar.</p>{showDetails && <div className="cookie-consent__choices"><label className="cookie-consent__choice"><input type="checkbox" checked={analytics} onChange={event => setAnalytics(event.target.checked)} /> <span>Permitir medição anônima de uso</span></label><label className="cookie-consent__choice"><input type="checkbox" checked={advertising} onChange={event => setAdvertising(event.target.checked)} /> <span>Permitir publicidade personalizada do Google</span></label></div>}<a href="/privacidade">ler política de privacidade</a></div>
    <div className="cookie-consent__actions"><button type="button" className="consent-button consent-button--quiet" onClick={() => savePreferences({ advertising: false, analytics: false })}>recusar publicidade</button><button type="button" className="consent-button consent-button--settings" onClick={() => setShowDetails(current => !current)} aria-expanded={showDetails}><Settings2 size={15} aria-hidden="true" /> preferências</button>{showDetails ? <button type="button" className="consent-button consent-button--primary" onClick={() => savePreferences({ advertising, analytics })}>salvar escolhas</button> : <button type="button" className="consent-button consent-button--primary" onClick={() => savePreferences({ advertising: true, analytics: true })}>aceitar publicidade</button>}</div>
  </TextReveal>;
}
