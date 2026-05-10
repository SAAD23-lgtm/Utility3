import JSZip from "jszip";
import { saveAs } from "file-saver";

const BASE = import.meta.env.BASE_URL;

const FILES = [
  "summary.json",
  "sectors.json",
  "roads.json",
  "network-electric.json",
  "network-gas.json",
  "network-water.json",
  "network-sewage.json",
  "network-telecom.json",
  "network-irrigation.json",
];

export async function downloadAllAsZip() {
  const zip = new JSZip();
  const folder = zip.folder("obour-utilities-data")!;

  for (const f of FILES) {
    try {
      const res = await fetch(`${BASE}data/${f}`);
      if (res.ok) {
        const text = await res.text();
        folder.file(f, text);
      }
    } catch (e) {
      console.warn("Could not include", f, e);
    }
  }

  const readme = `# Obour utilities dashboard data

These static JSON files are generated from the source GeoJSON utility layers and optimized for browser rendering.

## Included files

- **summary.json** - global totals for sectors, roads, and all networks.
- **sectors.json** - 23 sector polygons plus 6 contextual admin boundary polygons.
- **roads.json** - 1,160 city road line features.
- **network-electric.json** - 15,052 electricity features.
- **network-gas.json** - 10,888 gas features.
- **network-water.json** - 4,212 water features.
- **network-sewage.json** - 4,097 sewer/storm-drain features.
- **network-telecom.json** - 4,502 telecom features; one invalid null geometry is skipped.
- **network-irrigation.json** - 1,726 irrigation features.

## Network feature shape

- \`i\`: internal numeric id.
- \`code\`: source asset id when available.
- \`sourceLayer\`: source GeoJSON layer id.
- \`n\`: network key.
- \`t\`: normalized feature type.
- \`c\`: geometry category: \`point\`, \`line\`, or \`room\`.
- \`s\`: sector.
- \`imp\`: implementing party.
- \`st\`: material.
- \`d\`: diameter, size, or room dimension.
- \`l\`: line length in km.
- \`g\`: compact geometry.

Generated: ${new Date().toLocaleDateString("en-CA")}
`;

  folder.file("README.md", readme);

  const blob = await zip.generateAsync(
    { type: "blob", compression: "DEFLATE", compressionOptions: { level: 6 } },
    (meta) => {
      void meta;
    }
  );

  const date = new Date().toISOString().slice(0, 10);
  saveAs(blob, `obour-utilities-data-${date}.zip`);
}
