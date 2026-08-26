import { cn } from "@/lib/utils";
import { AlertTriangle, RotateCcw } from "lucide-react";
import { Component, ReactNode } from "react";
import { TextReveal } from "@/components/TextReveal";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error) {
    console.error("[Órbita] Falha de renderização recuperada", error);
  }

  render() {
    if (this.state.hasError) {
      return (
        <main className="flex items-center justify-center min-h-screen p-8 bg-background" role="alert">
          <TextReveal as="div" className="flex flex-col items-center w-full max-w-xl p-8 text-center" delay={40}>
            <AlertTriangle
              size={48}
              className="text-destructive mb-6 flex-shrink-0"
            />

            <p className="eyebrow mb-3">Sinal interrompido</p>
            <h1 className="font-serif text-4xl text-foreground mb-4">O observatório encontrou uma interferência.</h1>
            <p className="max-w-md text-sm leading-6 text-muted-foreground mb-6">Seus dados não foram alterados. Recarregue a página para retomar a leitura orbital.</p>

            <button
              onClick={() => window.location.reload()}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground hover:opacity-90 cursor-pointer"
            >
              <RotateCcw size={16} />
              recarregar observatório
            </button>
          </TextReveal>
        </main>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
