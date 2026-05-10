import { Link, useLocation } from "wouter";
import { motion } from "framer-motion";
import { type NetKey } from "@/lib/types";
import { Activity, Network, ChevronLeft, ChevronRight, Languages } from "lucide-react";
import { useI18n, netLabel } from "@/lib/i18n";
import { NetworkIcon } from "@/components/NetworkIcon";

const NETWORKS: NetKey[] = ["electric", "gas", "water", "sewage", "telecom", "irrigation"];

export function Layout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  const { t, lang, setLang } = useI18n();

  const isActive = (path: string) =>
    path === "/" ? location === "/" : location.startsWith(path);

  const TABS: Array<{ path: string; label: string; icon: React.ReactNode }> = [
    { path: "/", label: t("tab.overview"), icon: <Activity className="w-4 h-4" /> },
    { path: "/networks", label: t("tab.networks"), icon: <Network className="w-4 h-4" /> },
  ];

  return (
    <div className="min-h-screen flex flex-col">
      <header className="sticky top-0 z-50 glass-panel border-b">
        <div className="px-3 py-2.5 flex flex-wrap items-center gap-3 md:flex-nowrap md:px-4 md:gap-4">
          <motion.div
            initial={{ opacity: 0, x: lang === "ar" ? -10 : 10 }}
            animate={{ opacity: 1, x: 0 }}
            className="flex items-center gap-2.5"
          >
            <div className="w-10 h-10 rounded-md bg-white p-1 shadow-lg border border-white/20 flex items-center justify-center overflow-hidden">
              <img
                src="/93227c_755d67bf670e44d78567525fdb27b6f1~mv2.avif"
                alt={t("app.title")}
                className="w-full h-full object-contain"
              />
            </div>
            <div>
              <h1 className="text-sm font-bold leading-tight tracking-tight">
                {t("app.title")}
              </h1>
              <p className="text-[10px] text-muted-foreground leading-tight">
                {t("app.subtitle")}
              </p>
            </div>
          </motion.div>

          <nav className={`order-3 flex w-full items-center gap-1 overflow-x-auto pb-1 md:order-none md:w-auto md:overflow-visible md:pb-0 ${lang === "ar" ? "md:mr-auto" : "md:ml-auto"}`}>
            {TABS.map((tab) => (
              <Link key={tab.path} href={tab.path}>
                <button
                  className={`relative px-3 py-1.5 text-xs font-medium rounded-md transition flex items-center gap-1.5 ${
                    isActive(tab.path)
                      ? "text-primary-foreground"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {isActive(tab.path) && (
                    <motion.div
                      layoutId="active-tab"
                      className="absolute inset-0 gradient-amber rounded-md"
                      transition={{ type: "spring", stiffness: 380, damping: 30 }}
                    />
                  )}
                  <span className="relative z-10 flex items-center gap-1.5">
                    {tab.icon}
                    {tab.label}
                  </span>
                </button>
              </Link>
            ))}
            <div className="w-px h-5 bg-border mx-1" />
            {NETWORKS.map((k) => (
              <Link key={k} href={`/network/${k}`}>
                <button
                  className={`relative px-2.5 py-1.5 text-[11px] font-medium rounded-md transition flex items-center gap-1 ${
                    isActive(`/network/${k}`)
                      ? "text-primary-foreground"
                      : "text-muted-foreground hover:text-foreground hover:bg-secondary/50"
                  }`}
                >
                  {isActive(`/network/${k}`) && (
                    <motion.div
                      layoutId="active-tab"
                      className="absolute inset-0 gradient-amber rounded-md"
                      transition={{ type: "spring", stiffness: 380, damping: 30 }}
                    />
                  )}
                  <span className="relative z-10 flex items-center gap-1">
                    <NetworkIcon network={k} className="w-3.5 h-3.5" />
                    {netLabel(k, lang, true)}
                  </span>
                </button>
              </Link>
            ))}
          </nav>

          <button
            onClick={() => setLang(lang === "ar" ? "en" : "ar")}
            className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-bold rounded-md bg-secondary border border-border hover:bg-secondary/80 transition"
            title={lang === "ar" ? "English" : "العربية"}
          >
            <Languages className="w-3.5 h-3.5" />
            <span>{lang === "ar" ? "EN" : "ع"}</span>
          </button>

        </div>
      </header>

      <main className="flex-1 overflow-hidden max-md:overflow-visible">{children}</main>
    </div>
  );
}

export function PageContainer({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-[calc(100vh-92px)] overflow-y-auto p-2.5 md:h-[calc(100vh-49px)] md:min-h-0 md:overflow-hidden">{children}</div>
  );
}

export function BackButton({ to = "/networks", label }: { to?: string; label?: string }) {
  const { t, lang } = useI18n();
  const text = label ?? t("nav.networks");
  const Icon = lang === "ar" ? ChevronLeft : ChevronRight;
  return (
    <Link href={to}>
      <button className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition">
        <Icon className="w-3.5 h-3.5" />
        {t("nav.back_to")} {text}
      </button>
    </Link>
  );
}
