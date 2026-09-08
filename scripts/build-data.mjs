import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const inputDir =
  process.argv[2] ||
  path.join(root, "public", "data", "layers");
const outputDir = path.join(root, "public", "data");

const NETWORKS = {
  electric: {
    label: "شبكة الكهرباء",
    files: ["electricity_assets", "electricity_facilities", "electricity_lines"],
  },
  gas: {
    label: "شبكة الغاز",
    files: ["gas_assets", "gas_facilities", "gas_lines"],
  },
  water: {
    label: "شبكة المياه",
    files: [
      "water_assets",
      "water_fire_hydrants",
      "water_house_connections",
      "water_lines",
      "water_rooms",
    ],
  },
  sewage: {
    label: "شبكة الصرف الصحي",
    files: ["sewer_lines", "sewer_manholes", "sewer_rooms", "storm_drains"],
  },
  telecom: {
    label: "شبكة الاتصالات",
    files: ["telecom_assets", "telecom_facilities", "telecom_lines"],
  },
  irrigation: {
    label: "شبكة الري",
    files: ["irrigation_lines", "irrigation_rooms", "irrigation_valves"],
  },
};

const TYPE_FIELDS = [
  "__typeValue",
  "Electric_Feature_Type",
  "Electric_Facility_Type",
  "Electrical_Lines_Type",
  "Gas_Facility_Type",
  "Gas_Lines_Type",
  "Gas_Lines_Grade",
  "Water_Lines_Grade",
  "Sewer_Lines_Grade",
  "Structure_Type",
  "Type_Of_Manholes",
  "Telecom_line_degree",
  "Electrical_Facility_Point",
  "Water_Feature_Type",
  "Room_type",
  "Rooms_type",
  "TYPE",
  "Type",
  "Telecom_Feature_Type",
  "Telecom_Facility_Type",
  "Telecom_Lines_Type",
  "line_degree",
  "diameter",
  "__assetName",
];

function readGeoJson(layerId) {
  const full = path.join(inputDir, `${layerId}.geojson`);
  return JSON.parse(fs.readFileSync(full, "utf8"));
}

function clean(value) {
  if (value == null) return undefined;
  const text = String(value).trim();
  if (!text || text.toLowerCase() === "undefined" || text.toLowerCase() === "null") {
    return undefined;
  }
  return text;
}

function pick(props, names) {
  for (const name of names) {
    const value = clean(props[name]);
    if (value) return value;
  }
  return undefined;
}

function compactNumber(value, decimals = 6) {
  if (typeof value !== "number" || !Number.isFinite(value)) return value;
  return Number(value.toFixed(decimals));
}

function compactCoord(coord) {
  return [compactNumber(coord[0], 10), compactNumber(coord[1], 10)];
}

function compactGeom(geometry) {
  if (!geometry) return null;
  if (geometry.type === "Point") return { t: "P", c: compactCoord(geometry.coordinates) };
  if (geometry.type === "LineString") {
    if (!Array.isArray(geometry.coordinates) || geometry.coordinates.length < 2) return null;
    return { t: "L", c: geometry.coordinates.map(compactCoord) };
  }
  if (geometry.type === "MultiLineString") {
    const segments = geometry.coordinates
      .filter((segment) => Array.isArray(segment) && segment.length >= 2)
      .map((segment) => segment.map(compactCoord));
    return segments.length ? { t: "ML", c: segments } : null;
  }
  if (geometry.type === "Polygon") {
    const rings = geometry.coordinates
      .filter((ring) => Array.isArray(ring) && ring.length >= 4)
      .map((ring) => ring.map(compactCoord));
    return rings.length ? { t: "PG", c: rings } : null;
  }
  if (geometry.type === "MultiPolygon") {
    const rings = geometry.coordinates
      .flat()
      .filter((ring) => Array.isArray(ring) && ring.length >= 4)
      .map((ring) => ring.map(compactCoord));
    return rings.length ? { t: "PG", c: rings } : null;
  }
  return null;
}

