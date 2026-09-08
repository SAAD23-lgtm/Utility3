import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
  AreaChart,
  Area,
  LineChart,
  Line,
  Legend,
  LabelList,
} from "recharts";
import { motion } from "framer-motion";
import { useState } from "react";
import { formatCount } from "@/lib/data";

const CHART_PALETTE = [
  "#f59e0b",
  "#10b981",
  "#3b82f6",
  "#a855f7",
  "#06b6d4",
  "#ef4444",
  "#ec4899",
  "#14b8a6",
  "#8b5cf6",
  "#f97316",
];

export function CardWrap({
  title,
  children,
  right,
  className = "",
  delay = 0,
}: {
  title: string;
  children: React.ReactNode;
  right?: React.ReactNode;
  className?: string;
  delay?: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay }}
      className={`glass-card rounded-md flex flex-col ${className}`}
    >
      <div className="flex items-center justify-between px-3 py-2 border-b border-border/60">
        <h3 className="text-[11px] font-bold tracking-tight text-foreground">
          {title}
        </h3>
        {right}
      </div>
      <div className="flex-1 min-h-0 p-2">{children}</div>
    </motion.div>
  );
}

interface DonutProps {
  data: Array<{ name: string; value: number; color?: string }>;
  centerLabel?: string;
  centerValue?: string | number;
  thin?: boolean;
  compact?: boolean;
  maxItems?: number;
}

export function Donut({ data, centerLabel, centerValue, thin = false, compact = false, maxItems }: DonutProps) {
  const displayData = maxItems ? data.slice(0, maxItems) : data;
  const total = data.reduce((s, d) => s + d.value, 0);
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);
  const activeValue = hoverIdx !== null ? formatCount(displayData[hoverIdx]?.value || 0) : centerValue;
  const activeLabel = hoverIdx !== null ? displayData[hoverIdx]?.name : centerLabel;
  if (compact) {
    return (
      <div className="relative grid h-full w-full min-h-[150px] grid-cols-[minmax(150px,1fr)_clamp(132px,36%,176px)] content-center items-center gap-3 overflow-hidden max-[430px]:grid-cols-1 max-[430px]:content-start">
        <div className="min-h-0 min-w-0 space-y-1.5 overflow-hidden max-h-full pl-1 max-[430px]:order-2">
          {displayData.map((d, i) => {
            const pct = total > 0 ? (d.value / total) * 100 : 0;
            const itemColor = d.color || CHART_PALETTE[i % CHART_PALETTE.length];
            return (
              <div
                key={i}
                onMouseEnter={() => setHoverIdx(i)}
                onMouseLeave={() => setHoverIdx(null)}
                className={`rounded border border-white/5 bg-white/[0.025] px-2.5 py-2 text-[10px] leading-[1.2] cursor-pointer transition ${hoverIdx !== null && hoverIdx !== i ? "opacity-40" : ""}`}
              >
                <div className="flex items-start gap-1.5">
                  <span
                    className="mt-0.5 h-2 w-2 shrink-0 rounded-sm"
                    style={{ background: itemColor }}
                  />
                  <span className="min-w-0 flex-1 whitespace-normal break-words text-foreground/85" title={d.name}>
                    {d.name}
                  </span>
                </div>
                <div className="mt-1 flex items-center justify-between gap-2 text-muted-foreground">
                  <span className="tabular-nums">{formatCount(d.value)}</span>
                  <span className="tabular-nums">{pct.toFixed(1)}%</span>
                </div>
              </div>
            );
          })}
        </div>

        <div className="relative aspect-square w-full max-w-[176px] shrink-0 justify-self-center max-[430px]:order-1 max-[430px]:max-w-[150px]">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={displayData}
                dataKey="value"
                nameKey="name"
                innerRadius="60%"
                outerRadius="82%"
                paddingAngle={1.5}
                stroke="hsl(var(--background))"
                strokeWidth={1.25}
                onMouseEnter={(_, idx) => setHoverIdx(idx)}
                onMouseLeave={() => setHoverIdx(null)}
                isAnimationActive
                animationDuration={700}
              >
                {displayData.map((d, i) => (
                  <Cell
                    key={i}
                    fill={d.color || CHART_PALETTE[i % CHART_PALETTE.length]}
                    opacity={hoverIdx === null || hoverIdx === i ? 1 : 0.4}
                    style={{ transition: "opacity 0.2s" }}
                  />
                ))}
              </Pie>
            </PieChart>
          </ResponsiveContainer>
          <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none px-6 text-center">
            <div
              className="max-w-[62px] text-[12px] font-black leading-[1.08] text-gradient-amber tabular-nums"
              title={String(activeValue ?? "")}
            >
              {activeValue}
            </div>
            <div
              className="mt-0.5 line-clamp-2 max-w-[58px] text-[7px] leading-[1.1] text-muted-foreground"
              title={String(activeLabel ?? "")}
            >
              {activeLabel}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="relative w-full h-full flex items-center gap-1">
      <ResponsiveContainer width="48%" height="100%" minHeight={140}>
        <PieChart>
          <Pie
            data={displayData}
            dataKey="value"
            nameKey="name"
            innerRadius={thin ? "62%" : "55%"}
            outerRadius={thin ? "85%" : "90%"}
            paddingAngle={1.5}
            stroke="hsl(var(--background))"
            strokeWidth={1.5}
            onMouseEnter={(_, idx) => setHoverIdx(idx)}
            onMouseLeave={() => setHoverIdx(null)}
            isAnimationActive
            animationDuration={700}
          >
            {displayData.map((d, i) => (
              <Cell
                key={i}
                fill={d.color || CHART_PALETTE[i % CHART_PALETTE.length]}
                opacity={hoverIdx === null || hoverIdx === i ? 1 : 0.4}
                style={{ transition: "opacity 0.2s" }}
              />
            ))}
          </Pie>
        </PieChart>
      </ResponsiveContainer>

      <div className="flex-1 min-w-0 pr-2 space-y-1 overflow-y-auto max-h-full">
        {displayData.map((d, i) => {
          const pct = total > 0 ? (d.value / total) * 100 : 0;
          return (
            <div
              key={i}
              onMouseEnter={() => setHoverIdx(i)}
              onMouseLeave={() => setHoverIdx(null)}
              className={`flex items-center gap-1.5 text-[10px] cursor-pointer transition ${hoverIdx !== null && hoverIdx !== i ? "opacity-40" : ""}`}
            >
              <span
                className="w-2 h-2 rounded-sm shrink-0"
                style={{
                  background: d.color || CHART_PALETTE[i % CHART_PALETTE.length],
                }}
              />
              <span className="truncate flex-1 text-foreground/90" title={d.name}>
                {d.name}
              </span>
              <span className="tabular-nums text-muted-foreground shrink-0">
                {formatCount(d.value)}
              </span>
              <span className="tabular-nums text-foreground/70 shrink-0 w-9 text-left">
                {pct.toFixed(1)}%
              </span>
            </div>
          );
        })}
      </div>

      {(centerLabel !== undefined || centerValue !== undefined) && (
        <div
          className="absolute top-1/2 -translate-y-1/2 text-center pointer-events-none whitespace-normal break-words"
          style={{ right: "11%", maxWidth: "34%" }}
        >
          <div className="text-xl font-black text-gradient-amber tabular-nums leading-none">
            {hoverIdx !== null
              ? formatCount(displayData[hoverIdx]?.value || 0)
              : centerValue}
          </div>
          <div className="text-[9px] text-muted-foreground mt-1 leading-tight whitespace-normal break-words">
            {hoverIdx !== null ? displayData[hoverIdx]?.name : centerLabel}
          </div>
        </div>
      )}
    </div>
  );
}

