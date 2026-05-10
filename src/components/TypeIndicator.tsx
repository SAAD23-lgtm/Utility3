import {
  Activity,
  Box,
  Cable,
  CircleDot,
  CircleStop,
  CircuitBoard,
  Construction,
  Droplets,
  Factory,
  Flame,
  Gauge,
  GaugeCircle,
  GitBranch,
  Hexagon,
  Home,
  HousePlug,
  Lightbulb,
  Link,
  Map,
  Package,
  Pipette,
  PlugZap,
  RadioTower,
  RotateCw,
  Router,
  Ruler,
  Search,
  ShowerHead,
  Sprout,
  UtilityPole,
  Waves,
  Wind,
  Zap,
  type LucideIcon,
} from "lucide-react";
import type { SymbolShape, TypeStyle } from "@/lib/symbology";

type IndicatorSize = "sm" | "md" | "lg";

const SIZE: Record<IndicatorSize, { box: string; icon: string; line: string }> = {
  sm: { box: "w-5 h-5", icon: "w-3 h-3", line: "w-5 h-3" },
  md: { box: "w-7 h-7", icon: "w-4 h-4", line: "w-7 h-4" },
  lg: { box: "w-9 h-9", icon: "w-5 h-5", line: "w-9 h-5" },
};

const ICONS: Record<string, LucideIcon> = {
  Activity,
  Box,
  Cable,
  CircleDot,
  CircleStop,
  CircuitBoard,
  Construction,
  Droplets,
  Factory,
  Flame,
  Gauge,
  GaugeCircle,
  GitBranch,
  Hexagon,
  Home,
  HousePlug,
  Lightbulb,
  Link,
  Map,
  Package,
  Pipette,
  PlugZap,
  RadioTower,
  RotateCw,
  Router,
  Ruler,
  Search,
  ShowerHead,
  Sprout,
  UtilityPole,
  Waves,
  Wind,
  Zap,
};

function getIcon(iconName?: string) {
  return (iconName && ICONS[iconName]) || CircleDot;
}

export function TypeIndicator({
  style,
  shape,
  iconName,
  color,
  active = false,
  size = "md",
  className = "",
}: {
  style?: Pick<TypeStyle, "color" | "shape" | "iconName">;
  shape?: SymbolShape;
  iconName?: string;
  color?: string;
  active?: boolean;
  size?: IndicatorSize;
  className?: string;
}) {
  const resolvedColor = color || style?.color || "hsl(var(--primary))";
  const resolvedShape = shape || style?.shape || "circle";
  const Icon = getIcon(iconName || style?.iconName);
  const dims = SIZE[size];
  const glow = active ? `0 0 12px ${resolvedColor}aa` : `0 0 0 1px ${resolvedColor}55`;

  if (resolvedShape === "line" || resolvedShape === "dashed-line") {
    return (
      <span className={`relative inline-flex shrink-0 items-center justify-center ${dims.line} ${className}`}>
        <span
          className="absolute left-0 right-0 top-1/2 h-[3px] -translate-y-1/2 rounded-full"
          style={{
            background: resolvedShape === "dashed-line" ? "transparent" : resolvedColor,
            borderTop: resolvedShape === "dashed-line" ? `3px dashed ${resolvedColor}` : undefined,
            boxShadow: active ? `0 0 10px ${resolvedColor}aa` : undefined,
          }}
        />
        <Icon className={`${dims.icon} relative z-10`} style={{ color: resolvedColor }} strokeWidth={2.3} />
      </span>
    );
  }

  const commonStyle = {
    background: `${resolvedColor}22`,
    borderColor: `${resolvedColor}cc`,
    color: resolvedColor,
    boxShadow: glow,
  };

  if (resolvedShape === "triangle") {
    return (
      <span className={`relative inline-flex shrink-0 items-center justify-center ${dims.box} ${className}`}>
        <span
          className="absolute inset-0"
          style={{
            ...commonStyle,
            clipPath: "polygon(50% 4%, 96% 92%, 4% 92%)",
          }}
        />
        <Icon className={`${dims.icon} relative z-10`} strokeWidth={2.3} style={{ color: resolvedColor }} />
      </span>
    );
  }

  return (
    <span
      className={`inline-flex shrink-0 items-center justify-center border ${dims.box} ${className}`}
      style={{
        ...commonStyle,
        borderRadius:
          resolvedShape === "circle" ? "999px"
          : resolvedShape === "hex" ? "5px"
          : resolvedShape === "diamond" ? "5px"
          : "4px",
        clipPath: resolvedShape === "hex" ? "polygon(25% 5%, 75% 5%, 100% 50%, 75% 95%, 25% 95%, 0 50%)" : undefined,
        transform: resolvedShape === "diamond" ? "rotate(45deg)" : undefined,
      }}
    >
      <Icon
        className={dims.icon}
        style={{ transform: resolvedShape === "diamond" ? "rotate(-45deg)" : undefined }}
        strokeWidth={2.3}
      />
    </span>
  );
}