function geomCategory(geometry, layerId) {
  if (geometry?.type?.includes("LineString")) return "line";
  if (geometry?.type === "Point") return "point";
  if (
    layerId.includes("facilities") ||
    layerId.includes("rooms") ||
    layerId.includes("sewer_rooms")
  ) {
    return "room";
  }
  return "room";
}

function addToBounds(bounds, coord) {
  const [lon, lat] = coord;
  if (!Number.isFinite(lon) || !Number.isFinite(lat)) return;
  bounds[0] = Math.min(bounds[0], lon);
  bounds[1] = Math.min(bounds[1], lat);
  bounds[2] = Math.max(bounds[2], lon);
  bounds[3] = Math.max(bounds[3], lat);
}

function visitCoords(compact, bounds) {
  if (!compact) return;
  if (compact.t === "P") addToBounds(bounds, compact.c);
  else if (compact.t === "L") compact.c.forEach((coord) => addToBounds(bounds, coord));
  else compact.c.flat().forEach((coord) => addToBounds(bounds, coord));
}

function getLengthKm(props) {
  const roadLength = Number(props.Length);
  if (Number.isFinite(roadLength) && roadLength > 0) return compactNumber(roadLength, 4);
  const lengthM = Number(props.__length_m ?? props.SHAPE_Length ?? props.shape_Length ?? props.Shape_Length);
  if (Number.isFinite(lengthM) && lengthM > 0) return compactNumber(lengthM / 1000, 4);
  return undefined;
}

function normalizeMaterial(value) {
  if (!value) return undefined;
  if (value === "1") return "بولي إيثيلين عالي الكثافة (HDPE)";
  return value;
}

function sourceCode(props, index) {
  return (
    pick(props, [
      "ID",
      "GlobalID",
      "Room_Id",
      "Station_Id",
      "Meter_Id",
      "I_D",
      "source",
    ]) || String(index)
  );
}

function typeFromLayer(layerId, props, rawType, category) {
  const diameter = clean(props.diameter || props.Diameter || props.diameter2 || props.dimention || props.Dimention_Of_Manholes);
  const degree = clean(props.line_degree);
  const room = clean(props.Room_type || props.Rooms_type || props.TYPE || props.Type || props.Structure_Type || props.Type_Of_Manholes);

  if (layerId === "water_lines") return diameter ? `خط مياه ${diameter}` : "خط مياه";
  if (layerId === "water_house_connections") {
    return diameter ? `توصيلة منزلية ${diameter}` : "توصيلة منزلية";
  }
  if (layerId === "water_fire_hydrants") return "صنبور حريق";
  if (layerId === "water_rooms") return room || "غرفة مياه";

  if (layerId === "irrigation_lines") return diameter ? `خط ري ${diameter}` : "خط ري";
  if (layerId === "irrigation_valves") return diameter ? `محبس ري ${diameter}` : "محبس ري";
  if (layerId === "irrigation_rooms") return room || "غرفة ري";

  if (layerId === "sewer_lines") return diameter ? `خط صرف ${diameter}` : degree ? `خط صرف درجة ${degree}` : "خط صرف";
  if (layerId === "sewer_manholes") return room ? `مطبق ${room}` : "مطبق صرف";
  if (layerId === "sewer_rooms") return rawType || "غرفة صرف";
  if (layerId === "storm_drains") return "بلاعات المطر";

  if (category === "line" && rawType) return rawType;
  if (category === "room" && rawType) return rawType;
  return rawType || "غير محدد";
}

