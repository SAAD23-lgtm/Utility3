import { useCallback, useEffect, useMemo, useState } from "react";
import { useSummary, useSectors, formatCount, formatKm } from "@/lib/data";
import { PageContainer } from "@/components/Layout";
import { StatCard } from "@/components/StatCard";
import { CardWrap, Donut, MiniBars } from "@/components/Charts";
import { MapView } from "@/components/Map";
import { DataTable } from "@/components/DataTable";
import { NetworkIcon } from "@/components/NetworkIcon";
import { NET_COLORS, type NetKey, type SimpleFeature } from "@/lib/types";
import { useQueries } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { Layers, Activity, Map as MapIcon, Table as TableIcon } from "lucide-react";
import { useI18n, netLabel } from "@/lib/i18n";

const ALL_KEYS: NetKey[] = ["electric", "gas", "water", "sewage", "telecom", "irrigation"];
const BASE = import.meta.env.BASE_URL;

type ViewMode = "map" | "table";

interface NetworkInsight {
  key: NetKey;
  sectorCount: number;
  topSector: string;
  topParty: string;
  linePct: number;
  pointPct: number;
  roomPct: number;
  totalLengthKm: number;
}

function topRecordName(record: Record<string, number> | undefined) {
  return Object.entries(record || {}).sort((a, b) => Number(b[1]) - Number(a[1]))[0]?.[0] || "";
}

