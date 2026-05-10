/**
 * ElementTypesPanel — shows a detailed breakdown of every element type
 * in a network (بيلارات, كوفريهات, أكشاك, محابس, …) with color, count, %, and bar.
 */
import { useMemo } from "react";
import { motion } from "framer-motion";
import type { NetKey } from "@/lib/types";
import { getTypeStyle, getTypeLabel } from "@/lib/symbology";
import { NET_COLORS } from "@/lib/types";
import { formatCount } from "@/lib/data";
import { useI18n } from "@/lib/i18n";
import { TypeIndicator } from "@/components/TypeIndicator";

interface Props {
  netKey: NetKey;
  byType: Record<string, number>;
  /** If provided, shows filtered counts vs. total */
  filteredByType?: Record<string, number> | null;
  /** Called when user clicks a type — passes type name or null to clear */
  onTypeClick?: (typeName: string | null) => void;
  activeType?: string | null;
}

const CATEGORY_LABELS: Record<string, string> = {
  point: "نقطة",
  line: "خط",
  room: "غرفة",
};

/** Infer category from type key (for display badge only) */
function inferCategory(netKey: NetKey, typeName: string): string {
  const style = getTypeStyle(netKey, typeName, NET_COLORS[netKey]);
  if (style.weight !== undefined) return "line";
  if (style.tone === "room") return "room";
  return "point";
}

export function ElementTypesPanel({
  netKey,
  byType,
  filteredByType,
  onTypeClick,
  activeType,
}: Props) {
  const { td } = useI18n();
  const netColor = NET_COLORS[netKey];

  const entries = useMemo(() => {
    const total = Object.values(byType).reduce((a, b) => a + b, 0);
    return Object.entries(byType)
      .map(([raw, count]) => {
        const style = getTypeStyle(netKey, raw, netColor);
        const filteredCount = filteredByType ? (filteredByType[raw] || 0) : null;
        return {
          raw,
          label: getTypeLabel(raw) || td(raw) || raw,
          count,
          filteredCount,
          pct: total > 0 ? (count / total) * 100 : 0,
          style,
          cat: inferCategory(netKey, raw),
        };
      })
      .sort((a, b) => b.style.order - a.style.order || b.count - a.count)
      .sort((a, b) => {
        if (a.raw === activeType) return -1;
        if (b.raw === activeType) return 1;
        return a.style.order - b.style.order;
      });
  }, [byType, filteredByType, netKey, netColor, activeType, td]);

  return (
    <div className="space-y-1 overflow-y-auto h-full pr-0.5">
      {entries.map((e, i) => {
        const isActive = activeType === e.raw;
        const displayCount = e.filteredCount !== null ? e.filteredCount : e.count;
        const isFiltered = e.filteredCount !== null && e.filteredCount !== e.count;

        return (
          <motion.button
            key={e.raw}
            initial={{ opacity: 0, x: 6 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: Math.min(i * 0.025, 0.5) }}
            onClick={() => onTypeClick?.(isActive ? null : e.raw)}
            className={`w-full text-start rounded-md p-1.5 border transition-all ${
              isActive
                ? "border-primary/60 bg-primary/10"
                : "border-transparent hover:border-border/60 hover:bg-secondary/40"
            } ${displayCount === 0 ? "opacity-40" : ""}`}
          >
            <div className="flex items-center gap-1.5">
              <TypeIndicator style={e.style} active={isActive} size="sm" />
              {/* Label */}
              <span
                className="flex-1 text-[10.5px] font-semibold truncate leading-tight"
                style={isActive ? { color: e.style.color } : undefined}
              >
                {e.label}
              </span>
              {/* Category badge */}
              <span
                className="shrink-0 text-[8.5px] px-1 py-0.5 rounded-sm font-medium"
                style={{
                  background: `${e.style.color}22`,
                  color: e.style.color,
                }}
              >
                {CATEGORY_LABELS[e.cat] || e.cat}
              </span>
              {/* Count */}
              <span
                className="shrink-0 text-[11px] font-black tabular-nums leading-tight"
                style={{ color: e.style.color }}
              >
                {formatCount(displayCount)}
                {isFiltered && (
                  <span className="text-[8px] text-muted-foreground">
                    /{formatCount(e.count)}
                  </span>
                )}
              </span>
            </div>

            {/* % bar */}
            <div className="mt-1 h-0.5 w-full bg-border/30 rounded-full overflow-hidden">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${e.pct}%` }}
                transition={{ delay: 0.1 + i * 0.02, duration: 0.4 }}
                className="h-full rounded-full"
                style={{ background: e.style.color }}
              />
            </div>
          </motion.button>
        );
      })}
    </div>
  );
}
