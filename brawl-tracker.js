{
  const data = window.BRAWL_DATA || {};
  const number = (value) => value == null ? "—" : new Intl.NumberFormat("en-US").format(value);
  const percentOneDecimal = (value) => `${Number(value ?? 0).toFixed(1).replace(/\.0$/, "")}%`;
  const palette = { blue: "#1278d8", yellow: "#f4bd28", dark: "#111827" };

  const empty = (text) => `<div class="tracker-empty tracker-empty-small">${text}</div>`;

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
    const min = rawRange < minRange ? center - minRange / 2 : rawMin - rawRange * .14;
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
    const ticks = [max, min + range / 2, min].map(value => ({ value, y: yFor(value) }));
    const resets = (options.resets || []).map(reset => {
      const index = points.findIndex(point => point.date === reset.date);
      if (index < 0) return "";
      const x = coords[index].x;
      return `<path class="brawl-reset-line" d="M ${x} ${pad} V ${height - pad}"><title>Season reset: ${reset.label || reset.date}</title></path>`;
    }).join("");
    const gradientId = `brawl-area-${metric.key}`;
    const formatValue = options.formatter || number;
    const tickValue = (value) => options.integerTicks === false ? value : Math.round(value);

    return `
      <svg viewBox="0 0 ${width} ${height}" role="img" aria-label="${metric.label}">
        <defs>
          <linearGradient id="${gradientId}" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stop-color="${metric.color}" stop-opacity=".25"/>
            <stop offset="100%" stop-color="${metric.color}" stop-opacity="0"/>
          </linearGradient>
        </defs>
        <path class="chart-grid" d="${ticks.map(tick => `M ${leftPad} ${tick.y} H ${width - pad}`).join(" ")}"/>
        ${ticks.map(tick => `<text class="chart-y-label" x="${leftPad - 8}" y="${tick.y + 3}" text-anchor="end">${formatValue(tickValue(tick.value))}</text>`).join("")}
        ${resets}
        <path class="chart-area" fill="url(#${gradientId})" d="${area}"/>
        <path class="chart-line" style="stroke:${metric.color}" d="${path}"/>
        ${coords.map(point => `<circle cx="${point.x}" cy="${point.y}" r="${options.dot || 4}" style="stroke:${metric.color}"><title>${point.label}: ${formatValue(point.value)}</title></circle>`).join("")}
        ${coords.map(point => `<text x="${point.x}" y="${height - 6}" text-anchor="middle">${point.label}</text>`).join("")}
      </svg>
    `;
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
      const initials = (item.name || "?").split(/\s+/).map(part => part[0]).join("").slice(0, 2);
      const portrait = item.image
        ? `<img src="${item.image}" alt="${item.name} portrait">`
        : `<i>${initials}</i>`;

      if (variant === "trophy-games") {
        return `
          <div class="brawl-rank-row brawl-rank-row-stats">
            <span>${index + 1}</span>
            ${portrait}
            <b>${item.name}</b>
            <strong>${number(item.trophies || 0)} trophies</strong>
            <small>${number(item.games || 0)} games tracked</small>
          </div>
        `;
      }

      return `
        <div class="brawl-rank-row">
          <span>${index + 1}</span>
          ${portrait}
          <b>${item.name}</b>
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
  const latestValue = (items, key) => items?.at(-1)?.[key] ?? 0;
  const firstValue = (items, key) => items?.[0]?.[key] ?? latestValue(items, key);
  const deltaSinceFirst = (items, key) => (items?.length || 0) <= 1
    ? latestValue(items, key)
    : latestValue(items, key) - firstValue(items, key);
  const winRateFrom = (wins, losses) => wins + losses ? wins / (wins + losses) * 100 : null;

  const trophyHistory = (trophy.history || []).map(point => ({ label: point.label, date: point.date, value: point.trophies }));
  const lifetimeWinPoints = (trophy.lifetimeWinsHistory || []).map(point => ({ label: point.label, date: point.date, value: point.wins }));
  const trophyWins = trophy.winsHistory || [];
  const trophyLosses = trophy.lossesHistory || [];
  const trophyWinPoints = trophyWins.map(point => ({ label: point.label, date: point.date, value: point.wins }));
  const rankedPoints = (ranked.pointsHistory || []).map(point => ({ label: point.label, date: point.date, value: point.points }));
  const rankedGames = (ranked.gamesHistory || []).map(point => ({ label: point.label, date: point.date, value: point.games }));
  const rankedWins = ranked.winsHistory || [];
  const rankedLosses = ranked.lossesHistory || [];

  const trophyGamesDelta = deltaSinceFirst(trophy.gamesHistory || [], "games");
  const rankedGamesDelta = deltaSinceFirst(ranked.gamesHistory || [], "games");
  const lifetimeWinsDelta = deltaSinceFirst(trophy.lifetimeWinsHistory || [], "wins");
  const trophyWinsDelta = deltaSinceFirst(trophyWins, "wins");
  const trophyLossesDelta = deltaSinceFirst(trophyLosses, "losses");
  const rankedWinsDelta = deltaSinceFirst(rankedWins, "wins");
  const rankedLossesDelta = deltaSinceFirst(rankedLosses, "losses");
  const trackedWins = latestValue(trophyWins, "wins") + latestValue(rankedWins, "wins");
  const trackedLosses = latestValue(trophyLosses, "losses") + latestValue(rankedLosses, "losses");
  const trackedWinRate = winRateFrom(trackedWins, trackedLosses);

  document.querySelector("#brawl-weekly-summary").innerHTML = [
    { label: "Lifetime wins gained", value: number(lifetimeWinsDelta), note: "Official API total" },
    { label: "Tracked trophy games", value: number(trophyGamesDelta), note: `${number(trophyWinsDelta)} tracked wins` },
    { label: "Tracked ranked wins", value: number(rankedWinsDelta), note: `${number(rankedGamesDelta)} ranked games tracked` },
    { label: "Tracked win rate", value: trackedWinRate == null ? "—" : percentOneDecimal(trackedWinRate), note: `${number(trackedWins)}-${number(trackedLosses)} in tracked battles` },
  ].map(item => `
    <article class="weekly-summary-card">
      <span>${item.label}</span>
      <strong>${item.value}</strong>
    </article>
  `).join("");

  document.querySelector("#brawl-trophy-latest").textContent = number(trophyHistory.at(-1)?.value);
  document.querySelector("#brawl-trophy-chart").innerHTML = renderLineChart(trophyHistory, { key: "trophies", label: "Trophies", color: palette.blue }, { empty: "Add trophy snapshots to start this graph." });
  document.querySelector("#brawl-recent-count").textContent = number((trophy.recentGames || []).length);
  document.querySelector("#brawl-recent-games").innerHTML = renderRecentGames(trophy.recentGames || []);
  document.querySelector("#brawl-trophy-games-latest").textContent = number(lifetimeWinPoints.at(-1)?.value);
  document.querySelector("#brawl-trophy-games-chart").innerHTML = renderLineChart(lifetimeWinPoints, { key: "lifetime-wins", label: "Lifetime wins", color: palette.yellow }, { width: 340, height: 150, pad: 18, yLabelWidth: 56, empty: "Add lifetime win snapshots to start this graph." });
  document.querySelector("#brawl-mode-total").textContent = number((trophy.modes || []).reduce((sum, item) => sum + (item.count || 0), 0));
  document.querySelector("#brawl-mode-histogram").innerHTML = renderBars(trophy.modes || []);
  document.querySelector("#brawl-top-brawlers").innerHTML = renderBrawlers(trophy.topBrawlers || [], { variant: "trophy-games" });

  document.querySelector("#brawl-ranked-latest").textContent = number(rankedPoints.at(-1)?.value);
  document.querySelector("#brawl-ranked-chart").innerHTML = renderLineChart(rankedPoints, { key: "ranked-points", label: "Ranked points", color: palette.blue }, { empty: "Add ranked snapshots to start this graph.", resets: ranked.seasonResets || [] });
  document.querySelector("#brawl-ranked-games-latest").textContent = number(rankedGames.at(-1)?.value);
  document.querySelector("#brawl-ranked-games-chart").innerHTML = renderLineChart(rankedGames, { key: "ranked-games", label: "Ranked games", color: palette.yellow }, { width: 340, height: 150, pad: 18, yLabelWidth: 48, empty: "Add ranked game counts to start this graph." });
  document.querySelector("#brawl-ranked-mode-total").textContent = number((ranked.modes || []).reduce((sum, item) => sum + (item.count || 0), 0));
  document.querySelector("#brawl-ranked-mode-histogram").innerHTML = renderBars(ranked.modes || [], { emptyText: "Waiting for ranked mode history." });
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
