/**
 * Per-element-type symbology for the Obour utility network dashboard.
 * Keys must match the Arabic type names in public/data/network-*.json.
 */
import type { NetKey } from "./types";

export interface TypeStyle {
  color: string;
  /** For points: circle radius */
  radius?: number;
  /** For lines: stroke weight */
  weight?: number;
  fillOpacity?: number;
  opacity?: number;
  /** For dashed lines */
  dashArray?: string;
  /** Legacy icon text, kept for backward compatibility. New UI uses iconName. */
  icon?: string;
  /** Lucide icon key used by visual indicators. */
  iconName?: string;
  /** Stable geometric shape used by legends/cards/panels. */
  shape?: SymbolShape;
  /** Semantic role for network-specific indicators. */
  tone?: "primary" | "control" | "room" | "equipment" | "mainLine" | "secondaryLine" | "size";
  /** Order in legend (lower = first) */
  order: number;
}

type TypeMap = Record<string, TypeStyle>;
export type SymbolShape = "circle" | "square" | "diamond" | "triangle" | "hex" | "line" | "dashed-line";

const POINT_SHAPES: SymbolShape[] = ["circle", "square", "diamond", "triangle"];

function getDiameter(typeName: string): number | null {
  const match = typeName.match(/(\d+(?:\.\d+)?)\s*(?:مم|Ù…Ù…)/);
  if (!match) return null;
  const value = Number(match[1]);
  return Number.isFinite(value) ? value : null;
}

function lineWeightForDiameter(diameter: number) {
  if (diameter >= 700) return 3.4;
  if (diameter >= 400) return 3;
  if (diameter >= 200) return 2.35;
  if (diameter >= 110) return 1.8;
  return 1.35;
}

function lineColorForDiameter(typeName: string, baseColor: string) {
  const diameter = getDiameter(typeName);
  if (!diameter) return baseColor;
  if (typeName.startsWith("خط مياه") || typeName.startsWith("Ø®Ø· Ù…ÙŠØ§Ù‡")) {
    if (diameter >= 700) return "#1d4ed8";
    if (diameter >= 300) return "#2563eb";
    if (diameter >= 160) return "#0284c7";
    return "#38bdf8";
  }
  if (typeName.startsWith("خط صرف") || typeName.startsWith("Ø®Ø· ØµØ±Ù")) {
    if (diameter >= 700) return "#5b21b6";
    if (diameter >= 300) return "#7c3aed";
    if (diameter >= 200) return "#a855f7";
    return "#c4b5fd";
  }
  if (typeName.startsWith("خط ري") || typeName.startsWith("Ø®Ø· Ø±ÙŠ")) {
    if (diameter >= 300) return "#0f766e";
    if (diameter >= 160) return "#0891b2";
    if (diameter >= 100) return "#06b6d4";
    return "#67e8f9";
  }
  return baseColor;
}

function styleForDiameterLine(
  typeName: string,
  color: string,
  order: number,
  options: Partial<TypeStyle> = {}
): TypeStyle | null {
  const diameter = getDiameter(typeName);
  if (!diameter) return null;
  const weight = lineWeightForDiameter(diameter);
  return {
    color: lineColorForDiameter(typeName, color),
    weight,
    opacity: diameter >= 300 ? 0.94 : 0.84,
    order,
    shape: options.dashArray ? "dashed-line" : "line",
    iconName: "Cable",
    tone: diameter >= 300 ? "mainLine" : "secondaryLine",
    ...options,
  };
}

