import { useQuery } from "@tanstack/react-query";
import type {
  NetworkFile,
  NetKey,
  RoadsFile,
  SectorsFile,
  SummaryFile,
} from "./types";

const BASE = import.meta.env.BASE_URL;

async function fetchJSON<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}data/${path}`, { cache: "force-cache" });
  if (!res.ok) throw new Error(`Failed to load ${path}: ${res.status}`);
  return res.json();
}

export function useSummary() {
  return useQuery({
    queryKey: ["summary"],
    queryFn: () => fetchJSON<SummaryFile>("summary.json"),
    staleTime: Infinity,
  });
}

export function useSectors() {
  return useQuery({
    queryKey: ["sectors"],
    queryFn: () => fetchJSON<SectorsFile>("sectors.json"),
    staleTime: Infinity,
  });
}

export function useRoads() {
  return useQuery({
    queryKey: ["roads"],
    queryFn: () => fetchJSON<RoadsFile>("roads.json"),
    staleTime: Infinity,
  });
}

export function useNetwork(key: NetKey) {
  return useQuery({
    queryKey: ["network", key],
    queryFn: () => fetchJSON<NetworkFile>(`network-${key}.json`),
    staleTime: Infinity,
  });
}

export function formatNumber(n: number, opts: { decimals?: number; arabic?: boolean } = {}) {
  const { decimals = 0 } = opts;
  if (n == null || isNaN(n)) return "-";
  const value = Number(n).toLocaleString("en-US", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
  return value;
}

export function formatKm(n: number) {
  if (n >= 1000) return `${formatNumber(n / 1000, { decimals: 1 })} ألف كم`;
  return `${formatNumber(n, { decimals: n < 10 ? 2 : 1 })} كم`;
}

export function formatCount(n: number) {
  return formatNumber(n);
}
