import { useCallback, useEffect, useMemo, useState } from "react";
import { useSummary, useSectors, formatCount, formatKm } from "@/lib/data";
import { PageContainer } from "@/components/Layout";
import { StatCard } from "@/components/StatCard";
import { CardWrap, MiniBars, SerialChart } from "@/components/Charts";
import { MapView } from "@/components/Map";
import { DataTable } from "@/components/DataTable";
import { NET_COLORS, type NetKey, type SimpleFeature } from "@/lib/types";
import { useQueries } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { Layers, Activity, Map as MapIcon, Table as TableIcon, Filter, RotateCcw } from "lucide-react";
import { useI18n, netLabel } from "@/lib/i18n";

const ALL_KEYS: NetKey[] = ["electric", "gas", "water", "sewage", "telecom", "irrigation"];
const BASE = import.meta.env.BASE_URL;

type ViewMode = "map" | "table";

export function AllNetworksPage() {
  const { t, td, lang } = useI18n();
  const summary = useSummary();
  const sectorsQ = useSectors();
  const [enabled, setEnabled] = useState<Set<NetKey>>(new Set(ALL_KEYS));
  const [viewMode, setViewMode] = useState<ViewMode>("map");
  const [flyTo, setFlyTo] = useState<SimpleFeature | null>(null);
  const [loadNetworks, setLoadNetworks] = useState(false);
  const [networkFilter, setNetworkFilter] = useState<NetKey | "all">("all");
  const [sectorFilter, setSectorFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [implementerFilter, setImplementerFilter] = useState("all");
  const [featureSearch, setFeatureSearch] = useState("");

  useEffect(() => {
    const id = window.setTimeout(() => setLoadNetworks(true), 120);
    return () => window.clearTimeout(id);
  }, []);

  const networkQueries = useQueries({
    queries: ALL_KEYS.map((k) => ({
      queryKey: ["network", k],
      queryFn: async () => {
        const res = await fetch(`${BASE}data/network-${k}.json`, { cache: "force-cache" });
        return res.json();
      },
      enabled: loadNetworks,
      staleTime: Infinity,
    })),
  });
  const networkData = networkQueries.map((q) => q.data);

  const allFeatures = useMemo(() => {
    const out: SimpleFeature[] = [];
    networkData.forEach((data, i) => {
      if (!data) return;
      const key = ALL_KEYS[i];
      if (!enabled.has(key)) return;
      out.push(...data.features);
    });
    return out;
  }, [...networkData, enabled]);

  const filterOptions = useMemo(() => {
    const sectors = new Set<string>();
    const types = new Set<string>();
    const implementers = new Set<string>();
    allFeatures.forEach((feature) => {
      if (feature.s) sectors.add(String(feature.s));
      if (feature.t) types.add(String(feature.t));
      if (feature.imp) implementers.add(String(feature.imp));
    });
    return {
      sectors: [...sectors].sort(),
      types: [...types].sort(),
      implementers: [...implementers].sort(),
    };
  }, [allFeatures]);

  const filteredFeatures = useMemo(() => {
    const q = featureSearch.trim().toLowerCase();
    return allFeatures.filter((feature) => {
      if (networkFilter !== "all" && feature.n !== networkFilter) return false;
      if (sectorFilter !== "all" && feature.s !== sectorFilter) return false;
      if (typeFilter !== "all" && feature.t !== typeFilter) return false;
      if (implementerFilter !== "all" && feature.imp !== implementerFilter) return false;
      if (q && ![feature.t, feature.s, feature.imp, feature.code].some((v) => String(v || "").toLowerCase().includes(q))) return false;
      return true;
    });
  }, [allFeatures, networkFilter, sectorFilter, typeFilter, implementerFilter, featureSearch]);

  const allLoaded = networkQueries.every((q) => !!q.data);

  // Keep this memoized hook above the loading return so hook order is stable
  // while the summary and network files load asynchronously.
  const waterDiameterLengths = useMemo(() => {
    const totals: Record<string, number> = {};
    const water = networkData[2];
    (water?.features || []).forEach((feature: SimpleFeature) => {
      if (feature.c !== "line" || !feature.d || !feature.l) return;
      const diameter = String(feature.d).trim();
      if (!/^\d+(\.\d+)?$/.test(diameter)) return;
      totals[diameter] = (totals[diameter] || 0) + Number(feature.l) * 1000;
    });
    return Object.entries(totals)
      .sort(([a], [b]) => Number(a) - Number(b))
      .map(([name, value], index) => ({
        name,
        value: Number(value.toFixed(1)),
        color: ["#b5179e", "#087fba", "#8ba32b", "#824b84", "#d27b17", "#c7ad2f", "#4f8747", "#97744e", "#3a9386", "#5c5bb0", "#a33f6e", "#777777", "#168db2", "#0b70a1", "#8ba32b", "#8d4a91", "#d47c22"][index % 17],
      }));
  }, [networkData[2]]);

  const handleLocate = useCallback((f: SimpleFeature) => {
    setFlyTo(f);
    setViewMode("map");
  }, []);

  if (!summary.data || !sectorsQ.data) {
    return (
      <PageContainer>
        <div className="h-full flex items-center justify-center text-muted-foreground text-sm">
          {t("state.loading")}
        </div>
      </PageContainer>
    );
  }

  const s = summary.data;
  const visibleSectors = sectorsQ.data.polygons;

  const totalFeatures = ALL_KEYS.reduce(
    (sum, k) => sum + (s.networks[k]?.total || 0),
    0
  );
  const totalLengthKm = ALL_KEYS.reduce(
    (sum, k) => sum + (s.networks[k]?.totalLengthKm || 0),
    0
  );

  const featureDetails = ALL_KEYS.flatMap((key) =>
    Object.entries(s.networks[key]?.byType || {})
      .filter(([type]) => !["غير محدد", "غير محددة", "unknown", "undefined"].includes(type.trim().toLowerCase()))
      .map(([type, value]) => ({
      key,
      type,
      value: Number(value),
      color: NET_COLORS[key],
      }))
  ).sort((a, b) => b.value - a.value).slice(0, 30);
  const leftFeatureDetails = featureDetails.slice(0, 15);
  const rightFeatureDetails = featureDetails.slice(15, 30);

  const lengthBreakdown = ALL_KEYS.map((k) => ({
    name: netLabel(k, lang, true),
    value: Number((s.networks[k]?.totalLengthKm || 0).toFixed(1)),
    color: NET_COLORS[k],
  })).filter((d) => d.value > 0);

  return (
    <PageContainer>
      <div className="all-networks-filters glass-card rounded-md">
        <div className="flex items-center gap-2 text-foreground font-bold text-xs shrink-0">
          <Filter className="h-3.5 w-3.5 text-primary" />
          <span>{lang === "ar" ? "فلاتر الخريطة" : "Map filters"}</span>
        </div>
        <select value={networkFilter} onChange={(e) => setNetworkFilter(e.target.value as NetKey | "all")}>
          <option value="all">{lang === "ar" ? "كل الشبكات" : "All networks"}</option>
          {ALL_KEYS.map((key) => <option key={key} value={key}>{netLabel(key, lang)}</option>)}
        </select>
        <select value={sectorFilter} onChange={(e) => setSectorFilter(e.target.value)}>
          <option value="all">{lang === "ar" ? "كل القطاعات" : "All sectors"}</option>
          {filterOptions.sectors.map((value) => <option key={value} value={value}>{td(value)}</option>)}
        </select>
        <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}>
          <option value="all">{lang === "ar" ? "كل الأنواع" : "All types"}</option>
          {filterOptions.types.map((value) => <option key={value} value={value}>{td(value)}</option>)}
        </select>
        <select value={implementerFilter} onChange={(e) => setImplementerFilter(e.target.value)}>
          <option value="all">{lang === "ar" ? "كل جهات التنفيذ" : "All implementers"}</option>
          {filterOptions.implementers.map((value) => <option key={value} value={value}>{td(value)}</option>)}
        </select>
        <input value={featureSearch} onChange={(e) => setFeatureSearch(e.target.value)} placeholder={lang === "ar" ? "بحث في العناصر..." : "Search features..."} />
        <button className="all-networks-filter-reset" onClick={() => { setNetworkFilter("all"); setSectorFilter("all"); setTypeFilter("all"); setImplementerFilter("all"); setFeatureSearch(""); }} title={lang === "ar" ? "مسح الفلاتر" : "Clear filters"}>
          <RotateCcw className="h-3.5 w-3.5" />
        </button>
        <span className="all-networks-filter-count">{formatCount(filteredFeatures.length)} {lang === "ar" ? "عنصر ظاهر" : "visible"}</span>
      </div>
      <div className="all-networks-grid">
        <CardWrap
          title={lang === "ar" ? "تفاصيل عناصر الشبكات" : "Network element details"}
          delay={0.1}
          className="all-networks-toggle"
          right={
            <div className="flex items-center gap-0.5 glass-card rounded p-0.5">
              <button
                onClick={() => setViewMode("map")}
                className={`flex items-center gap-1 px-1.5 py-0.5 rounded text-[9.5px] font-medium transition ${
                  viewMode === "map"
                    ? "bg-primary text-background"
                    : "text-muted-foreground hover:text-foreground"
                }`}
                title={t("view.map")}
              >
                <MapIcon className="w-2.5 h-2.5" />
              </button>
              <button
                onClick={() => setViewMode("table")}
                className={`flex items-center gap-1 px-1.5 py-0.5 rounded text-[9.5px] font-medium transition ${
                  viewMode === "table"
                    ? "bg-primary text-background"
                    : "text-muted-foreground hover:text-foreground"
                }`}
                title={t("view.table")}
              >
                <TableIcon className="w-2.5 h-2.5" />
              </button>
            </div>
          }
        >
          <div className="grid grid-cols-2 gap-1.5 overflow-y-auto pr-1 auto-rows-min">
            {leftFeatureDetails.map((item, index) => (
              <div key={`${item.key}-${item.type}-${index}`} className="rounded-md border border-border/40 bg-background/35 px-2.5 py-2.5 min-w-0 text-center">
                <div className="break-words text-[11px] font-semibold leading-tight text-foreground/90" title={td(item.type)}>{td(item.type)}</div>
                <div className="mt-1 flex flex-col items-center justify-center gap-0.5">
                  <span className="break-words text-[10px] leading-tight text-muted-foreground">{netLabel(item.key, lang)}</span>
                  <span className="shrink-0 text-[16px] font-black tabular-nums" style={{ color: item.color }}>{formatCount(item.value)}</span>
                </div>
              </div>
            ))}
          </div>
        </CardWrap>

        <div className="all-networks-map-shell">
          <AnimatePresence mode="wait">
            {viewMode === "map" ? (
              <motion.div
                key="map"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="absolute inset-0"
              >
                <MapView
                  bbox={s.bbox}
                  sectors={visibleSectors}
                  adminBoundaries={sectorsQ.data?.adminBoundaries}
                  features={filteredFeatures}
                  visibleNetworks={enabled}
                  flyToFeature={flyTo}
                  maxFeatures={100000}
                />
                {!allLoaded && (
                  <div className="absolute inset-0 flex items-center justify-center bg-background/60 z-[450] backdrop-blur-sm">
                    <div className="glass-card rounded-md px-4 py-2 text-xs text-foreground">
                      {t("state.loading_networks", {
                        n: networkQueries.filter((q) => q.data).length,
                        total: ALL_KEYS.length,
                      })}
                    </div>
                  </div>
                )}
                <div className={`absolute top-2 ${lang === "ar" ? "left-2" : "right-2"} glass-card rounded-md p-2 z-[400] text-[10px] space-y-0.5`}>
                  <div className="text-foreground font-bold mb-1 text-[10.5px]">
                    {t("map.legend_networks")}
                  </div>
                  {ALL_KEYS.filter((k) => enabled.has(k)).map((k) => (
                    <div key={k} className="flex items-center gap-1.5">
                      <span className="relative w-5 h-3.5 shrink-0">
                        <span
                          className="absolute left-0 right-0 top-1/2 h-[4px] -translate-y-1/2 rounded-full bg-background/90"
                        />
                        <span
                          className="absolute left-0.5 right-0.5 top-1/2 h-[2px] -translate-y-1/2 rounded-full"
                          style={{ background: NET_COLORS[k], boxShadow: `0 0 8px ${NET_COLORS[k]}99` }}
                        />
                        <span
                          className="absolute left-1/2 top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/80 shadow-sm"
                          style={{ background: NET_COLORS[k], boxShadow: `0 0 0 2px rgba(2, 6, 23, 0.72), 0 0 10px ${NET_COLORS[k]}88` }}
                        />
                      </span>
                      <span className="text-foreground/80">{netLabel(k, lang)}</span>
                    </div>
                  ))}
                </div>
              </motion.div>
            ) : (
              <motion.div
                key="table"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="absolute inset-0 glass-card rounded-md p-2"
              >
                <DataTable
                  features={filteredFeatures}
                  color="#f59e0b"
                  showNetworkColumn
                  onLocate={handleLocate}
                />
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <div className="all-networks-side-charts">
          <CardWrap title={lang === "ar" ? "التفاصيل الرئيسية" : "Primary details"} delay={0.15}>
            <div className="grid grid-cols-2 gap-1.5 overflow-y-auto pr-1 auto-rows-min">
              {rightFeatureDetails.map((item, index) => (
                <div key={`${item.key}-${item.type}-${index}`} className="rounded-md border border-border/40 bg-background/35 px-2.5 py-2.5 min-w-0 text-center">
                  <div className="break-words text-[11px] font-semibold leading-tight text-foreground/90" title={td(item.type)}>{td(item.type)}</div>
                  <div className="mt-1 flex flex-col items-center justify-center gap-0.5">
                    <span className="break-words text-[10px] leading-tight text-muted-foreground">{netLabel(item.key, lang)}</span>
                    <span className="shrink-0 text-[16px] font-black tabular-nums" style={{ color: item.color }}>{formatCount(item.value)}</span>
                  </div>
                </div>
              ))}
            </div>
          </CardWrap>
        </div>

        <CardWrap title={lang === "ar" ? "أطوال أقطار خطوط شبكة المياه بالمتر" : "Water network pipe lengths by diameter (m)"} delay={0.25} className="all-networks-length-chart">
          <SerialChart data={waterDiameterLengths} />
        </CardWrap>

        <CardWrap title={t("card.top_implementing")} delay={0.3} className="all-networks-top-implementing">
          <MiniBars
            data={topImplementing(s.networks).map((d) => ({
              name: td(d.name),
              value: d.value,
            }))}
            color="#10b981"
            maxItems={5}
          />
        </CardWrap>


      </div>
    </PageContainer>
  );
}

function topImplementing(networks: Record<NetKey, any>) {
  const merged: Record<string, number> = {};
  ALL_KEYS.forEach((k) => {
    const imp = networks[k]?.byImplementing || {};
    Object.entries(imp).forEach(([name, count]) => {
      merged[name] = (merged[name] || 0) + Number(count || 0);
    });
  });
  return Object.entries(merged)
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value);
}
