import { useMemo, useState } from "react";
import { useSummary, useSectors, formatCount, formatKm } from "@/lib/data";
import { PageContainer } from "@/components/Layout";
import { StatCard } from "@/components/StatCard";
import { CardWrap, MiniBars } from "@/components/Charts";
import { MapView } from "@/components/Map";
import { DataTable } from "@/components/DataTable";
import { NetworkIcon } from "@/components/NetworkIcon";
import { NET_COLORS, type NetKey, type SimpleFeature } from "@/lib/types";
import { useQueries } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  Filter,
  Layers,
  Map as MapIcon,
  Table as TableIcon,
  Target,
  Users,
  X,
} from "lucide-react";
import { useI18n, netLabel } from "@/lib/i18n";

const ALL_KEYS: NetKey[] = ["electric", "gas", "water", "sewage", "telecom", "irrigation"];
const BASE = import.meta.env.BASE_URL;

type ViewMode = "map" | "table";
type NetworkFileLike = { features: SimpleFeature[] };

interface MatrixCell {
  count: number;
  lengthKm: number;
  lines: number;
  points: number;
  rooms: number;
}

interface SectorReadiness {
  name: string;
  networkCount: number;
  totalElements: number;
  totalLengthKm: number;
  topParty: string;
  missing: NetKey[];
  cells: Partial<Record<NetKey, MatrixCell>>;
}

interface NetworkCoverage {
  key: NetKey;
  sectorCount: number;
  coveragePct: number;
  total: number;
  totalLengthKm: number;
  linePct: number;
  topParty: string;
  riskScore: number;
}

function sampleForMap(key: NetKey, features: SimpleFeature[]) {
  const lines = features.filter((feature) => feature.c === "line");
  const rooms = features.filter((feature) => feature.c === "room");
  const points = features.filter((feature) => feature.c === "point");

  if (key === "electric") return [...lines, ...rooms, ...points];

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

function incrementCell(cell: MatrixCell, feature: SimpleFeature) {
  cell.count += 1;
  cell.lengthKm += feature.l || 0;
  if (feature.c === "line") cell.lines += 1;
  else if (feature.c === "room") cell.rooms += 1;
  else cell.points += 1;
}

function emptyCell(): MatrixCell {
  return { count: 0, lengthKm: 0, lines: 0, points: 0, rooms: 0 };
}

function topEntry(record: Record<string, number>) {
  return Object.entries(record).sort((a, b) => b[1] - a[1])[0] || null;
}

function topImplementingFromStats(networks: Record<NetKey, any>) {
  const merged: Record<string, number> = {};
  ALL_KEYS.forEach((k) => {
    const imp = networks[k]?.byImplementing || {};
    Object.entries(imp).forEach(([name, count]) => {
      merged[name] = (merged[name] || 0) + Number(count);
    });
  });
  return Object.entries(merged)
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value);
}

function getCellStatus(cell?: MatrixCell) {
  if (!cell || cell.count === 0) return "missing";
  if (cell.lengthKm > 0 && cell.points + cell.rooms === 0) return "length";
  if (cell.lengthKm === 0 && cell.points + cell.rooms > 0) return "points";
  return "complete";
}

function getCellLabel(status: string, t: (key: string) => string) {
  if (status === "length") return t("biz.length_only");
  if (status === "points") return t("biz.points_only");
  if (status === "complete") return t("biz.present");
  return t("biz.missing");
}

