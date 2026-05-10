import { useMemo, useState } from "react";
import { useSummary, useSectors, formatCount, formatKm } from "@/lib/data";
import { PageContainer } from "@/components/Layout";
import { StatCard } from "@/components/StatCard";
import { CardWrap, Donut, MiniBars, RadialChart } from "@/components/Charts";
import { MapView } from "@/components/Map";
import { DataTable } from "@/components/DataTable";
import { NetworkIcon } from "@/components/NetworkIcon";
import { NET_COLORS, type NetKey, type SimpleFeature } from "@/lib/types";
import { useQueries } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { Layers, Activity, Pipette, Hash, Map as MapIcon, Table as TableIcon } from "lucide-react";
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

function sampleForMap(key: NetKey, features: SimpleFeature[]) {
  const lines = features.filter((feature) => feature.c === "line");
  const rooms = features.filter((feature) => feature.c === "room");
  const points = features.filter((feature) => feature.c === "point");

  if (key === "electric") {
    return [
      ...lines,
      ...rooms,
      ...points,
    ];
  }

  const limits: Record<NetKey, { lines: number; rooms: number; points: number }> = {
    electric: { lines: 0, rooms: 0, points: 0 },
    gas: { lines: 1800, rooms: 14, points: Number.POSITIVE_INFINITY },
    water: { lines: 1800, rooms: 158, points: Number.POSITIVE_INFINITY },
    sewage: { lines: 1500, rooms: 13, points: Number.POSITIVE_INFINITY },
    telecom: { lines: 1500, rooms: 51, points: Number.POSITIVE_INFINITY },
    irrigation: { lines: 900, rooms: 51, points: Number.POSITIVE_INFINITY },
  };
  const limit = limits[key];
  return [
    ...lines.slice(0, limit.lines),
    ...rooms.slice(0, limit.rooms),
    ...points.slice(0, limit.points),
  ];
}

function topRecordName(record: Record<string, number> | undefined) {
  return Object.entries(record || {}).sort((a, b) => Number(b[1]) - Number(a[1]))[0]?.[0] || "";
}

