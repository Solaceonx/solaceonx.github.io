import { readFile, writeFile } from "node:fs/promises";

const SNAPSHOT_PATH = new URL("../weather-snapshots.json", import.meta.url);
const DATA_PATH = new URL("../weather-data.js", import.meta.url);

const snapshots = JSON.parse(await readFile(SNAPSHOT_PATH, "utf8"));

if (!Array.isArray(snapshots) || !snapshots.length) {
  throw new Error("weather-snapshots.json must contain at least one snapshot");
}

const ids = new Set();
for (const snapshot of snapshots) {
  for (const key of ["id", "eventDate", "observedAt", "station", "distribution", "thresholds"]) {
    if (snapshot[key] == null) throw new Error(`Snapshot is missing ${key}`);
  }
  if (ids.has(snapshot.id)) throw new Error(`Duplicate weather snapshot id: ${snapshot.id}`);
  ids.add(snapshot.id);

  const probabilityTotal = snapshot.distribution.reduce(
    (sum, outcome) => sum + Number(outcome.probability || 0),
    0
  );
  if (Math.abs(probabilityTotal - 1) > 0.001) {
    throw new Error(`${snapshot.id} distribution sums to ${probabilityTotal}, not 1`);
  }
}

snapshots.sort((a, b) => a.observedAt.localeCompare(b.observedAt));
const latest = snapshots.at(-1);
const payload = {
  updatedAt: latest.observedAt,
  station: latest.station,
  snapshots
};

await writeFile(
  DATA_PATH,
  `window.WEATHER_DATA = ${JSON.stringify(payload, null, 2)};\n`,
  "utf8"
);

console.log(`Wrote ${snapshots.length} weather snapshot(s) to weather-data.js`);