export function AllNetworksPage() {
  const { t, td, lang } = useI18n();
  const summary = useSummary();
  const sectorsQ = useSectors();
  const [enabled, setEnabled] = useState<Set<NetKey>>(new Set(ALL_KEYS));
  const [activeNet, setActiveNet] = useState<NetKey | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>("map");
  const [flyTo, setFlyTo] = useState<SimpleFeature | null>(null);
  const [selectedSector, setSelectedSector] = useState<string | null>(null);
  const [selectedParty, setSelectedParty] = useState<string | null>(null);
  const [incompleteOnly, setIncompleteOnly] = useState(false);

  const networkQueries = useQueries({
    queries: ALL_KEYS.map((k) => ({
      queryKey: ["network", k],
      queryFn: async () => {
        const res = await fetch(`${BASE}data/network-${k}.json`);
        return res.json() as Promise<NetworkFileLike>;
      },
      staleTime: Infinity,
    })),
  });

  const allLoaded = networkQueries.every((q) => !!q.data);
  const s = summary.data;
  const namedSectors = (sectorsQ.data?.polygons || []).filter((sector) => sector.name?.trim());
  const sectorNames = namedSectors.map((sector) => sector.name);
  const sectorNameKey = sectorNames.join("|");

  const loadedFeaturesByNetwork = useMemo(() => {
    const out: Partial<Record<NetKey, SimpleFeature[]>> = {};
    networkQueries.forEach((q, i) => {
      if (q.data) out[ALL_KEYS[i]] = q.data.features || [];
    });
    return out;
  }, [networkQueries]);

  const execution = useMemo(() => {
    const sectorNameSet = new Set(sectorNames);
    const matrix: Record<string, Partial<Record<NetKey, MatrixCell>>> = {};
    const sectorParties: Record<string, Record<string, number>> = {};
    const networkCoverage: NetworkCoverage[] = [];
    const allParties: Record<string, number> = {};

    sectorNames.forEach((name) => {
      matrix[name] = {};
      sectorParties[name] = {};
    });

    ALL_KEYS.forEach((key) => {
      const features = loadedFeaturesByNetwork[key] || [];
      const sectorsWithNetwork = new Set<string>();
      const parties: Record<string, number> = {};
      let totalLines = 0;
      let totalLengthKm = 0;

      features.forEach((feature) => {
        if (feature.c === "line") totalLines += 1;
        totalLengthKm += feature.l || 0;
        if (feature.imp) {
          parties[feature.imp] = (parties[feature.imp] || 0) + 1;
          allParties[feature.imp] = (allParties[feature.imp] || 0) + 1;
        }
        if (!feature.s || !sectorNameSet.has(feature.s)) return;
        sectorsWithNetwork.add(feature.s);
        const cell = matrix[feature.s][key] || emptyCell();
        incrementCell(cell, feature);
        matrix[feature.s][key] = cell;
        if (feature.imp) {
          sectorParties[feature.s][feature.imp] = (sectorParties[feature.s][feature.imp] || 0) + 1;
        }
      });

      const stat = s?.networks[key];
      const coveragePct = sectorNames.length > 0 ? (sectorsWithNetwork.size / sectorNames.length) * 100 : 0;
      const total = stat?.total || features.length;
      const linePct = total > 0 ? (totalLines / total) * 100 : 0;
      const topParty = topEntry(parties)?.[0] || "";
      networkCoverage.push({
        key,
        sectorCount: sectorsWithNetwork.size,
        coveragePct,
        total,
        totalLengthKm: stat?.totalLengthKm || totalLengthKm,
        linePct,
        topParty,
        riskScore: (100 - coveragePct) + Math.min(35, total / 800),
      });
    });

    const sectorReadiness: SectorReadiness[] = sectorNames.map((name) => {
      const cells = matrix[name];
      const networkCount = ALL_KEYS.filter((key) => (cells[key]?.count || 0) > 0).length;
      const totalElements = ALL_KEYS.reduce((sum, key) => sum + (cells[key]?.count || 0), 0);
      const totalLengthKm = ALL_KEYS.reduce((sum, key) => sum + (cells[key]?.lengthKm || 0), 0);
      return {
        name,
        networkCount,
        totalElements,
        totalLengthKm,
        topParty: topEntry(sectorParties[name])?.[0] || "",
        missing: ALL_KEYS.filter((key) => !cells[key]?.count),
        cells,
      };
    });

    return {
      matrix,
      networkCoverage,
      sectorReadiness: sectorReadiness.sort((a, b) => {
        if (a.networkCount !== b.networkCount) return a.networkCount - b.networkCount;
        return b.totalElements - a.totalElements;
      }),
      implementingLoad: Object.entries(allParties)
        .map(([name, value]) => ({ name, value }))
        .sort((a, b) => b.value - a.value),
    };
  }, [loadedFeaturesByNetwork, s?.networks, sectorNameKey]);

  const incompleteSectorSet = useMemo(
    () => new Set(execution.sectorReadiness.filter((sector) => sector.networkCount < ALL_KEYS.length).map((sector) => sector.name)),
    [execution.sectorReadiness]
  );

  const filteredFeature = (feature: SimpleFeature) => {
    if (!enabled.has(feature.n)) return false;
    if (selectedSector && feature.s !== selectedSector) return false;
    if (selectedParty && feature.imp !== selectedParty) return false;
    if (incompleteOnly && (!feature.s || !incompleteSectorSet.has(feature.s))) return false;
    return true;
  };

  const mapFeatures = useMemo(() => {
    const out: SimpleFeature[] = [];
    ALL_KEYS.forEach((key) => {
      const sampled = sampleForMap(key, loadedFeaturesByNetwork[key] || []);
      out.push(...sampled.filter(filteredFeature));
    });
    return out;
  }, [loadedFeaturesByNetwork, enabled, selectedSector, selectedParty, incompleteOnly, incompleteSectorSet]);

  const tableFeatures = useMemo(() => {
    const out: SimpleFeature[] = [];
    ALL_KEYS.forEach((key) => {
      out.push(...(loadedFeaturesByNetwork[key] || []).filter(filteredFeature));
    });
    return out;
  }, [loadedFeaturesByNetwork, enabled, selectedSector, selectedParty, incompleteOnly, incompleteSectorSet]);

  const visibleSectors = useMemo(() => {
    const polygons = sectorsQ.data?.polygons || [];
    if (!selectedSector && !incompleteOnly) return polygons;
    return polygons.filter((sector) => {
      if (selectedSector && sector.name !== selectedSector) return false;
      if (incompleteOnly && !incompleteSectorSet.has(sector.name)) return false;
      return true;
    });
  }, [sectorsQ.data?.polygons, selectedSector, incompleteOnly, incompleteSectorSet]);

  if (!s || !sectorsQ.data) {
    return (
      <PageContainer>
        <div className="h-full flex items-center justify-center text-muted-foreground text-sm">
          {t("state.loading")}
        </div>
      </PageContainer>
    );
  }

  const totalFeatures = ALL_KEYS.reduce((sum, k) => sum + (s.networks[k]?.total || 0), 0);
  const totalLengthKm = ALL_KEYS.reduce((sum, k) => sum + (s.networks[k]?.totalLengthKm || 0), 0);
  const readySectors = execution.sectorReadiness.filter((sector) => sector.networkCount >= ALL_KEYS.length).length;
  const readinessPct = sectorNames.length > 0 ? (readySectors / sectorNames.length) * 100 : 0;
  const incompleteCount = execution.sectorReadiness.length - readySectors;
  const topExecutionLoad = execution.implementingLoad[0] || topImplementingFromStats(s.networks)[0];
  const topLoadPct = topExecutionLoad && totalFeatures > 0 ? (topExecutionLoad.value / totalFeatures) * 100 : 0;
  const criticalNetworks = [...execution.networkCoverage].sort((a, b) => b.riskScore - a.riskScore);
  const criticalNetwork = criticalNetworks[0];

  const prioritySectors = incompleteOnly
    ? execution.sectorReadiness.filter((sector) => sector.networkCount < ALL_KEYS.length)
    : execution.sectorReadiness;

  const toggleNet = (k: NetKey) => {
    setEnabled((prev) => {
      const next = new Set(prev);
      if (next.has(k)) next.delete(k);
      else next.add(k);
      return next;
    });
  };

  const clearFilters = () => {
    setSelectedSector(null);
    setSelectedParty(null);
    setIncompleteOnly(false);
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
          gridTemplateColumns: "300px 1fr 310px",
          gridTemplateRows: "auto 1fr 230px",
        }}
      >
        <div className="col-span-3 grid grid-cols-4 gap-2">
          <StatCard
            label={t("biz.execution_readiness")}
            value={`${readinessPct.toFixed(0)}%`}
            color="#10b981"
            icon={<CheckCircle2 className="w-4 h-4" />}
          />
          <StatCard
            label={t("biz.incomplete_sectors")}
            value={formatCount(incompleteCount)}
            color="#f59e0b"
            icon={<AlertTriangle className="w-4 h-4" />}
            delay={0.05}
          />
          <StatCard
            label={t("biz.top_execution_load")}
            value={`${topLoadPct.toFixed(1)}%`}
            color="#a855f7"
            icon={<Users className="w-4 h-4" />}
            delay={0.1}
          />
          <StatCard
            label={t("biz.critical_networks")}
            value={criticalNetwork ? netLabel(criticalNetwork.key, lang, true) : t("g.dash")}
            color={criticalNetwork ? NET_COLORS[criticalNetwork.key] : "#ef4444"}
            icon={<Target className="w-4 h-4" />}
            delay={0.15}
          />
        </div>

        <CardWrap
          title={t("biz.priority_sectors")}
          delay={0.1}
          className="row-span-2 overflow-hidden"
          right={
            <button
              onClick={() => setIncompleteOnly((value) => !value)}
              className={`flex items-center gap-1 rounded px-2 py-1 text-[9.5px] font-bold transition ${
                incompleteOnly ? "bg-amber-500 text-background" : "bg-secondary/50 text-muted-foreground hover:text-foreground"
              }`}
            >
              <Filter className="w-3 h-3" />
              {t("biz.incomplete_only")}
            </button>
          }
        >
          <PrioritySectorList
            sectors={prioritySectors}
            selectedSector={selectedSector}
            onSelect={(name) => setSelectedSector((current) => (current === name ? null : name))}
            td={td}
            t={t}
          />
        </CardWrap>

        <div className="row-span-2 relative overflow-hidden rounded-lg">
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
                  adminBoundaries={sectorsQ.data.adminBoundaries}
                  features={mapFeatures}
                  visibleNetworks={enabled}
                  flyToFeature={flyTo}
                  highlightSector={selectedSector}
                  onSectorClick={(sector) => setSelectedSector((current) => (current === sector.name ? null : sector.name))}
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
                  features={tableFeatures}
                  color="#f59e0b"
                  showNetworkColumn
                  onLocate={handleLocate}
                />
              </motion.div>
            )}
          </AnimatePresence>

          <div className={`absolute top-2 ${lang === "ar" ? "left-2" : "right-2"} z-[500] flex items-center gap-1 glass-card rounded-md p-1`}>
            <button
              onClick={() => setViewMode("map")}
              className={`flex items-center gap-1 px-2 py-1 rounded text-[10px] font-bold transition ${
                viewMode === "map" ? "bg-primary text-background" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <MapIcon className="w-3 h-3" />
              {t("view.map")}
            </button>
            <button
              onClick={() => setViewMode("table")}
              className={`flex items-center gap-1 px-2 py-1 rounded text-[10px] font-bold transition ${
                viewMode === "table" ? "bg-primary text-background" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <TableIcon className="w-3 h-3" />
              {t("view.table")}
            </button>
          </div>

          {(selectedSector || selectedParty || incompleteOnly) && (
            <div className={`absolute bottom-2 ${lang === "ar" ? "left-2" : "right-2"} z-[500] glass-card rounded-md px-2 py-1.5 text-[10px] flex items-center gap-2`}>
              <span className="text-muted-foreground">{t("filter.filtered")}</span>
              <span className="font-black tabular-nums text-foreground">{formatCount(tableFeatures.length)}</span>
              <button onClick={clearFilters} className="rounded bg-red-500/15 p-1 text-red-400 hover:bg-red-500/25">
                <X className="w-3 h-3" />
              </button>
            </div>
          )}
        </div>

        <CardWrap title={t("card.networks_toggle")} delay={0.15} className="row-span-2 overflow-hidden">
          <NetworkExecutionPanel
            coverage={execution.networkCoverage}
            enabled={enabled}
            activeNet={activeNet}
            selectedParty={selectedParty}
            onToggle={toggleNet}
            onActive={setActiveNet}
            onParty={(party) => setSelectedParty((current) => (current === party ? null : party))}
            td={td}
            t={t}
            lang={lang}
          />
        </CardWrap>

        <CardWrap title={t("biz.coverage_matrix")} delay={0.2} className="col-span-2 overflow-hidden">
          <ReadinessMatrix
            sectors={execution.sectorReadiness}
            selectedSector={selectedSector}
            onSelectSector={(name) => setSelectedSector((current) => (current === name ? null : name))}
            td={td}
            t={t}
            lang={lang}
          />
        </CardWrap>

        <CardWrap title={t("biz.execution_pressure")} delay={0.25} className="overflow-hidden">
          <BusinessKpiStrip
            topParties={execution.implementingLoad.slice(0, 6).map((item) => ({ name: td(item.name), value: item.value }))}
            criticalNetworks={criticalNetworks}
            totalLengthKm={totalLengthKm}
            totalFeatures={totalFeatures}
            t={t}
            lang={lang}
          />
        </CardWrap>
      </div>
    </PageContainer>
  );
}

