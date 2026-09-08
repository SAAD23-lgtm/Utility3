import { useEffect, useMemo, useRef, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { maplibreGL } from "@maplibre/maplibre-gl-leaflet";
import "maplibre-gl/dist/maplibre-gl.css";
import type {
  NetKey,
  AdminBoundaryPolygon,
  SectorPolygon,
  SimpleFeature,
  Road,
} from "@/lib/types";
import { NET_COLORS, STATUS_COLORS } from "@/lib/types";
import { getLineWeight, getPointRadius, getTypeStyle } from "@/lib/symbology";
import { useI18n, netLabel } from "@/lib/i18n";

interface MapProps {
  bbox?: [number, number, number, number];
  sectors?: SectorPolygon[];
  adminBoundaries?: AdminBoundaryPolygon[];
  features?: SimpleFeature[];
  roads?: Road[];
  visibleNetworks?: Set<NetKey>;
  highlightSector?: string | null;
  flyToFeature?: SimpleFeature | null;
  onFeatureClick?: (f: SimpleFeature) => void;
  onRoadClick?: (r: Road) => void;
  onSectorClick?: (s: SectorPolygon) => void;
  showRoads?: boolean;
  showSectors?: boolean;
  className?: string;
  colorRoadsByStatus?: boolean;
  colorSectorsByStatus?: boolean;
  maxFeatures?: number;
  symbolMode?: "combined" | "network-detail";
}

type BasemapKey = "dark" | "light" | "streets" | "satellite";

const BASEMAPS: Record<
  BasemapKey,
  { labelAr: string; labelEn: string; url: string; labelsUrl?: string; subdomains?: string | string[]; className?: string }
> = {
  dark: {
    labelAr: "داكن",
    labelEn: "Dark",
    url: "https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}",
    labelsUrl: "https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Reference/MapServer/tile/{z}/{y}/{x}",
    className: "map-black-basemap",
  },
  light: {
    labelAr: "فاتح",
    labelEn: "Light",
    url: "https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Base/MapServer/tile/{z}/{y}/{x}",
    labelsUrl: "https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Reference/MapServer/tile/{z}/{y}/{x}",
  },
  streets: {
    labelAr: "طرق",
    labelEn: "Roads",
    url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}",
  },
  satellite: {
    labelAr: "صور",
    labelEn: "Imagery",
    url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
    labelsUrl: "https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Reference/MapServer/tile/{z}/{y}/{x}",
  },
};

const MAP_HALO = "#020617";
const SECTOR_FALLBACK = "#14b8a6";
const SECTOR_BOUNDARY = "#22d3ee";
const ADMIN_BOUNDARY = "#94a3b8";
const DARK_VECTOR_STYLE = "https://tiles.openfreemap.org/styles/dark";

function applyBasemap(
  map: L.Map,
  key: BasemapKey,
  layers: { base?: L.TileLayer; labels?: L.TileLayer; vector?: L.MaplibreGL }
) {
  if (layers.base) {
    map.removeLayer(layers.base);
    layers.base = undefined;
  }
  if (layers.labels) {
    map.removeLayer(layers.labels);
    layers.labels = undefined;
  }
  if (layers.vector) {
    map.removeLayer(layers.vector);
    layers.vector = undefined;
  }

  if (key === "dark") {
    const vector = maplibreGL({ style: DARK_VECTOR_STYLE, interactive: false });
    vector.addTo(map);
    layers.vector = vector;
    const glMap = vector.getMaplibreMap();
    glMap.once("load", () => {
      // Keep roads, borders and labels from the vector style, while turning
      // every land/water/building fill truly black.
      for (const layer of glMap.getStyle().layers || []) {
        try {
          if (layer.type === "background") glMap.setPaintProperty(layer.id, "background-color", "#000000");
          if (layer.type === "fill") glMap.setPaintProperty(layer.id, "fill-color", "#020304");
          if (layer.type === "line") {
            const id = layer.id.toLowerCase();
            const roadColor = /motorway|trunk|primary/.test(id)
              ? "#66717f"
              : /secondary|tertiary/.test(id)
                ? "#4b5563"
                : "#303844";
            glMap.setPaintProperty(layer.id, "line-color", roadColor);
            glMap.setPaintProperty(layer.id, "line-opacity", 0.78);
          }
          if (layer.type === "symbol") {
            glMap.setPaintProperty(layer.id, "text-color", "#a8b1bf");
            glMap.setPaintProperty(layer.id, "text-halo-color", "#000000");
            glMap.setPaintProperty(layer.id, "text-halo-width", 1.1);
          }
        } catch {
          // Some style layers intentionally do not expose a fill color.
        }
      }
    });
    return;
  }

  const config = BASEMAPS[key];
  layers.base = L.tileLayer(config.url, {
    maxZoom: 19,
    subdomains: config.subdomains || "abc",
  }).addTo(map);

  if (config.labelsUrl) {
    layers.labels = L.tileLayer(config.labelsUrl, {
      maxZoom: 19,
      subdomains: config.subdomains || "abc",
      pane: "shadowPane",
    }).addTo(map);
  }
}

