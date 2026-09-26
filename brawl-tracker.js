{
  const data = window.BRAWL_DATA || {};
  const number = (value) => value == null ? "—" : new Intl.NumberFormat("en-US").format(value);
  const percentOneDecimal = (value) => `${Number(value ?? 0).toFixed(1).replace(/\.0$/, "")}%`;
  const palette = { blue: "#1278d8", yellow: "#f4bd28", dark: "#111827" };

  const empty = (text) => `<div class="tracker-empty tracker-empty-small">${text}</div>`;
  const titleCase = (str) => (str || "").toLowerCase().replace(/\b\w/g, c => c.toUpperCase());

  const renderLineChart = (points = [], metric, options = {}) => {
    if (!points.length) return empty(options.empty || "Waiting for Brawl Stars snapshots.");

    const width = options.width || 760;
    const height = options.height || 240;
    const pad = options.pad || 30;
    const yLabelWidth = options.yLabelWidth || 52;
    const leftPad = pad + yLabelWidth;
    const values = points.map(point => point.value).filter(value => typeof value === "number");
    const rawMin = Math.min(...values);
    const rawMax = Math.max(...values);
    const rawRange = rawMax - rawMin;
    const minRange = options.minRange || 1;
    const center = (rawMin + rawMax) / 2;
    const paddedMin = rawRange < minRange ? center - minRange / 2 : rawMin - rawRange * .14;
    const min = rawMin >= 0 ? Math.max(0, paddedMin) : paddedMin;
    const max = rawRange < minRange ? center + minRange / 2 : rawMax + rawRange * .14;
    const range = max - min || 1;
    const xStep = points.length > 1 ? (width - leftPad - pad) / (points.length - 1) : 0;
    const yFor = (value) => height - pad - ((value - min) / range) * (height - pad * 2);
    const coords = points.map((point, index) => ({
      ...point,
      x: points.length === 1 ? width / 2 : leftPad + index * xStep,
      y: yFor(point.value)
    }));
    const path = coords.length === 1
      ? `M ${leftPad} ${coords[0].y} L ${width - pad} ${coords[0].y}`
      : coords.map((point, index) => `${index ? "L" : "M"} ${point.x} ${point.y}`).join(" ");
    const area = `${path} L ${coords.at(-1).x} ${height - pad} L ${coords[0].x} ${height - pad} Z`;
    const tickStep = options.tickStep;
    const ticks = tickStep
      ? (() => {
          const first = Math.ceil(min / tickStep) * tickStep;
          const result = [];
          for (let v = first; v <= max; v += tickStep) result.push({ value: v, y: yFor(v) });
          return result;
        })()
      : [max, min + range / 2, min].map(value => ({ value, y: yFor(value) }));
    const rankTierLines = (options.rankTiers || [])
      .filter(tier => tier.points >= min && tier.points <= max)
      .map(tier => {
        const y = yFor(tier.points);
        return `<line class="brawl-rank-line" x1="${leftPad}" y1="${y}" x2="${width - pad}" y2="${y}"/><text class="brawl-rank-label" x="${leftPad - 58}" y="${y + 3}" text-anchor="end">${tier.label}</text>`;
      }).join("");
    const seasonResetLines = (options.seasonResets || [])
      .map(resetDate => {
        const idx = points.findIndex((p, i) => i > 0 && p.date >= resetDate && points[i - 1].date < resetDate);
        if (idx < 0) return "";
        const x = leftPad + (idx - 0.5) * xStep;
        return `<line class="chart-vline-reset" x1="${x}" y1="${pad}" x2="${x}" y2="${height - pad}"/>`;
      }).join("");
    const gradientId = `brawl-area-${metric.key}`;
    const formatValue = options.formatter || number;
    const tickValue = (value) => options.integerTicks === false ? value : Math.round(value);

    return `
      <svg viewBox="0 0 ${width} ${height}" role="img" aria-label="${metric.label}">
        <defs>
          <linearGradient id="${gradientId}" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stop-color="${metric.color}" stop-opacity=".45"/>
            <stop offset="100%" stop-color="${metric.color}" stop-opacity="0"/>
          </linearGradient>
        </defs>
        <path class="chart-grid" d="${ticks.map(tick => `M ${leftPad} ${tick.y} H ${width - pad}`).join(" ")}"/>
        ${ticks.map(tick => `<text class="chart-y-label" x="${leftPad - 8}" y="${tick.y + 3}" text-anchor="end">${formatValue(tickValue(tick.value))}</text>`).join("")}
        ${seasonResetLines}
        ${rankTierLines}
        <path class="chart-area" fill="url(#${gradientId})" d="${area}"/>
        <path class="chart-line" style="stroke:${metric.color}" d="${path}"/>
        ${coords.map(point => `<circle cx="${point.x}" cy="${point.y}" r="${options.dot || 4}" style="stroke:${metric.color}"><title>${point.label}: ${formatValue(point.value)}</title></circle>`).join("")}
        ${(() => { const maxLabels = 8; const labelIndexes = new Set(); const visibleLabels = Math.min(maxLabels, coords.length); for (let i = 0; i < visibleLabels; i++) labelIndexes.add(Math.round(i * (coords.length - 1) / Math.max(1, visibleLabels - 1))); return coords.map((point, index) => labelIndexes.has(index) ? `<text x="${point.x}" y="${height - 6}" text-anchor="middle">${point.label}</text>` : "").join(""); })()}
      </svg>
    `;
  };

  const renderColumns = (items = [], { emptyText = "Waiting for game history." } = {}) => {
    if (!items.length) return empty(emptyText);
    const max = Math.max(...items.map(item => item.count || 0), 1);
    return items.map(item => `
      <div class="brawl-column">
        <strong>${number(item.count || 0)}</strong>
        <div class="brawl-column-track"><i style="height:${Math.round(((item.count || 0) / max) * 100)}%"></i></div>
        <span>${item.mode || item.name}</span>
      </div>
    `).join("");
  };

  const renderBars = (items = [], { emptyText = "Waiting for game history." } = {}) => {
    if (!items.length) return empty(emptyText);
    const max = Math.max(...items.map(item => item.count || 0), 1);
    return items.map(item => `
      <div class="brawl-bar-row">
        <span>${item.mode || item.name}</span>
        <div><i style="width:${Math.round(((item.count || 0) / max) * 100)}%"></i></div>
        <strong>${number(item.count || 0)}</strong>
      </div>
    `).join("");
  };

  const renderBrawlers = (items = [], { emptyText = "Waiting for brawler stats.", variant = "bars" } = {}) => {
    if (!items.length) return empty(emptyText);
    const max = Math.max(...items.map(item => item.count || item.trophies || 0), 1);
    return items.slice(0, 10).map((item, index) => {
      const value = item.count ?? item.trophies ?? 0;
      const displayName = titleCase(item.name);
      const initials = (item.name || "?").split(/\s+/).map(part => part[0]).join("").slice(0, 2);
      const portrait = item.image
        ? `<img src="${item.image}" alt="${displayName} portrait">`
        : `<i>${initials}</i>`;

      if (variant === "trophy-games") {
        return `
          <div class="brawl-rank-row brawl-rank-row-stats">
            <span>${index + 1}</span>
            ${portrait}
            <b>${displayName}</b>
            <strong>${number(item.trophies || 0)} trophies</strong>
            <small>${number(item.games || 0)} games tracked</small>
          </div>
        `;
      }

      return `
        <div class="brawl-rank-row">
          <span>${index + 1}</span>
          ${portrait}
          <b>${displayName}</b>
          <div><em style="width:${Math.round((value / max) * 100)}%"></em></div>
          <strong>${number(value)}</strong>
        </div>
      `;
    }).join("");
  };

  const renderRecentGames = (games = []) => {
    if (!games.length) return empty("Waiting for recent trophy battle data.");
    return games.slice(0, 12).map(game => `
      <article class="brawl-game-card">
        ${game.image ? `<img src="${game.image}" alt="${game.brawler} portrait">` : `<i>${(game.brawler || "?").slice(0, 2).toUpperCase()}</i>`}
        <div><strong>${game.brawler}</strong><span>${game.mode || "Unknown mode"}</span></div>
        <b class="${game.result || ""}">${game.result || "—"}</b>
      </article>
    `).join("");
  };

  const trophy = data.trophy || {};
  const ranked = data.ranked || {};
  const summaryEnd = [...(trophy.history || []), ...(ranked.gamesHistory || [])]
    .map(point => point.date).filter(Boolean).sort().at(-1);
  const summaryCutoff = new Date(`${summaryEnd}T00:00:00Z`).getTime() - 7 * 86400000;
  const weeklyDelta = (items, key) => {
    const points = (items || []).filter(point =>
      typeof point[key] === "number" &&
      new Date(`${point.date}T00:00:00Z`).getTime() >= summaryCutoff &&
      point.date <= summaryEnd
    ).sort((a, b) => a.date.localeCompare(b.date));
    // A lone cumulative snapshot cannot establish any weekly activity.
    return points.length < 2 ? 0 : Math.max(0, points.at(-1)[key] - points[0][key]);
  };
  const winRateFrom = (wins, losses) => wins + losses ? wins / (wins + losses) * 100 : null;

  const trophyHistory = (trophy.history || []).map(point => ({ label: point.label, date: point.date, value: point.trophies }));
  const lifetimeWinPoints = (trophy.lifetimeWinsHistory || []).map(point => ({ label: point.label, date: point.date, value: point.wins }));
  const rankedPoints = (ranked.pointsHistory || []).map(point => ({ label: point.label, date: point.date, value: point.points }));
  const rankedGames = (ranked.gamesHistory || []).map(point => ({ label: point.label, date: point.date, value: point.games }));
  const rankedWins = ranked.winsHistory || [];
  const rankedLosses = ranked.lossesHistory || [];

  const rankedGamesDelta = weeklyDelta(ranked.gamesHistory || [], "games");
  const lifetimeWinsDelta = weeklyDelta(trophy.lifetimeWinsHistory || [], "wins");
  const rankedWinsDelta = weeklyDelta(rankedWins, "wins");
  const rankedLossesDelta = weeklyDelta(rankedLosses, "losses");
  const rankedWinRate = winRateFrom(rankedWinsDelta, rankedLossesDelta);
  const trophyDelta = (() => {
    const pts = (trophy.history || []).filter(p => typeof p.trophies === "number" && new Date(`${p.date}T00:00:00Z`).getTime() >= summaryCutoff && p.date <= summaryEnd).sort((a, b) => a.date.localeCompare(b.date));
    return pts.length < 2 ? null : pts.at(-1).trophies - pts[0].trophies;
  })();

  document.querySelector("#brawl-weekly-summary").innerHTML = [
    { label: "Lifetime wins gained", value: number(lifetimeWinsDelta) },
    { label: "Trophy change", value: trophyDelta == null ? "—" : (trophyDelta >= 0 ? "+" : "") + number(trophyDelta) },
    { label: "Trophy games won", value: number(Math.max(0, lifetimeWinsDelta - rankedWinsDelta)) },
    { label: "Ranked games played", value: number(rankedGamesDelta) },
    { label: "Ranked games won", value: number(rankedWinsDelta) },
    { label: "Ranked win rate", value: rankedWinRate == null ? "—" : percentOneDecimal(rankedWinRate) },
  ].map(item => `
    <article class="weekly-summary-card">
      <span>${item.label}</span>
      <strong>${item.value}</strong>
    </article>
  `).join("");

  document.querySelector("#brawl-trophy-latest").textContent = number(trophyHistory.at(-1)?.value);
  window.attachRangePicker(document.querySelector("#brawl-trophy-chart"), trophyHistory, pts => renderLineChart(pts, { key: "trophies", label: "Trophies", color: palette.blue }, { empty: "Add trophy snapshots to start this graph." }));
  document.querySelector("#brawl-recent-count").textContent = number((trophy.recentGames || []).length);
  document.querySelector("#brawl-recent-games").innerHTML = renderRecentGames(trophy.recentGames || []);
  document.querySelector("#brawl-trophy-games-latest").textContent = number(lifetimeWinPoints.at(-1)?.value);
  window.attachRangePicker(document.querySelector("#brawl-trophy-games-chart"), lifetimeWinPoints, pts => renderLineChart(pts, { key: "lifetime-wins", label: "Lifetime wins", color: palette.yellow }, { width: 340, height: 150, pad: 18, yLabelWidth: 56, empty: "Add lifetime win snapshots to start this graph." }));
  document.querySelector("#brawl-mode-total").textContent = number((trophy.modes || []).reduce((sum, item) => sum + (item.count || 0), 0));
  document.querySelector("#brawl-mode-histogram").innerHTML = renderBars(trophy.modes || []);
  document.querySelector("#brawl-top-brawlers").innerHTML = renderBrawlers(trophy.topBrawlers || [], { variant: "trophy-games" });

  document.querySelector("#brawl-ranked-latest").textContent = number(rankedPoints.at(-1)?.value);
  const BRAWL_RANK_TIERS = [
    { points: 3000, label: "Diamond I" },
    { points: 3500, label: "Diamond II" },
    { points: 4000, label: "Diamond III" },
    { points: 4500, label: "Mythic I" },
    { points: 5000, label: "Mythic II" },
    { points: 5500, label: "Mythic III" },
    { points: 6000, label: "Legendary I" },
    { points: 6750, label: "Legendary II" },
    { points: 7500, label: "Legendary III" },
    { points: 8250, label: "Masters I" },
  ];
  const brawlSeasonResets = (ranked.seasonResets || []).map(r => r.date);
  window.attachRangePicker(document.querySelector("#brawl-ranked-chart"), rankedPoints, pts => renderLineChart(pts, { key: "ranked-points", label: "Ranked points", color: palette.blue }, { empty: "Add ranked snapshots to start this graph.", rankTiers: BRAWL_RANK_TIERS, tickStep: 500, yLabelWidth: 120, seasonResets: brawlSeasonResets }), {
    extraRanges: brawlSeasonResets.length ? [{ label: "Season", since: brawlSeasonResets.at(-1) }] : [],
    defaultRange: "Season"
  });
  document.querySelector("#brawl-ranked-games-latest").textContent = number(rankedGames.at(-1)?.value);
  window.attachRangePicker(document.querySelector("#brawl-ranked-games-chart"), rankedGames, pts => renderLineChart(pts, { key: "ranked-games", label: "Ranked games", color: palette.yellow }, { width: 340, height: 150, pad: 18, yLabelWidth: 48, empty: "Add ranked game counts to start this graph." }));
  document.querySelector("#brawl-ranked-mode-total").textContent = number((ranked.modes || []).reduce((sum, item) => sum + (item.count || 0), 0));
  document.querySelector("#brawl-ranked-mode-histogram").innerHTML = renderColumns(ranked.modes || [], { emptyText: "Waiting for ranked mode history." });

  // Per-season mode breakdown — derived from rankedGamesLog + seasonResets
  const seasonContainer = document.querySelector("#brawl-ranked-season-modes");
  if (seasonContainer) {
    const resets = (ranked.seasonResets || []).map(r => r.date).sort();
    const log = ranked.rankedGamesLog || [];
    // Build seasons: [start, end) boundaries
    const boundaries = [null, ...resets, null]; // null = open-ended
    const allSeasons = boundaries.slice(0, -1).map((start, i) => {
      const end = boundaries[i + 1];
      const entries = log.filter(e => (!start || e.date >= start) && (!end || e.date < end));
      const counts = {};
      entries.forEach(e => { counts[e.mode] = (counts[e.mode] || 0) + 1; });
      const modes = Object.entries(counts)
        .sort((a, b) => b[1] - a[1])
        .map(([mode, count]) => ({ mode, count }));
      const label = `S${i + 1}`;
      const rangeLabel = start && end ? `${start.slice(5)} – ${end.slice(5)}`
        : start ? `${start.slice(5)} —` : end ? `— ${end.slice(5)}` : "All";
      return { label, rangeLabel, modes };
    });
    const seasons = allSeasons.filter(s => s.modes.length > 0);
    if (!seasons.length) {
      seasonContainer.innerHTML = `<div class="brawl-bar-chart">${renderBars([], { emptyText: "No ranked game data yet." })}</div>`;
    } else {
      let activeSeason = seasons.length - 1;
      const render = () => {
        const tabs = seasons.map((s, i) => `
          <button class="brawl-season-tab${i === activeSeason ? " active" : ""}" data-idx="${i}">${s.rangeLabel}</button>
        `).join("");
        const s = seasons[activeSeason];
        const bars = renderBars(s.modes, { emptyText: "No data for this season yet." });
        seasonContainer.innerHTML = `
          <div class="brawl-season-tabs">${tabs}</div>
          <div class="brawl-bar-chart brawl-season-chart">${bars}</div>
        `;
        seasonContainer.querySelectorAll(".brawl-season-tab").forEach(btn => {
          btn.addEventListener("click", () => { activeSeason = +btn.dataset.idx; render(); });
        });
      };
      render();
    }
  }

  document.querySelector("#brawl-current-ranked-total").textContent = number((ranked.currentSeasonBrawlers || []).length);
  document.querySelector("#brawl-current-ranked-brawlers").innerHTML = renderBrawlers(ranked.currentSeasonBrawlers || [], { emptyText: "Waiting for current season ranked brawler stats." });
  document.querySelector("#brawl-all-ranked-total").textContent = number((ranked.allTimeBrawlers || []).length);
  document.querySelector("#brawl-all-ranked-brawlers").innerHTML = renderBrawlers(ranked.allTimeBrawlers || [], { emptyText: "Waiting for all-time ranked brawler stats." });

  const highlights = data.highlights || [];
  const hallImage = document.querySelector("#brawl-hall-image");
  const prev = document.querySelector("#brawl-hall-prev");
  const next = document.querySelector("#brawl-hall-next");
  let highlightIndex = highlights.length ? Math.floor(Math.random() * highlights.length) : 0;

  const showHighlight = (direction = 0) => {
    if (!highlights.length) {
      document.querySelector("#brawl-hall").innerHTML = empty("Add screenshots to assets/brawl_highlights.");
      return;
    }
    if (direction === 0) highlightIndex = Math.floor(Math.random() * highlights.length);
    else highlightIndex = (highlightIndex + direction + highlights.length) % highlights.length;
    hallImage.src = highlights[highlightIndex];
  };

  prev?.addEventListener("click", () => showHighlight(-1));
  next?.addEventListener("click", () => showHighlight(1));
  hallImage?.addEventListener("click", () => showHighlight(0));
  showHighlight(0);
  if (highlights.length > 1) setInterval(() => showHighlight(1), 7000);
}
