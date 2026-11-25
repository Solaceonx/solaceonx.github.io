(function (root) {
  const DAY_MS = 86400000;
  const day = date => Date.parse(`${date}T00:00:00Z`);
  const label = date => new Date(day(date)).toLocaleDateString("en-US", {
    month: "short", day: "numeric", timeZone: "UTC"
  });

  function create(accounts) {
    const histories = accounts.map(account => new Map((account.history || [])
      .filter(point => Number.isFinite(day(point.date)))
      .map(point => [point.date, point])));
    const dates = [...new Set(histories.flatMap(history => [...history.keys()]))].sort();
    const latest = dates.at(-1);

    // A daily total is known only when every account has valid snapshots on
    // both consecutive UTC dates. Never assign a multi-day gap to its end date.
    const dailyDeltas = key => dates.flatMap(date => {
      if (!histories.length) return [];
      const previousDate = new Date(day(date) - DAY_MS).toISOString().slice(0, 10);
      let value = 0;
      for (const history of histories) {
        const current = history.get(date)?.[key];
        const previous = history.get(previousDate)?.[key];
        // A reset or missing metric makes this interval unknown, not zero.
        if (!Number.isFinite(current) || !Number.isFinite(previous) || current < previous) return [];
        value += current - previous;
      }
      return [{ date, label: label(date), value }];
    });

    const weekTotal = (points, end) => {
      if (!end) return null;
      const byDate = new Map(points.map(point => [point.date, point.value]));
      let total = 0;
      for (let offset = 0; offset < 7; offset += 1) {
        const date = new Date(day(end) - offset * DAY_MS).toISOString().slice(0, 10);
        if (!byDate.has(date)) return null;
        total += byDate.get(date);
      }
      return total;
    };

    return {
      sevenDayDelta: key => weekTotal(dailyDeltas(key), latest),
      bestDailyRecord: key => dailyDeltas(key).reduce((best, point) =>
        best.value == null || point.value > best.value ? point : best,
      { label: "No complete tracked day", value: null }),
      bestSevenDayRecord: key => {
        const points = dailyDeltas(key);
        return points.reduce((best, point) => {
          const value = weekTotal(points, point.date);
          if (value == null || (best.value != null && value <= best.value)) return best;
          const start = new Date(day(point.date) - 6 * DAY_MS).toISOString().slice(0, 10);
          return { label: `${label(start)}–${point.label}`, value };
        }, { label: "No complete tracked week", value: null });
      }
    };
  }

  const api = { create };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.CocStats = api;
})(typeof window !== "undefined" ? window : globalThis);
