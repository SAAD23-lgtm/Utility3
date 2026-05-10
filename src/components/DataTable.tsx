import { useMemo, useState, useRef, useEffect, type ReactNode } from "react";
import type { SimpleFeature } from "@/lib/types";
import { useI18n, netLabel } from "@/lib/i18n";
import { formatCount } from "@/lib/data";
import { ChevronDown, ChevronUp, MapPin, Search } from "lucide-react";
import { motion } from "framer-motion";

type SortDir = "asc" | "desc";

export interface DataTableColumn {
  key: string;
  label: string;
  flex: string;
  align?: string;
  sortable?: boolean;
  render: (feature: SimpleFeature, rowIndex: number) => ReactNode;
  sortValue?: (feature: SimpleFeature) => string | number;
  searchValue?: (feature: SimpleFeature) => string;
}

interface Props {
  features: SimpleFeature[];
  color?: string;
  onLocate?: (f: SimpleFeature) => void;
  showNetworkColumn?: boolean;
  columns?: DataTableColumn[];
}

const ROW_HEIGHT = 28;
const OVERSCAN = 8;

function categoryBadge(feature: SimpleFeature, t: (key: string) => string) {
  const style =
    feature.c === "line"
      ? { background: "rgba(59,130,246,0.18)", color: "#60a5fa" }
      : feature.c === "room"
        ? { background: "rgba(168,85,247,0.18)", color: "#c084fc" }
        : { background: "rgba(245,158,11,0.18)", color: "#fbbf24" };

  return (
    <span className="px-1.5 py-0.5 rounded-sm" style={style}>
      {t(`cat.${feature.c}`)}
    </span>
  );
}

