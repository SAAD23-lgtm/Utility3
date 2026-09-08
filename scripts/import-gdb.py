"""Import the NUCA File Geodatabase into the dashboard's GeoJSON data pipeline.

Usage:
    python scripts/import-gdb.py "C:\\path\\to\\database.gdb"
"""

from __future__ import annotations

import json
import re
import sys
from pathlib import Path

import geopandas as gpd
import numpy as np
import pyogrio


ROOT = Path(__file__).resolve().parents[1]
LAYERS_DIR = ROOT / "public" / "data" / "layers"
DATA_DIR = ROOT / "public" / "data"

# The names consumed by build-data.mjs, mapped to the supplied geodatabase.
ALIASES = {
    "Electrical_Feature": "electricity_assets",
    "Electrical_Facilities": "electricity_facilities",
    "Electrical_lines": "electricity_lines",
    "Gas_Featur": "gas_assets",
    "GAS_Facilities": "gas_facilities",
    "Gas_lines": "gas_lines",
    "Water_Pump_Valves": "water_assets",
    "Water_Fire_Hydrant": "water_fire_hydrants",
    "Water_Pariza": "water_house_connections",
    "Water_Canals_Pipes": "water_lines",
    "Water_Room": "water_rooms",
    "Sewer_Pipes": "sewer_lines",
    "Sewage_Manhole": "sewer_manholes",
    "Sewer_Stations": "sewer_rooms",
    "rain_drains": "storm_drains",
    "Telecom_Point": "telecom_assets",
    "Telecom_Facilities": "telecom_facilities",
    "Telecom_Lines": "telecom_lines",
    "Irrigation_Pipes": "irrigation_lines",
    "Irrigation_Room": "irrigation_rooms",
    "Irrigation_Valves": "irrigation_valves",
}


def dump_geojson(name: str, features: list[dict]) -> None:
    (LAYERS_DIR / f"{name}.geojson").write_text(
        json.dumps({"type": "FeatureCollection", "features": features}, ensure_ascii=False, allow_nan=False),
        encoding="utf-8",
    )


def restore_dashboard_base_layers() -> None:
    """Retain roads/sectors: they aren't contained in this infrastructure GDB."""
    sectors = json.loads((DATA_DIR / "sectors.json").read_text(encoding="utf-8"))
    sector_features = [
        {
            "type": "Feature",
            "properties": {"name": item["name"], "area": item["area"], "phase": item["phase"], "status": item["status"], "order": item["order"]},
            "geometry": {"type": "Polygon", "coordinates": item["coords"]},
        }
        for item in sectors["polygons"]
    ]
    admin_features = [
        {"type": "Feature", "properties": {"name": item["name"], "area": item["area"]}, "geometry": {"type": "Polygon", "coordinates": item["coords"]}}
        for item in sectors["adminBoundaries"]
    ]
    roads = json.loads((DATA_DIR / "roads.json").read_text(encoding="utf-8"))["roads"]
    road_features = [
        {
            "type": "Feature",
            "properties": {key: item.get(key) for key in ("sector", "district", "type", "field", "status", "length", "notes")},
            "geometry": {"type": "LineString", "coordinates": item["coords"]},
        }
        for item in roads
    ]
    dump_geojson("sectors_polygons", sector_features)
    dump_geojson("admin_boundaries", admin_features)
    dump_geojson("roads_lines", road_features)


def main() -> None:
    if len(sys.argv) != 2:
        raise SystemExit("Provide exactly one .gdb directory path.")
    gdb = Path(sys.argv[1])
    if not gdb.is_dir() or gdb.suffix.lower() != ".gdb":
        raise SystemExit(f"Not a File Geodatabase directory: {gdb}")

    LAYERS_DIR.mkdir(parents=True, exist_ok=True)
    restore_dashboard_base_layers()

    count = 0
    for source_name, _geometry_type in pyogrio.list_layers(gdb):
        frame = gpd.read_file(gdb, layer=source_name).to_crs(epsg=4326)
        # Preserve every source record. A corrupt geometry is represented as
        # null (valid GeoJSON), retaining its attributes without breaking map
        # loading for the remaining features.
        valid_bounds = np.isfinite(frame.geometry.bounds.to_numpy()).all(axis=1)
        frame.loc[frame.geometry.notna() & ~valid_bounds, frame.geometry.name] = None
        payload = json.loads(frame.to_json(na="null", drop_id=True, to_wgs84=False, default=str))
        safe_name = re.sub(r"[^a-z0-9]+", "_", source_name.lower()).strip("_")
        dump_geojson(f"source_{safe_name}", payload["features"])
        if alias := ALIASES.get(source_name):
            dump_geojson(alias, payload["features"])
        count += len(payload["features"])
        print(f"{source_name}: {len(payload['features'])} features")

    print(f"Imported {count} features from {len(pyogrio.list_layers(gdb))} layers into {LAYERS_DIR}")


if __name__ == "__main__":
    main()