function getDynamicTypeStyle(netKey: NetKey, typeName: string): TypeStyle | null {
  if (netKey === "water") {
    if (typeName.startsWith("خط مياه")) {
      return styleForDiameterLine(typeName, "#38bdf8", 20);
    }
    if (typeName.startsWith("توصيلة منزلية")) {
      return styleForDiameterLine(typeName, "#7dd3fc", 21, {
        dashArray: "5 4",
        opacity: 0.76,
        iconName: "Home",
        tone: "secondaryLine",
      });
    }
    if (typeName === "صنبور حريق") {
      return {
        color: "#ef4444",
        radius: 5.5,
        fillOpacity: 0.96,
        opacity: 1,
        order: 6,
        shape: "hex",
        iconName: "Flame",
        tone: "control",
      };
    }
    if (typeName.includes("غسيل")) {
      return { color: "#7dd3fc", radius: 4.6, fillOpacity: 0.88, opacity: 0.95, order: 4, shape: "diamond", iconName: "ShowerHead", tone: "room" };
    }
    if (typeName.includes("هواء")) {
      return { color: "#bae6fd", radius: 4.6, fillOpacity: 0.88, opacity: 0.95, order: 5, shape: "triangle", iconName: "Wind", tone: "room" };
    }
    if (typeName.includes("تقاطع") || typeName.includes("غرف") || typeName.includes("غرفة")) {
      return { color: "#0ea5e9", radius: 5, fillOpacity: 0.82, opacity: 0.95, order: 3, shape: "square", iconName: "Waves", tone: "room" };
    }
  }

  if (netKey === "irrigation") {
    if (typeName.startsWith("خط ري")) {
      return styleForDiameterLine(typeName, "#22d3ee", 20, { iconName: "Sprout" });
    }
    if (typeName.startsWith("محبس ري")) {
      return {
        color: "#10b981",
        radius: 4.2,
        fillOpacity: 0.92,
        opacity: 0.96,
        order: 5,
        shape: "circle",
        iconName: "Droplets",
        tone: "control",
      };
    }
    if (typeName.includes("ربط")) {
      return { color: "#06b6d4", radius: 4.5, fillOpacity: 0.82, opacity: 0.9, order: 4, shape: "diamond", iconName: "Link", tone: "room" };
    }
    if (typeName.includes("محبس") || typeName.includes("غرفة")) {
      return { color: "#67e8f9", radius: 4.5, fillOpacity: 0.82, opacity: 0.9, order: 2, shape: "square", iconName: "Sprout", tone: "room" };
    }
  }

  if (netKey === "sewage") {
    if (typeName.startsWith("خط صرف")) {
      return styleForDiameterLine(typeName, "#a855f7", 20, { iconName: "Waves" });
    }
    if (typeName.startsWith("مطبق دائري")) {
      return { color: "#c4b5fd", radius: 4.3, fillOpacity: 0.9, opacity: 0.96, order: 1, shape: "circle", iconName: "CircleDot", tone: "control" };
    }
    if (typeName.startsWith("مطبق")) {
      return { color: "#a78bfa", radius: 4.4, fillOpacity: 0.9, opacity: 0.96, order: 2, shape: "square", iconName: "Search", tone: "control" };
    }
    if (typeName === "بلاعات المطر") {
      return { color: "#60a5fa", radius: 4.2, fillOpacity: 0.9, opacity: 0.95, order: 4, shape: "triangle", iconName: "Waves", tone: "equipment" };
    }
    if (typeName.includes("غرفة")) {
      return { color: "#8b5cf6", radius: 4.8, fillOpacity: 0.82, opacity: 0.94, order: 3, shape: "diamond", iconName: "Box", tone: "room" };
    }
  }

  return null;
}