export function DataTable({
  features,
  color = "#f59e0b",
  onLocate,
  showNetworkColumn,
  columns,
}: Props) {
  const { t, td, lang } = useI18n();
  const [query, setQuery] = useState("");
  const [sortKey, setSortKey] = useState<string>("i");
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const scrollRef = useRef<HTMLDivElement>(null);
  const [scrollTop, setScrollTop] = useState(0);
  const [viewportH, setViewportH] = useState(400);
  const dirAlign = lang === "ar" ? "text-right" : "text-left";

  const defaultColumns = useMemo<DataTableColumn[]>(
    () => [
      {
        key: "i",
        label: t("tbl.id"),
        flex: "w-16 shrink-0",
        align: "text-center",
        sortable: true,
        render: (f) => f.i,
        sortValue: (f) => f.i,
      },
      ...(showNetworkColumn
        ? ([
            {
              key: "net",
              label: t("tbl.network"),
              flex: "w-24 shrink-0",
              sortable: false,
              render: (f) => (
                <span className="font-bold" style={{ color }}>
                  {netLabel(f.n, lang, true)}
                </span>
              ),
              searchValue: (f) => netLabel(f.n, lang),
            } satisfies DataTableColumn,
          ])
        : []),
      {
        key: "t",
        label: t("tbl.type"),
        flex: "flex-1 min-w-0",
        sortable: true,
        render: (f) => td(f.t),
        sortValue: (f) => td(f.t),
        searchValue: (f) => `${f.t || ""} ${td(f.t)}`,
      },
      {
        key: "c",
        label: t("tbl.category"),
        flex: "w-20 shrink-0",
        sortable: true,
        render: (f) => categoryBadge(f, t),
        sortValue: (f) => f.c,
        searchValue: (f) => t(`cat.${f.c}`),
      },
      {
        key: "s",
        label: t("tbl.sector"),
        flex: "w-32 shrink-0",
        sortable: true,
        render: (f) => td(f.s) || t("g.dash"),
        sortValue: (f) => td(f.s),
        searchValue: (f) => `${f.s || ""} ${td(f.s)}`,
      },
      {
        key: "imp",
        label: t("tbl.implementing"),
        flex: "w-28 shrink-0",
        sortable: true,
        render: (f) => td(f.imp) || t("g.dash"),
        sortValue: (f) => td(f.imp),
        searchValue: (f) => `${f.imp || ""} ${td(f.imp)}`,
      },
      {
        key: "st",
        label: t("tbl.material"),
        flex: "w-32 shrink-0",
        sortable: true,
        render: (f) => td(f.st) || t("g.dash"),
        sortValue: (f) => td(f.st),
        searchValue: (f) => `${f.st || ""} ${td(f.st)}`,
      },
      {
        key: "d",
        label: t("tbl.diameter"),
        flex: "w-20 shrink-0",
        align: "text-center",
        sortable: true,
        render: (f) => f.d || t("g.dash"),
        sortValue: (f) => f.d || "",
      },
      {
        key: "l",
        label: t("tbl.length_km"),
        flex: "w-20 shrink-0",
        align: "text-end",
        sortable: true,
        render: (f) => (f.l ? f.l.toFixed(3) : t("g.dash")),
        sortValue: (f) => f.l ?? 0,
      },
    ],
    [color, lang, showNetworkColumn, t, td]
  );

  const activeColumns = columns || defaultColumns;

  useEffect(() => {
    setSortKey((current) =>
      activeColumns.some((column) => column.key === current && column.sortable)
        ? current
        : activeColumns.find((column) => column.sortable)?.key || activeColumns[0]?.key || "i"
    );
  }, [activeColumns]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return features;
    return features.filter((feature) => {
      const base = [
        feature.i,
        feature.code,
        feature.sourceLayer,
        feature.t,
        feature.c,
        feature.s,
        feature.imp,
        feature.st,
        feature.d,
        feature.l,
        td(feature.t),
        td(feature.s),
        td(feature.imp),
        td(feature.st),
      ].join(" ");
      const fromColumns = activeColumns
        .map((column) => column.searchValue?.(feature) || "")
        .join(" ");
      return `${base} ${fromColumns}`.toLowerCase().includes(q);
    });
  }, [activeColumns, features, query, td]);

  const sorted = useMemo(() => {
    const arr = [...filtered];
    const column = activeColumns.find((item) => item.key === sortKey);
    if (!column?.sortable) return arr;
    const sign = sortDir === "asc" ? 1 : -1;
    arr.sort((a, b) => {
      const va = column.sortValue ? column.sortValue(a) : "";
      const vb = column.sortValue ? column.sortValue(b) : "";
      if (typeof va === "number" && typeof vb === "number") return (va - vb) * sign;
      return String(va).localeCompare(String(vb), undefined, { numeric: true }) * sign;
    });
    return arr;
  }, [activeColumns, filtered, sortDir, sortKey]);

  useEffect(() => {
    if (!scrollRef.current) return;
    const el = scrollRef.current;
    const update = () => setViewportH(el.clientHeight);
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const totalH = sorted.length * ROW_HEIGHT;
  const startIdx = Math.max(0, Math.floor(scrollTop / ROW_HEIGHT) - OVERSCAN);
  const endIdx = Math.min(
    sorted.length,
    Math.ceil((scrollTop + viewportH) / ROW_HEIGHT) + OVERSCAN
  );
  const visible = sorted.slice(startIdx, endIdx);
  const offsetY = startIdx * ROW_HEIGHT;

  const toggleSort = (key: string) => {
    if (sortKey === key) setSortDir((dir) => (dir === "asc" ? "desc" : "asc"));
    else {
      setSortKey(key);
      setSortDir("asc");
    }
  };

  return (
    <div className="flex flex-col h-full min-h-0">
      <div className="flex items-center gap-2 mb-2 shrink-0">
        <div className="relative flex-1">
          <Search className={`absolute top-1/2 -translate-y-1/2 ${lang === "ar" ? "right-2" : "left-2"} w-3.5 h-3.5 text-muted-foreground`} />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t("filter.search_features")}
            className={`w-full bg-secondary/40 border border-border/60 rounded-md text-[11px] py-1.5 ${lang === "ar" ? "pr-7 pl-2" : "pl-7 pr-2"} focus:outline-none focus:border-primary/60 transition`}
          />
        </div>
        <span className="text-[10px] text-muted-foreground tabular-nums shrink-0">
          {t("filter.results", { n: formatCount(sorted.length) })}
        </span>
      </div>

      <div className="flex items-center gap-1.5 px-2 py-1.5 bg-secondary/30 border border-border/60 rounded-t-md text-[10px] font-bold text-muted-foreground shrink-0">
        {activeColumns.map((column) => (
          <button
            key={column.key}
            onClick={() => column.sortable && toggleSort(column.key)}
            disabled={!column.sortable}
            className={`${column.flex} ${column.align || dirAlign} flex items-center gap-0.5 ${column.sortable ? "hover:text-foreground cursor-pointer" : "cursor-default"} transition`}
          >
            <span className="truncate">{column.label}</span>
            {sortKey === column.key && column.sortable && (
              sortDir === "asc" ? <ChevronUp className="w-3 h-3 inline" /> : <ChevronDown className="w-3 h-3 inline" />
            )}
          </button>
        ))}
        <span className="w-7 shrink-0" />
      </div>

      <div
        ref={scrollRef}
        onScroll={(event) => setScrollTop(event.currentTarget.scrollTop)}
        className="flex-1 min-h-0 overflow-auto border-x border-b border-border/60 rounded-b-md bg-background/30"
      >
        {sorted.length === 0 ? (
          <div className="h-full flex items-center justify-center text-[11px] text-muted-foreground py-8">
            {t("tbl.empty")}
          </div>
        ) : (
          <div style={{ height: totalH, position: "relative" }}>
            <div style={{ position: "absolute", top: offsetY, left: 0, right: 0 }}>
              {visible.map((feature, idx) => (
                <motion.div
                  key={`${feature.n}-${feature.i}`}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ duration: 0.15 }}
                  className="flex items-center gap-1.5 px-2 hover:bg-secondary/50 transition border-b border-border/20 cursor-default"
                  style={{ height: ROW_HEIGHT }}
                >
                  {activeColumns.map((column) => (
                    <div
                      key={column.key}
                      className={`${column.flex} ${column.align || dirAlign} text-[10px] text-foreground/80 truncate`}
                      title={String(column.searchValue?.(feature) || column.sortValue?.(feature) || "")}
                    >
                      {column.render(feature, startIdx + idx)}
                    </div>
                  ))}
                  <div className="w-7 shrink-0 text-center">
                    {onLocate && (
                      <button
                        onClick={() => onLocate(feature)}
                        className="p-1 rounded hover:bg-primary/20 transition text-muted-foreground hover:text-primary"
                        title={t("tbl.locate")}
                      >
                        <MapPin className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