function PrioritySectorList({
  sectors,
  selectedSector,
  onSelect,
  td,
  t,
}: {
  sectors: SectorReadiness[];
  selectedSector: string | null;
  onSelect: (name: string) => void;
  td: (raw: string | undefined | null) => string;
  t: (key: string) => string;
}) {
  return (
    <div className="h-full space-y-1.5 overflow-y-auto pr-1">
      {sectors.map((sector, index) => {
        const pct = (sector.networkCount / ALL_KEYS.length) * 100;
        const active = selectedSector === sector.name;
        return (
          <motion.button
            key={sector.name}
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: Math.min(index * 0.015, 0.3) }}
            onClick={() => onSelect(sector.name)}
            className={`w-full rounded-md border p-2 text-start transition ${
              active ? "border-primary bg-primary/10" : "border-border/45 bg-background/25 hover:bg-secondary/35"
            }`}
          >
            <div className="flex items-center justify-between gap-2">
              <span className="min-w-0 truncate text-[11px] font-black text-foreground">
                {td(sector.name)}
              </span>
              <span className={`shrink-0 rounded px-1.5 py-0.5 text-[9px] font-black ${pct >= 100 ? "bg-emerald-500/15 text-emerald-400" : "bg-amber-500/15 text-amber-400"}`}>
                {sector.networkCount}/{ALL_KEYS.length}
              </span>
            </div>
            <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-secondary/60">
              <div className="h-full rounded-full bg-primary" style={{ width: `${pct}%` }} />
            </div>
            <div className="mt-1.5 grid grid-cols-2 gap-1 text-[9px] text-muted-foreground">
              <span>{formatCount(sector.totalElements)} {t("g.elements")}</span>
              <span className="text-left">{formatKm(sector.totalLengthKm)}</span>
            </div>
            <div className="mt-1 truncate text-[8.5px] text-muted-foreground">
              {sector.topParty ? `${t("filter.implementing")}: ${td(sector.topParty)}` : t("state.no_data")}
            </div>
          </motion.button>
        );
      })}
    </div>
  );
}

