import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { useNetwork, useSummary, useSectors, formatCount, formatKm } from "@/lib/data";
import { PageContainer, BackButton } from "@/components/Layout";
import { StatCard } from "@/components/StatCard";
import { CardWrap, MiniBars, Donut } from "@/components/Charts";
import { MapView } from "@/components/Map";
import { DataTable, type DataTableColumn } from "@/components/DataTable";
import { SmartFilter } from "@/components/SmartFilter";
import { ElementTypesPanel } from "@/components/ElementTypesPanel";
import { NetworkIcon } from "@/components/NetworkIcon";
import { NET_COLORS, type NetKey, type SimpleFeature } from "@/lib/types";
import { getTypeStyle, type SymbolShape } from "@/lib/symbology";
import { motion, AnimatePresence } from "framer-motion";
import {
  Layers, Activity, Pipette, Hash,
  X, Map as MapIcon, Table as TableIcon, Filter, CircleDot, Ruler, Cable, Boxes,
} from "lucide-react";
import { useI18n, netLabel } from "@/lib/i18n";
import type { NetworkStats } from "@/lib/types";

type ViewMode = "map" | "table";

type StatsShape = {
  total: number;
  lines: number;
  points: number;
  rooms: number;
  lengthKm: number;
  byType: Record<string, number>;
  bySector: Record<string, number>;
  byImp: Record<string, number>;
  byMaterial: Record<string, number>;
  byDiameter: Record<string, number>;
  lengthByType: Record<string, number>;
};

type ChartDatum = { name: string; value: number; color?: string };
type DashboardCard = {
  key: string;
  title: string;
  kind: "ranked" | "tiles" | "split" | "donut";
  metric?: "count" | "km";
  data: ChartDatum[];
  centerLabel?: string;
  centerValue?: string | number;
};
type StatCardConfig = {
  label: string;
  value: ReactNode;
  unit?: string;
  icon: ReactNode;
  color: string;
  delay?: number;
  indicatorShape?: SymbolShape;
  indicatorIconName?: string;
};
type DetailRowConfig = {
  key: string;
  label: string;
  value: (feature: SimpleFeature) => ReactNode;
  isVisible?: (feature: SimpleFeature) => boolean;
};
type NetworkDetailConfig = {
  codeLabel: string;
  tableColumns: DataTableColumn[];
  popupRows: DetailRowConfig[];
  getBadge: (feature: SimpleFeature) => string;
};
type NetworkVisualConfig = {
  palette: string[];
  statIndicators: Record<string, { shape: SymbolShape; iconName: string }>;
};

function hasEntries(record?: Record<string, number> | null) {
  return !!record && Object.values(record).some((value) => Number(value) > 0);
}

function toChartData(
  record: Record<string, number> | undefined,
  translate: (value: string) => string,
  limit = 12
): ChartDatum[] {
  return Object.entries(record || {})
    .filter(([, value]) => Number(value) > 0)
    .map(([name, value]) => ({ name: translate(name), value: Number(value) }))
    .sort((a, b) => b.value - a.value)
    .slice(0, limit);
}

function sumMatching(record: Record<string, number>, patterns: string[]) {
  return Object.entries(record || {}).reduce((sum, [name, value]) => {
    const normalized = name.toLowerCase();
    return patterns.some((pattern) => normalized.includes(pattern.toLowerCase()))
      ? sum + Number(value)
      : sum;
  }, 0);
}

function toBusinessData(
  record: Record<string, number>,
  items: Array<{ name: string; patterns: string[]; color?: string }>
): ChartDatum[] {
  return items
    .map((item) => ({
      name: item.name,
      value: sumMatching(record, item.patterns),
      color: item.color,
    }))
    .filter((item) => item.value > 0);
}

function cardTotal(data: ChartDatum[]) {
  return formatCount(data.reduce((sum, item) => sum + item.value, 0));
}

function insightValue(value: number, metric: DashboardCard["metric"] = "count") {
  return metric === "km" ? formatKm(value) : formatCount(value);
}

function InsightEmpty() {
  return (
    <div className="h-full flex items-center justify-center text-[11px] text-muted-foreground">
      لا توجد بيانات كافية
    </div>
  );
}

