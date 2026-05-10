import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";
import { Layout } from "@/components/Layout";
import { OverviewPage } from "@/pages/Overview";
import { AllNetworksPage } from "@/pages/AllNetworks";
import { NetworkDetailPage } from "@/pages/NetworkDetail";
import type { NetKey } from "@/lib/types";
import { I18nProvider } from "@/lib/i18n";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

const VALID_NETS: NetKey[] = [
  "electric",
  "gas",
  "water",
  "sewage",
  "telecom",
  "irrigation",
];

function NetworkRoute({ params }: { params: { key: string } }) {
  const k = params.key as NetKey;
  if (!VALID_NETS.includes(k)) return <NotFound />;
  return <NetworkDetailPage networkKey={k} />;
}

function Router() {
  return (
    <Layout>
      <Switch>
        <Route path="/" component={OverviewPage} />
        <Route path="/networks" component={AllNetworksPage} />
        <Route path="/network/:key" component={NetworkRoute} />
        <Route component={NotFound} />
      </Switch>
    </Layout>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <I18nProvider>
        <TooltipProvider>
          <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
            <Router />
          </WouterRouter>
          <Toaster />
        </TooltipProvider>
      </I18nProvider>
    </QueryClientProvider>
  );
}

export default App;