function NetworkExecutionPanel({
  coverage,
  enabled,
  activeNet,
  selectedParty,
  onToggle,
  onActive,
  onParty,
  td,
  t,
  lang,
}: {
  coverage: NetworkCoverage[];
  enabled: Set<NetKey>;
  activeNet: NetKey | null;
  selectedParty: string | null;
  onToggle: (key: NetKey) => void;
  onActive: (key: NetKey | null) => void;
  onParty: (party: string) => void;
  td: (raw: string | undefined | null) => string;
  t: (key: string) => string;
  lang: "ar" | "en";
}) {
  return (
    <div className="h-full space-y-1.5 overflow-y-auto pr-1">
      {coverage.map((item) => {
        const isOn = enabled.has(item.key);
        const isActive = activeNet === item.key;
        return (
          <motion.div
            key={item.key}
            onMouseEnter={() => onActive(item.key)}
            onMouseLeave={() => onActive(null)}
            className={`rounded-md border p-2 transition ${isOn ? "" : "opacity-45"} ${isActive ? "border-primary/50" : "border-border/45"}`}
            style={{ background: `${NET_COLORS[item.key]}12` }}
          >
            <button type="button" onClick={() => onToggle(item.key)} className="flex w-full items-center justify-between gap-2 text-start">
              <span className="flex min-w-0 items-center gap-1.5 text-[11px] font-black" style={{ color: NET_COLORS[item.key] }}>
                <NetworkIcon network={item.key} className="h-3.5 w-3.5" />
                <span className="truncate">{netLabel(item.key, lang)}</span>
              </span>
              <span className="h-3.5 w-3.5 rounded-sm border-2" style={{ borderColor: NET_COLORS[item.key], background: isOn ? NET_COLORS[item.key] : "transparent" }} />
            </button>
            <div className="mt-2 grid grid-cols-2 gap-1 text-[9px]">
              <MetricPill label={t("biz.coverage")} value={`${item.coveragePct.toFixed(0)}%`} color={NET_COLORS[item.key]} />
              <MetricPill label={t("stat.lines")} value={`${item.linePct.toFixed(0)}%`} color={NET_COLORS[item.key]} />
              <MetricPill label={t("stat.total_lengths")} value={formatKm(item.totalLengthKm)} color={NET_COLORS[item.key]} />
              <MetricPill label={t("stat.total_elements")} value={formatCount(item.total)} color={NET_COLORS[item.key]} />
            </div>
            {item.topParty && (
              <button
                type="button"
                onClick={() => onParty(item.topParty)}
                className={`mt-1.5 w-full truncate rounded border px-2 py-1 text-[9px] transition ${
                  selectedParty === item.topParty ? "border-primary bg-primary/15 text-primary" : "border-white/5 bg-background/30 text-muted-foreground hover:text-foreground"
                }`}
                title={td(item.topParty)}
              >
                {t("filter.implementing")}: {td(item.topParty)}
              </button>
            )}
          </motion.div>
        );
      })}
    </div>
  );
}

