export type NetKey =
  | "electric"
  | "gas"
  | "water"
  | "sewage"
  | "telecom"
  | "irrigation";

export interface NetworkStats {
  label: string;
  total: number;
  byType: Record<string, number>;
  bySector: Record<string, number>;
  byCategory: Record<string, number>;
  byImplementing: Record<string, number>;
  byMaterial: Record<string, number>;
  byDiameter: Record<string, number>;
  totalLengthKm: number;
  lengthByType: Record<string, number>;
}

export interface RoadStats {
  total: number;
  totalKm: number;
  byStatus: Record<string, number>;
  byField: Record<string, number>;
  byType: Record<string, number>;
  byDistrict: Record<string, number>;
  bySector: Record<string, { count: number; km: number }>;
  kmByStatus: Record<string, number>;
}

export interface SectorSummary {
  total: number;
  byStatus: Record<string, number>;
  totalAreaKm2: number;
  byPhase: Record<string, number>;
}

export interface SummaryFile {
  city: string;
  bbox: [number, number, number, number];
  generatedAt: string;
  sectors: SectorSummary;
  roads: RoadStats;
  networks: Record<NetKey, NetworkStats>;
}

export type SimpleGeom =
  | { t: "P"; c: [number, number] }
  | { t: "L"; c: [number, number][] }
  | { t: "ML"; c: [number, number][][] }
  | { t: "PG"; c: [number, number][][] };

export interface SimpleFeature {
  i: number;
  code?: string;
  sourceLayer?: string;
  n: NetKey;
  t: string;
  c: "point" | "line" | "room";
  s?: string;
  st?: string;
  imp?: string;
  d?: string;
  l?: number;
  g: SimpleGeom;
}

export interface NetworkFile {
  key: NetKey;
  label: string;
  stats: NetworkStats;
  features: SimpleFeature[];
}

export interface SectorPolygon {
  id: number;
  name: string;
  area: number;
  phase: string;
  status: string;
  order: number;
  coords: [number, number][][];
}

export interface AdminBoundaryPolygon {
  id: number;
  name: string;
  area: number;
  coords: [number, number][][];
}

export interface SectorsFile {
  bbox: [number, number, number, number];
  polygons: SectorPolygon[];
  adminBoundaries?: AdminBoundaryPolygon[];
}

export interface Road {
  id: number;
  sector: string;
  district: string;
  type: string;
  field: string;
  status: string;
  length: number;
  notes: string | null;
  coords: [number, number][];
}

export interface RoadsFile {
  stats: RoadStats;
  roads: Road[];
}

export const NET_COLORS: Record<NetKey, string> = {
  electric: "#f59e0b",
  gas: "#ef4444",
  water: "#3b82f6",
  sewage: "#a855f7",
  telecom: "#10b981",
  irrigation: "#06b6d4",
};

export const NET_LABELS: Record<NetKey, string> = {
  electric: "شبكة الكهرباء",
  gas: "شبكة الغاز",
  water: "شبكة المياه",
  sewage: "شبكة الصرف الصحي",
  telecom: "شبكة الاتصالات",
  irrigation: "شبكة الري",
};

export const STATUS_COLORS: Record<string, string> = {
  "تم التسليم": "#84f04d",
  "جاري العمل ميدانياً": "#f59e0b",
  "جاري العمل مكتبياً": "#3b82f6",
  "لم يتم العمل عليهم": "#ef4444",
  // Fallback variants
  "جاري العمل ميدانيا": "#f59e0b",
  "جاري العمل ميدانيًا": "#f59e0b",
  "جاري العمل مكتبيا": "#3b82f6",
  "جاري العمل مكتبيًا": "#3b82f6",
  "لم يتم العمل عليه": "#ef4444",
  "": "#64748b",
};
