import { useMemo, useState } from "react";
import { useSummary, useSectors, useRoads, formatCount, formatKm } from "@/lib/data";
import { PageContainer } from "@/components/Layout";
import { StatCard } from "@/components/StatCard";
import { CardWrap, Donut, MiniBars } from "@/components/Charts";
import { MapView } from "@/components/Map";
import { STATUS_COLORS } from "@/lib/types";
import {
  Building2,
  Construction,
  CheckCircle2,
  AlertOctagon,
  Map as MapIcon,
  Hammer,
  Laptop,
  MapPinned,
  Search,
} from "lucide-react";
import { motion } from "framer-motion";
import { useI18n } from "@/lib/i18n";

export function OverviewPage() {
  const { t, td, lang } = useI18n();
  const summary = useSummary();
  const sectorsQ = useSectors();
  const roadsQ = useRoads();
  const [colorByStatus, setColorByStatus] = useState(true);
  const [highlightSector, setHighlightSector] = useState<string | null>(null);
  const [sectorQuery, setSectorQuery] = useState("");

  const sectorStatusData = useMemo(
    () =>
      Object.entries(summary.data?.sectors.byStatus || {})
        .filter(([name]) => name && name.length > 0)
        .map(([name, value]) => ({
          name: td(name),
          value: value as number,
          color: STATUS_COLORS[name] || "#64748b",
        })),
    [summary.data, td]
  );

  const roadStatusData = useMemo(
    () =>
      Object.entries(summary.data?.roads.kmByStatus || {}).map(([name, value]) => ({
        name: td(name),
        value: Number((value as number).toFixed(1)),
        color: STATUS_COLORS[name] || "#64748b",
      })),
    [summary.data, td]
  );

  const roadFieldData = useMemo(
    () =>
      Object.entries(summary.data?.roads.byField || {}).map(([name, value]) => ({
        rawName: name,
        name: td(name),
        value: value as number,
      })),
    [summary.data, td]
  );

  const sectorList = useMemo(
    () =>
      [...(sectorsQ.data?.polygons || [])]
        .filter((p) => p.name && p.name.trim().length > 0)
        .sort((a, b) => a.order - b.order)
        .map((p) => ({
          name: p.name,
          status: p.status || "",
          phase: p.phase || "",
          area: p.area > 1000 ? p.area / 1_000_000 : p.area,
        })),
    [sectorsQ.data]
  );

  const filteredSectorList = useMemo(() => {
    const q = sectorQuery.trim().toLowerCase();
    if (!q) return sectorList;
    return sectorList.filter((s) => {
      const tdName = td(s.name).toLowerCase();
      const tdStatus = td(s.status).toLowerCase();
      const tdPhase = td(s.phase).toLowerCase();
      return (
        s.name.toLowerCase().includes(q) ||
        tdName.includes(q) ||
        s.status.toLowerCase().includes(q) ||
        tdStatus.includes(q) ||
        s.phase.toLowerCase().includes(q) ||
        tdPhase.includes(q)
      );
    });
  }, [sectorList, sectorQuery, td]);
  const visibleSectorList = filteredSectorList.slice(0, 10);

  if (!summary.data || !sectorsQ.data || !roadsQ.data) {
    return <Loading text={t("state.loading")} />;
  }

  const s = summary.data;
  const sectorsData = sectorsQ.data;
  const roadsData = roadsQ.data;

  const validPolygons = sectorsData.polygons.filter(
    (p) => p.name && p.name.trim().length > 0
  );
  const totalSectors = validPolygons.length;
  const deliveredSectors = validPolygons.filter(
    (p) => p.status === "تم التسليم"
  ).length;
  const officeSectors = validPolygons.filter((p) =>
    p.status?.startsWith("جاري العمل مكتبي")
  ).length;
  const fieldSectors = validPolygons.filter((p) =>
    p.status?.startsWith("جاري العمل ميداني")
  ).length;
  const remainingSectors = totalSectors - deliveredSectors;

  const totalRoadsKm = s.roads.totalKm;
  const deliveredRoadsKm = s.roads.kmByStatus["تم التسليم"] || 0;
  const remainingRoadsKm = totalRoadsKm - deliveredRoadsKm;

  return (
    <PageContainer>
      <div className="overview-grid">
        {/* Top stats row */}
        <div className="overview-stats">
          <StatCard
            label={t("stat.total_sectors")}
            value={formatCount(totalSectors)}
            color="#f59e0b"
            icon={<Building2 className="w-4 h-4" />}
            delay={0.0}
          />
          <StatCard
            label={t("stat.delivered_sectors")}
            value={formatCount(deliveredSectors)}
            color="#10b981"
            icon={<CheckCircle2 className="w-4 h-4" />}
            delay={0.05}
          />
          <StatCard
            label={t("stat.remaining_sectors")}
            value={formatCount(remainingSectors)}
            color="#ef4444"
            icon={<AlertOctagon className="w-4 h-4" />}
            delay={0.1}
          />
          <StatCard
            label={t("stat.field_progress")}
            value={formatCount(fieldSectors)}
            color="#f59e0b"
            icon={<Hammer className="w-4 h-4" />}
            delay={0.15}
          />
          <StatCard
            label={t("stat.office_progress")}
            value={formatCount(officeSectors)}
            color="#3b82f6"
            icon={<Laptop className="w-4 h-4" />}
            delay={0.2}
          />
          <StatCard
            label={t("stat.total_roads")}
            value={formatCount(Math.round(totalRoadsKm))}
            unit={t("g.km")}
            color="#a855f7"
            icon={<MapIcon className="w-4 h-4" />}
            delay={0.25}
          />
          <StatCard
            label={t("stat.delivered_roads")}
            value={formatCount(Math.round(deliveredRoadsKm))}
            unit={t("g.km")}
            color="#10b981"
            icon={<MapPinned className="w-4 h-4" />}
            delay={0.3}
          />
          <StatCard
            label={t("stat.remaining_roads")}
            value={formatCount(Math.round(remainingRoadsKm))}
            unit={t("g.km")}
            color="#ef4444"
            icon={<Construction className="w-4 h-4" />}
            delay={0.35}
          />
        </div>

        {/* Left side — searchable sector list */}
        <CardWrap
          title={`${t("card.sectors")} (${visibleSectorList.length}/${filteredSectorList.length})`}
          delay={0.1}
          className="overview-panel"
        >
          <div className="flex flex-col h-full">
            <div className="relative mb-1.5 shrink-0">
              <Search className={`absolute top-1/2 -translate-y-1/2 ${lang === "ar" ? "right-2" : "left-2"} w-3 h-3 text-muted-foreground`} />
              <input
                value={sectorQuery}
                onChange={(e) => setSectorQuery(e.target.value)}
                placeholder={t("filter.search_sector")}
                className={`w-full bg-secondary/40 border border-border/40 rounded-md text-[10.5px] py-1 ${lang === "ar" ? "pr-6 pl-2" : "pl-6 pr-2"} focus:outline-none focus:border-primary/60 transition`}
              />
            </div>
            <div className="space-y-1 overflow-hidden flex-1 pr-1">
              {visibleSectorList.map((sec, i) => (
                <motion.button
                  key={sec.name + i}
                  initial={{ opacity: 0, x: lang === "ar" ? -6 : 6 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: Math.min(i * 0.012, 0.4) }}
                  onMouseEnter={() => setHighlightSector(sec.name)}
                  onMouseLeave={() => setHighlightSector(null)}
                  onClick={() =>
                    setHighlightSector(highlightSector === sec.name ? null : sec.name)
                  }
                  className={`w-full text-start p-2 rounded-md transition border ${
                    highlightSector === sec.name
                      ? "border-primary/60 bg-primary/10"
                      : "border-transparent hover:bg-secondary/50"
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="text-[11px] font-bold truncate text-foreground">
                        {td(sec.name) || t("g.no_name")}
                      </div>
                      <div className="text-[9.5px] text-muted-foreground truncate">
                        {td(sec.phase) || t("g.dash")}
                      </div>
                    </div>
                    <div
                      className="shrink-0 w-1.5 h-7 rounded-full"
                      style={{ background: STATUS_COLORS[sec.status] || "#64748b" }}
                    />
                  </div>
                  <div className="flex items-center justify-between mt-1">
                    <span
                      className="text-[9px] px-1.5 py-0.5 rounded-sm font-medium"
                      style={{
                        background: `${STATUS_COLORS[sec.status] || "#64748b"}26`,
                        color: STATUS_COLORS[sec.status] || "#64748b",
                      }}
                    >
                      {td(sec.status) || t("status.unknown")}
                    </span>
                    <span className="text-[9px] text-muted-foreground tabular-nums">
                      {sec.area.toFixed(2)} {t("g.km2")}
                    </span>
                  </div>
                </motion.button>
              ))}
            </div>
          </div>
        </CardWrap>

        {/* Center map */}
        <div className="overview-map-shell">
          <MapView
            bbox={s.bbox}
            sectors={sectorsData.polygons}
            adminBoundaries={sectorsData.adminBoundaries}
            roads={roadsData.roads}
            showRoads
            colorRoadsByStatus={colorByStatus}
            colorSectorsByStatus={colorByStatus}
            highlightSector={highlightSector}
            onSectorClick={(s) => setHighlightSector(s.name)}
          />
          {/* Floating legend */}
          <div className={`absolute top-2 ${lang === "ar" ? "left-2" : "right-2"} glass-card rounded-md p-2 z-[400] text-[10px] space-y-0.5 pointer-events-auto`}>
            <div className="text-foreground font-bold mb-1 text-[10.5px]">
              {t("map.legend_status")}
            </div>
            {[
              "تم التسليم",
              "جاري العمل ميدانياً",
              "جاري العمل مكتبياً",
              "لم يتم العمل عليهم",
            ].map((k) => (
              <div key={k} className="flex items-center gap-1.5">
                <span
                  className="w-2.5 h-2.5 rounded-sm"
                  style={{ background: STATUS_COLORS[k] }}
                />
                <span className="text-foreground/80">{td(k)}</span>
              </div>
            ))}
          </div>
          <button
            onClick={() => setColorByStatus((s) => !s)}
            className={`absolute top-2 ${lang === "ar" ? "right-2" : "left-2"} z-[400] glass-card rounded-md px-2.5 py-1 text-[10px] font-medium hover:bg-secondary/50 transition`}
          >
            {colorByStatus ? t("map.color_by_status") : t("map.color_default")}
          </button>
        </div>

        {/* Right side — donuts */}
        <div className="overview-side-charts">
          <CardWrap title={t("card.sector_progress")} delay={0.15}>
            <Donut
              data={sectorStatusData}
              centerLabel={t("stat.total_sectors")}
              centerValue={formatCount(totalSectors)}
              compact
              maxItems={4}
            />
          </CardWrap>
          <CardWrap title={t("card.road_progress")} delay={0.2}>
            <Donut
              data={roadStatusData}
              centerLabel={t("g.total_km")}
              centerValue={formatKm(totalRoadsKm)}
              thin
              compact
              maxItems={4}
            />
          </CardWrap>
        </div>

        {/* Bottom row */}
        <CardWrap title={t("card.road_classification")} delay={0.25}>
          <div className="grid grid-cols-3 gap-1.5 h-full">
            {roadFieldData.map((r, i) => {
              const colors = ["#f59e0b", "#3b82f6", "#a855f7"];
              const color = colors[i % colors.length];
              return (
                <div
                  key={r.rawName}
                  className="rounded-md p-2 flex flex-col justify-between"
                  style={{ background: `${color}1a`, border: `1px solid ${color}40` }}
                >
                  <div className="text-[10px] text-foreground/80 font-medium">
                    {r.name}
                  </div>
                  <div
                    className="text-2xl font-black tabular-nums"
                    style={{ color }}
                  >
                    {formatCount(r.value)}
                  </div>
                </div>
              );
            })}
          </div>
        </CardWrap>

        <CardWrap title={t("card.roads_by_district")} delay={0.3}>
          <MiniBars
            data={Object.entries(s.roads.byDistrict)
              .sort((a, b) => b[1] - a[1])
              .map(([name, value]) => ({ name: td(name), value }))}
            color="#a855f7"
            maxItems={5}
          />
        </CardWrap>

        <CardWrap
          title={t("card.top_road_sectors")}
          delay={0.35}
        >
          <MiniBars
            data={Object.entries(s.roads.bySector)
              .sort((a, b) => b[1].km - a[1].km)
              .map(([name, v]) => ({ name: td(name), value: Number(v.km.toFixed(1)) }))}
            color="#f59e0b"
            maxItems={5}
          />
        </CardWrap>
      </div>
    </PageContainer>
  );
}

function Loading({ text }: { text: string }) {
  return (
    <PageContainer>
      <div className="h-full flex items-center justify-center">
        <motion.div
          animate={{ opacity: [0.4, 1, 0.4] }}
          transition={{ duration: 1.5, repeat: Infinity }}
          className="text-muted-foreground text-sm"
        >
          {text}
        </motion.div>
      </div>
    </PageContainer>
  );
}