export function SerialChart({ data }: { data: Array<{ name: string; value: number; color?: string }> }) {
  return (
    <div className="h-full min-h-[180px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 18, right: 8, left: 0, bottom: 4 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.45} />
          <XAxis
            dataKey="name"
            tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 10 }}
            axisLine={{ stroke: "hsl(var(--border))" }}
            tickLine={false}
            interval={0}
          />
          <YAxis
            tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 10 }}
            axisLine={false}
            tickLine={false}
            width={48}
          />
          <Tooltip
            cursor={{ fill: "hsl(var(--muted) / 0.18)" }}
            contentStyle={{
              background: "hsl(var(--card))",
              border: "1px solid hsl(var(--border))",
              borderRadius: 8,
              color: "hsl(var(--foreground))",
              fontSize: 11,
            }}
            formatter={(value: number) => [formatCount(value), ""]}
          />
          <Bar dataKey="value" radius={[4, 4, 0, 0]}>
            <LabelList dataKey="value" position="top" formatter={(value: number) => `${Number(value).toLocaleString(undefined, { maximumFractionDigits: 1 })}م`} fill="hsl(var(--foreground))" fontSize={9} />
            {data.map((item, index) => (
              <Cell key={index} fill={item.color || CHART_PALETTE[index % CHART_PALETTE.length]} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

interface BarsProps {
  data: Array<{ name: string; value: number; color?: string }>;
  vertical?: boolean;
  unit?: string;
  maxItems?: number;
}

export function Bars({ data, vertical = false, unit, maxItems = 12 }: BarsProps) {
  const sorted = [...data].sort((a, b) => b.value - a.value).slice(0, maxItems);
  return (
    <ResponsiveContainer width="100%" height="100%" minHeight={140}>
      <BarChart
        data={sorted}
        layout={vertical ? "vertical" : "horizontal"}
        margin={{ top: 4, right: 8, left: vertical ? 60 : 0, bottom: 4 }}
      >
        <CartesianGrid stroke="hsl(220, 15%, 18%)" strokeDasharray="2 4" vertical={!vertical} horizontal={vertical} />
        {vertical ? (
          <>
            <XAxis type="number" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 9 }} stroke="hsl(220, 15%, 25%)" />
            <YAxis
              type="category"
              dataKey="name"
              width={60}
              tick={{ fill: "hsl(var(--foreground))", fontSize: 9 }}
              stroke="hsl(220, 15%, 25%)"
              interval={0}
            />
          </>
        ) : (
          <>
            <XAxis dataKey="name" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 9 }} stroke="hsl(220, 15%, 25%)" interval={0} angle={-30} textAnchor="end" height={50} />
            <YAxis tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 9 }} stroke="hsl(220, 15%, 25%)" />
          </>
        )}
        <Tooltip
          cursor={{ fill: "hsla(38, 92%, 55%, 0.08)" }}
          contentStyle={{
            background: "hsl(222, 35%, 9%)",
            border: "1px solid hsl(220, 15%, 22%)",
            borderRadius: 6,
            fontSize: 10,
            padding: "6px 10px",
          }}
          formatter={(v: number) => [`${formatCount(v)} ${unit || ""}`, ""]}
        />
        <Bar dataKey="value" radius={[3, 3, 0, 0]} animationDuration={800}>
          {sorted.map((d, i) => (
            <Cell key={i} fill={d.color || CHART_PALETTE[i % CHART_PALETTE.length]} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

export function MiniBars({
  data,
  color = "hsl(var(--primary))",
  maxItems,
}: {
  data: Array<{ name: string; value: number; color?: string }>;
  color?: string;
  maxItems?: number;
}) {
  const displayData = maxItems ? data.slice(0, maxItems) : data;
  const max = Math.max(1, ...displayData.map((d) => d.value));
  return (
    <div className="space-y-1.5 overflow-hidden">
      {displayData.map((d, i) => (
        <motion.div
          key={i}
          initial={{ opacity: 0, x: 8 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: i * 0.04 }}
          className="group"
        >
          <div className="flex items-center justify-between text-[10px] mb-0.5">
            <span className="truncate text-foreground/80 max-w-[70%]" title={d.name}>
              {d.name}
            </span>
            <span className="tabular-nums font-medium" style={{ color: d.color || color }}>
              {formatCount(d.value)}
            </span>
          </div>
          <div className="h-1.5 bg-secondary/50 rounded-full overflow-hidden">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${(d.value / max) * 100}%` }}
              transition={{ duration: 0.8, delay: i * 0.04, ease: "easeOut" }}
              className="h-full rounded-full"
              style={{
                background: `linear-gradient(90deg, ${d.color || color}, ${d.color || color}cc)`,
              }}
            />
          </div>
        </motion.div>
      ))}
    </div>
  );
}

export function RadialChart({
  data,
}: {
  data: Array<{ subject: string; value: number; fullMark: number }>;
}) {
  return (
    <ResponsiveContainer width="100%" height="100%" minHeight={190}>
      <RadarChart data={data} margin={{ top: 22, right: 34, bottom: 18, left: 34 }}>
        <PolarGrid stroke="hsl(220, 15%, 22%)" />
        <PolarAngleAxis dataKey="subject" tick={{ fill: "hsl(var(--foreground))", fontSize: 9 }} />
        <PolarRadiusAxis tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 8 }} stroke="hsl(220, 15%, 18%)" angle={90} tickCount={4} />
        <Radar
          dataKey="value"
          stroke="hsl(var(--primary))"
          fill="hsl(var(--primary))"
          fillOpacity={0.3}
          animationDuration={900}
        />
      </RadarChart>
    </ResponsiveContainer>
  );
}

export function Sparkline({
  data,
  color = "hsl(var(--primary))",
}: {
  data: Array<{ name: string; value: number }>;
  color?: string;
}) {
  return (
    <ResponsiveContainer width="100%" height="100%" minHeight={60}>
      <AreaChart data={data} margin={{ top: 0, right: 0, bottom: 0, left: 0 }}>
        <defs>
          <linearGradient id="sparkfill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity={0.6} />
            <stop offset="100%" stopColor={color} stopOpacity={0} />
          </linearGradient>
        </defs>
        <Area
          type="monotone"
          dataKey="value"
          stroke={color}
          strokeWidth={1.5}
          fill="url(#sparkfill)"
          animationDuration={700}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}

export function MultiLine({
  data,
  series,
}: {
  data: Array<Record<string, any>>;
  series: Array<{ key: string; name: string; color: string }>;
}) {
  return (
    <ResponsiveContainer width="100%" height="100%" minHeight={160}>
      <LineChart data={data} margin={{ top: 8, right: 8, bottom: 4, left: 0 }}>
        <CartesianGrid stroke="hsl(220, 15%, 18%)" strokeDasharray="2 4" />
        <XAxis dataKey="name" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 9 }} stroke="hsl(220, 15%, 25%)" />
        <YAxis tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 9 }} stroke="hsl(220, 15%, 25%)" />
        <Tooltip
          contentStyle={{
            background: "hsl(222, 35%, 9%)",
            border: "1px solid hsl(220, 15%, 22%)",
            borderRadius: 6,
            fontSize: 10,
          }}
        />
        <Legend wrapperStyle={{ fontSize: 9 }} />
        {series.map((s) => (
          <Line
            key={s.key}
            type="monotone"
            dataKey={s.key}
            name={s.name}
            stroke={s.color}
            strokeWidth={1.5}
            dot={{ r: 2 }}
            animationDuration={700}
          />
        ))}
      </LineChart>
    </ResponsiveContainer>
  );
}