function RankedInsight({
  data,
  color,
  metric,
  labelPrefix,
}: {
  data: ChartDatum[];
  color: string;
  metric?: DashboardCard["metric"];
  labelPrefix?: string;
}) {
  const items = data.slice(0, 5);
  const max = Math.max(1, ...items.map((item) => item.value));
  if (!items.length) return <InsightEmpty />;

  return (
    <div className="h-full overflow-y-auto pr-1 space-y-2">
      {items.map((item, index) => (
        <motion.div
          key={`${item.name}-${index}`}
          initial={{ opacity: 0, x: 10 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: index * 0.035 }}
          className="rounded-md border border-white/10 bg-white/[0.035] px-2.5 py-2"
        >
          <div className="flex items-center gap-2.5 text-[11px]">
            <span
              className="w-7 h-6 rounded-md grid place-items-center text-[11px] font-black shrink-0 tabular-nums"
              style={{
                background: `${item.color || color}18`,
                color: item.color || color,
                border: `1px solid ${item.color || color}55`,
              }}
            >
              {index + 1}
            </span>
            <span className="truncate flex-1 text-foreground font-bold" title={item.name}>
              {labelPrefix ? `${labelPrefix} ${item.name}` : item.name}
            </span>
            <span className="tabular-nums text-[12px] font-black shrink-0" style={{ color: item.color || color }}>
              {insightValue(item.value, metric)}
            </span>
          </div>
          <div className="mt-2 h-2 bg-secondary/60 rounded-full overflow-hidden">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${Math.max(5, (item.value / max) * 100)}%` }}
              transition={{ duration: 0.65, delay: index * 0.035 }}
              className="h-full rounded-full"
              style={{
                background: `linear-gradient(90deg, ${item.color || color}, ${item.color || color}88)`,
                boxShadow: `0 0 10px ${item.color || color}66`,
              }}
            />
          </div>
        </motion.div>
      ))}
    </div>
  );
}

function TileInsight({
  data,
  color,
  metric,
}: {
  data: ChartDatum[];
  color: string;
  metric?: DashboardCard["metric"];
}) {
  const items = data.slice(0, 6);
  if (!items.length) return <InsightEmpty />;

  return (
    <div className="grid grid-cols-2 gap-1.5 h-full content-start overflow-y-auto pr-1">
      {items.map((item, index) => (
        <motion.div
          key={`${item.name}-${index}`}
          initial={{ opacity: 0, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: index * 0.035 }}
          className="min-h-[48px] rounded border bg-white/[0.025] p-2 overflow-hidden"
          style={{
            borderColor: `${item.color || color}40`,
            boxShadow: `inset 0 0 18px ${item.color || color}0f`,
          }}
        >
          <div className="flex items-center gap-1.5">
            <span
              className="w-2 h-2 rounded-full shrink-0"
              style={{
                background: item.color || color,
                boxShadow: `0 0 10px ${item.color || color}`,
              }}
            />
            <span className="text-[9px] text-muted-foreground truncate" title={item.name}>
              {item.name}
            </span>
          </div>
          <div className="mt-1 text-base font-black tabular-nums leading-none" style={{ color: item.color || color }}>
            {insightValue(item.value, metric)}
          </div>
        </motion.div>
      ))}
    </div>
  );
}

function SplitInsight({
  data,
  color,
  metric,
}: {
  data: ChartDatum[];
  color: string;
  metric?: DashboardCard["metric"];
}) {
  const items = data.slice(0, 3);
  const total = items.reduce((sum, item) => sum + item.value, 0);
  if (!items.length || total <= 0) return <InsightEmpty />;

  return (
    <div className="h-full flex flex-col justify-center gap-2">
      <div className="flex h-5 rounded overflow-hidden bg-secondary/50 border border-white/5">
        {items.map((item, index) => (
          <motion.div
            key={`${item.name}-${index}`}
            initial={{ width: 0 }}
            animate={{ width: `${(item.value / total) * 100}%` }}
            transition={{ duration: 0.7, delay: index * 0.05 }}
            style={{
              background: item.color || color,
              boxShadow: `0 0 14px ${item.color || color}88`,
            }}
          />
        ))}
      </div>
      <div className="grid gap-1.5" style={{ gridTemplateColumns: `repeat(${items.length}, minmax(0, 1fr))` }}>
        {items.map((item, index) => {
          const pct = (item.value / total) * 100;
          return (
            <motion.div
              key={`${item.name}-${index}`}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.04 }}
              className="rounded border border-white/5 bg-white/[0.025] p-2 min-w-0"
            >
              <div className="text-[9px] text-muted-foreground truncate" title={item.name}>
                {item.name}
              </div>
              <div className="mt-1 text-sm font-black tabular-nums leading-none" style={{ color: item.color || color }}>
                {insightValue(item.value, metric)}
              </div>
              <div className="mt-1 text-[9px] text-foreground/60 tabular-nums">
                {pct.toFixed(1)}%
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}

function BusinessInsightCard({
  card,
  color,
  t,
}: {
  card: DashboardCard;
  color: string;
  t: (key: string) => string;
}) {
  if (card.kind === "donut") {
    return (
      <Donut
        data={card.data}
        centerLabel={card.centerLabel || t("g.total")}
        centerValue={card.centerValue || insightValue(card.data.reduce((sum, item) => sum + item.value, 0), card.metric)}
        thin={card.key === "share"}
        compact
      />
    );
  }

  if (card.kind === "tiles") {
    return <TileInsight data={card.data} color={color} metric={card.metric} />;
  }

  if (card.kind === "split") {
    return <SplitInsight data={card.data} color={color} metric={card.metric} />;
  }

  return (
    <RankedInsight
      data={card.data}
      color={color}
      metric={card.metric}
      labelPrefix={card.key === "telecom_capacity" ? "سعة" : undefined}
    />
  );
}

function SectorInsightSummary({
  data,
  color,
  t,
}: {
  data: ChartDatum[];
  color: string;
  t: (key: string, values?: Record<string, string | number>) => string;
}) {
  const total = data.reduce((sum, item) => sum + item.value, 0);
  const top = data[0];
  const topThree = data.slice(0, 3).reduce((sum, item) => sum + item.value, 0);
  const topShare = total > 0 ? (topThree / total) * 100 : 0;

  if (!top || total <= 0) {
    return (
      <div className="mt-auto rounded-md border border-white/5 bg-white/[0.025] p-2 text-[10px] text-muted-foreground">
        {t("state.no_data")}
      </div>
    );
  }

  const cards = [
    {
      label: t("insight.top_sector"),
      value: top.name,
      hint: formatCount(top.value),
    },
    {
      label: t("insight.top3_share"),
      value: `${topShare.toFixed(1)}%`,
      hint: t("insight.of_total"),
    },
    {
      label: t("insight.active_sectors"),
      value: formatCount(data.length),
      hint: t("g.total"),
    },
  ];

  return (
    <div className="mt-auto grid grid-cols-3 gap-1.5 pt-2">
      {cards.map((item, index) => (
        <motion.div
          key={item.label}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.18 + index * 0.04 }}
          className="rounded-md border border-white/5 bg-white/[0.035] px-2 py-2 min-w-0"
          style={{ boxShadow: `inset 0 0 16px ${color}0d` }}
        >
          <div className="text-[8px] text-muted-foreground truncate" title={item.label}>
            {item.label}
          </div>
          <div className="mt-1 text-[12px] font-black leading-none truncate" style={{ color }} title={item.value}>
            {item.value}
          </div>
          <div className="mt-1 text-[8px] text-foreground/50 truncate" title={item.hint}>
            {item.hint}
          </div>
        </motion.div>
      ))}
    </div>
  );
}

function buildFullStats(stat: NetworkStats): StatsShape {
  return {
    total: stat.total,
    lines: stat.byCategory.line || 0,
    points: stat.byCategory.point || 0,
    rooms: stat.byCategory.room || 0,
    lengthKm: stat.totalLengthKm,
    byType: stat.byType,
    bySector: stat.bySector,
    byImp: stat.byImplementing,
    byMaterial: stat.byMaterial,
    byDiameter: stat.byDiameter,
    lengthByType: stat.lengthByType,
  };
}

function optionCounts(features: SimpleFeature[], field: "s" | "t" | "imp" | "st" | "d") {
  const counts: Record<string, number> = {};
  for (const feature of features) {
    const raw = feature[field];
    if (raw) counts[raw] = (counts[raw] || 0) + 1;
  }
  return Object.entries(counts)
    .map(([raw, count]) => ({ raw, count }))
    .sort((a, b) => b.count - a.count);
}

function naturalSortKey(value: string) {
  const numeric = value.match(/\d+/)?.[0];
  return numeric ? Number(numeric) : Number.POSITIVE_INFINITY;
}

function getAvailableFilters(features: SimpleFeature[]) {
  return {
    implementing: features.some((feature) => !!feature.imp),
    material: features.some((feature) => !!feature.st),
    diameter: features.some((feature) => !!feature.d),
  };
}

function getCategoryLabel(feature: SimpleFeature, t: (key: string) => string) {
  return t(`cat.${feature.c}`);
}

function getFeatureLength(feature: SimpleFeature, t: (key: string) => string) {
  return feature.l ? `${feature.l.toFixed(3)} ${t("g.km")}` : t("g.dash");
}

function getFeatureCode(feature: SimpleFeature) {
  return feature.code || String(feature.i);
}

function includesAny(value: string | undefined | null, patterns: string[]) {
  const normalized = (value || "").toLowerCase();
  return patterns.some((pattern) => normalized.includes(pattern.toLowerCase()));
}

function getOperationalDetail(
  networkKey: NetKey,
  feature: SimpleFeature,
  t: (key: string) => string
) {
  const type = feature.t || "";
  const geometry = getCategoryLabel(feature, t);
  const diameter = feature.d ? `${t("detail.size")} ${feature.d}` : "";

  if (networkKey === "electric") {
    if (includesAny(type, ["متوسط"])) return t("detail.medium_voltage");
    if (includesAny(type, ["منخفض"])) return t("detail.low_voltage");
    if (includesAny(type, ["انارة", "إنارة", "ولاعة"])) return t("detail.lighting");
    if (feature.c === "line") return t("detail.cable");
    return t("detail.equipment");
  }

  if (networkKey === "gas") {
    if (includesAny(type, ["رئيسي"])) return t("detail.main_line");
    if (includesAny(type, ["فرعي"])) return t("detail.secondary_line");
    if (includesAny(type, ["تغذية"])) return t("detail.feed_line");
    if (includesAny(type, ["محبس", "مخفض"])) return t("detail.control_point");
    return feature.c === "line" ? t("detail.pipe_line") : geometry;
  }

  if (networkKey === "water") {
    if (diameter) return diameter;
    if (includesAny(type, ["محبس"])) return t("detail.valve");
    if (feature.c === "room" || includesAny(type, ["غرف", "غرفة"])) return t("detail.room");
    return geometry;
  }

  if (networkKey === "sewage") {
    if (includesAny(type, ["درجة 1"])) return `${t("detail.main_line")} · ${type}`;
    if (includesAny(type, ["درجة 2"])) return `${t("detail.secondary_line")} · ${type}`;
    if (diameter) return diameter;
    if (feature.c === "line") return t("detail.pipe_line");
    if (feature.c === "room") return t("detail.room");
    return geometry;
  }

  if (networkKey === "telecom") {
    if (includesAny(type, ["رئيسي"])) return t("detail.main_line");
    if (includesAny(type, ["فرعي"])) return t("detail.secondary_line");
    if (feature.c === "line") return t("detail.cable");
    return t("detail.equipment");
  }

  if (diameter) return diameter;
  if (includesAny(type, ["دائري"])) return type;
  return t("detail.room");
}

function getNetworkVisualConfig(networkKey: NetKey): NetworkVisualConfig {
  const configs: Record<NetKey, NetworkVisualConfig> = {
    electric: {
      palette: ["#f59e0b", "#ef4444", "#a855f7", "#fde68a", "#f97316", "#3b82f6"],
      statIndicators: {
        total: { shape: "hex", iconName: "Zap" },
        length: { shape: "line", iconName: "Cable" },
        lines: { shape: "line", iconName: "PlugZap" },
        points: { shape: "circle", iconName: "UtilityPole" },
        cable: { shape: "line", iconName: "Cable" },
        electricPoints: { shape: "hex", iconName: "Hexagon" },
        electricLines: { shape: "line", iconName: "Zap" },
      },
    },
    gas: {
      palette: ["#ef4444", "#f97316", "#60a5fa", "#fb923c", "#fde68a", "#94a3b8"],
      statIndicators: {
        total: { shape: "hex", iconName: "Flame" },
        length: { shape: "line", iconName: "GitBranch" },
        lines: { shape: "line", iconName: "Flame" },
        points: { shape: "circle", iconName: "Gauge" },
        gasLines: { shape: "line", iconName: "Flame" },
        control: { shape: "diamond", iconName: "GaugeCircle" },
      },
    },
    water: {
      palette: ["#2563eb", "#38bdf8", "#0ea5e9", "#7dd3fc", "#bae6fd", "#a855f7"],
      statIndicators: {
        total: { shape: "circle", iconName: "Droplets" },
        valves: { shape: "circle", iconName: "Droplets" },
        rooms: { shape: "square", iconName: "Waves" },
        sizes: { shape: "diamond", iconName: "Ruler" },
      },
    },
    sewage: {
      palette: ["#a855f7", "#c4b5fd", "#8b5cf6", "#ddd6fe", "#7c3aed", "#ef4444"],
      statIndicators: {
        total: { shape: "square", iconName: "Waves" },
        length: { shape: "line", iconName: "Pipette" },
        roomsPoints: { shape: "diamond", iconName: "Search" },
        lines: { shape: "line", iconName: "Waves" },
      },
    },
    telecom: {
      palette: ["#34d399", "#6ee7b7", "#059669", "#10b981", "#a7f3d0", "#065f46"],
      statIndicators: {
        total: { shape: "square", iconName: "RadioTower" },
        length: { shape: "line", iconName: "Cable" },
        lines: { shape: "line", iconName: "RadioTower" },
        points: { shape: "diamond", iconName: "Router" },
        equipment: { shape: "square", iconName: "Package" },
      },
    },
    irrigation: {
      palette: ["#22d3ee", "#67e8f9", "#a5f3fc", "#10b981", "#06b6d4", "#a855f7"],
      statIndicators: {
        rooms: { shape: "square", iconName: "Sprout" },
        sizes: { shape: "diamond", iconName: "Ruler" },
        parties: { shape: "circle", iconName: "Activity" },
        sectors: { shape: "hex", iconName: "Map" },
      },
    },
  };

  return configs[networkKey];
}

function getNetworkDetailConfig(
  networkKey: NetKey,
  t: (key: string, values?: Record<string, string | number>) => string,
  td: (raw: string | undefined | null) => string
): NetworkDetailConfig {
  const textCell = (value: string | undefined | null) => td(value) || t("g.dash");
  const code = (label: string): DataTableColumn => ({
    key: "i",
    label,
    flex: "w-20 shrink-0",
    align: "text-center",
    sortable: true,
    render: (feature) => <span className="font-black tabular-nums">{feature.i}</span>,
    sortValue: (feature) => feature.i,
    searchValue: getFeatureCode,
  });
  const typeColumn = (label = t("tbl.type")): DataTableColumn => ({
    key: "t",
    label,
    flex: "flex-1 min-w-0",
    sortable: true,
    render: (feature) => textCell(feature.t),
    sortValue: (feature) => td(feature.t),
    searchValue: (feature) => `${feature.t || ""} ${td(feature.t)}`,
  });
  const practicalColumn: DataTableColumn = {
    key: "detail",
    label: t("detail.practical"),
    flex: "w-28 shrink-0",
    sortable: true,
    render: (feature) => (
      <span
        className="px-1.5 py-0.5 rounded-sm border border-border/50 bg-secondary/40 text-foreground/90"
        title={getOperationalDetail(networkKey, feature, t)}
      >
        {getOperationalDetail(networkKey, feature, t)}
      </span>
    ),
    sortValue: (feature) => getOperationalDetail(networkKey, feature, t),
    searchValue: (feature) => getOperationalDetail(networkKey, feature, t),
  };
  const sectorColumn: DataTableColumn = {
    key: "s",
    label: t("tbl.sector"),
    flex: "w-32 shrink-0",
    sortable: true,
    render: (feature) => textCell(feature.s),
    sortValue: (feature) => td(feature.s),
    searchValue: (feature) => `${feature.s || ""} ${td(feature.s)}`,
  };
  const impColumn: DataTableColumn = {
    key: "imp",
    label: t("tbl.implementing"),
    flex: "w-32 shrink-0",
    sortable: true,
    render: (feature) => textCell(feature.imp),
    sortValue: (feature) => td(feature.imp),
    searchValue: (feature) => `${feature.imp || ""} ${td(feature.imp)}`,
  };
  const diameterColumn: DataTableColumn = {
    key: "d",
    label: t("tbl.diameter"),
    flex: "w-24 shrink-0",
    align: "text-center",
    sortable: true,
    render: (feature) => feature.d || t("g.dash"),
    sortValue: (feature) => feature.d || "",
    searchValue: (feature) => feature.d || "",
  };
  const sizeColumn: DataTableColumn = {
    ...diameterColumn,
    label: t("detail.size"),
  };
  const lengthColumn: DataTableColumn = {
    key: "l",
    label: t("tbl.length_km"),
    flex: "w-24 shrink-0",
    align: "text-end",
    sortable: true,
    render: (feature) => (feature.l ? feature.l.toFixed(3) : t("g.dash")),
    sortValue: (feature) => feature.l ?? 0,
  };

  const baseRows = (): DetailRowConfig[] => [
    { key: "sector", label: t("tbl.sector"), value: (feature) => textCell(feature.s) },
  ];
  const impRow: DetailRowConfig = {
    key: "imp",
    label: t("tbl.implementing"),
    value: (feature) => textCell(feature.imp),
    isVisible: (feature) => !!feature.imp,
  };
  const diameterRow: DetailRowConfig = {
    key: "diameter",
    label: t("tbl.diameter"),
    value: (feature) => feature.d || t("g.dash"),
    isVisible: (feature) => !!feature.d && getOperationalDetail(networkKey, feature, t) !== `${t("detail.size")} ${feature.d}`,
  };
  const sizeRow: DetailRowConfig = { ...diameterRow, label: t("detail.size") };
  const lengthRow: DetailRowConfig = {
    key: "length",
    label: t("tbl.length_km"),
    value: (feature) => getFeatureLength(feature, t),
    isVisible: (feature) => !!feature.l,
  };

  const configs: Record<NetKey, NetworkDetailConfig> = {
    electric: {
      codeLabel: t("detail.electric_code"),
      tableColumns: [code(t("detail.electric_code")), typeColumn(t("detail.cable_or_asset_type")), practicalColumn, sectorColumn, impColumn, lengthColumn],
      popupRows: [...baseRows(), impRow, lengthRow],
      getBadge: (feature) => getOperationalDetail(networkKey, feature, t),
    },
    gas: {
      codeLabel: t("detail.gas_code"),
      tableColumns: [code(t("detail.gas_code")), typeColumn(t("detail.line_or_control_type")), practicalColumn, sectorColumn, impColumn, lengthColumn],
      popupRows: [...baseRows(), impRow, lengthRow],
      getBadge: (feature) => getOperationalDetail(networkKey, feature, t),
    },
    water: {
      codeLabel: t("detail.water_code"),
      tableColumns: [code(t("detail.water_code")), typeColumn(t("detail.valve_room_type")), practicalColumn, sectorColumn, impColumn, diameterColumn],
      popupRows: [...baseRows(), impRow, diameterRow],
      getBadge: (feature) => getOperationalDetail(networkKey, feature, t),
    },
    sewage: {
      codeLabel: t("detail.sewage_code"),
      tableColumns: [code(t("detail.sewage_code")), typeColumn(t("detail.line_room_type")), practicalColumn, sectorColumn, impColumn, diameterColumn, lengthColumn],
      popupRows: [...baseRows(), impRow, diameterRow, lengthRow],
      getBadge: (feature) => getOperationalDetail(networkKey, feature, t),
    },
    telecom: {
      codeLabel: t("detail.telecom_code"),
      tableColumns: [code(t("detail.telecom_code")), typeColumn(t("detail.equipment_line_type")), practicalColumn, sectorColumn, lengthColumn],
      popupRows: [...baseRows(), lengthRow],
      getBadge: (feature) => getOperationalDetail(networkKey, feature, t),
    },
    irrigation: {
      codeLabel: t("detail.irrigation_code"),
      tableColumns: [code(t("detail.irrigation_code")), typeColumn(t("detail.irrigation_room_type")), practicalColumn, sectorColumn, impColumn, sizeColumn],
      popupRows: [...baseRows(), impRow, sizeRow],
      getBadge: (feature) => getOperationalDetail(networkKey, feature, t),
    },
  };

  return configs[networkKey];
}

function getStatCards(networkKey: NetKey, stats: StatsShape, stat: NetworkStats, t: (key: string, values?: Record<string, string | number>) => string): StatCardConfig[] {
  const visual = getNetworkVisualConfig(networkKey);
  const withIndicator = (key: string, card: Omit<StatCardConfig, "indicatorShape" | "indicatorIconName">): StatCardConfig => {
    const indicator = visual.statIndicators[key];
    return {
      ...card,
      indicatorShape: indicator?.shape,
      indicatorIconName: indicator?.iconName,
    };
  };
  const typeCount = Object.keys(stats.byType || {}).length;
  const sectorCount = Object.keys(stats.bySector || {}).length;
  const diameterCount = Object.keys(stats.byDiameter || {}).length;
  const cableLengthKm = Object.values(stat.lengthByType || {}).reduce((sum, value) => sum + Number(value), 0);
  const controlPoints = sumMatching(stats.byType, ["محبس", "مخفض", "غرفة", "بيلر", "كشك", "موزع", "محطة", "بوكس", "كبينة", "شمبر", "جوينت", "كونيكتور"]);

  const common = {
    total: withIndicator("total", {
      label: t("stat.total_elements"),
      value: formatCount(stats.total),
      color: NET_COLORS[networkKey],
      icon: <Layers className="w-4 h-4" />,
    }),
    length: withIndicator("length", {
      label: t("stat.total_lengths"),
      value: formatCount(Math.round(stats.lengthKm)),
      unit: t("g.km"),
      color: "#10b981",
      icon: <Activity className="w-4 h-4" />,
    }),
    lines: withIndicator("lines", {
      label: t("stat.lines"),
      value: formatCount(stats.lines),
      color: "#3b82f6",
      icon: <Pipette className="w-4 h-4" />,
    }),
    points: withIndicator("points", {
      label: t("stat.points"),
      value: formatCount(stats.points + stats.rooms),
      color: "#a855f7",
      icon: <Hash className="w-4 h-4" />,
    }),
  };

  const byNetwork: Record<NetKey, StatCardConfig[]> = {
    electric: [
      common.total,
      withIndicator("cable", { label: t("stat.cable_lengths"), value: formatCount(Math.round(cableLengthKm || stats.lengthKm)), unit: t("g.km"), color: "#f59e0b", icon: <Cable className="w-4 h-4" /> }),
      withIndicator("electricPoints", { label: t("stat.electric_points"), value: formatCount(stats.points + stats.rooms), color: "#a855f7", icon: <CircleDot className="w-4 h-4" /> }),
      withIndicator("electricLines", { label: t("stat.electric_lines"), value: formatCount(stats.lines), color: "#3b82f6", icon: <Pipette className="w-4 h-4" /> }),
    ],
    gas: [
      common.total,
      common.length,
      withIndicator("gasLines", { label: t("stat.gas_lines"), value: formatCount(stats.lines), color: "#3b82f6", icon: <Pipette className="w-4 h-4" /> }),
      withIndicator("control", { label: t("stat.control_points"), value: formatCount(controlPoints || stats.points), color: "#ef4444", icon: <CircleDot className="w-4 h-4" /> }),
    ],
    water: [
      common.total,
      withIndicator("valves", { label: t("stat.valves"), value: formatCount(sumMatching(stats.byType, ["محبس"])), color: "#3b82f6", icon: <CircleDot className="w-4 h-4" /> }),
      withIndicator("rooms", { label: t("stat.rooms"), value: formatCount(stats.rooms || sumMatching(stats.byType, ["غرف", "غرفة"])), color: "#06b6d4", icon: <Boxes className="w-4 h-4" /> }),
      withIndicator("sizes", { label: t("stat.sizes_count"), value: formatCount(diameterCount), color: "#a855f7", icon: <Ruler className="w-4 h-4" /> }),
    ],
    sewage: [
      common.total,
      common.length,
      withIndicator("roomsPoints", { label: t("stat.rooms_points"), value: formatCount(stats.points + stats.rooms), color: "#a855f7", icon: <Boxes className="w-4 h-4" /> }),
      common.lines,
    ],
    telecom: [
      common.total,
      common.length,
      common.lines,
      withIndicator("equipment", { label: t("stat.equipment_points"), value: formatCount(stats.points + stats.rooms), color: "#10b981", icon: <CircleDot className="w-4 h-4" /> }),
    ],
    irrigation: [
      withIndicator("rooms", { label: t("stat.irrigation_rooms"), value: formatCount(stats.rooms || stats.total), color: NET_COLORS.irrigation, icon: <Boxes className="w-4 h-4" /> }),
      withIndicator("sizes", { label: t("stat.sizes_count"), value: formatCount(diameterCount), color: "#a855f7", icon: <Ruler className="w-4 h-4" /> }),
      withIndicator("parties", { label: t("g.parties_count"), value: formatCount(Object.keys(stats.byImp || {}).length), color: "#10b981", icon: <Activity className="w-4 h-4" /> }),
      withIndicator("sectors", { label: t("card.sectors"), value: formatCount(sectorCount), color: "#06b6d4", icon: <MapIcon className="w-4 h-4" /> }),
    ],
  };

  return byNetwork[networkKey].map((card, index) => ({ ...card, delay: index * 0.05 }));
}

function getDashboardCards(
  networkKey: NetKey,
  stats: StatsShape,
  stat: NetworkStats,
  translate: (value: string) => string,
  t: (key: string, values?: Record<string, string | number>) => string,
  color: string,
  featureBacked: { material: boolean; diameter: boolean }
): DashboardCard[] {
  const palette = getNetworkVisualConfig(networkKey).palette;
  const totalCategory = (stats.lines || 0) + (stats.points || 0) + (stats.rooms || 0);
  const categoryData = [
    { name: t("cat.line"), value: stats.lines, color: "#3b82f6" },
    { name: t("cat.point"), value: stats.points, color: "#a855f7" },
    { name: t("cat.room"), value: stats.rooms, color: "#06b6d4" },
  ].filter((item) => item.value > 0);

  const lengthData = toChartData(stat.lengthByType, translate, 8);
  const materialSource = featureBacked.material && hasEntries(stats.byMaterial) ? stats.byMaterial : stat.byMaterial;
  const diameterSource = featureBacked.diameter && hasEntries(stats.byDiameter) ? stats.byDiameter : stat.byDiameter;
  const candidates: DashboardCard[] = [
    {
      key: "type",
      title: networkKey === "telecom" ? t("card.equipment_types") : networkKey === "irrigation" ? t("card.irrigation_room_types") : t("card.by_type"),
      kind: "ranked",
      data: toChartData(stats.byType, translate, 10),
    },
    {
      key: "length",
      title: networkKey === "electric" ? t("card.lengths_by_cable_type") : t("card.lengths_by_line_type"),
      kind: "ranked",
      metric: "km",
      data: lengthData,
    },
    {
      key: "diameter",
      title: networkKey === "irrigation" ? t("card.by_size") : t("card.by_diameter"),
      kind: "ranked",
      data: toChartData(diameterSource, translate, 12),
    },
    {
      key: "material",
      title: t("card.by_material"),
      kind: "ranked",
      data: toChartData(materialSource, translate, 8),
    },
    {
      key: "implementing",
      title: t("card.implementing_parties"),
      kind: "donut",
      data: toChartData(stats.byImp, translate, 7),
      centerLabel: t("g.parties_count"),
      centerValue: Object.keys(stats.byImp || {}).length,
    },
    {
      key: "sector",
      title: t("card.by_sector_top", { n: 12 }),
      kind: "ranked",
      data: toChartData(stats.bySector, translate, 12),
    },
    {
      key: "share",
      title: t("card.line_point_share"),
      kind: "donut",
      data: categoryData,
      centerLabel: t("g.total"),
      centerValue: formatCount(totalCategory),
    },
  ];

  const preferred: Record<NetKey, string[]> = {
    electric: ["length", "implementing", "share", "material", "type"],
    gas: ["length", "material", "implementing", "share", "type"],
    water: ["diameter", "material", "implementing", "share", "type"],
    sewage: ["diameter", "length", "material", "implementing", "share"],
    telecom: ["length", "implementing", "share", "material", "type"],
    irrigation: ["diameter", "implementing", "share", "material", "type"],
  };

  return preferred[networkKey]
    .map((key) => candidates.find((card) => card.key === key))
    .filter((card): card is DashboardCard => !!card && card.data.length > 0)
    .slice(0, 3)
    .map((card) => ({
      ...card,
      data: card.data.map((datum, index) => ({
        ...datum,
        color: datum.color || palette[index % palette.length] || color,
      })),
    }));
}

function getBusinessInsightCards(
  networkKey: NetKey,
  stats: StatsShape,
  stat: NetworkStats,
  translate: (value: string) => string,
  t: (key: string, values?: Record<string, string | number>) => string,
  color: string
): DashboardCard[] {
  const palette = getNetworkVisualConfig(networkKey).palette;
  const byType = stats.byType || {};
  const byMaterial = hasEntries(stats.byMaterial) ? stats.byMaterial : stat.byMaterial;
  const byDiameter = hasEntries(stats.byDiameter) ? stats.byDiameter : stat.byDiameter;
  const lengthByType = hasEntries(stats.lengthByType) ? stats.lengthByType : stat.lengthByType;

  const assetMix = [
    { name: t("cat.line"), value: stats.lines, color: "#3b82f6" },
    { name: t("cat.point"), value: stats.points, color: "#a855f7" },
    { name: t("cat.room"), value: stats.rooms, color: "#06b6d4" },
  ].filter((item) => item.value > 0);

  const fallbackCards: DashboardCard[] = [
    {
      key: "business_asset_mix",
      title: t("biz.asset_mix"),
      kind: "donut",
      data: assetMix,
      centerLabel: t("g.total"),
      centerValue: formatCount(stats.total),
    },
    {
      key: "business_top_sectors",
      title: t("biz.top_service_areas"),
      kind: "ranked",
      data: toChartData(stats.bySector, translate, 8),
    },
    {
      key: "business_top_types",
      title: t("biz.critical_assets"),
      kind: "tiles",
      data: toChartData(stats.byType, translate, 8),
    },
  ];

  const cardsByNetwork: Record<NetKey, DashboardCard[]> = {
    electric: [
      {
        key: "electric_voltage_lengths",
        title: t("biz.electric_voltage_lengths"),
        kind: "ranked",
        metric: "km",
        data: toBusinessData(lengthByType, [
          { name: t("biz.medium_voltage"), patterns: ["الجهد المتوسط"], color: "#ef4444" },
          { name: t("biz.low_voltage"), patterns: ["الجهد المنخفض"], color: "#f97316" },
          { name: t("biz.lighting_cables"), patterns: ["اعمدة الانارة", "أعمدة الإنارة"], color: "#fde68a" },
          { name: t("biz.building_feeds"), patterns: ["تغذية العمارات"], color: "#fbbf24" },
        ]),
      },
      {
        key: "electric_assets",
        title: t("biz.electric_assets"),
        kind: "tiles",
        data: toBusinessData(byType, [
          { name: t("biz.lighting_poles"), patterns: ["اعمدة الانارة", "أعمدة الإنارة"], color: "#fde68a" },
          { name: t("biz.cable_boxes"), patterns: ["كوفرية"], color: "#fb923c" },
          { name: t("biz.pillars"), patterns: ["بيلر"], color: "#ef4444" },
          { name: t("biz.kiosks"), patterns: ["كشك"], color: "#a855f7" },
          { name: t("biz.stations"), patterns: ["محطة"], color: "#dc2626" },
        ]),
      },
      {
        key: "electric_service_density",
        title: t("biz.service_density"),
        kind: "split",
        data: [
          { name: t("biz.service_points"), value: stats.points + stats.rooms, color: "#a855f7" },
          { name: t("biz.cable_lines"), value: stats.lines, color: "#f59e0b" },
        ].filter((item) => item.value > 0),
        centerLabel: t("g.total"),
        centerValue: formatCount(stats.total),
      },
    ],
    gas: [
      {
        key: "gas_lines",
        title: t("biz.gas_line_distribution"),
        kind: "split",
        data: toBusinessData(byType, [
          { name: t("detail.main_line"), patterns: ["رئيسي"], color: "#ef4444" },
          { name: t("detail.secondary_line"), patterns: ["فرعي"], color: "#f97316" },
          { name: t("detail.feed_line"), patterns: ["تغذية"], color: "#fde68a" },
        ]),
      },
      {
        key: "gas_safety",
        title: t("biz.gas_safety_points"),
        kind: "tiles",
        data: toBusinessData(byType, [
          { name: t("detail.valve"), patterns: ["محبس"], color: "#ef4444" },
          { name: t("biz.reducers"), patterns: ["مخفض"], color: "#60a5fa" },
          { name: t("biz.endcaps"), patterns: ["ايندكاب", "إيندكاب"], color: "#94a3b8" },
          { name: t("detail.room"), patterns: ["غرفة"], color: "#fb923c" },
        ]),
      },
      {
        key: "gas_material",
        title: t("biz.material_readiness"),
        kind: "donut",
        data: toChartData(byMaterial, translate, 6),
        centerLabel: t("g.types_count"),
        centerValue: Object.keys(byMaterial || {}).length,
      },
    ],
    water: [
      {
        key: "water_diameter",
        title: t("biz.water_capacity_diameters"),
        kind: "ranked",
        data: toChartData(byDiameter, translate, 10),
      },
      {
        key: "water_operations",
        title: t("biz.water_operation_assets"),
        kind: "tiles",
        data: toBusinessData(byType, [
          { name: t("stat.valves"), patterns: ["محبس"], color: "#2563eb" },
          { name: t("stat.rooms"), patterns: ["غرفة", "غرف", "تقاطع"], color: "#0ea5e9" },
          { name: t("biz.fire_hydrants"), patterns: ["صنبور حريق"], color: "#ef4444" },
          { name: t("biz.house_connections"), patterns: ["توصيلة منزلية"], color: "#7dd3fc" },
        ]),
      },
      {
        key: "water_material",
        title: t("biz.material_readiness"),
        kind: "donut",
        data: toChartData(byMaterial, translate, 6),
        centerLabel: t("g.types_count"),
        centerValue: Object.keys(byMaterial || {}).length,
      },
    ],
    sewage: [
      {
        key: "sewage_diameter",
        title: t("biz.sewage_load_diameters"),
        kind: "ranked",
        data: toChartData(byDiameter, translate, 10),
      },
      {
        key: "sewage_access",
        title: t("biz.sewage_access_assets"),
        kind: "tiles",
        data: toBusinessData(byType, [
          { name: t("biz.square_manholes"), patterns: ["مطبق مربع"], color: "#a78bfa" },
          { name: t("biz.round_manholes"), patterns: ["مطبق دائري"], color: "#c4b5fd" },
          { name: t("stat.rooms"), patterns: ["غرفة"], color: "#8b5cf6" },
          { name: t("biz.storm_drains"), patterns: ["بلاعات المطر"], color: "#60a5fa" },
        ]),
      },
      {
        key: "sewage_contractors",
        title: t("biz.contractor_distribution"),
        kind: "ranked",
        data: toChartData(stats.byImp, translate, 7),
        centerLabel: t("g.parties_count"),
        centerValue: Object.keys(stats.byImp || {}).length,
      },
    ],
    telecom: [
      {
        key: "telecom_structure",
        title: t("biz.telecom_structure"),
        kind: "split",
        data: toBusinessData(byType, [
          { name: t("detail.main_line"), patterns: ["رئيسي"], color: "#34d399" },
          { name: t("detail.secondary_line"), patterns: ["فرعي"], color: "#6ee7b7" },
        ]),
      },
      {
        key: "telecom_equipment",
        title: t("biz.telecom_service_equipment"),
        kind: "tiles",
        data: toBusinessData(byType, [
          { name: t("biz.boxes"), patterns: ["بوكس"], color: "#34d399" },
          { name: t("biz.connectors"), patterns: ["كونيكتور"], color: "#6ee7b7" },
          { name: t("biz.joints"), patterns: ["جوينت"], color: "#a7f3d0" },
          { name: t("biz.cabinets"), patterns: ["كبينة"], color: "#059669" },
          { name: t("biz.passive"), patterns: ["باسيف"], color: "#065f46" },
        ]),
      },
      {
        key: "telecom_capacity",
        title: t("biz.telecom_capacity"),
        kind: "ranked",
        data: toChartData(byDiameter, translate, 8),
      },
    ],
    irrigation: [
      {
        key: "irrigation_diameter",
        title: t("biz.irrigation_capacity_diameters"),
        kind: "ranked",
        data: toChartData(byDiameter, translate, 10),
      },
      {
        key: "irrigation_control",
        title: t("biz.irrigation_control_points"),
        kind: "tiles",
        data: toBusinessData(byType, [
          { name: t("stat.valves"), patterns: ["محبس ري"], color: "#10b981" },
          { name: t("stat.rooms"), patterns: ["غرفة"], color: "#67e8f9" },
          { name: t("stat.lines"), patterns: ["خط ري"], color: "#22d3ee" },
        ]),
      },
      {
        key: "irrigation_contractors",
        title: t("biz.contractor_distribution"),
        kind: "ranked",
        data: toChartData(stats.byImp, translate, 7),
        centerLabel: t("g.parties_count"),
        centerValue: Object.keys(stats.byImp || {}).length,
      },
    ],
  };

  const primary = cardsByNetwork[networkKey];
  const filled = [...primary, ...fallbackCards]
    .filter((card) => card.data.length > 0)
    .slice(0, 3)
    .map((card) => ({
      ...card,
      centerValue: card.centerValue || (card.kind === "donut" ? cardTotal(card.data) : undefined),
      data: card.data.map((datum, index) => ({
        ...datum,
        color: datum.color || palette[index % palette.length] || color,
      })),
    }));

  return filled;
}

export function NetworkDetailPage({ networkKey }: { networkKey: NetKey }) {
  const { t, td, lang } = useI18n();
  const summary = useSummary();
  const sectorsQ = useSectors();
  const netQ = useNetwork(networkKey);

  const [sectorFilter, setSectorFilter] = useState<string | null>(null);
  const [districtFilter, setDistrictFilter] = useState<string | null>(null);
  const [typeFilter, setTypeFilter] = useState<string | null>(null);
  const [impFilter, setImpFilter] = useState<string | null>(null);
  const [matFilter, setMatFilter] = useState<string | null>(null);
  const [diameterFilter, setDiameterFilter] = useState<string | null>(null);
  const [selected, setSelected] = useState<SimpleFeature | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>("map");
  const [flyTo, setFlyTo] = useState<SimpleFeature | null>(null);
  const visibleNetworks = useMemo(() => new Set<NetKey>([networkKey]), [networkKey]);

  useEffect(() => {
    setSectorFilter(null);
    setDistrictFilter(null);
    setTypeFilter(null);
    setImpFilter(null);
    setMatFilter(null);
    setDiameterFilter(null);
    setSelected(null);
    setFlyTo(null);
  }, [networkKey]);

  const sectorDistrictMap = useMemo(() => {
    const map: Record<string, string> = {};
    sectorsQ.data?.polygons.forEach((sector) => {
      if (sector.name && sector.phase) map[sector.name] = sector.phase;
    });
    return map;
  }, [sectorsQ.data]);

  /* ─── Filtered feature set ─────────────────────────────── */
  const filteredFeatures = useMemo(() => {
    if (!netQ.data) return [];
    return netQ.data.features.filter((f) => {
      if (districtFilter && (!f.s || sectorDistrictMap[f.s] !== districtFilter)) return false;
      if (sectorFilter && f.s !== sectorFilter) return false;
      if (typeFilter && f.t !== typeFilter) return false;
      if (impFilter && f.imp !== impFilter) return false;
      if (matFilter && f.st !== matFilter) return false;
      if (diameterFilter && f.d !== diameterFilter) return false;
      return true;
    });
  }, [netQ.data, districtFilter, sectorDistrictMap, sectorFilter, typeFilter, impFilter, matFilter, diameterFilter]);

  /* ─── Stats computed from filtered set ─────────────────── */
  const filteredStats = useMemo(() => {
    let lines = 0, points = 0, rooms = 0, lengthKm = 0;
    const byType: Record<string, number> = {};
    const bySector: Record<string, number> = {};
    const byImp: Record<string, number> = {};
    const byMaterial: Record<string, number> = {};
    const byDiameter: Record<string, number> = {};
    const lengthByType: Record<string, number> = {};
    for (const f of filteredFeatures) {
      if (f.c === "line") lines++;
      else if (f.c === "room") rooms++;
      else points++;
      if (f.l) {
        lengthKm += f.l;
        lengthByType[f.t] = (lengthByType[f.t] || 0) + f.l;
      }
      byType[f.t] = (byType[f.t] || 0) + 1;
      if (f.s) bySector[f.s] = (bySector[f.s] || 0) + 1;
      if (f.imp) byImp[f.imp] = (byImp[f.imp] || 0) + 1;
      if (f.st) byMaterial[f.st] = (byMaterial[f.st] || 0) + 1;
      if (f.d) byDiameter[f.d] = (byDiameter[f.d] || 0) + 1;
    }
    return {
      total: filteredFeatures.length, lines, points, rooms, lengthKm,
      byType, bySector, byImp, byMaterial, byDiameter, lengthByType,
    };
  }, [filteredFeatures]);

  const isFiltered =
    districtFilter !== null || sectorFilter !== null || typeFilter !== null || impFilter !== null || matFilter !== null || diameterFilter !== null;

  /* ─── Filter option lists (from FULL data, not filtered) ── */
  const sectorOptions = useMemo(() => {
    return netQ.data
      ? optionCounts(netQ.data.features, "s").sort((a, b) => a.count - b.count)
      : [];
  }, [netQ.data]);

  const districtOptions = useMemo(() => {
    if (!netQ.data) return [];
    const counts: Record<string, number> = {};
    for (const feature of netQ.data.features) {
      if (!feature.s) continue;
      const district = sectorDistrictMap[feature.s];
      if (district) counts[district] = (counts[district] || 0) + 1;
    }
    return Object.entries(counts)
      .map(([raw, count]) => ({ raw, count }))
      .sort((a, b) => {
        const byNumber = naturalSortKey(a.raw) - naturalSortKey(b.raw);
        return byNumber || a.raw.localeCompare(b.raw, "ar");
      });
  }, [netQ.data, sectorDistrictMap]);

  const stat = summary.data?.networks[networkKey];

  const typeOptions = useMemo(() => {
    return netQ.data ? optionCounts(netQ.data.features, "t") : [];
  }, [netQ.data]);

  const impOptions = useMemo(() => {
    return netQ.data ? optionCounts(netQ.data.features, "imp") : [];
  }, [netQ.data]);

  const matOptions = useMemo(() => {
    return netQ.data ? optionCounts(netQ.data.features, "st") : [];
  }, [netQ.data]);

  const diameterOptions = useMemo(() => {
    return netQ.data ? optionCounts(netQ.data.features, "d") : [];
  }, [netQ.data]);

  const handleLocate = useCallback((f: SimpleFeature) => {
    setSelected(f);
    setFlyTo(f);
    if (viewMode === "table") setViewMode("map");
  }, [viewMode]);

  const handleSectorClick = useCallback((s: { name: string }) => {
    setSectorFilter((prev) => (prev === s.name ? null : s.name));
  }, []);

  /* ─── Loading guard ─────────────────────────────────────── */
  if (!summary.data || !netQ.data || !sectorsQ.data || !stat) {
    return (
      <PageContainer>
        <div className="h-full flex items-center justify-center text-muted-foreground text-sm animate-pulse">
          {t("state.loading_network", { name: netLabel(networkKey, lang) })}
        </div>
      </PageContainer>
    );
  }

  const color = NET_COLORS[networkKey];
  const label = netLabel(networkKey, lang);
  const visibleSectors = sectorsQ.data.polygons;
  const availableFilters = getAvailableFilters(netQ.data.features);
  const featureBacked = {
    material: availableFilters.material,
    diameter: availableFilters.diameter,
  };

  const activeStats = isFiltered ? filteredStats : buildFullStats(stat);

  const totalFeatures = activeStats.total;
  const totalLengthKm = activeStats.lengthKm;
  const statCards = getStatCards(networkKey, activeStats, stat, t);
  const dashboardCards = getBusinessInsightCards(networkKey, activeStats, stat, td, t, color);
  const detailConfig = getNetworkDetailConfig(networkKey, t, td);
  const hasLengthDetails = netQ.data.features.some((feature) => !!feature.l);
  const detailTableColumns = detailConfig.tableColumns.filter((column) => {
    if (column.key === "imp") return availableFilters.implementing;
    if (column.key === "d") return availableFilters.diameter;
    if (column.key === "l") return hasLengthDetails;
    return true;
  });
  const filterItems = [
    { key: "sector", label: t("filter.sector"), value: sectorFilter, options: sectorOptions, onChange: setSectorFilter },
    { key: "type", label: t("filter.type"), value: typeFilter, options: typeOptions, onChange: setTypeFilter },
    ...(availableFilters.implementing ? [{ key: "implementing", label: t("filter.implementing"), value: impFilter, options: impOptions, onChange: setImpFilter }] : []),
    ...(availableFilters.material ? [{ key: "material", label: t("filter.material"), value: matFilter, options: matOptions, onChange: setMatFilter }] : []),
    ...(availableFilters.diameter ? [{ key: "diameter", label: t("filter.diameter"), value: diameterFilter, options: diameterOptions, onChange: setDiameterFilter }] : []),
  ];

  const sectorData = Object.entries(activeStats?.bySector || stat.bySector)
    .map(([name, value]) => ({ name: td(name), value }))
    .sort((a, b) => b.value - a.value).slice(0, 12);

  const clearAll = () => {
    setDistrictFilter(null);
    setSectorFilter(null);
    setTypeFilter(null);
    setImpFilter(null);
    setMatFilter(null);
    setDiameterFilter(null);
  };

  const typeStyle = typeFilter ? getTypeStyle(networkKey, typeFilter, color) : null;

  return (
    <PageContainer>
      <div className="network-detail-grid">
        {/* ── Title bar ── */}
        <div className="network-detail-title">
          <div className="flex items-center gap-2.5">
            <div
              className="w-9 h-9 rounded-md flex items-center justify-center text-lg shrink-0"
              style={{ background: `${color}22`, color }}
            >
              <NetworkIcon network={networkKey} className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-black leading-tight" style={{ color }}>
                {label}
              </h2>
              <p className="text-[10px] text-muted-foreground leading-tight mt-0.5">
                {formatCount(totalFeatures)} {t("g.elements")} · {formatKm(totalLengthKm)}
                {isFiltered && (
                  <span className="text-amber-400 mx-1.5">· {t("filter.filtered")}</span>
                )}
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            {/* Active type chip */}
            {typeFilter && typeStyle && (
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                className="flex items-center gap-1 text-[10px] px-2 py-1 rounded-md border"
                style={{
                  background: `${typeStyle.color}18`,
                  borderColor: `${typeStyle.color}60`,
                  color: typeStyle.color,
                }}
              >
                <span className="w-1.5 h-1.5 rounded-full" style={{ background: typeStyle.color }} />
                <span>{td(typeFilter)}</span>
                <button onClick={() => setTypeFilter(null)} className="opacity-60 hover:opacity-100">
                  <X className="w-2.5 h-2.5" />
                </button>
              </motion.div>
            )}
            {/* View toggle */}
            <div className="flex items-center gap-0.5 glass-card rounded-md p-0.5">
              <button
                onClick={() => setViewMode("map")}
                className={`flex items-center gap-1 px-2 py-1 rounded text-[10px] font-medium transition ${
                  viewMode === "map" ? "bg-primary text-background" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <MapIcon className="w-3 h-3" />
                {t("view.map")}
              </button>
              <button
                onClick={() => setViewMode("table")}
                className={`flex items-center gap-1 px-2 py-1 rounded text-[10px] font-medium transition ${
                  viewMode === "table" ? "bg-primary text-background" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <TableIcon className="w-3 h-3" />
                {t("view.table")}
              </button>
            </div>
            {isFiltered && (
              <button
                onClick={clearAll}
                className="flex items-center gap-1 text-[10px] px-2 py-1 rounded-md bg-red-500/15 text-red-400 hover:bg-red-500/25 border border-red-500/30 transition"
              >
                <X className="w-3 h-3" />
                {t("filter.clear")}
              </button>
            )}
            <BackButton to="/networks" />
          </div>
        </div>

        {/* ── Filters row ── */}
        <div className="network-detail-filters">
          {filterItems.map((filter) => (
            <SmartFilter
              key={filter.key}
              label={filter.label}
              value={filter.value}
              options={filter.options}
              onChange={filter.onChange}
              color={color}
              variant="dropdown"
            />
          ))}
        </div>

        {/* ── Stat cards ── */}
        <div className="network-detail-stats">
          {statCards.map((card) => (
            <StatCard
              key={card.label}
              label={card.label}
              value={card.value}
              unit={card.unit}
              color={card.color}
              icon={card.icon}
              delay={card.delay}
              indicatorShape={card.indicatorShape}
              indicatorIconName={card.indicatorIconName}
            />
          ))}
        </div>

        {/* ── Left: Element Types Panel ── */}
        <CardWrap
          title={t("card.elements_detail")}
          delay={0.1}
          className="network-detail-panel"
          right={
            isFiltered ? (
              <span className="text-[9px] px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-400 border border-amber-500/30 flex items-center gap-1">
                <Filter className="w-2.5 h-2.5" />
                {t("filter.filtered")}
              </span>
            ) : undefined
          }
        >
          <ElementTypesPanel
            netKey={networkKey}
            byType={stat.byType}
            filteredByType={isFiltered ? filteredStats.byType : null}
            onTypeClick={(raw) => setTypeFilter(raw)}
            activeType={typeFilter}
          />
        </CardWrap>

        {/* ── Center: Map or Table ── */}
        <div className="network-detail-map-shell">
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
                  bbox={summary.data.bbox}
                  sectors={visibleSectors}
                  adminBoundaries={sectorsQ.data.adminBoundaries}
                  features={filteredFeatures}
                  visibleNetworks={visibleNetworks}
                  symbolMode="network-detail"
                  highlightSector={sectorFilter}
                  flyToFeature={flyTo}
                  onFeatureClick={setSelected}
                  onSectorClick={handleSectorClick}
                />
                {/* Counter badge */}
                <div className="absolute top-2 right-2 z-[400] glass-card rounded-md px-2.5 py-1 text-[10px] font-medium pointer-events-none">
                  <span className="text-muted-foreground">{t("map.showing")}: </span>
                  <span className="font-black tabular-nums" style={{ color }}>
                    {formatCount(filteredFeatures.length)}
                  </span>
                  <span className="text-muted-foreground"> {t("map.of")} {formatCount(stat.total)}</span>
                </div>

                {/* Selected feature popup */}
                <AnimatePresence>
                  {selected && (
                    <FeatureDetailsPopup
                      feature={selected}
                      config={detailConfig}
                      color={getTypeStyle(networkKey, selected.t, color).color}
                      title={td(selected.t)}
                      lang={lang}
                      onClose={() => setSelected(null)}
                    />
                  )}
                </AnimatePresence>
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
                  color={color}
                  onLocate={handleLocate}
                  columns={detailTableColumns}
                />
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* ── Right: By sector (top 12) ── */}
        <CardWrap
          title={t("card.by_sector_top", { n: 12 })}
          delay={0.15}
          className="network-detail-panel"
        >
          <div className="h-full flex flex-col min-h-0 gap-2">
            <div className="shrink-0 overflow-y-auto rounded-md border border-white/5 bg-background/20 p-2 pr-3 max-h-[28%]">
              <MiniBars data={sectorData.slice(0, 6)} color={color} />
            </div>
            <div className="min-h-0 flex-1 rounded-md border border-white/10 bg-background/35 p-2">
              <div className="mb-1.5 flex items-center justify-between gap-2">
                <span className="text-[10px] font-bold text-foreground">
                  {t("hover.district")}
                </span>
                <span className="text-[9px] tabular-nums text-muted-foreground">
                  {formatCount(filteredFeatures.length)} {t("g.elements")}
                </span>
              </div>
              <div className="space-y-1 pr-1">
                <button
                  type="button"
                  onClick={() => {
                    setDistrictFilter(null);
                    setSectorFilter(null);
                  }}
                  className={`flex min-h-7 w-full items-center justify-between gap-2 rounded border px-2 text-[9.5px] font-bold transition ${
                    districtFilter === null
                      ? "text-background"
                      : "border-border/50 text-muted-foreground hover:text-foreground hover:bg-secondary/40"
                  }`}
                  style={districtFilter === null ? { background: color, borderColor: color } : undefined}
                >
                  <span>{t("filter.all")}</span>
                  <span className="tabular-nums opacity-70">
                    {formatCount(netQ.data.features.length)}
                  </span>
                </button>
                {districtOptions.map((district) => (
                  <button
                    key={district.raw}
                    type="button"
                    onClick={() => {
                      setDistrictFilter((current) =>
                        current === district.raw ? null : district.raw
                      );
                      setSectorFilter(null);
                    }}
                    className={`flex min-h-7 w-full items-center justify-between gap-2 rounded border px-2 text-[9.5px] font-bold leading-tight transition ${
                      districtFilter === district.raw
                        ? "text-background"
                        : "border-border/50 text-foreground/80 hover:text-foreground hover:bg-secondary/40"
                    }`}
                    style={
                      districtFilter === district.raw
                        ? { background: color, borderColor: color }
                        : undefined
                    }
                    title={`${td(district.raw)} · ${district.count.toLocaleString("en-US")}`}
                  >
                    <span className="min-w-0 truncate">{td(district.raw)}</span>
                    <span className="shrink-0 text-[8.5px] font-medium opacity-70 tabular-nums">
                      {district.count.toLocaleString("en-US")}
                    </span>
                  </button>
                ))}
              </div>
            </div>
            <SectorInsightSummary data={sectorData} color={color} t={t} />
          </div>
        </CardWrap>

        {/* ── Bottom row: implementing / material / diameter ── */}
        {dashboardCards.map((card, index) => (
          <CardWrap key={card.key} title={card.title} delay={0.25 + index * 0.05}>
            <BusinessInsightCard card={card} color={color} t={t} />
          </CardWrap>
        ))}
      </div>
    </PageContainer>
  );
}

function FeatureDetailsPopup({
  feature,
  config,
  color,
  title,
  lang,
  onClose,
}: {
  feature: SimpleFeature;
  config: NetworkDetailConfig;
  color: string;
  title: string;
  lang: string;
  onClose: () => void;
}) {
  const badge = config.getBadge(feature);
  const rows = config.popupRows.reduce<Array<{ key: string; label: string; value: ReactNode; raw: string }>>((acc, row) => {
    if (row.isVisible && !row.isVisible(feature)) return acc;
    const value = row.value(feature);
    const raw = String(value ?? "").trim();
    if (!raw || raw === "—" || raw === String(feature.i) || raw === title || raw === badge) return acc;
    if (acc.some((item) => item.raw === raw || item.label === row.label)) return acc;
    acc.push({ key: row.key, label: row.label, value, raw });
    return acc;
  }, []);

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 8 }}
      className={`absolute bottom-2 ${lang === "ar" ? "left-2" : "right-2"} z-[450] glass-card rounded-md p-2.5 w-[280px] max-w-[calc(100%-16px)]`}
    >
      <div className="flex items-center justify-between mb-2">
        <div className="min-w-0">
          <div className="text-[11px] font-bold truncate" style={{ color }}>
            {title}
          </div>
          <div className="mt-0.5 text-[9px] text-muted-foreground">
            {config.codeLabel}: <span className="font-bold tabular-nums text-foreground">{getFeatureCode(feature)}</span>
          </div>
          <div
            className="mt-1 inline-flex max-w-full items-center rounded-sm border px-1.5 py-0.5 text-[9px] font-bold"
            style={{ borderColor: `${color}70`, background: `${color}18`, color }}
            title={badge}
          >
            <span className="truncate">{badge}</span>
          </div>
        </div>
        <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
      <div className="grid grid-cols-2 gap-1 text-[10px]">
        {rows.map((row) => (
          <InfoRow key={row.key} k={row.label} v={row.value} />
        ))}
      </div>
    </motion.div>
  );
}

function InfoRow({ k, v }: { k: string; v: ReactNode }) {
  return (
    <div className="rounded border border-border/40 bg-background/35 px-1.5 py-1 min-w-0">
      <div className="text-[8.5px] text-muted-foreground truncate">{k}</div>
      <div className="font-medium text-foreground truncate tabular-nums">{v}</div>
    </div>
  );
}