const VISUAL_OVERRIDES: Record<NetKey, Record<string, Pick<TypeStyle, "shape" | "iconName" | "tone">>> = {
  electric: {
    "اعمدة الانارة": { shape: "circle", iconName: "UtilityPole", tone: "equipment" },
    "كوفرية": { shape: "square", iconName: "Box", tone: "equipment" },
    "بيلر": { shape: "hex", iconName: "Hexagon", tone: "control" },
    "كشك": { shape: "square", iconName: "HousePlug", tone: "room" },
    "كشك تحت الانشاء": { shape: "square", iconName: "Construction", tone: "room" },
    "ولاعة اعمدة الانارة": { shape: "circle", iconName: "Lightbulb", tone: "equipment" },
    "موزع كهرباء": { shape: "diamond", iconName: "CircuitBoard", tone: "control" },
    "محطة الكهرباء": { shape: "hex", iconName: "Factory", tone: "primary" },
    "تغذية العمارات": { shape: "dashed-line", iconName: "PlugZap", tone: "secondaryLine" },
    "كابلات الجهد المنخفض": { shape: "line", iconName: "Cable", tone: "secondaryLine" },
    "كابلات الجهد المتوسط": { shape: "line", iconName: "Zap", tone: "mainLine" },
    "كابلات اعمدة الانارة": { shape: "dashed-line", iconName: "Lightbulb", tone: "secondaryLine" },
  },
  gas: {
    "محبس": { shape: "circle", iconName: "Gauge", tone: "control" },
    "مخفض": { shape: "diamond", iconName: "GaugeCircle", tone: "control" },
    "ايندكاب": { shape: "hex", iconName: "CircleStop", tone: "equipment" },
    "غرفة": { shape: "square", iconName: "Box", tone: "room" },
    "تغذية منزلية": { shape: "dashed-line", iconName: "Home", tone: "secondaryLine" },
    "فرعي": { shape: "line", iconName: "GitBranch", tone: "secondaryLine" },
    "رئيسي": { shape: "line", iconName: "Flame", tone: "mainLine" },
  },
  water: {
    "محبس": { shape: "circle", iconName: "Droplets", tone: "control" },
    "غرف مياه": { shape: "square", iconName: "Waves", tone: "room" },
    "غرفة محبس": { shape: "square", iconName: "Box", tone: "room" },
    "محبس غسيل": { shape: "diamond", iconName: "ShowerHead", tone: "room" },
    "محبس هواء": { shape: "triangle", iconName: "Wind", tone: "room" },
  },
  sewage: {
    "غرفة تفتيش": { shape: "square", iconName: "Search", tone: "control" },
    "أخرى": { shape: "circle", iconName: "CircleDot", tone: "equipment" },
    "غرفة": { shape: "square", iconName: "Box", tone: "room" },
    "غرفة ربط": { shape: "diamond", iconName: "Link", tone: "room" },
    "درجة 1": { shape: "line", iconName: "Waves", tone: "mainLine" },
    "درجة 2": { shape: "line", iconName: "Waves", tone: "secondaryLine" },
    "خط صرف": { shape: "dashed-line", iconName: "Pipette", tone: "secondaryLine" },
  },
  telecom: {
    "بوكس": { shape: "square", iconName: "Package", tone: "equipment" },
    "كونيكتور": { shape: "diamond", iconName: "Cable", tone: "control" },
    "جوينت": { shape: "circle", iconName: "CircleDot", tone: "control" },
    "ايندكاب": { shape: "hex", iconName: "CircleStop", tone: "equipment" },
    "كبينة": { shape: "square", iconName: "RadioTower", tone: "room" },
    "شمبر": { shape: "square", iconName: "Box", tone: "equipment" },
    "باسيف": { shape: "hex", iconName: "Router", tone: "room" },
    "رئيسي": { shape: "line", iconName: "RadioTower", tone: "mainLine" },
    "فرعي": { shape: "line", iconName: "GitBranch", tone: "secondaryLine" },
  },
  irrigation: {
    "دائري": { shape: "circle", iconName: "RotateCw", tone: "primary" },
    "غرفة ري": { shape: "square", iconName: "Sprout", tone: "room" },
    "غرفة الري": { shape: "square", iconName: "Sprout", tone: "room" },
  },
};

