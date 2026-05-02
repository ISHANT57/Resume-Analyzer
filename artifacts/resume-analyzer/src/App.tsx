import { useState } from "react";
import { Switch, Route, Router as WouterRouter, useLocation } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";
import HomePage from "@/pages/Home";
import AnalyzePage from "@/pages/Analyze";
import HistoryPage from "@/pages/History";
import ImprovePage from "@/pages/Improve";
import ToolsPage from "@/pages/Tools";
import { ColdStartBanner } from "@/components/ColdStartBanner";
import type { AnalysisResult } from "@workspace/api-client-react";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 1, staleTime: 60_000 },
    mutations: { retry: 0 },
  },
});

interface AppState {
  resumeId: number | null;
  analysisId: number | null;
  analysis: AnalysisResult | null;
}

function Routes() {
  const [, navigate] = useLocation();
  const [state, setState] = useState<AppState>({
    resumeId: null,
    analysisId: null,
    analysis: null,
  });

  const handleAnalysisComplete = (resumeId: number, analysis: unknown) => {
    const a = analysis as AnalysisResult;
    setState({ resumeId, analysisId: a.id, analysis: a });
  };

  return (
    <Switch>
      <Route path="/">
        <HomePage onAnalysisComplete={handleAnalysisComplete} />
      </Route>
      <Route path="/analyze">
        <AnalyzePage
          analysis={state.analysis}
          resumeId={state.resumeId}
          onNavigateImprove={() => navigate("/improve")}
          onNavigateTools={() => navigate("/tools")}
        />
      </Route>
      <Route path="/history">
        <HistoryPage />
      </Route>
      <Route path="/improve">
        <ImprovePage resumeId={state.resumeId} analysisId={state.analysisId} />
      </Route>
      <Route path="/tools">
        <ToolsPage resumeId={state.resumeId} onNavigateAnalyze={() => navigate("/analyze")} />
      </Route>
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <ColdStartBanner />
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
          <Routes />
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
