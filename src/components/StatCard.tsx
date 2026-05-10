import { motion } from "framer-motion";
import type { ReactNode } from "react";
import { TypeIndicator } from "@/components/TypeIndicator";
import type { SymbolShape } from "@/lib/symbology";

interface StatCardProps {
  label: string;
  value: ReactNode;
  unit?: string;
  icon?: ReactNode;
  color?: string;
  delta?: { value: string; positive?: boolean };
  compact?: boolean;
  delay?: number;
  onClick?: () => void;
  active?: boolean;
  indicatorShape?: SymbolShape;
  indicatorIconName?: string;
}

export function StatCard({
  label,
  value,
  unit,
  icon,
  color = "hsl(var(--primary))",
  delta,
  compact = false,
  delay = 0,
  onClick,
  active = false,
  indicatorShape,
  indicatorIconName,
}: StatCardProps) {
  return (
    <motion.button
      type="button"
      onClick={onClick}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay }}
      whileHover={{ y: -2 }}
      className={`relative w-full text-right glass-card rounded-md ${compact ? "p-2.5" : "p-3"} hover:border-primary/40 transition group ${
        active ? "border-primary ring-1 ring-primary/30" : ""
      } ${onClick ? "cursor-pointer" : "cursor-default"}`}
    >
      <div
        className="absolute top-0 right-0 w-[2px] h-full rounded-r-md transition-all group-hover:w-1"
        style={{ background: color }}
      />
      <div className="flex min-h-[52px] flex-col justify-between gap-1.5">
        <p
          className={`${compact ? "text-[9.5px]" : "text-[10px]"} min-h-[24px] text-muted-foreground font-semibold leading-[1.25] line-clamp-2`}
          title={label}
        >
          {label}
        </p>

        <div className="flex items-end justify-between gap-2">
          <div className="min-w-0 flex items-baseline gap-1.5">
            <span
              className={`${compact ? "text-[18px]" : "text-[19px]"} truncate font-black leading-none tracking-tight tabular-nums`}
              style={{ color }}
            >
              {value}
            </span>
            {unit && (
              <span className="shrink-0 text-[9.5px] text-muted-foreground font-medium">
                {unit}
              </span>
            )}
          </div>

          {(indicatorIconName || icon) && (
            <div className="shrink-0 flex items-center justify-center opacity-95" style={{ color }}>
              {indicatorIconName ? (
                <TypeIndicator
                  color={color}
                  shape={indicatorShape || "circle"}
                  iconName={indicatorIconName}
                  active={active}
                  size={compact ? "md" : "lg"}
                />
              ) : (
                <div
                  className="w-7 h-7 rounded-md flex items-center justify-center"
                  style={{ background: `${color}1a` }}
                >
                  {icon}
                </div>
              )}
            </div>
          )}
        </div>

        {delta && (
          <div
            className={`text-[9.5px] font-medium ${delta.positive ? "text-emerald-400" : "text-red-400"}`}
          >
            {delta.positive ? "▲" : "▼"} {delta.value}
          </div>
        )}
      </div>
    </motion.button>
  );
}