/** Complete per-type styles keyed by Arabic type name */
export const TYPE_STYLES: Record<NetKey, TypeMap> = {
  electric: {
    "اعمدة الانارة": {
      color: "#fde68a",
      radius: 2.5,
      fillOpacity: 0.92,
      opacity: 0.9,
      order: 1,
    },
    "كوفرية": {
      color: "#fb923c",
      radius: 5,
      fillOpacity: 0.95,
      opacity: 1,
      order: 2,
    },
    "بيلر": {
      color: "#ef4444",
      radius: 6,
      fillOpacity: 0.95,
      opacity: 1,
      order: 3,
    },
    "كشك": {
      color: "#a855f7",
      radius: 6,
      fillOpacity: 0.72,
      opacity: 0.95,
      order: 4,
    },
    "كشك تحت الانشاء": {
      color: "#7c3aed",
      radius: 5,
      fillOpacity: 0.62,
      opacity: 0.85,
      dashArray: "3 3",
      order: 5,
    },
    "ولاعة اعمدة الانارة": {
      color: "#eab308",
      radius: 3,
      fillOpacity: 0.85,
      opacity: 0.9,
      order: 6,
    },
    "موزع كهرباء": {
      color: "#f97316",
      radius: 5,
      fillOpacity: 0.9,
      opacity: 1,
      order: 7,
    },
    "محطة الكهرباء": {
      color: "#dc2626",
      radius: 8,
      fillOpacity: 1,
      opacity: 1,
      order: 8,
    },
    "تغذية العمارات": {
      color: "#fbbf24",
      weight: 1.4,
      opacity: 0.85,
      dashArray: "5 3",
      order: 10,
    },
    "كابلات الجهد المنخفض": {
      color: "#f97316",
      weight: 1.5,
      opacity: 0.85,
      order: 11,
    },
    "كابلات الجهد المتوسط": {
      color: "#ef4444",
      weight: 2.2,
      opacity: 0.9,
      order: 12,
    },
    "كابلات اعمدة الانارة": {
      color: "#fde68a",
      weight: 1,
      opacity: 0.75,
      dashArray: "4 3",
      order: 13,
    },
  },

  gas: {
    "محبس": {
      color: "#ef4444",
      radius: 4.5,
      fillOpacity: 0.95,
      opacity: 1,
      order: 1,
    },
    "مخفض": {
      color: "#60a5fa",
      radius: 5,
      fillOpacity: 0.95,
      opacity: 1,
      order: 2,
    },
    "ايندكاب": {
      color: "#94a3b8",
      radius: 3,
      fillOpacity: 0.8,
      opacity: 0.9,
      order: 3,
    },
    "غرفة": {
      color: "#fb923c",
      radius: 4,
      fillOpacity: 0.9,
      opacity: 0.9,
      order: 4,
    },
    "تغذية منزلية": {
      color: "#fde68a",
      weight: 1,
      opacity: 0.75,
      dashArray: "4 3",
      order: 10,
    },
    "فرعي": {
      color: "#f97316",
      weight: 1.6,
      opacity: 0.85,
      order: 11,
    },
    "رئيسي": {
      color: "#ef4444",
      weight: 2.8,
      opacity: 0.95,
      order: 12,
    },
  },

  water: {
    "محبس": {
      color: "#2563eb",
      radius: 4.5,
      fillOpacity: 0.95,
      opacity: 1,
      order: 1,
    },
    "غرف مياه": {
      color: "#38bdf8",
      radius: 4,
      fillOpacity: 0.75,
      opacity: 0.9,
      order: 2,
    },
    "غرفة محبس": {
      color: "#0ea5e9",
      radius: 4,
      fillOpacity: 0.8,
      opacity: 0.9,
      order: 3,
    },
    "محبس غسيل": {
      color: "#7dd3fc",
      radius: 3.5,
      fillOpacity: 0.9,
      opacity: 0.9,
      order: 4,
    },
    "محبس هواء": {
      color: "#bae6fd",
      radius: 3.5,
      fillOpacity: 0.9,
      opacity: 0.9,
      order: 5,
    },
  },

  sewage: {
    "غرفة تفتيش": {
      color: "#c4b5fd",
      radius: 4,
      fillOpacity: 0.92,
      opacity: 1,
      order: 1,
    },
    "أخرى": {
      color: "#7c3aed",
      radius: 3,
      fillOpacity: 0.75,
      opacity: 0.85,
      order: 2,
    },
    "غرفة": {
      color: "#a78bfa",
      radius: 3.5,
      fillOpacity: 0.8,
      opacity: 0.9,
      order: 3,
    },
    "غرفة ربط": {
      color: "#8b5cf6",
      radius: 3.5,
      fillOpacity: 0.8,
      opacity: 0.9,
      order: 4,
    },
    "درجة 1": {
      color: "#a855f7",
      weight: 2.5,
      opacity: 0.9,
      order: 10,
    },
    "درجة 2": {
      color: "#c4b5fd",
      weight: 1.5,
      opacity: 0.85,
      order: 11,
    },
    "خط صرف": {
      color: "#ddd6fe",
      weight: 1.2,
      opacity: 0.8,
      dashArray: "5 3",
      order: 12,
    },
  },

  telecom: {
    "بوكس": {
      color: "#34d399",
      radius: 4.5,
      fillOpacity: 0.95,
      opacity: 1,
      order: 1,
    },
    "كونيكتور": {
      color: "#6ee7b7",
      radius: 3,
      fillOpacity: 0.9,
      opacity: 0.9,
      order: 2,
    },
    "جوينت": {
      color: "#a7f3d0",
      radius: 3.5,
      fillOpacity: 0.88,
      opacity: 0.9,
      order: 3,
    },
    "ايندكاب": {
      color: "#10b981",
      radius: 2.5,
      fillOpacity: 0.8,
      opacity: 0.85,
      order: 4,
    },
    "كبينة": {
      color: "#059669",
      radius: 6,
      fillOpacity: 0.82,
      opacity: 1,
      order: 5,
    },
    "شمبر": {
      color: "#d1fae5",
      radius: 4,
      fillOpacity: 0.85,
      opacity: 0.9,
      order: 6,
    },
    "باسيف": {
      color: "#065f46",
      radius: 4,
      fillOpacity: 0.78,
      opacity: 1,
      order: 7,
    },
    "رئيسي": {
      color: "#34d399",
      weight: 2.5,
      opacity: 0.9,
      order: 10,
    },
    "فرعي": {
      color: "#6ee7b7",
      weight: 1.5,
      opacity: 0.82,
      order: 11,
    },
  },

  irrigation: {
    "دائري": {
      color: "#22d3ee",
      radius: 4,
      fillOpacity: 0.8,
      opacity: 0.9,
      order: 1,
    },
    "غرفة ري": {
      color: "#67e8f9",
      radius: 3.5,
      fillOpacity: 0.8,
      opacity: 0.9,
      order: 2,
    },
    "غرفة الري": {
      color: "#a5f3fc",
      radius: 3.5,
      fillOpacity: 0.75,
      opacity: 0.88,
      order: 3,
    },
  },
};

