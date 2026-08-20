import { Button } from "@/components/ui/button";
import { AlertCircle, Home } from "lucide-react";
import { useLocation } from "wouter";

export default function NotFound() {
  const [, setLocation] = useLocation();

  const handleGoHome = () => {
    setLocation("/");
  };

  return (
    <main className="legal-shell flex min-h-screen items-center justify-center">
      <section className="w-full max-w-xl border border-white/15 bg-[#0c1a2c]/80 p-8 text-center shadow-2xl backdrop-blur-sm" aria-labelledby="not-found-title">
        <AlertCircle className="mx-auto mb-6 h-12 w-12 text-[#ffb38d]" aria-hidden="true" />
        <p className="eyebrow justify-center">Coordenada desconhecida</p>
        <h1 id="not-found-title" className="mt-4 font-serif text-6xl text-[#f7f2e8]">404</h1>
        <p className="mt-4 text-base leading-7 text-[#b9c4cf]">A página procurada não está no nosso mapa orbital ou foi movida para outra rota.</p>
        <button type="button" onClick={handleGoHome} className="locate-button mx-auto mt-8"><Home className="h-4 w-4" aria-hidden="true" /> voltar ao observatório</button>
      </section>
    </main>
  );
}