function buildFeature(netKey, layerId, feature, index) {
  const props = feature.properties || {};
  const g = compactGeom(feature.geometry);
  if (!g) return null;

  const category = geomCategory(feature.geometry, layerId);
  const rawType = pick(props, TYPE_FIELDS);
  const type = typeFromLayer(layerId, props, rawType, category);
  const length = getLengthKm(props);
  const diameter = pick(props, ["diameter", "Diameter", "diameter2", "dimention", "Dimention_Of_Manholes", "Capacity", "number_boxs", "Number_OF_Boxs"]);

  return {
    i: index,
    code: sourceCode(props, index),
    sourceLayer: layerId,
    n: netKey,
    t: type,
    c: category,
    s: pick(props, ["sectors", "Sectors", "اسم_القطاع", "القطاع"]),
    st: normalizeMaterial(pick(props, ["manufacturing_material", "Manufacturing_material", "Manufacturing_Material", "material", "مادة_التصنيع", "مادةالصنع"])),
    imp: pick(props, ["Implementing", "Implementing_company", "lmplementing_company", "الشركة_المنفذة", "الشركةالمنفذة"]),
    d: diameter,
    l: category === "line" ? length : undefined,
    g,
  };
}

function increment(record, key, amount = 1) {
  if (!key) return;
  record[key] = compactNumber((record[key] || 0) + amount, 4);
}

function buildStats(label, features) {
  const stats = {
    label,
    total: features.length,
    byType: {},
    bySector: {},
    byCategory: {},
    byImplementing: {},
    byMaterial: {},
    byDiameter: {},
    totalLengthKm: 0,
    lengthByType: {},
  };

  for (const feature of features) {
    increment(stats.byType, feature.t);
    increment(stats.bySector, feature.s);
    increment(stats.byCategory, feature.c);
    increment(stats.byImplementing, feature.imp);
    increment(stats.byMaterial, feature.st);
    increment(stats.byDiameter, feature.d);
    if (feature.l) {
      stats.totalLengthKm += feature.l;
      increment(stats.lengthByType, feature.t, feature.l);
    }
  }
  stats.totalLengthKm = compactNumber(stats.totalLengthKm, 4);
  return stats;
}

let nextFeatureId = 1;
const cityBounds = [Infinity, Infinity, -Infinity, -Infinity];
const networkFiles = {};

for (const [netKey, config] of Object.entries(NETWORKS)) {
  const features = [];
  for (const layerId of config.files) {
    const geojson = readGeoJson(layerId);
    for (const feature of geojson.features || []) {
      const compact = buildFeature(netKey, layerId, feature, nextFeatureId);
      nextFeatureId += 1;
      if (!compact) continue;
      visitCoords(compact.g, cityBounds);
      features.push(compact);
    }
  }
  const stats = buildStats(config.label, features);
  networkFiles[netKey] = { key: netKey, label: config.label, stats, features };
}

function buildSectors() {
  const geojson = readGeoJson("sectors_polygons");
  const polygons = [];
  for (const [index, feature] of (geojson.features || []).entries()) {
    const props = feature.properties || {};
    const g = compactGeom(feature.geometry);
    if (!g || g.t !== "PG") continue;
    visitCoords(g, cityBounds);
    const areaRaw = Number(props["المساحة"] ?? props.area ?? props.__area_m2 ?? props.SHAPE_Area ?? 0);
    polygons.push({
      id: index + 1,
      name: clean(props["اسم_القطاع"] || props.name) || `قطاع ${index + 1}`,
      area: compactNumber(areaRaw, 4),
      phase: clean(props["المرحلة"] || props.phase) || "",
      status: clean(props.Statuse_Sector || props.status) || "",
      order: Number(props["الترتيب"] || props.order) || index + 1,
      coords: g.c,
    });
  }

  const admin = readGeoJson("admin_boundaries");
  const adminBoundaries = [];
  for (const [index, feature] of (admin.features || []).entries()) {
    const props = feature.properties || {};
    const g = compactGeom(feature.geometry);
    if (!g || g.t !== "PG") continue;
    visitCoords(g, cityBounds);
    adminBoundaries.push({
      id: index + 1,
      name: clean(props["المرحلة"] || props.name || props.__typeValue) || `حد إداري ${index + 1}`,
      area: compactNumber(Number(props.area ?? props.__area_m2 ?? props.SHAPE_Area ?? 0), 4),
      coords: g.c,
    });
  }

  return { bbox: cityBounds.map((value) => compactNumber(value, 10)), polygons, adminBoundaries };
}