/** Returns the rendering style for a feature, with fallback to network default */
export function getTypeStyle(
  netKey: NetKey,
  typeName: string,
  netColor: string
): TypeStyle {
  const dynamic = getDynamicTypeStyle(netKey, typeName);
  if (dynamic) return dynamic;
  const netMap = TYPE_STYLES[netKey] || {};
  const base = netMap[typeName] || {
    color: netColor,
    radius: 3,
    fillOpacity: 0.85,
    opacity: 0.85,
    order: 99,
  };
  const visual = VISUAL_OVERRIDES[netKey]?.[typeName] || {};
  const shape = visual.shape || (base.weight !== undefined ? (base.dashArray ? "dashed-line" : "line") : POINT_SHAPES[Math.abs(base.order - 1) % POINT_SHAPES.length]);
  return {
    ...base,
    ...visual,
    shape,
    iconName: visual.iconName || (base.weight !== undefined ? "Cable" : "CircleDot"),
  };
}

export function isLineStyle(style: TypeStyle): boolean {
  return style.weight !== undefined;
}

export function getSymbolShape(style: TypeStyle): SymbolShape {
  if (style.shape) return style.shape;
  if (isLineStyle(style)) return style.dashArray ? "dashed-line" : "line";
  return POINT_SHAPES[Math.abs(style.order - 1) % POINT_SHAPES.length];
}

