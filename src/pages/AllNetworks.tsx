import { useCallback, useEffect, useMemo, useState } from "react";
import { useSummary, useSectors, formatCount, formatKm } from "@/lib/data";
import { PageContainer } from "@/components/Layout";
import { StatCard } from "@/components/StatCard";
import { CardWrap, MiniBars, SerialChart, Donut } from "@/components/Charts";
import { MapView } from "@/components/Map";
import { DataTable } from "@/components/DataTable";
import { NET_COLORS, type NetKey, type SimpleFeature } from "@/lib/types";
import { useQueries } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import {
  Layers,
  Activity,
  Map as MapIcon,
  Table as TableIcon,
  Filter,
  RotateCcw,
  Network,
  Building2,
  Hammer,
  Search,
  Zap,
  Flame,
  Droplets,
  Waves,
  RadioTower,
  Sprout,
  CircleDot,
  UtilityPole,
} from "lucide-react";
import { useI18n, netLabel } from "@/lib/i18n";

const ALL_KEYS: NetKey[] = ["electric", "gas", "water", "sewage", "telecom", "irrigation"];
const BASE = import.meta.env.BASE_URL;
const HIDDEN_DETAIL_TYPES = new Set([`n  String.fromCodePoint(0x62a,0x63a,0x630,0x64a,0x629,0x20,0x627,0x644,0x639,0x645,0x627,0x631,0x627,0x62a),`n  String.fromCodePoint(0x627,0x644,0x62a,0x63a,0x630,0x64a,0x629,0x20,0x627,0x644,0x645,0x646,0x632,0x644,0x64a,0x629),`n  String.fromCodePoint(0x62a,0x63a,0x630,0x64a,0x629,0x20,0x645,0x646,0x632,0x644,0x64a,0x629),`n  String.fromCodePoint(0x641,0x631,0x639,0x64a),`n  String.fromCodePoint(0x641,0x631,0x639,0x649),`n]);`nconst isHiddenDetailType = (type: string) => HIDDEN_DETAIL_TYPES.has(type.replace(/\s+/g, " ").trim());

type ViewMode = "map" | "table";

function getElementIcon(type: string, key: NetKey) {
  const t = type.toLowerCase();
  if (t.includes("انارة") || t.includes("إنارة") || t.includes("عمود")) return <UtilityPole className="w-4 h-4 shrink-0" />;
  if (t.includes("بيلر") || t.includes("كشك") || t.includes("موزع") || t.includes("كوفر")) return <Zap className="w-4 h-4 shrink-0" />;
  if (t.includes("غاز") || t.includes("مخفض")) return <Flame className="w-4 h-4 shrink-0" />;
  if (t.includes("حريق") || t.includes("حنفية")) return <Flame className="w-4 h-4 text-red-500 shrink-0" />;
  if (t.includes("مياه") || t.includes("محبس مياه")) return <Droplets className="w-4 h-4 shrink-0" />;
  if (t.includes("صرف") || t.includes("مطبق")) return <Waves className="w-4 h-4 shrink-0" />;
  if (t.includes("بوكس") || t.includes("كابينة") || t.includes("اتصالات") || t.includes("كابل")) return <RadioTower className="w-4 h-4 shrink-0" />;
  if (t.includes("ري")) return <Sprout className="w-4 h-4 shrink-0" />;
  if (key === "electric") return <Zap className="w-4 h-4 shrink-0" />;
  if (key === "gas") return <Flame className="w-4 h-4 shrink-0" />;
  if (key === "water") return <Droplets className="w-4 h-4 shrink-0" />;
  if (key === "sewage") return <Waves className="w-4 h-4 shrink-0" />;
  if (key === "telecom") return <RadioTower className="w-4 h-4 shrink-0" />;
  if (key === "irrigation") return <Sprout className="w-4 h-4 shrink-0" />;
  return <CircleDot className="w-4 h-4 shrink-0" />;
}

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
  const [detailSearch, setDetailSearch] = useState("");

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

  const isFiltered =
    networkFilter !== "all" ||
    sectorFilter !== "all" ||
    typeFilter !== "all" ||
    implementerFilter !== "all" ||
    featureSearch.trim().length > 0;

  const statsSummary = useMemo(() => {
    if (!allLoaded && summary.data) {
      const s = summary.data;
      const totalF = ALL_KEYS.reduce((sum, k) => sum + (s.networks[k]?.total || 0), 0);
      const totalKm = ALL_KEYS.reduce((sum, k) => sum + (s.networks[k]?.totalLengthKm || 0), 0);
      return {
        totalFeatures: totalF,
        totalLengthKm: totalKm,
        networksCount: ALL_KEYS.length,
        sectorsCount: sectorsQ.data?.polygons?.length || 0,
        implementersCount: filterOptions.implementers.length,
      };
    }

    let totalKm = 0;
    const networks = new Set<string>();
    const sectors = new Set<string>();
    const implementers = new Set<string>();

    filteredFeatures.forEach((f) => {
      if (f.l) totalKm += Number(f.l);
      if (f.n) networks.add(f.n);
      if (f.s) sectors.add(String(f.s));
      if (f.imp) implementers.add(String(f.imp));
    });

    return {
      totalFeatures: filteredFeatures.length,
      totalLengthKm: totalKm,
      networksCount: networkFilter !== "all" ? 1 : networks.size,
      sectorsCount: sectorFilter !== "all" ? 1 : sectors.size,
      implementersCount: implementerFilter !== "all" ? 1 : implementers.size,
    };
  }, [allLoaded, summary.data, sectorsQ.data, filterOptions.implementers, filteredFeatures, networkFilter, sectorFilter, implementerFilter]);

  const featureDetails = useMemo(() => {
    if (!allLoaded && summary.data) {
      return ALL_KEYS.flatMap((key) =>
        Object.entries(summary.data.networks[key]?.byType || {})
          .filter(([type]) => !["غير محدد", "غير محددة", "unknown", "undefined"].includes(type.trim().toLowerCase()))
          .map(([type, value]) => ({
            key,
            type,
            value: Number(value),
            color: NET_COLORS[key] || "#f59e0b",
          }))
      ).filter((item) => !isHiddenDetailType(item.type)).sort((a, b) => b.value - a.value);
    }

    const counts: Record<string, { key: NetKey; type: string; value: number; color: string }> = {};
    filteredFeatures.forEach((f) => {
      const key = (f.n as NetKey) || "electric";
      const type = String(f.t || "").trim();
      if (!type || ["غير محدد", "غير محددة", "unknown", "undefined"].includes(type.toLowerCase())) return;
      const compositeKey = `${key}___${type}`;
      if (!counts[compositeKey]) {
        counts[compositeKey] = {
          key,
          type,
          value: 0,
          color: NET_COLORS[key] || "#f59e0b",
        };
      }
      counts[compositeKey].value += 1;
    });
    return Object.values(counts).filter((item) => !isHiddenDetailType(item.type)).sort((a, b) => b.value - a.value);
  }, [allLoaded, summary.data, filteredFeatures]);

  const filteredDetailList = useMemo(() => {
    if (!detailSearch.trim()) return featureDetails;
    const q = detailSearch.trim().toLowerCase();
    return featureDetails.filter((item) =>
      td(item.type).toLowerCase().includes(q) ||
      netLabel(item.key, lang).toLowerCase().includes(q)
    );
  }, [featureDetails, detailSearch, td, lang]);

  const lengthBreakdown = useMemo(() => {
    if (!allLoaded && summary.data) {
      return ALL_KEYS.map((k) => ({
        name: netLabel(k, lang, true),
        value: Number((summary.data.networks[k]?.totalLengthKm || 0).toFixed(1)),
        color: NET_COLORS[k],
      })).filter((d) => d.value > 0);
    }

    const totals: Record<NetKey, number> = { electric: 0, gas: 0, water: 0, sewage: 0, telecom: 0, irrigation: 0 };
    filteredFeatures.forEach((f) => {
      if (f.n && f.l) totals[f.n] = (totals[f.n] || 0) + Number(f.l);
    });
    return ALL_KEYS.map((k) => ({
      name: netLabel(k, lang, true),
      value: Number((totals[k] || 0).toFixed(1)),
      color: NET_COLORS[k],
    })).filter((d) => d.value > 0);
  }, [allLoaded, summary.data, filteredFeatures, lang]);

  const elementCountBreakdown = useMemo(() => {
    if (!allLoaded && summary.data) {
      return ALL_KEYS.map((k) => ({
        name: netLabel(k, lang, true),
        value: Number(summary.data.networks[k]?.total || 0),
        color: NET_COLORS[k],
      })).filter((d) => d.value > 0);
    }

    const totals: Record<NetKey, number> = { electric: 0, gas: 0, water: 0, sewage: 0, telecom: 0, irrigation: 0 };
    filteredFeatures.forEach((f) => {
      if (f.n) totals[f.n] = (totals[f.n] || 0) + 1;
    });
    return ALL_KEYS.map((k) => ({
      name: netLabel(k, lang, true),
      value: totals[k] || 0,
      color: NET_COLORS[k],
    })).filter((d) => d.value > 0);
  }, [allLoaded, summary.data, filteredFeatures, lang]);

  const waterDiameterLengths = useMemo(() => {
    const totals: Record<string, number> = {};
    const summaryLengths = summary.data?.networks.water?.lengthByDiameter || {};
    Object.entries(summaryLengths).forEach(([diameter, lengthKm]) => {
      if (/^\d+(\.\d+)?$/.test(String(diameter))) totals[String(diameter)] = Number(lengthKm) * 1000;
    });
    const rawWaterFeatures = networkData[2]?.features || [];
    if (Object.keys(totals).length === 0) rawWaterFeatures.forEach((feature: SimpleFeature) => {
      const isLine = feature.c === "line" || feature.g?.t === "L" || feature.g?.t === "ML";
      if (!isLine || !feature.d) return;
      const diameter = String(feature.d).trim();
      if (!/^\d+(\.\d+)?$/.test(diameter)) return;
      const lenKm = Number(feature.l || 0);
      const lenMeters = lenKm > 0 ? lenKm * 1000 : 1;
      totals[diameter] = (totals[diameter] || 0) + lenMeters;
    });

    return Object.entries(totals)
      .sort(([a], [b]) => Number(a) - Number(b))
      .map(([name, value], index) => ({
        name: `${name} مم`,
        value: Number(value.toFixed(1)),
        color: ["#b5179e", "#087fba", "#8ba32b", "#824b84", "#d27b17", "#c7ad2f", "#4f8747", "#97744e", "#3a9386", "#5c5bb0", "#a33f6e", "#777777", "#168db2", "#0b70a1", "#8ba32b", "#8d4a91", "#d47c22"][index % 17],
      }));
  }, [allLoaded, filteredFeatures, networkData, summary.data]);

  const topImplementingData = useMemo(() => {
    if (!allLoaded && summary.data) {
      return topImplementing(summary.data.networks).map((d) => ({
        name: td(d.name),
        value: d.value,
      }));
    }
    const merged: Record<string, number> = {};
    filteredFeatures.forEach((f) => {
      if (f.imp && f.imp.trim()) {
        const impName = f.imp.trim();
        merged[impName] = (merged[impName] || 0) + 1;
      }
    });
    return Object.entries(merged)
      .map(([name, value]) => ({ name: td(name), value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 5);
  }, [allLoaded, summary.data, filteredFeatures, td]);

  const midPoint = Math.ceil(filteredDetailList.length / 2);
  const leftDetailList = filteredDetailList.slice(0, midPoint);
  const rightDetailList = filteredDetailList.slice(midPoint);

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

  return (
    <PageContainer>
      {/* ── Filters bar ── */}
      <div className="all-networks-filters glass-card rounded-md">
        <div className="flex items-center gap-2 text-foreground font-bold text-xs shrink-0">
          <Filter className="h-3.5 w-3.5 text-primary" />
          <span>{lang === "ar" ? "فلاتر الخريطة والكروت" : "Filters"}</span>
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
        <span className="all-networks-filter-count">
          {formatCount(filteredFeatures.length)} {lang === "ar" ? "عنصر مصفى" : "filtered"}
        </span>
      </div>

      <div className="all-networks-grid">
        {/* ── Left Column: All Element Stat Tiles (Matching Reference Image) ── */}
        <CardWrap
          title={lang === "ar" ? "عناصر شبكات المرافق" : "Utility Element Statistics"}
          delay={0.1}
          className="all-networks-toggle"
          right={
            <div className="relative w-24 md:w-32">
              <Search className={`absolute top-1/2 -translate-y-1/2 ${lang === "ar" ? "right-1.5" : "left-1.5"} w-2.5 h-2.5 text-muted-foreground`} />
              <input
                value={detailSearch}
                onChange={(e) => setDetailSearch(e.target.value)}
                placeholder={lang === "ar" ? "تصفية..." : "Filter..."}
                className={`w-full bg-secondary/40 border border-border/40 rounded text-[9.5px] py-0.5 ${lang === "ar" ? "pr-5 pl-1.5" : "pl-5 pr-1.5"} focus:outline-none focus:border-primary/60 transition`}
              />
            </div>
          }
        >
          <div className="grid grid-cols-2 md:grid-cols-3 gap-1.5 overflow-y-auto pr-1 h-full content-start">
            {filteredDetailList.map((item, index) => {
              const icon = getElementIcon(item.type, item.key);
              return (
                <div
                  key={`${item.key}-${item.type}-${index}`}
                  className="rounded-md border border-border/40 bg-background/35 p-2 flex flex-col justify-between hover:bg-secondary/30 transition min-w-0"
                >
                  <div className="text-[10px] font-bold text-foreground/80 truncate leading-tight" title={td(item.type)}>
                    {td(item.type)}
                  </div>
                  <div className="mt-1 flex items-center justify-between gap-1">
                    <div style={{ color: item.color }}>
                      {icon}
                    </div>
                    <span className="text-base font-black tabular-nums leading-none" style={{ color: item.color }}>
                      {formatCount(item.value)}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </CardWrap>

        {/* ── Center Column: Map View (Spans Wide Area) ── */}
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
                {/* View toggle in map */}
                <div className={`absolute top-2 ${lang === "ar" ? "right-2" : "left-2"} z-[400] flex items-center gap-0.5 glass-card rounded p-0.5`}>
                  <button
                    onClick={() => setViewMode("map")}
                    className={`flex items-center gap-1 px-2 py-1 rounded text-[10px] font-medium transition ${
                      viewMode === "map"
                        ? "bg-primary text-background"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                    title={t("view.map")}
                  >
                    <MapIcon className="w-3 h-3" />
                    {t("view.map")}
                  </button>
                  <button
                    onClick={() => setViewMode("table")}
                    className="flex items-center gap-1 px-2 py-1 rounded text-[10px] font-medium transition text-muted-foreground hover:text-foreground"
                    title={t("view.table")}
                  >
                    <TableIcon className="w-3 h-3" />
                    {t("view.table")}
                  </button>
                </div>
                {/* Map legend */}
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

        {/* ── Bottom Row Charts (Reacts dynamically to top filters) ── */}
        <CardWrap title={lang === "ar" ? "أطوال أقطار خطوط شبكة المياه بالمتر" : "Water network pipe lengths by diameter (m)"} delay={0.25} className="all-networks-length-chart">
          <SerialChart key={`water-diameters-${waterDiameterLengths.length}-${allLoaded}`} data={waterDiameterLengths} />
        </CardWrap>

        <CardWrap title={t("card.top_implementing")} delay={0.3} className="all-networks-top-implementing">
          <MiniBars
            data={topImplementingData}
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
