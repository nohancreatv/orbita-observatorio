import { useLocation } from "wouter";
import { AlertCircle, Home } from "lucide-react";
import { TextReveal } from "@/components/TextReveal";

export default function NotFound() {
  const [, setLocation] = useLocation();

  return (
    <main style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "linear-gradient(135deg, #07111f, #0a1d2e)" }}>
      <TextReveal as="div" delay={40} style={{ textAlign: "center", maxWidth: 480, padding: "0 24px" }}>
        <div style={{ marginBottom: 28, display: "flex", justifyContent: "center" }}>
          <div style={{ position: "relative" }}>
            <div style={{ position: "absolute", inset: 0, borderRadius: "50%", background: "rgba(255,179,141,.12)", animation: "active-radar 1.8s ease-out infinite" }} />
            <AlertCircle size={56} style={{ color: "#ffb38d", position: "relative" }} />
          </div>
        </div>
        <h1 style={{ color: "#f6f1e7", font: "400 4.5rem/1 'DM Serif Display', serif", letterSpacing: "-.06em", margin: 0 }}>404</h1>
        <h2 style={{ color: "#d3e1df", font: "400 clamp(1.3rem,2.5vw,1.8rem)/1.1 'DM Serif Display', serif", marginTop: 16, letterSpacing: "-.03em" }}>Trajetória não encontrada</h2>
        <p style={{ color: "#8a9faa", fontSize: ".85rem", lineHeight: 1.7, marginTop: 18, maxWidth: 380, marginLeft: "auto", marginRight: "auto" }}>
          Esta rota não existe no observatório. Pode ter sido movida, removida ou o endereço pode estar incorreto.
        </p>
        <button
          type="button"
          onClick={() => setLocation("/")}
          style={{ marginTop: 34, display: "inline-flex", alignItems: "center", gap: 8, padding: "12px 28px", border: "1px solid rgba(99,230,190,.45)", borderRadius: 4, background: "transparent", color: "#63e6be", font: ".62rem/1 'IBM Plex Mono', monospace", letterSpacing: ".07em", textTransform: "uppercase" as const, cursor: "pointer", transition: "border-color .2s, background .2s" }}
          onMouseEnter={e => { e.currentTarget.style.background = "rgba(99,230,190,.08)"; }}
          onMouseLeave={e => { e.currentTarget.style.background = "transparent"; }}
        >
          <Home size={15} /> voltar ao observatório
        </button>
      </TextReveal>
    </main>
  );
}