export function getPointRadius(style: TypeStyle): number {
  const toneBoost =
    style.tone === "primary" ? 0.55
    : style.tone === "control" ? 0.28
    : style.tone === "room" ? 0.18
    : style.tone === "equipment" ? 0.08
    : 0;
  return Math.max(2.5, Math.min((style.radius ?? 3.2) * 0.68 + toneBoost, 4.8));
}

export function getLineWeight(style: TypeStyle): number {
  const toneBoost =
    style.tone === "mainLine" ? 0.55
    : style.tone === "secondaryLine" ? -0.05
    : 0;
  return Math.max(1.25, Math.min((style.weight ?? 1.8) + toneBoost, 4.4));
}

/**
 * User-facing Arabic labels for element type groups (for panels).
 * Key = Arabic type name as in data.
 */
export const TYPE_PANEL_LABELS: Record<string, string> = {
  // Electric
  "اعمدة الانارة": "أعمدة الإنارة",
  "كوفرية": "كوفرية",
  "بيلر": "بيلارات",
  "كشك": "أكشاك",
  "كشك تحت الانشاء": "أكشاك تحت الإنشاء",
  "ولاعة اعمدة الانارة": "ولاعات أعمدة الإنارة",
  "موزع كهرباء": "موزعات كهرباء",
  "محطة الكهرباء": "محطات الكهرباء",
  "تغذية العمارات": "تغذية العمارات",
  "كابلات الجهد المنخفض": "كابلات الجهد المنخفض",
  "كابلات الجهد المتوسط": "كابلات الجهد المتوسط",
  "كابلات اعمدة الانارة": "كابلات أعمدة الإنارة",
  // Gas
  "محبس": "محابس",
  "مخفض": "مخفضات",
  "ايندكاب": "إيندكابات",
  "غرفة": "غرف",
  "تغذية منزلية": "تغذية منزلية",
  "فرعي": "خط فرعي",
  "رئيسي": "خط رئيسي",
  // Water
  "غرف مياه": "غرف مياه",
  "غرفة محبس": "غرف محابس",
  "محبس غسيل": "محابس غسيل",
  "محبس هواء": "محابس هواء",
  // Sewage
  "غرفة تفتيش": "غرف التفتيش",
  "أخرى": "نقاط أخرى",
  "غرفة ربط": "غرف الربط",
  "درجة 1": "خط درجة أولى",
  "درجة 2": "خط درجة ثانية",
  "خط صرف": "خطوط الصرف",
  // Telecom
  "بوكس": "بوكسات",
  "كونيكتور": "كونيكتورات",
  "جوينت": "جوينتات",
  "كبينة": "كباين",
  "شمبر": "شمبرات",
  "باسيف": "باسيف",
  // Irrigation
  "دائري": "دوائر الري",
  "غرفة ري": "غرف الري",
  "غرفة الري": "غرف الري",
};

/** Get display label for a type name */
export function getTypeLabel(typeName: string): string {
  if (typeName.startsWith("خط مياه")) return typeName;
  if (typeName.startsWith("توصيلة منزلية")) return typeName;
  if (typeName === "صنبور حريق") return "صنابير الحريق";
  if (typeName.startsWith("خط ري")) return typeName;
  if (typeName.startsWith("محبس ري")) return typeName;
  if (typeName.startsWith("خط صرف")) return typeName;
  if (typeName.startsWith("مطبق")) return typeName;
  if (typeName === "بلاعات المطر") return "بلاعات المطر";
  return TYPE_PANEL_LABELS[typeName] || typeName;
}