function featureDrawRank(f: SimpleFeature) {
  if (f.g.t === "PG") return 0;
  if (f.g.t === "L" || f.g.t === "ML") return 1;
  return 2;
}

function featureVisualRank(f: SimpleFeature) {
  const style = getTypeStyle(f.n, f.t, NET_COLORS[f.n]);
  const base = featureDrawRank(f) * 100;
  if (f.g.t === "L" || f.g.t === "ML") return base + (style.weight || 1);
  if (f.g.t === "P") return base + (style.radius || 3);
  return base;
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function getSectorColor(status: string, classify: boolean, highlighted: boolean) {
  if (highlighted) return "#fde047";
  if (!classify) return SECTOR_BOUNDARY;
  if (!status) return SECTOR_BOUNDARY;
  return STATUS_COLORS[status] || SECTOR_FALLBACK;
}

function getSectorStyle(status: string, highlighted: boolean, classify: boolean) {
  const color = getSectorColor(status, classify, highlighted);
  const isUnknown = !status;
  const isBoundaryOnly = !classify;

  return {
    color,
    weight: highlighted ? 1.8 : isBoundaryOnly ? 0.75 : isUnknown ? 0.55 : 0.7,
    fillOpacity: highlighted ? 0.08 : isBoundaryOnly ? 0.012 : 0.018,
    opacity: highlighted ? 0.86 : isBoundaryOnly ? 0.42 : isUnknown ? 0.28 : 0.46,
    haloOpacity: highlighted ? 0.2 : isBoundaryOnly ? 0.08 : isUnknown ? 0.08 : 0.07,
    haloWeight: highlighted ? 2.8 : isBoundaryOnly ? 1.4 : isUnknown ? 1.2 : 1.3,
    dashArray: isBoundaryOnly ? "5 5" : undefined,
  };
}

function getRingBoundsCenter(ring: [number, number][]) {
  let minLat = Infinity;
  let maxLat = -Infinity;
  let minLon = Infinity;
  let maxLon = -Infinity;

  ring.forEach(([lon, lat]) => {
    minLat = Math.min(minLat, lat);
    maxLat = Math.max(maxLat, lat);
    minLon = Math.min(minLon, lon);
    maxLon = Math.max(maxLon, lon);
  });

  return [(minLat + maxLat) / 2, (minLon + maxLon) / 2] as [number, number];
}

function getRingLabelPoint(ring: [number, number][]) {
  let signedArea = 0;
  let centroidLon = 0;
  let centroidLat = 0;

  for (let i = 0; i < ring.length - 1; i += 1) {
    const [lon1, lat1] = ring[i];
    const [lon2, lat2] = ring[i + 1];
    const cross = lon1 * lat2 - lon2 * lat1;
    signedArea += cross;
    centroidLon += (lon1 + lon2) * cross;
    centroidLat += (lat1 + lat2) * cross;
  }

  if (Math.abs(signedArea) < 1e-12) return getRingBoundsCenter(ring);

  signedArea *= 0.5;
  return [
    centroidLat / (6 * signedArea),
    centroidLon / (6 * signedArea),
  ] as [number, number];
}

function getLargestRing(rings: [number, number][][]) {
  return rings.reduce((largest, ring) => (ring.length > largest.length ? ring : largest), rings[0]);
}

function getSectorLatLngs(rings: [number, number][][]) {
  return rings
    .filter((ring) => ring.length >= 4)
    .map((ring) => ring.map(([lon, lat]) => [lat, lon]) as [number, number][]);
}

function getStudyBounds(sectors?: SectorPolygon[]) {
  const coords = (sectors || []).flatMap((sector) => sector.coords.flat());
  const valid = coords.filter(([lon, lat]) => Number.isFinite(lon) && Number.isFinite(lat));
  if (valid.length === 0) return null;
  const lons = valid.map(([lon]) => lon);
  const lats = valid.map(([, lat]) => lat);
  return [[Math.min(...lats), Math.min(...lons)], [Math.max(...lats), Math.max(...lons)]] as L.LatLngBoundsLiteral;
}

function createSectorLabelIcon(name: string, color: string) {
  return L.divIcon({
    className: "sector-label",
    html: `<span style="--sector-label-color:${color}">${escapeHtml(name)}</span>`,
    iconSize: [0, 0],
    iconAnchor: [0, 0],
  });
}

function getPolygonCenter(rings: [number, number][][]) {
  const ring = getLargestRing(rings);
  return getRingLabelPoint(ring);
}

function getDetailPointSize(style: ReturnType<typeof getTypeStyle>) {
  const radius = getPointRadius(style);
  return Math.max(2.4, Math.min(5.2, radius * 0.62));
}

function getShapeSvgPath(shape: string | undefined, size: number) {
  const c = size / 2;
  const r = size * 0.34;
  if (shape === "square") {
    const inset = size * 0.22;
    return `<rect x="${inset}" y="${inset}" width="${size - inset * 2}" height="${size - inset * 2}" rx="${size * 0.08}" />`;
  }
  if (shape === "diamond") {
    return `<polygon points="${c},${size * 0.15} ${size * 0.85},${c} ${c},${size * 0.85} ${size * 0.15},${c}" />`;
  }
  if (shape === "triangle") {
    return `<polygon points="${c},${size * 0.14} ${size * 0.86},${size * 0.82} ${size * 0.14},${size * 0.82}" />`;
  }
  if (shape === "hex") {
    return `<polygon points="${c},${size * 0.12} ${size * 0.82},${size * 0.31} ${size * 0.82},${size * 0.69} ${c},${size * 0.88} ${size * 0.18},${size * 0.69} ${size * 0.18},${size * 0.31}" />`;
  }
  return `<circle cx="${c}" cy="${c}" r="${r}" />`;
}

function createDetailPointIcon(style: ReturnType<typeof getTypeStyle>) {
  const markerSize = getDetailPointSize(style);
  const size = Math.ceil(markerSize * 2.45);
  const shape = style.shape === "line" || style.shape === "dashed-line" ? "circle" : style.shape;
  const shapePath = getShapeSvgPath(shape, size);
  const color = style.color;
  const html = `
    <svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" aria-hidden="true">
      <g fill="${color}" opacity="0.1" filter="url(#glow)">
        ${shapePath}
      </g>
      <g fill="${color}" opacity="0.86" stroke="rgba(5,12,18,0.82)" stroke-width="0.75">
        ${shapePath}
      </g>
      <defs>
        <filter id="glow" x="-60%" y="-60%" width="220%" height="220%">
          <feGaussianBlur stdDeviation="1.15" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>
    </svg>`;

  return L.divIcon({
    className: "network-detail-symbol",
    html,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  });
}

function addFireflyLine(
  group: L.LayerGroup,
  latlngs: [number, number][],
  style: ReturnType<typeof getTypeStyle>,
  weight: number,
  renderer: L.Renderer
) {
  const isMain = style.tone === "mainLine" || style.tone === "primary";
  group.addLayer(
    L.polyline(latlngs, {
      color: style.color,
      weight: weight + (isMain ? 5.4 : 3.8),
      opacity: isMain ? 0.18 : 0.12,
      dashArray: style.dashArray,
      interactive: false,
      lineCap: "round",
      lineJoin: "round",
      renderer,
    })
  );
  group.addLayer(
    L.polyline(latlngs, {
      color: style.color,
      weight: weight + (isMain ? 2.2 : 1.4),
      opacity: isMain ? 0.34 : 0.22,
      dashArray: style.dashArray,
      interactive: false,
      lineCap: "round",
      lineJoin: "round",
      renderer,
    })
  );
  return L.polyline(latlngs, {
    color: style.color,
    weight,
    opacity: Math.min(style.opacity ?? 0.86, isMain ? 0.88 : 0.72),
    dashArray: style.dashArray,
    lineCap: "round",
    lineJoin: "round",
    renderer,
  });
}

function addFastLine(
  group: L.LayerGroup,
  latlngs: [number, number][],
  style: ReturnType<typeof getTypeStyle>,
  weight: number,
  renderer: L.Renderer
) {
  const isMain = style.tone === "mainLine" || style.tone === "primary";
  const line = L.polyline(latlngs, {
    color: style.color,
    weight: Math.max(1.15, weight * (isMain ? 1.08 : 0.94)),
    opacity: Math.min(style.opacity ?? 0.94, isMain ? 0.94 : 0.8),
    dashArray: style.dashArray,
    lineCap: "round",
    lineJoin: "round",
    renderer,
  });
  return line;
}

function getFeatureVertexCount(f: SimpleFeature) {
  if (f.g.t === "P") return 1;
  if (f.g.t === "L") return f.g.c.length;
  if (f.g.t === "ML") return f.g.c.reduce((sum, segment) => sum + segment.length, 0);
  return f.g.c.reduce((sum, ring) => sum + ring.length, 0);
}

function getFeatureCoordinateText(f: SimpleFeature) {
  if (f.g.t !== "P") return "";
  const [lon, lat] = f.g.c;
  return `${lat.toFixed(6)}, ${lon.toFixed(6)}`;
}

export function MapView(props: MapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const layersRef = useRef<Record<string, L.LayerGroup>>({});
  const basemapLayersRef = useRef<{ base?: L.TileLayer; labels?: L.TileLayer }>({});
  const onFeatureClickRef = useRef(props.onFeatureClick);
  const onRoadClickRef = useRef(props.onRoadClick);
  const onSectorClickRef = useRef(props.onSectorClick);
  const [basemap, setBasemap] = useState<BasemapKey>("dark");
  const [viewportVersion, setViewportVersion] = useState(0);
  const [hovered, setHovered] = useState<{
    title: string;
    titleColor?: string;
    rows: Array<[string, string]>;
  } | null>(null);
  const hoverPosRef = useRef({ x: 0, y: 0 });
  const { t, td, lang } = useI18n();
  const visibleNetworkKey = useMemo(
    () => (props.visibleNetworks ? [...props.visibleNetworks].sort().join("|") : "all"),
    [props.visibleNetworks]
  );

  useEffect(() => {
    onFeatureClickRef.current = props.onFeatureClick;
    onRoadClickRef.current = props.onRoadClick;
    onSectorClickRef.current = props.onSectorClick;
  }, [props.onFeatureClick, props.onRoadClick, props.onSectorClick]);

  // Initialize map
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    const map = L.map(containerRef.current, {
      center: [30.27, 31.55],
      zoom: 13,
      preferCanvas: true,
      zoomControl: false,
      attributionControl: false,
    });
    applyBasemap(map, basemap, basemapLayersRef.current);
    map.createPane("sectorPane");
    map.getPane("sectorPane")!.style.zIndex = "230";
    map.createPane("sectorLabelPane");
    map.getPane("sectorLabelPane")!.style.zIndex = "430";
    map.getPane("sectorLabelPane")!.style.pointerEvents = "none";
    map.on("click", () => setHovered(null));
    map.on("moveend", () => setViewportVersion((version) => version + 1));
    L.control.zoom({ position: "topleft" }).addTo(map);
    mapRef.current = map;
    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!mapRef.current) return;
    applyBasemap(mapRef.current, basemap, basemapLayersRef.current);
  }, [basemap]);

  useEffect(() => {
    if (!containerRef.current) return;
    const updateSize = () => {
      window.requestAnimationFrame(() => mapRef.current?.invalidateSize());
    };
    const observer = new ResizeObserver(updateSize);
    observer.observe(containerRef.current);
    updateSize();
    return () => observer.disconnect();
  }, []);

  // Prefer actual study sectors: raw network bounds can include a stray point.
  useEffect(() => {
    if (!mapRef.current) return;
    const sectorBounds = getStudyBounds(props.sectors);
    const fallbackBounds = props.bbox
      ? [[props.bbox[1], props.bbox[0]], [props.bbox[3], props.bbox[2]]] as L.LatLngBoundsLiteral
      : null;
    const bounds = sectorBounds || fallbackBounds;
    if (!bounds) return;
    mapRef.current.fitBounds(
      bounds,
      { padding: [28, 28], maxZoom: 15 }
    );
  }, [props.bbox, props.sectors]);

  // Fly to feature
  useEffect(() => {
    if (!mapRef.current || !props.flyToFeature) return;
    const f = props.flyToFeature;
    let lat = 0, lon = 0;
    if (f.g.t === "P") {
      [lon, lat] = f.g.c;
    } else if (f.g.t === "L") {
      const mid = f.g.c[Math.floor(f.g.c.length / 2)];
      [lon, lat] = mid;
    } else if (f.g.t === "ML") {
      const seg = f.g.c[0];
      const mid = seg[Math.floor(seg.length / 2)];
      [lon, lat] = mid;
    } else if (f.g.t === "PG") {
      const ring = f.g.c[0];
      const mid = ring[Math.floor(ring.length / 2)];
      [lon, lat] = mid;
    }
    if (lat && lon) mapRef.current.flyTo([lat, lon], 17, { duration: 0.6 });
  }, [props.flyToFeature]);

  // Sectors layer
  useEffect(() => {
    if (!mapRef.current) return;
    const map = mapRef.current;
    if (layersRef.current.sectors) {
      layersRef.current.sectors.remove();
      delete layersRef.current.sectors;
    }
    if (props.showSectors === false || !props.sectors || props.sectors.length === 0) return;
    const group = L.layerGroup();
    const renderer = L.canvas({ pane: "sectorPane" });

    props.adminBoundaries?.forEach((boundary) => {
      const latlngs = getSectorLatLngs(boundary.coords);
      if (latlngs.length === 0) return;
      group.addLayer(
        L.polygon(latlngs, {
          color: MAP_HALO,
          weight: 3.2,
          fillOpacity: 0,
          opacity: 0.34,
          interactive: false,
          pane: "sectorPane",
          renderer,
        })
      );
      group.addLayer(
        L.polygon(latlngs, {
          color: ADMIN_BOUNDARY,
          weight: 1,
          fillOpacity: 0,
          opacity: 0.55,
          dashArray: "6 5",
          interactive: false,
          pane: "sectorPane",
          renderer,
        })
      );
    });

    const orderedSectors = [...props.sectors].sort((a, b) => {
      const aNamed = a.name ? 1 : 0;
      const bNamed = b.name ? 1 : 0;
      if (aNamed !== bNamed) return aNamed - bNamed;
      return (a.order || a.id) - (b.order || b.id);
    });

    orderedSectors.forEach((s) => {
      const latlngs = getSectorLatLngs(s.coords);
      if (latlngs.length === 0) return;
      const hasName = !!s.name?.trim();
      const isHighlighted = hasName && props.highlightSector === s.name;
      const sectorStyle = getSectorStyle(s.status, isHighlighted, !!props.colorSectorsByStatus);

      group.addLayer(
        L.polygon(latlngs, {
          color: MAP_HALO,
          weight: sectorStyle.haloWeight,
          fillOpacity: 0,
          opacity: sectorStyle.haloOpacity,
          dashArray: sectorStyle.dashArray,
          interactive: false,
          pane: "sectorPane",
          renderer,
        })
      );

      const poly = L.polygon(latlngs, {
        color: sectorStyle.color,
        weight: sectorStyle.weight,
        fillColor: sectorStyle.color,
        fillOpacity: sectorStyle.fillOpacity,
        opacity: sectorStyle.opacity,
        dashArray: sectorStyle.dashArray,
        lineCap: "round",
        lineJoin: "round",
        pane: "sectorPane",
        renderer,
      });
      if (hasName) {
        poly.on("mouseover", (e) => {
          setHovered({
            title: td(s.name) || t("g.no_name"),
            rows: [
              [t("hover.status"), td(s.status) || t("g.dash")],
              [t("hover.phase"), td(s.phase) || t("g.dash")],
              [t("hover.area"), `${(s.area > 1000 ? s.area / 1e6 : s.area).toFixed(2)} ${t("g.km2")}`],
            ],
          });
          hoverPosRef.current = {
            x: (e.originalEvent as MouseEvent).clientX,
            y: (e.originalEvent as MouseEvent).clientY,
          };
        });
        poly.on("mouseout", () => setHovered(null));
        poly.on("click", () => onSectorClickRef.current?.(s));
      }
      group.addLayer(poly);

      if (isHighlighted && s.name && s.coords.length > 0) {
        const labelRing = getLargestRing(s.coords);
        group.addLayer(
          L.marker(getRingLabelPoint(labelRing), {
            icon: createSectorLabelIcon(td(s.name) || s.name, sectorStyle.color),
            interactive: false,
            keyboard: false,
            pane: "sectorLabelPane",
          })
        );
      }
    });
    group.addTo(map);
    layersRef.current.sectors = group;
  }, [
    props.sectors, props.adminBoundaries, props.showSectors, props.highlightSector,
    props.colorSectorsByStatus, lang,
  ]);

  // Roads layer
  useEffect(() => {
    if (!mapRef.current) return;
    const map = mapRef.current;
    if (layersRef.current.roads) {
      layersRef.current.roads.remove();
      delete layersRef.current.roads;
    }
    if (!props.showRoads || !props.roads || props.roads.length === 0) return;
    const group = L.layerGroup();
    const renderer = L.canvas();
    props.roads.forEach((r) => {
      if (!r.coords || r.coords.length < 2) return;
      const latlngs = r.coords.map(([lon, lat]) => [lat, lon]) as [number, number][];
      const color = props.colorRoadsByStatus
        ? STATUS_COLORS[r.status] || "#64748b"
        : r.field === "رئيسي" ? "#f59e0b"
        : r.field === "ثانوي" ? "#3b82f6" : "#64748b";
      const weight = r.field === "رئيسي" ? 2.5 : r.field === "ثانوي" ? 1.8 : 1.2;
      group.addLayer(
        L.polyline(latlngs, {
          color,
          weight: weight + 3,
          opacity: 0.1,
          interactive: false,
          lineCap: "round",
          lineJoin: "round",
          renderer,
        })
      );
      const line = L.polyline(latlngs, {
        color,
        weight: Math.max(0.7, weight * 0.65),
        opacity: props.colorRoadsByStatus ? 0.42 : 0.32,
        lineCap: "round",
        lineJoin: "round",
        renderer,
      });
      line.on("mouseover", (e) => {
        setHovered({
          title: `${t("hover.road")} · ${td(r.field) || ""}`,
          titleColor: color,
          rows: [
            [t("hover.sector"), td(r.sector) || t("g.dash")],
            [t("hover.district"), td(r.district) || t("g.dash")],
            [t("hover.status"), td(r.status) || t("g.dash")],
            [t("hover.length"), `${r.length.toFixed(2)} ${t("g.km")}`],
          ],
        });
        hoverPosRef.current = {
          x: (e.originalEvent as MouseEvent).clientX,
          y: (e.originalEvent as MouseEvent).clientY,
        };
      });
      line.on("mouseout", () => setHovered(null));
      line.on("click", () => onRoadClickRef.current?.(r));
      group.addLayer(line);
    });
    group.addTo(map);
    layersRef.current.roads = group;
  }, [props.roads, props.showRoads, props.colorRoadsByStatus, lang]);

  // Features layer — per-type symbology
  useEffect(() => {
    if (!mapRef.current) return;
    const map = mapRef.current;
    if (layersRef.current.features) {
      layersRef.current.features.remove();
      delete layersRef.current.features;
    }
    if (!props.features || props.features.length === 0) return;
    const visible = props.visibleNetworks;
    const cap = props.maxFeatures ?? Number.POSITIVE_INFINITY;
    const group = L.layerGroup();
    const renderer = L.canvas({ padding: 0.35 });
    const isNetworkDetail = props.symbolMode === "network-detail";
    const useFastSymbols = !isNetworkDetail;
    const zoom = map.getZoom();
    const viewBounds = map.getBounds().pad(0.16);
    const symbolScale = zoom <= 12 ? 0.38 : zoom <= 14 ? 0.55 : zoom <= 16 ? 0.72 : 0.92;
    let rendered = 0;

    const isVisibleInViewport = (f: SimpleFeature) => {
      const contains = ([lon, lat]: [number, number]) => viewBounds.contains([lat, lon]);
      if (f.g.t === "P") return contains(f.g.c);
      if (f.g.t === "L") return f.g.c.some(contains);
      if (f.g.t === "ML") return f.g.c.some((segment) => segment.some(contains));
      return f.g.c.some((ring) => ring.some(contains));
    };

    const orderedFeatures = [...props.features].sort(
      (a, b) => featureVisualRank(a) - featureVisualRank(b)
    );

    const showFeatureHover = (
      f: SimpleFeature,
      style: ReturnType<typeof getTypeStyle>,
      e: L.LeafletMouseEvent
    ) => {
      const label = (ar: string, en: string) => (lang === "ar" ? ar : en);
      const rows: Array<[string, string]> = [
        [label("الشبكة", "Network"), netLabel(f.n, lang)],
        [label("التصنيف", "Category"), t(`cat.${f.c}`)],
        [t("hover.sector"), td(f.s) || t("g.dash")],
        [t("hover.implementing"), td(f.imp) || t("g.dash")],
      ];
      if (f.st) rows.push([t("hover.material"), td(f.st)]);
      if (f.d) rows.push([t("hover.diameter"), td(f.d) || String(f.d)]);
      if (f.l) rows.push([t("hover.length"), `${f.l.toFixed(3)} ${t("g.km")}`]);
      rows.push([label("نقاط الرسم", "Vertices"), String(getFeatureVertexCount(f))]);
      if (f.code) rows.push([label("الكود", "Code"), String(f.code)]);
      if (f.sourceLayer) rows.push([label("الطبقة", "Source layer"), f.sourceLayer]);
      const coordinates = getFeatureCoordinateText(f);
      if (coordinates) rows.push([label("الإحداثيات", "Coordinates"), coordinates]);

      setHovered({
        title: td(f.t),
        titleColor: style.color,
        rows,
      });
      hoverPosRef.current = {
        x: (e.originalEvent as MouseEvent).clientX,
        y: (e.originalEvent as MouseEvent).clientY,
      };
    };

    const openFeatureDetails = (
      f: SimpleFeature,
      style: ReturnType<typeof getTypeStyle>,
      e: L.LeafletMouseEvent
    ) => {
      L.DomEvent.stopPropagation(e);
      showFeatureHover(f, style, e);
      onFeatureClickRef.current?.(f);
    };

    for (const f of orderedFeatures) {
      if (rendered >= cap) break;
      if (visible && !visible.has(f.n)) continue;
      if (!isVisibleInViewport(f)) continue;
      // At overview scales, a representative sample prevents coincident
      // assets from obscuring the basemap. Every item appears as the user
      // zooms in or pans into its immediate area.
      if (zoom <= 12 && f.c === "point" && f.i % 6 !== 0) continue;
      if (zoom <= 13 && f.c === "line" && f.i % 3 !== 0) continue;
      const netColor = NET_COLORS[f.n];
      const style = getTypeStyle(f.n, f.t, netColor);

      if (f.g.t === "P") {
        const [lon, lat] = f.g.c;
        if (isNetworkDetail && (props.features?.length || 0) <= 3500) {
          const marker = L.marker([lat, lon], {
            icon: createDetailPointIcon(style),
            keyboard: false,
            zIndexOffset: style.tone === "primary" || style.tone === "control" ? 80 : 40,
          });
          marker.on("click", (e) => openFeatureDetails(f, style, e));
          group.addLayer(marker);
          rendered++;
          continue;
        }
        const radius = getPointRadius(style) * symbolScale;
        if (!useFastSymbols) {
          group.addLayer(
            L.circleMarker([lat, lon], {
              radius: Math.max(2.4, radius * 1.95),
              color: style.color,
              fillColor: style.color,
              fillOpacity: 0.12,
              weight: 0,
              opacity: 0.16,
              interactive: false,
              renderer,
            })
          );
        }
        const c = L.circleMarker([lat, lon], {
          radius: useFastSymbols ? Math.max(0.95, radius * 0.82) : Math.max(1.4, radius * 0.9),
          color: style.color,
          fillColor: style.color,
          fillOpacity: 1,
          weight: 0.35,
          opacity: 1,
          renderer,
        });
        c.on("click", (e) => openFeatureDetails(f, style, e));
        group.addLayer(c);
        rendered++;
      } else if (f.g.t === "L") {
        const latlngs = f.g.c.map(([lon, lat]) => [lat, lon]) as [number, number][];
        const weight = Math.max(0.75, getLineWeight(style) * symbolScale);
        const line = useFastSymbols
          ? addFastLine(group, latlngs, style, weight, renderer)
          : addFireflyLine(group, latlngs, style, weight, renderer);
        line.on("click", (e) => openFeatureDetails(f, style, e));
        group.addLayer(line);
        rendered++;
      } else if (f.g.t === "ML") {
        for (const seg of f.g.c) {
          const latlngs = seg.map(([lon, lat]) => [lat, lon]) as [number, number][];
          const weight = Math.max(0.75, getLineWeight(style) * symbolScale);
          const line = useFastSymbols
            ? addFastLine(group, latlngs, style, weight, renderer)
            : addFireflyLine(group, latlngs, style, weight, renderer);
          line.on("click", (e) => openFeatureDetails(f, style, e));
          group.addLayer(line);
        }
        rendered++;
      } else if (f.g.t === "PG") {
        const latlngs = f.g.c.map((ring) =>
          ring.map(([lon, lat]) => [lat, lon])
        ) as [number, number][][];
        const center = getPolygonCenter(f.g.c);
        if (!useFastSymbols) {
          const poly = L.polygon(latlngs, {
            color: style.color,
            fillOpacity: 0,
            weight: 3.8,
            opacity: 0.12,
            interactive: false,
            lineCap: "round",
            lineJoin: "round",
            renderer,
          });
          group.addLayer(poly);
        }
        const topPoly = L.polygon(latlngs, {
          color: style.color,
          fillColor: style.color,
          fillOpacity: Math.min((style.fillOpacity ?? 0.4) * 0.08, 0.06),
          weight: useFastSymbols ? 0.55 : style.tone === "primary" ? 1.05 : 0.65,
          opacity: useFastSymbols ? 0.38 : style.tone === "room" ? 0.36 : 0.5,
          lineCap: "round",
          lineJoin: "round",
          renderer,
        });
        topPoly.on("click", (e) => openFeatureDetails(f, style, e));
        group.addLayer(topPoly);
        if (!useFastSymbols && style.tone === "primary" && style.shape && style.shape !== "line" && style.shape !== "dashed-line") {
          group.addLayer(
            L.circleMarker(center, {
              radius: Math.max(1.4, getPointRadius(style) * 0.72),
              color: style.color,
              fillColor: style.color,
              fillOpacity: 0.92,
              weight: 0,
              opacity: 0.9,
              interactive: false,
              renderer,
            })
          );
        }
        rendered++;
      }
    }

    group.addTo(map);
    layersRef.current.features = group;
  }, [props.features, visibleNetworkKey, props.maxFeatures, props.symbolMode, lang, viewportVersion]);

  return (
    <div
      ref={containerRef}
      className={`relative w-full h-full rounded-lg overflow-hidden border border-border ${props.className || ""}`}
      style={{ background: "#0a0e1a" }}
    >
      <div
        className={`absolute bottom-2 ${lang === "ar" ? "left-2" : "right-2"} z-[460] glass-card rounded-md p-1 flex items-center gap-1 pointer-events-auto`}
      >
        {(Object.keys(BASEMAPS) as BasemapKey[]).map((key) => {
          const item = BASEMAPS[key];
          const active = basemap === key;
          return (
            <button
              key={key}
              type="button"
              onClick={() => setBasemap(key)}
              className={`h-7 px-2 rounded text-[10px] font-bold transition ${
                active
                  ? "bg-primary text-background shadow-[0_0_14px_rgba(245,158,11,0.38)]"
                  : "text-muted-foreground hover:text-foreground hover:bg-secondary/60"
              }`}
              title={lang === "ar" ? item.labelAr : item.labelEn}
            >
              {lang === "ar" ? item.labelAr : item.labelEn}
            </button>
          );
        })}
      </div>
      {hovered && (
        <div
          dir={lang === "ar" ? "rtl" : "ltr"}
          className="pointer-events-none fixed z-[9999] min-w-[250px] max-w-[340px] rounded-lg border border-white/10 bg-slate-950/95 p-3 text-[11px] text-right shadow-[0_18px_45px_rgba(2,6,23,0.55)] backdrop-blur-md"
          style={{
            left:
              hoverPosRef.current.x +
              (hoverPosRef.current.x > window.innerWidth - 360 ? -356 : 14),
            top: hoverPosRef.current.y + 12,
            boxShadow: `0 18px 45px rgba(2,6,23,0.55), 0 0 0 1px ${hovered.titleColor || "rgba(245,158,11,0.34)"}`,
          }}
        >
          <div
            className="mb-2 flex items-start gap-2 border-b border-white/10 pb-2"
            style={{ color: hovered.titleColor || "#f59e0b" }}
          >
            <span
              className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full shadow-[0_0_12px_currentColor]"
              style={{ backgroundColor: hovered.titleColor || "#f59e0b" }}
            />
            <span className="min-w-0 flex-1 text-[12px] font-extrabold leading-5">
              {hovered.title}
            </span>
          </div>
          <div className="space-y-1.5">
            {hovered.rows.map(([k, v], i) => (
              <div key={i} className="grid grid-cols-[82px_minmax(0,1fr)] items-start gap-3 text-[10.5px] leading-4">
                <span className="text-slate-400">{k}</span>
                <span className="min-w-0 break-words [overflow-wrap:anywhere] text-start font-semibold text-slate-50" dir="auto">
                  {v}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