function buildRoads() {
  const geojson = readGeoJson("roads_lines");
  const roads = [];
  for (const [index, feature] of (geojson.features || []).entries()) {
    const props = feature.properties || {};
    const g = compactGeom(feature.geometry);
    if (!g || g.t !== "L") continue;
    visitCoords(g, cityBounds);
    roads.push({
      id: index + 1,
      sector: clean(props["اسم_القطاع"] || props.sector) || "",
      district: clean(props["اسم_الحي"] || props["المرحلة"] || props.district) || "",
      type: clean(props["نوع_الطريق"] || props.type) || "",
      field: clean(props.Field || props.field) || "",
      status: clean(props["موقف_التنفيذ"] || props.status) || "",
      length: getLengthKm(props) || 0,
      notes: clean(props["ملاحظات"]) || null,
      coords: g.c,
    });
  }

  const stats = {
    total: roads.length,
    totalKm: 0,
    byStatus: {},
    byField: {},
    byType: {},
    byDistrict: {},
    bySector: {},
    kmByStatus: {},
  };
  for (const road of roads) {
    stats.totalKm += road.length;
    increment(stats.byStatus, road.status);
    increment(stats.byField, road.field);
    increment(stats.byType, road.type);
    increment(stats.byDistrict, road.district);
    if (road.sector) {
      const current = stats.bySector[road.sector] || { count: 0, km: 0 };
      current.count += 1;
      current.km = compactNumber(current.km + road.length, 4);
      stats.bySector[road.sector] = current;
    }
    increment(stats.kmByStatus, road.status, road.length);
  }
  stats.totalKm = compactNumber(stats.totalKm, 4);
  return { stats, roads };
}

const sectors = buildSectors();
const roads = buildRoads();

const summary = {
  city: "مدينة العبور الجديدة",
  bbox: cityBounds.map((value) => compactNumber(value, 10)),
  generatedAt: new Date().toISOString(),
  sectors: {
    total: sectors.polygons.length,
    byStatus: {},
    totalAreaKm2: compactNumber(
      sectors.polygons.reduce((sum, sector) => sum + (sector.area > 1000 ? sector.area / 1_000_000 : sector.area), 0),
      4
    ),
    byPhase: {},
  },
  roads: roads.stats,
  networks: {},
};

for (const sector of sectors.polygons) {
  increment(summary.sectors.byStatus, sector.status);
  increment(summary.sectors.byPhase, sector.phase);
}
for (const [netKey, file] of Object.entries(networkFiles)) {
  summary.networks[netKey] = file.stats;
}

fs.mkdirSync(outputDir, { recursive: true });
fs.writeFileSync(path.join(outputDir, "summary.json"), JSON.stringify(summary));
fs.writeFileSync(path.join(outputDir, "sectors.json"), JSON.stringify(sectors));
fs.writeFileSync(path.join(outputDir, "roads.json"), JSON.stringify(roads));
for (const [netKey, file] of Object.entries(networkFiles)) {
  fs.writeFileSync(path.join(outputDir, `network-${netKey}.json`), JSON.stringify(file));
}

console.log("Generated dashboard data:");
console.table({
  electric: networkFiles.electric.features.length,
  gas: networkFiles.gas.features.length,
  water: networkFiles.water.features.length,
  sewage: networkFiles.sewage.features.length,
  telecom: networkFiles.telecom.features.length,
  irrigation: networkFiles.irrigation.features.length,
  roads: roads.roads.length,
  sectors: sectors.polygons.length,
  adminBoundaries: sectors.adminBoundaries.length,
});
