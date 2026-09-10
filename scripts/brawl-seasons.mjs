// Ranked seasons start on the third Thursday (Supercell's Ranked 2.0 schedule).
export function rankedSeasonStart(date) {
  const day = new Date(`${date.slice(0, 10)}T00:00:00Z`);
  function start(year, month) {
    const first = new Date(Date.UTC(year, month, 1));
    return new Date(Date.UTC(year, month, 15 + (4 - first.getUTCDay() + 7) % 7));
  }
  let boundary = start(day.getUTCFullYear(), day.getUTCMonth());
  if (day < boundary) boundary = start(day.getUTCFullYear(), day.getUTCMonth() - 1);
  return boundary.toISOString().slice(0, 10);
}

// Legacy snapshots only retain cumulative brawler totals, so reconstruct their
// seasonal totals from observed daily increments. Battle times are unavailable
// per brawler in that history; games first observed after a reset are approximate.
export function migrateRankedSeasons(history) {
  let previous;
  let counts = {};
  let season;
  return history.map(point => {
    const nextSeason = rankedSeasonStart(point.date);
    if (season !== nextSeason || previous?.trackingSchemaVersion !== point.trackingSchemaVersion) counts = {};
    if (point.rankedSeasonStart === nextSeason) {
      counts = { ...point.rankedCurrentBrawlerCounts };
    } else {
      const baseline = previous?.trackingSchemaVersion === point.trackingSchemaVersion
        ? previous?.rankedAllTimeBrawlerCounts || {} : {};
      for (const [name, total] of Object.entries(point.rankedAllTimeBrawlerCounts || {})) {
        const delta = Math.max(0, total - (baseline[name] || 0));
        if (delta) counts[name] = (counts[name] || 0) + delta;
      }
    }
    previous = point;
    season = nextSeason;
    return { ...point, rankedSeasonStart: season, rankedCurrentBrawlerCounts: { ...counts } };
  });
}
