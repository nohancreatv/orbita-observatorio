import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import Privacy from "@/pages/Privacy";
import Sources from "@/pages/Sources";
import Terms from "@/pages/Terms";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import Home from "./pages/Home";

function Router() {
  return <Switch><Route path="/" component={Home} /><Route path="/privacidade" component={Privacy} /><Route path="/termos" component={Terms} /><Route path="/fontes" component={Sources} /><Route path="/404" component={NotFound} /><Route component={NotFound} /></Switch>;
}

function App() { return <ErrorBoundary><ThemeProvider defaultTheme="dark"><TooltipProvider><Toaster /><Router /></TooltipProvider></ThemeProvider></ErrorBoundary>; }

export default App;
