import { writeFile, rename, mkdir } from "node:fs/promises";
const base =
  "https://geo.api.vlaanderen.be/Haltes/ogc/features/v1/collections/Halte/items";
const entries = new Map();
let start = 0;
for (let page = 0; page < 20; page++) {
  const url = new URL(base);
  url.search = new URLSearchParams({
    f: "application/json",
    limit: "10000",
    startIndex: String(start),
  });
  const response = await fetch(url, { signal: AbortSignal.timeout(30000) });
  if (!response.ok) throw new Error("Stop source returned " + response.status);
  const json = await response.json();
  if (!Array.isArray(json.features))
    throw new Error("Unexpected stop source schema");
  for (const f of json.features) {
    const p = f.properties;
    const [lon, lat] = f.geometry?.coordinates || [];
    if (![1, 2].includes(p?.TYPEHALTE)) continue;
    if (
      !Number.isFinite(lat) ||
      !Number.isFinite(lon) ||
      !p.STOPID ||
      !p.NAAMHALTE
    )
      throw new Error("Invalid stop");
    const code = String(p.STOPID).padStart(6, "0");
    entries.set(code, [code, p.NAAMHALTE, lat, lon, p.NAAMGEM || ""]);
  }
  start += json.features.length;
  if (json.features.length < 10000) break;
  if (page === 19) throw new Error("Unexpected pagination size");
}
if (entries.size < 1000)
  throw new Error("Incomplete stop index; retaining previous data");
await mkdir("public/data", { recursive: true });
await writeFile(
  "public/data/delijn-stops.json.tmp",
  JSON.stringify({
    source: base,
    retrievedAt: new Date().toISOString(),
    stops: [...entries.values()],
  }),
);
await rename(
  "public/data/delijn-stops.json.tmp",
  "public/data/delijn-stops.json",
);
console.log(
  `Updated ${entries.size} regular/shared De Lijn stops. Rebuild and deploy to publish.`,
);