export function AllNetworksPage() {
  const { t, td, lang } = useI18n();
  const summary = useSummary();
  const sectorsQ = useSectors();
  const [enabled, setEnabled] = useState<Set<NetKey>>(new Set(ALL_KEYS));
  const [activeNet, setActiveNet] = useState<NetKey | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>("map");
  const [flyTo, setFlyTo] = useState<SimpleFeature | null>(null);

  const networkQueries = useQueries({
    queries: ALL_KEYS.map((k) => ({
      queryKey: ["network", k],
      queryFn: async () => {
        const res = await fetch(`${BASE}data/network-${k}.json`);
        return res.json();
      },
      staleTime: Infinity,
    })),
  });

  const mapFeatures = useMemo(() => {
    const out: SimpleFeature[] = [];
    networkQueries.forEach((q, i) => {
      if (!q.data) return;
      const key = ALL_KEYS[i];
      out.push(...sampleForMap(key, q.data.features));
    });
    return out;
  }, [networkQueries]);

  const allFeatures = useMemo(() => {
    const out: SimpleFeature[] = [];
    networkQueries.forEach((q, i) => {
      if (!q.data) return;
      const key = ALL_KEYS[i];
      if (!enabled.has(key)) return;
      out.push(...q.data.features);
    });
    return out;
  }, [networkQueries, enabled]);

  const allLoaded = networkQueries.every((q) => !!q.data);

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
  const totalLines = ALL_KEYS.reduce(
    (sum, k) => sum + (s.networks[k]?.byCategory?.line || 0),
    0
  );
  const totalPoints = ALL_KEYS.reduce(
    (sum, k) => sum + (s.networks[k]?.byCategory?.point || 0),
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

  const networkBreakdown = ALL_KEYS.map((k) => ({
    name: netLabel(k, lang, true),
    value: s.networks[k]?.total || 0,
    color: NET_COLORS[k],
    key: k,
  }));

  const lengthBreakdown = ALL_KEYS.map((k) => ({
    name: netLabel(k, lang, true),
    value: Number((s.networks[k]?.totalLengthKm || 0).toFixed(1)),
    color: NET_COLORS[k],
  })).filter((d) => d.value > 0);

  const radarData = ALL_KEYS.map((k) => ({
    subject: netLabel(k, lang, true).slice(0, 10),
    value: s.networks[k]?.total || 0,
    fullMark: Math.max(...ALL_KEYS.map((kk) => s.networks[kk]?.total || 0)),
  }));

  const toggleNet = (k: NetKey) => {
    setEnabled((prev) => {
      const next = new Set(prev);
      if (next.has(k)) next.delete(k);
      else next.add(k);
      return next;
    });
  };

  const handleLocate = (f: SimpleFeature) => {
    setFlyTo(f);
    setViewMode("map");
  };

  return (
    <PageContainer>
      <div
        className="grid h-full gap-2.5"
        style={{
          gridTemplateColumns: "270px 1fr 290px",
          gridTemplateRows: "auto 1fr 220px",
        }}
      >
        <div className="col-span-3 grid grid-cols-4 gap-2">
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
          <StatCard
            label={t("stat.lines_count")}
            value={formatCount(totalLines)}
            color="#3b82f6"
            icon={<Pipette className="w-4 h-4" />}
            delay={0.1}
          />
          <StatCard
            label={t("stat.points_count")}
            value={formatCount(totalPoints)}
            color="#a855f7"
            icon={<Hash className="w-4 h-4" />}
            delay={0.15}
          />
        </div>

        <CardWrap
          title={t("card.networks_toggle")}
          delay={0.1}
          className="row-span-2 overflow-hidden"
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
          <div className="space-y-1.5 overflow-y-auto h-full pr-1">
            {ALL_KEYS.map((k, i) => {
              const stat = s.networks[k];
              const insight = networkInsights[k];
              const isOn = enabled.has(k);
              const isActive = activeNet === k;
              return (
                <motion.button
                  key={k}
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.04 }}
                  onClick={() => toggleNet(k)}
                  onMouseEnter={() => setActiveNet(k)}
                  onMouseLeave={() => setActiveNet(null)}
                  className={`w-full text-start p-2 rounded-md transition border ${
                    isActive ? "border-primary/40" : "border-border/40"
                  } ${isOn ? "" : "opacity-40"}`}
                  style={{
                    background: isOn ? `${NET_COLORS[k]}14` : "transparent",
                  }}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="flex items-center gap-1.5 text-[11.5px] font-bold">
                      <NetworkIcon network={k} className="w-3.5 h-3.5" />
                      <span style={{ color: NET_COLORS[k] }}>
                        {netLabel(k, lang)}
                      </span>
                    </span>
                    <span
                      className="w-3.5 h-3.5 rounded-sm border-2"
                      style={{
                        borderColor: NET_COLORS[k],
                        background: isOn ? NET_COLORS[k] : "transparent",
                      }}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-1 text-[9.5px]">
                    <div className="bg-background/40 rounded-sm p-1">
                      <div className="text-muted-foreground">{t("stat.total_elements")}</div>
                      <div
                        className="font-bold tabular-nums"
                        style={{ color: NET_COLORS[k] }}
                      >
                        {formatCount(stat?.total || 0)}
                      </div>
                    </div>
                    <div className="bg-background/40 rounded-sm p-1">
                      <div className="text-muted-foreground">{t("stat.total_lengths")}</div>
                      <div
                        className="font-bold tabular-nums"
                        style={{ color: NET_COLORS[k] }}
                      >
                        {(stat?.totalLengthKm || 0).toFixed(1)} {t("g.km")}
                      </div>
                    </div>
                  </div>
                  <div className="mt-1.5 grid grid-cols-2 gap-1 text-[8.5px]">
                    <div className="rounded-sm border border-white/5 bg-background/25 p-1">
                      <div className="text-muted-foreground">{t("biz.coverage")}</div>
                      <div className="font-bold tabular-nums" style={{ color: NET_COLORS[k] }}>
                        {insight.sectorCount}/{sectorNames.length}
                      </div>
                    </div>
                    <div className="rounded-sm border border-white/5 bg-background/25 p-1">
                      <div className="text-muted-foreground">{t("stat.lines")}</div>
                      <div className="font-bold tabular-nums" style={{ color: NET_COLORS[k] }}>
                        {insight.linePct.toFixed(0)}%
                      </div>
                    </div>
                  </div>
                  <div className="mt-1.5 space-y-0.5 text-[8.5px] text-muted-foreground">
                    <div className="truncate" title={td(insight.topSector)}>
                      {t("insight.top_sector")}: <span className="text-foreground/85">{td(insight.topSector) || t("g.dash")}</span>
                    </div>
                    <div className="truncate" title={td(insight.topParty)}>
                      {t("filter.implementing")}: <span className="text-foreground/85">{td(insight.topParty) || t("g.dash")}</span>
                    </div>
                  </div>
                </motion.button>
              );
            })}
          </div>
        </CardWrap>

        <div className="row-span-2 relative">
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
                  features={mapFeatures}
                  visibleNetworks={enabled}
                  flyToFeature={flyTo}
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

        <div className="row-span-2 grid grid-rows-2 gap-2 overflow-hidden">
          <CardWrap title={t("card.network_distribution")} delay={0.15}>
            <Donut
              data={networkBreakdown}
              centerLabel={t("g.total")}
              centerValue={formatCount(totalFeatures)}
              compact
            />
          </CardWrap>
          <CardWrap title={t("card.network_radar")} delay={0.2}>
            <RadialChart data={radarData} />
          </CardWrap>
        </div>

        <CardWrap title={t("card.lengths_by_network")} delay={0.25}>
          <Donut
            data={lengthBreakdown}
            centerLabel={t("g.total")}
            centerValue={formatKm(totalLengthKm)}
            thin
            compact
          />
        </CardWrap>

        <CardWrap title={t("card.top_implementing")} delay={0.3}>
          <MiniBars
            data={topImplementing(s.networks).slice(0, 7).map((d) => ({
              name: td(d.name),
              value: d.value,
            }))}
            color="#10b981"
          />
        </CardWrap>

        <CardWrap title={t("card.network_share")} delay={0.35}>
          <div className="grid grid-cols-3 gap-1 h-full">
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