function MetricPill({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="rounded bg-background/45 p-1">
      <div className="truncate text-muted-foreground">{label}</div>
      <div className="mt-0.5 truncate font-black tabular-nums" style={{ color }}>
        {value}
      </div>
    </div>
  );
}

function ReadinessMatrix({
  sectors,
  selectedSector,
  onSelectSector,
  td,
  t,
  lang,
}: {
  sectors: SectorReadiness[];
  selectedSector: string | null;
  onSelectSector: (name: string) => void;
  td: (raw: string | undefined | null) => string;
  t: (key: string) => string;
  lang: "ar" | "en";
}) {
  return (
    <div className="h-full overflow-auto pr-1">
      <div className="min-w-[620px]">
        <div className="grid grid-cols-[150px_repeat(6,minmax(62px,1fr))] gap-1 pb-1 text-[9px] font-bold text-muted-foreground">
          <div>{t("filter.sector")}</div>
          {ALL_KEYS.map((key) => (
            <div key={key} className="truncate text-center" style={{ color: NET_COLORS[key] }}>
              {netLabel(key, lang, true)}
            </div>
          ))}
        </div>
        <div className="space-y-1">
          {sectors.map((sector) => (
            <button
              key={sector.name}
              type="button"
              onClick={() => onSelectSector(sector.name)}
              className={`grid w-full grid-cols-[150px_repeat(6,minmax(62px,1fr))] gap-1 rounded border p-1 text-[9px] transition ${
                selectedSector === sector.name ? "border-primary bg-primary/10" : "border-white/5 bg-white/[0.02] hover:bg-secondary/25"
              }`}
            >
              <div className="truncate text-start font-bold text-foreground" title={td(sector.name)}>
                {td(sector.name)}
              </div>
              {ALL_KEYS.map((key) => {
                const cell = sector.cells[key];
                const status = getCellStatus(cell);
                const isMissing = status === "missing";
                return (
                  <div
                    key={key}
                    title={`${netLabel(key, lang)} - ${getCellLabel(status, t)}`}
                    className={`rounded px-1.5 py-1 text-center font-bold tabular-nums ${
                      isMissing ? "bg-red-500/10 text-red-400" : "bg-emerald-500/10 text-emerald-400"
                    }`}
                  >
                    {isMissing ? "—" : formatCount(cell?.count || 0)}
                  </div>
                );
              })}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function BusinessKpiStrip({
  topParties,
  criticalNetworks,
  totalLengthKm,
  totalFeatures,
  t,
  lang,
}: {
  topParties: Array<{ name: string; value: number }>;
  criticalNetworks: NetworkCoverage[];
  totalLengthKm: number;
  totalFeatures: number;
  t: (key: string) => string;
  lang: "ar" | "en";
}) {
  const criticalData = criticalNetworks.slice(0, 4).map((item) => ({
    name: netLabel(item.key, lang, true),
    value: Number((100 - item.coveragePct).toFixed(0)),
    color: NET_COLORS[item.key],
  }));

  return (
    <div className="grid h-full grid-cols-[1.15fr_0.85fr] gap-2">
      <div className="min-h-0 overflow-hidden">
        <MiniBars data={topParties} color="#10b981" />
      </div>
      <div className="flex min-h-0 flex-col gap-1.5">
        <div className="grid grid-cols-2 gap-1.5">
          <MetricTile label={t("stat.total_network_elements")} value={formatCount(totalFeatures)} color="#f59e0b" />
          <MetricTile label={t("stat.total_lengths_all")} value={formatKm(totalLengthKm)} color="#10b981" />
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto rounded border border-white/5 bg-background/25 p-1.5">
          <div className="mb-1 text-[9px] font-bold text-muted-foreground">{t("biz.follow_up_networks")}</div>
          <MiniBars data={criticalData} color="#ef4444" />
        </div>
      </div>
    </div>
  );
}

function MetricTile({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="rounded border border-white/5 bg-background/30 p-2">
      <div className="truncate text-[8.5px] text-muted-foreground" title={label}>
        {label}
      </div>
      <div className="mt-1 truncate text-[13px] font-black tabular-nums" style={{ color }}>
        {value}
      </div>
    </div>
  );
}