export function AllNetworksPage() {
  const { t, td, lang } = useI18n();
  const summary = useSummary();
  const sectorsQ = useSectors();
  const [enabled, setEnabled] = useState<Set<NetKey>>(new Set(ALL_KEYS));
  const [viewMode, setViewMode] = useState<ViewMode>("map");
  const [flyTo, setFlyTo] = useState<SimpleFeature | null>(null);
  const [loadNetworks, setLoadNetworks] = useState(false);

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

  const allLoaded = networkQueries.every((q) => !!q.data);

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

  const sectorNames = sectorsQ.data.polygons
    .map((sector) => sector.name)
    .filter((name) => name && name.trim().length > 0);

  const networkInsights: Record<NetKey, NetworkInsight> = ALL_KEYS.reduce((acc, key) => {
    const stat = s.networks[key];
    const byCategory = stat?.byCategory || {};
    const total = stat?.total || 0;
    const sectorCount = Object.keys(stat?.bySector || {}).length;
    acc[key] = {
      key,
      sectorCount,
      topSector: topRecordName(stat?.bySector),
      topParty: topRecordName(stat?.byImplementing),
      linePct: total > 0 ? ((byCategory.line || 0) / total) * 100 : 0,
      pointPct: total > 0 ? ((byCategory.point || 0) / total) * 100 : 0,
      roomPct: total > 0 ? ((byCategory.room || 0) / total) * 100 : 0,
      totalLengthKm: stat?.totalLengthKm || 0,
    };
    return acc;
  }, {} as Record<NetKey, NetworkInsight>);

  const featureDetails = ALL_KEYS.flatMap((key) =>
    Object.entries(s.networks[key]?.byType || {}).map(([type, value]) => ({
      key,
      type,
      value: Number(value),
      color: NET_COLORS[key],
    }))
  ).sort((a, b) => b.value - a.value).slice(0, 20);
  const leftFeatureDetails = featureDetails.slice(0, 10);
  const rightFeatureDetails = featureDetails.slice(10, 20);

  const lengthBreakdown = ALL_KEYS.map((k) => ({
    name: netLabel(k, lang, true),
    value: Number((s.networks[k]?.totalLengthKm || 0).toFixed(1)),
    color: NET_COLORS[k],
  })).filter((d) => d.value > 0);

  return (
    <PageContainer>
      <div className="all-networks-grid">
        <div className="all-networks-stats">
          <StatCard
            label={t("stat.total_network_elements")}
            value={formatCount(totalFeatures)}
            color="#f59e0b"
            icon={<Layers className="w-4 h-4" />}
          />
          <StatCard
            label={t("stat.total_lengths_all")}
            value={formatCount(Math.round(totalLengthKm))}
            unit={t("g.km")}
            color="#10b981"
            icon={<Activity className="w-4 h-4" />}
            delay={0.05}
          />
        </div>

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
          <div className="grid grid-cols-2 gap-1 overflow-y-auto h-full pr-1">
            {leftFeatureDetails.map((item, index) => (
              <div key={`${item.key}-${item.type}-${index}`} className="rounded-md border border-border/40 bg-background/35 px-1.5 py-1.5 min-w-0">
                <div className="truncate text-[9px] text-foreground/90" title={td(item.type)}>{td(item.type)}</div>
                <div className="mt-0.5 flex items-center justify-between gap-1">
                  <span className="truncate text-[8px] text-muted-foreground">{netLabel(item.key, lang)}</span>
                  <span className="shrink-0 text-[11px] font-black tabular-nums" style={{ color: item.color }}>{formatCount(item.value)}</span>
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
                  features={allFeatures}
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
                  features={allFeatures}
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
            <div className="grid grid-cols-1 gap-1 overflow-y-auto h-full pr-1">
              {rightFeatureDetails.map((item, index) => (
                <div key={`${item.key}-${item.type}-${index}`} className="rounded-md border border-border/40 bg-background/35 px-2 py-1.5 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <div className="truncate text-[9px] text-foreground/90" title={td(item.type)}>{td(item.type)}</div>
                    <span className="shrink-0 text-[12px] font-black tabular-nums" style={{ color: item.color }}>{formatCount(item.value)}</span>
                  </div>
                  <div className="mt-0.5 truncate text-[8px] text-muted-foreground">{netLabel(item.key, lang)}</div>
                </div>
              ))}
            </div>
          </CardWrap>
        </div>

        <CardWrap title={t("card.lengths_by_network")} delay={0.25}>
          <Donut
            data={lengthBreakdown}
            centerLabel={t("g.total")}
            centerValue={formatKm(totalLengthKm)}
            thin
            compact
            maxItems={6}
          />
        </CardWrap>

        <CardWrap title={t("card.top_implementing")} delay={0.3}>
          <MiniBars
            data={topImplementing(s.networks).map((d) => ({
              name: td(d.name),
              value: d.value,
            }))}
            color="#10b981"
            maxItems={5}
          />
        </CardWrap>

        <CardWrap title={t("card.network_share")} delay={0.35}>
          <div className="all-networks-share-grid">
            {ALL_KEYS.map((k) => {
              const stat = s.networks[k];
              if (!stat) return null;
              const total = stat.total;
              const insight = networkInsights[k];
              const coveragePct = sectorNames.length > 0 ? (insight.sectorCount / sectorNames.length) * 100 : 0;
              return (
                <motion.div
                  key={k}
                  whileHover={{ scale: 1.03 }}
                  className="rounded-md p-1.5 flex flex-col justify-between overflow-hidden"
                  style={{
                    background: `${NET_COLORS[k]}14`,
                    border: `1px solid ${NET_COLORS[k]}40`,
                  }}
                >
                  <div className="text-[9.5px] text-foreground/80 font-medium flex items-center gap-1">
                    <NetworkIcon network={k} className="w-3.5 h-3.5" />
                    <span className="truncate">{netLabel(k, lang, true)}</span>
                  </div>
                  <div>
                    <div
                      className="text-base font-black tabular-nums leading-none"
                      style={{ color: NET_COLORS[k] }}
                    >
                      {formatCount(total)}
                    </div>
                    <div className="mt-1 grid grid-cols-2 gap-1 text-[8px] text-muted-foreground">
                      <span className="truncate">
                        {t("biz.coverage")} <b className="font-black text-foreground/80 tabular-nums">{coveragePct.toFixed(0)}%</b>
                      </span>
                      <span className="truncate">
                        {t("g.km")} <b className="font-black text-foreground/80 tabular-nums">{Math.round(insight.totalLengthKm)}</b>
                      </span>
                      <span className="truncate">
                        {t("cat.line")} <b className="font-black text-foreground/80 tabular-nums">{insight.linePct.toFixed(0)}%</b>
                      </span>
                      <span className="truncate">
                        {t("cat.point")} <b className="font-black text-foreground/80 tabular-nums">{insight.pointPct.toFixed(0)}%</b>
                      </span>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>
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
      merged[name] = (merged[name] || 0) + (count as number);
    });
  });
  return Object.entries(merged)
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value);
}
