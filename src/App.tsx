import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { lazy, Suspense } from "react";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";
import { Layout } from "@/components/Layout";
import type { NetKey } from "@/lib/types";
import { I18nProvider } from "@/lib/i18n";

const OverviewPage = lazy(() => import("@/pages/Overview").then((m) => ({ default: m.OverviewPage })));
const AllNetworksPage = lazy(() => import("@/pages/AllNetworks").then((m) => ({ default: m.AllNetworksPage })));
const NetworkDetailPage = lazy(() => import("@/pages/NetworkDetail").then((m) => ({ default: m.NetworkDetailPage })));

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
      <Suspense fallback={<div className="flex h-full items-center justify-center text-sm text-muted-foreground">...</div>}>
        <Switch>
          <Route path="/" component={OverviewPage} />
          <Route path="/networks" component={AllNetworksPage} />
          <Route path="/network/:key" component={NetworkRoute} />
          <Route component={NotFound} />
        </Switch>
      </Suspense>
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
