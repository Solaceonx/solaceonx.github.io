{
  const data = window.ROYALE_DATA;

  if (!data) {
    document.querySelector("#royale-chart-grid").innerHTML = "<div class=\"tracker-empty\">Missing Royale data.</div>";
  } else {
    const number = (value) => new Intl.NumberFormat("en-US").format(value ?? 0);
    const percent = (value) => `${Math.round(value)}%`;
    const percentOneDecimal = (value) => `${Number(value ?? 0).toFixed(1).replace(/\.0$/, "")}%`;
    const royalePalette = {
      blue: "#1f6fe5",
      gold: "#d99a20",
      navy: "#143d75"
    };
    const pieColors = [royalePalette.blue, royalePalette.gold, royalePalette.navy, "#f2c45f", "#8bb6f5"];

    const renderLevelPie = (distribution = []) => {
      const visible = distribution.filter(slice => slice.count > 0 && slice.percent > 0);
      if (!visible.length) return "";

      let cursor = -90;
      const radius = 47;
      const center = 60;
      const polar = (angle, distance = radius) => {
        const radians = angle * Math.PI / 180;
        return {
          x: center + Math.cos(radians) * distance,
          y: center + Math.sin(radians) * distance
        };
      };
      const slices = visible.map((slice, index) => {
        const startAngle = cursor;
        const endAngle = cursor + (slice.percent / 100) * 360;
        const start = polar(startAngle);
        const end = polar(endAngle);
        const largeArc = endAngle - startAngle > 180 ? 1 : 0;
        const mid = polar((startAngle + endAngle) / 2, 29);
        cursor = endAngle;
        return {
          ...slice,
          color: pieColors[index % pieColors.length],
          path: `M ${center} ${center} L ${start.x} ${start.y} A ${radius} ${radius} 0 ${largeArc} 1 ${end.x} ${end.y} Z`,
          labelX: mid.x,
          labelY: mid.y
        };
      });

      return `
        <div class="royale-level-pie-inset" aria-label="Card level distribution">
          <svg class="royale-level-pie" viewBox="0 0 120 120" role="img">
            ${slices.map(slice => `<path d="${slice.path}" fill="${slice.color}"></path>`).join("")}
            ${slices.map(slice => `<text x="${slice.labelX}" y="${slice.labelY}"><tspan x="${slice.labelX}" dy="-2">L${slice.level}</tspan><tspan x="${slice.labelX}" dy="10">${percentOneDecimal(slice.percent)}</tspan></text>`).join("")}
          </svg>
        </div>
      `;
    };

    const renderSvgChart = (points, metric, options = {}) => {
      if (!points.length) return `<div class="tracker-empty">Add data to start this graph.</div>`;

      const width = options.width || 920;
      const height = options.height || 280;
      const pad = options.pad || 24;
      const yLabelWidth = options.yLabelWidth || 54;
      const formatValue = options.formatter || number;
      const showLabels = options.labels !== false;
      const leftPad = pad + yLabelWidth;
      const values = points.map(point => point.value);
      const rawMin = Math.min(...values);
      const rawMax = Math.max(...values);
      const minRange = options.minRange || 1;
      const rawRange = rawMax - rawMin;
      const rangeBuffer = rawRange ? rawRange * 0.18 : minRange / 2;
      const center = (rawMin + rawMax) / 2;
      const min = rawRange < minRange
        ? center - minRange / 2
        : rawMin - rangeBuffer;
      const max = rawRange < minRange
        ? center + minRange / 2
        : rawMax + rangeBuffer;
      const range = max - min || 1;
      const xStep = points.length > 1 ? (width - leftPad - pad) / (points.length - 1) : 0;
      const yFor = (value) => height - pad - ((value - min) / range) * (height - pad * 2);
      const coords = points.map((point, index) => ({
        x: leftPad + index * xStep,
        y: yFor(point.value),
        label: point.label,
        value: point.value
      }));
      const path = coords.map((point, index) => `${index ? "L" : "M"} ${point.x} ${point.y}`).join(" ");
      const area = `${path} L ${coords.at(-1).x} ${height - pad} L ${coords[0].x} ${height - pad} Z`;
      const gradientId = `royale-area-${metric.key}`;
      const tickValues = [max, min + range / 2, min];
      const ticks = tickValues.map(value => ({ value, y: yFor(value) }));
      const tickValue = (value) => options.integerTicks === false ? value : Math.round(value);

      return `
        <svg viewBox="0 0 ${width} ${height}" role="img" aria-label="${metric.label} chart">
          <defs>
            <linearGradient id="${gradientId}" x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stop-color="${metric.color}" stop-opacity=".24"/>
              <stop offset="100%" stop-color="${metric.color}" stop-opacity="0"/>
            </linearGradient>
          </defs>
          <path class="chart-grid" d="${ticks.map(tick => `M ${leftPad} ${tick.y} H ${width - pad}`).join(" ")}"/>
          ${ticks.map(tick => `<text class="chart-y-label" x="${leftPad - 8}" y="${tick.y + 3}" text-anchor="end">${formatValue(tickValue(tick.value))}</text>`).join("")}
          <path style="fill:url(#${gradientId})" d="${area}"/>
          <path class="chart-line" style="stroke:${metric.color}" d="${path}"/>
          ${coords.map(point => `<circle cx="${point.x}" cy="${point.y}" r="4" style="stroke:${metric.color}"/>`).join("")}
          ${showLabels ? coords.map(point => `<text x="${point.x}" y="${height - 4}" text-anchor="middle">${point.label}</text>`).join("") : ""}
        </svg>`;
    };

    const wins = data.recentBattles.filter(battle => battle.result === "win").length;
    const losses = data.recentBattles.filter(battle => battle.result === "loss").length;
    const decidedBattles = wins + losses;
    const winRate = data.recentWinRate ?? (decidedBattles ? wins / decidedBattles * 100 : 0);
    const overallWinRate = data.overallWinRate ?? 0;
    const latestSnapshot = data.history?.at(-1) || {};
    const overallWinRateLabel = `${number(latestSnapshot.wins)} / ${number(latestSnapshot.losses)} = ${percentOneDecimal(overallWinRate)}`;
    const firstSnapshot = data.history?.[0] || latestSnapshot;
    const weeklyGames = data.history?.length > 1
      ? (latestSnapshot.battleCount ?? 0) - (firstSnapshot.battleCount ?? 0)
      : latestSnapshot.battleCount ?? 0;
    const weeklyWins = data.history?.length > 1
      ? (latestSnapshot.wins ?? 0) - (firstSnapshot.wins ?? 0)
      : latestSnapshot.wins ?? 0;
    const weeklyLosses = data.history?.length > 1
      ? (latestSnapshot.losses ?? 0) - (firstSnapshot.losses ?? 0)
      : latestSnapshot.losses ?? 0;
    const weeklyTrophyChange = data.history?.length > 1
      ? (latestSnapshot.trophies ?? 0) - (firstSnapshot.trophies ?? 0)
      : latestSnapshot.trophies ?? 0;
    const weeklyWinRate = weeklyWins + weeklyLosses ? weeklyWins / (weeklyWins + weeklyLosses) * 100 : null;

    document.querySelector("#royale-weekly-summary").innerHTML = [
      { label: "Games played", value: number(weeklyGames), note: "since first snapshot" },
      { label: "Win rate", value: weeklyWinRate == null ? "—" : percentOneDecimal(weeklyWinRate), note: `${number(weeklyWins)}-${number(weeklyLosses)} over tracked games` },
      { label: "Trophy change", value: `${weeklyTrophyChange >= 0 ? "+" : ""}${number(weeklyTrophyChange)}`, note: "since first snapshot" },
      { label: "Current trophies", value: number(data.currentTrophies), note: "latest snapshot" }
    ].map(item => `
      <article class="weekly-summary-card">
        <span>${item.label}</span>
        <strong>${item.value}</strong>
        <small>${item.note}</small>
      </article>
    `).join("");

    document.querySelector("#royale-current-trophies").textContent = number(data.currentTrophies);
    document.querySelector("#royale-best-trophies").textContent = number(data.bestTrophies);
    document.querySelector("#royale-win-rate").textContent = percent(winRate);
    document.querySelector("#royale-overall-win-rate").textContent = overallWinRateLabel;

    const chartCards = [
      {
        title: "Trophies",
        latest: number(data.currentTrophies),
        points: (data.trophyHistory || []).map(point => ({ label: point.label, value: point.trophies })),
        metric: { key: "trophies", label: "Trophies", color: royalePalette.blue },
        formatter: number
      },
      {
        title: "Games played",
        latest: number(data.totalGames),
        points: (data.gameHistory || []).map(point => ({ label: point.label, value: point.games })),
        metric: { key: "games", label: "Games played", color: royalePalette.gold },
        formatter: number
      },
      {
        title: "Overall win rate",
        latest: overallWinRateLabel,
        points: (data.overallWinRateHistory || []).map(point => ({ label: point.label, value: point.winRate })),
        metric: { key: "overall-winrate", label: "Overall win rate", color: royalePalette.blue },
        formatter: percentOneDecimal,
        minRange: 0.35,
        integerTicks: false
      }
    ];

    document.querySelector("#royale-chart-grid").innerHTML = chartCards.map(chart => `
      <article class="royale-chart-card">
        <div class="mini-chart-head">
          <h4>${chart.title}</h4>
          <strong>${chart.latest}</strong>
        </div>
        <div class="line-chart">${renderSvgChart(chart.points, chart.metric, { width: 520, height: 180, formatter: chart.formatter, minRange: chart.minRange, integerTicks: chart.integerTicks })}</div>
      </article>
    `).join("");

    const collection = data.collectionProgress || {};
    const collectionPoint = (point, path) => path.reduce((value, key) => value?.[key], point.collectionProgress);
    const progressCards = [
      {
        title: "Card levels",
        latest: percent(collection.cardLevels?.percent || 0),
        points: (data.history || []).map(point => ({
          label: point.label,
          value: collectionPoint(point, ["cardLevels", "percent"])
        })).filter(point => typeof point.value === "number"),
        metric: { key: "royale-card-levels", label: "Card levels", color: royalePalette.blue },
        formatter: percent
      },
      {
        title: "Maxed cards",
        latest: `${number(collection.maxedCards?.current)} / ${number(collection.maxedCards?.total)}`,
        points: (data.history || []).map(point => ({
          label: point.label,
          value: collectionPoint(point, ["maxedCards", "current"])
        })).filter(point => typeof point.value === "number"),
        metric: { key: "royale-maxed-cards", label: "Maxed cards", color: royalePalette.gold },
        formatter: number,
        levelDistribution: collection.maxedCards?.levelDistribution || []
      },
      {
        title: "Evolutions",
        latest: `${number(collection.evolutions?.unlocked)} / ${number(collection.evolutions?.total)}`,
        points: (data.history || []).map(point => ({
          label: point.label,
          value: collectionPoint(point, ["evolutions", "unlocked"])
        })).filter(point => typeof point.value === "number"),
        metric: { key: "royale-evolutions", label: "Evolutions", color: royalePalette.blue },
        formatter: number
      },
      {
        title: "Unlocked heroes",
        latest: `${number(collection.heroes?.unlocked)} / ${number(collection.heroes?.total)}`,
        points: (data.history || []).map(point => ({
          label: point.label,
          value: collectionPoint(point, ["heroes", "unlocked"])
        })).filter(point => typeof point.value === "number"),
        metric: { key: "royale-heroes", label: "Unlocked heroes", color: royalePalette.gold },
        formatter: number
      }
    ];

    document.querySelector("#royale-progress-grid").innerHTML = progressCards.map(card => `
      <article class="mini-chart-card${card.levelDistribution ? " mini-chart-card-with-pie" : ""}">
        <div class="mini-chart-head">
          <h4>${card.title}</h4>
          <strong>${card.latest}</strong>
        </div>
        ${card.levelDistribution ? renderLevelPie(card.levelDistribution) : ""}
        <div class="mini-chart">${renderSvgChart(card.points, card.metric, { width: 320, height: 132, pad: 16, yLabelWidth: 48, labels: true, formatter: card.formatter })}</div>
      </article>
    `).join("");

    document.querySelector("#royale-form").innerHTML = `
      <div class="royale-winrate">
        <strong>${wins}-${losses}</strong>
        <span>${percent(winRate)} over last ${data.recentBattles.length || decidedBattles} games</span>
      </div>
      ${data.recentBattles.length ? `
        <ol class="royale-battle-grid" aria-label="Past ${data.recentBattles.length} battles">
          ${data.recentBattles.map((battle, index) => `
            <li class="${battle.result}" title="${battle.result} · ${battle.mode} · ${battle.crowns}">
              <span>${index + 1}</span>
              <strong>${battle.result === "win" ? "W" : battle.result === "loss" ? "L" : "D"}</strong>
            </li>
          `).join("")}
        </ol>
      ` : "<div class=\"tracker-empty tracker-empty-small\">Add a CR_API_TOKEN to start the battle log.</div>"}
    `;

  }
}
