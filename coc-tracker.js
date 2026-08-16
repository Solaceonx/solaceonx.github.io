const cocAccounts = window.COC_ACCOUNTS || [];
const tabsRoot = document.querySelector("#coc-account-tabs");

if (tabsRoot && cocAccounts.length) {
  const number = (value) => value == null ? "—" : new Intl.NumberFormat().format(value);
  const percent = (value) => value == null ? "—" : `${number(value)}%`;
  const cocPalette = {
    green: "#2f7d32",
    gold: "#c88719",
    dark: "#40513b"
  };
  const achievementMetrics = [
    { key: "attacksWon", label: "Attacks won", color: cocPalette.green, note: "Lifetime multiplayer wins", showAvg: true },
    { key: "donations", label: "Donations", color: cocPalette.gold, note: "Lifetime donations", showAvg: true },
    { key: "warStars", label: "War stars", color: cocPalette.green, note: "Lifetime war stars", showAvg: true },
    { key: "clanCapitalContributions", label: "Capital gold", color: cocPalette.gold, note: "Lifetime contribution" }
  ];
  const progressMetrics = [
    { key: "heroesProgress", fallback: "Heroes", label: "Heroes", color: cocPalette.gold },
    { key: "troopsProgress", fallback: "Troops", label: "Troops", color: cocPalette.green },
    { key: "spellsProgress", fallback: "Spells", label: "Spells", color: cocPalette.green },
    { key: "equipmentProgress", fallback: "Equipment", label: "Equipment", color: cocPalette.gold }
  ];

  const formatDateLabel = (point) => {
    if (point.label) return point.label;
    if (!point.date) return "Snapshot";
    const date = new Date(`${point.date}T00:00:00`);
    return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  };

  const metricPoints = (account, metric) => {
    const points = account.history.map(point => {
      const fallbackValue = metric.fallback ? account.progress?.[metric.fallback] : undefined;
      return { ...point, value: point[metric.key] ?? fallbackValue, label: formatDateLabel(point) };
    })
    .filter(point => typeof point.value === "number" && Number.isFinite(point.value));

    if (!metric.key.endsWith("Progress")) return points;

    let runningMax = -Infinity;
    return points.map(point => {
      runningMax = Math.max(runningMax, point.value);
      return { ...point, value: runningMax };
    });
  };

  const makePath = (points, width, height, pad) => {
    const values = points.map(point => point.value);
    const rawMin = Math.min(...values);
    const rawMax = Math.max(...values);
    const buffer = Math.max(1, Math.round((rawMax - rawMin) * 0.12));
    const min = rawMin === rawMax ? rawMin - 1 : rawMin - buffer;
    const max = rawMin === rawMax ? rawMax + 1 : rawMax + buffer;
    const plotted = points.map((point, index) => {
      const x = points.length === 1 ? width / 2 : pad + index * ((width - pad * 2) / (points.length - 1));
      const y = height - pad - ((point.value - min) / (max - min)) * (height - pad * 2);
      return { ...point, x, y };
    });

    const path = plotted.length === 1
      ? `M ${pad} ${plotted[0].y} L ${width - pad} ${plotted[0].y}`
      : plotted.map((point, index) => `${index ? "L" : "M"} ${point.x} ${point.y}`).join(" ");
    const area = plotted.length === 1
      ? `M ${pad} ${height - pad} L ${pad} ${plotted[0].y} L ${width - pad} ${plotted[0].y} L ${width - pad} ${height - pad} Z`
      : `${path} L ${plotted.at(-1).x} ${height - pad} L ${plotted[0].x} ${height - pad} Z`;

    const ticks = [
      { value: max, y: pad },
      { value: (min + max) / 2, y: height / 2 },
      { value: min, y: height - pad }
    ];

    return { plotted, path, area, ticks };
  };

  const renderSvgChart = (points, metric, options = {}) => {
    if (!points.length) {
      return `<div class="tracker-empty tracker-empty-small">Run the updater to start this graph.</div>`;
    }

    const width = options.width || 760;
    const height = options.height || 250;
    const pad = options.pad || 34;
    const yLabelWidth = options.yLabelWidth ?? 44;
    const leftPad = Math.max(pad, yLabelWidth);
    const { plotted, path, area, ticks } = makePath(points, width, height, leftPad);
    const gradientId = `coc-area-${metric.key}`;
    const formatValue = options.formatter || number;
    const maxLabels = options.maxLabels || 8;
    const labelIndexes = new Set();
    if (options.labels !== false && plotted.length) {
      const visibleLabels = Math.min(maxLabels, plotted.length);
      for (let index = 0; index < visibleLabels; index += 1) {
        labelIndexes.add(Math.round(index * (plotted.length - 1) / Math.max(1, visibleLabels - 1)));
      }
    }

    return `
      <svg viewBox="0 0 ${width} ${height}" role="img" aria-label="${metric.label} history">
        <defs>
          <linearGradient id="${gradientId}" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stop-color="${metric.color}" stop-opacity=".28"/>
            <stop offset="1" stop-color="${metric.color}" stop-opacity="0"/>
          </linearGradient>
        </defs>
        <path class="chart-grid" d="${ticks.map(tick => `M ${leftPad} ${tick.y} H ${width - pad}`).join(" ")}"/>
        ${ticks.map(tick => `<text class="chart-y-label" x="${leftPad - 8}" y="${tick.y + 3}" text-anchor="end">${formatValue(Math.round(tick.value))}</text>`).join("")}
        <path class="chart-area" fill="url(#${gradientId})" d="${area}"/>
        <path class="chart-line" style="stroke:${metric.color}" d="${path}"/>
        ${plotted.map(point => `<circle style="stroke:${metric.color}" cx="${point.x}" cy="${point.y}" r="${options.dot || 4}"><title>${point.label}: ${formatValue(point.value)}</title></circle>`).join("")}
        ${options.labels === false ? "" : plotted.map((point, index) => labelIndexes.has(index) ? `<text x="${point.x}" y="${height - 8}" text-anchor="middle">${point.label}</text>` : "").join("")}
        ${options.avgPerWeek != null ? `<text class="chart-avg-label" x="${leftPad + 6}" y="${pad + 12}" text-anchor="start">avg ${formatValue(options.avgPerWeek)}/wk</text>` : ""}
      </svg>`;
  };

  const renderRankedHistory = (account) => {
    const rows = account.rankedHistory || [];

    // Map tier IDs to short display names for the Y axis
    const tierLabel = (tierId, league) => {
      if (!tierId || tierId === 105000000) return "Unranked";
      // Extract league family name (before the number)
      const match = (league || "").match(/^([A-Za-z .]+\S)/);
      return match ? match[1].replace(" League", "") : league || "—";
    };

    const chartPoints = rows
      .filter(row => row.result !== "Tracking" && row.leagueTierId && row.leagueTierId !== 105000000)
      .map(row => ({ label: row.label, date: row.week, value: row.leagueTierId, leagueName: row.league }));

    // Build ordered tier list from data for Y axis labels
    const tierMap = new Map();
    chartPoints.forEach(p => tierMap.set(p.value, tierLabel(p.value, p.leagueName)));
    const sortedTiers = [...tierMap.entries()].sort((a, b) => a[0] - b[0]);

    const leagueFormatter = (val) => {
      const rounded = Math.round(val);
      // Find closest tier
      const closest = sortedTiers.reduce((best, t) => Math.abs(t[0] - rounded) < Math.abs(best[0] - rounded) ? t : best, sortedTiers[0] || [0, "—"]);
      return closest[1];
    };

    document.querySelector("#coc-league-season").innerHTML = rows.length
      ? `
        <div class="ranked-table" role="table" aria-label="Ranked battle weekly history">
          <div class="ranked-row ranked-row-head" role="row">
            <span>Week</span>
            <span>League</span>
            <span>Ending trophies</span>
            <span>Result</span>
          </div>
          ${rows.slice().reverse().map(row => `
            <div class="ranked-row" role="row">
              <span>${row.label}</span>
              <span>${row.league}</span>
              <span>${number(row.endingTrophies)}</span>
              <span>${row.result}</span>
            </div>`).join("")}
        </div>
        <div class="ranked-chart">
          <div class="mini-chart-head">
            <div><h4>League progression</h4></div>
            <strong>${rows.at(-1)?.league || "—"}</strong>
          </div>
          <div class="line-chart" id="coc-range-ranked-trophies"></div>
        </div>`
      : '<div class="tracker-empty">Run the updater to start ranked battle history.</div>';

    if (chartPoints.length) {
      window.attachRangePicker(
        document.querySelector("#coc-range-ranked-trophies"),
        chartPoints,
        pts => renderSvgChart(pts, { key: "rankedLeague", label: "League", color: cocPalette.gold }, { width: 760, height: 220, pad: 34, yLabelWidth: 72, dot: 4, formatter: leagueFormatter })
      );
    }
  };

  const ordinalSuffix = (value) => {
    const numberValue = Number(value);
    const mod100 = numberValue % 100;
    if (mod100 >= 11 && mod100 <= 13) return "th";
    const mod10 = numberValue % 10;
    if (mod10 === 1) return "st";
    if (mod10 === 2) return "nd";
    if (mod10 === 3) return "rd";
    return "th";
  };

  const renderMiniCharts = (rootSelector, account, metrics, formatter = number) => {
    const root = document.querySelector(rootSelector);
    root.innerHTML = metrics.map((metric, idx) => {
      const points = metricPoints(account, metric);
      const latest = points.at(-1)?.value;
      const first = points[0]?.value;
      const delta = latest != null && first != null && points.length > 1 ? latest - first : null;
      const weekCount = points.length > 1 ? (points.length - 1) : null;
      const avgPerWeek = metric.showAvg && delta != null && weekCount ? Math.round(delta / weekCount) : null;
      const pickerId = `coc-range-${rootSelector.replace(/[^a-z]/g, "")}-${idx}`;

      return `
        <article class="mini-chart-card">
          <div class="mini-chart-head">
            <div>
              <h4>${metric.label}</h4>
            </div>
            <strong>${formatter(latest)}</strong>
          </div>
          <div class="mini-chart" id="${pickerId}"></div>
        </article>`;
    }).join("");

    metrics.forEach((metric, idx) => {
      const points = metricPoints(account, metric);
      const latest = points.at(-1)?.value;
      const first = points[0]?.value;
      const delta = latest != null && first != null && points.length > 1 ? latest - first : null;
      const weekCount = points.length > 1 ? (points.length - 1) : null;
      const avgPerWeek = metric.showAvg && delta != null && weekCount ? Math.round(delta / weekCount) : null;
      const pickerId = `coc-range-${rootSelector.replace(/[^a-z]/g, "")}-${idx}`;
      window.attachRangePicker(
        document.querySelector(`#${pickerId}`),
        points,
        pts => renderSvgChart(pts, metric, { width: 320, height: 146, pad: 18, yLabelWidth: 48, dot: 3, labels: true, formatter, avgPerWeek })
      );
    });
  };

  const renderPlacements = (placements) => {
    document.querySelector("#coc-placements").innerHTML = placements.length
      ? `<ul class="placement-bullets">${placements.map(item => `
          <li><strong>#${number(item.rank)}</strong> ${item.label}${item.date ? ` <span>(${item.date})</span>` : ""}</li>
        `).join("")}</ul>`
      : "<div class=\"tracker-empty\">Add notable finishes for this account.</div>";
  };

  const DAY_MS = 24 * 60 * 60 * 1000;

  const parseDate = (dateString) => dateString ? new Date(`${dateString}T00:00:00`) : null;

  const latestSnapshotDate = () => cocAccounts
    .flatMap(account => account.history || [])
    .map(point => point.date)
    .filter(Boolean)
    .sort()
    .at(-1);

  const positiveDelta = (current, previous, key) => {
    const currentValue = current?.[key];
    const previousValue = previous?.[key];
    if (typeof currentValue !== "number" || typeof previousValue !== "number") return 0;
    const delta = currentValue - previousValue;
    return delta > 0 ? delta : 0;
  };

  const dailyDeltas = (key) => {
    const totals = new Map();
    cocAccounts.forEach(account => {
      const points = (account.history || []).slice().sort((a, b) => (a.date || "").localeCompare(b.date || ""));
      for (let index = 1; index < points.length; index += 1) {
        const date = points[index].date;
        if (!date) continue;
        totals.set(date, (totals.get(date) || 0) + positiveDelta(points[index], points[index - 1], key));
      }
    });
    return [...totals.entries()]
      .map(([date, value]) => ({ date, label: formatDateLabel({ date }), value }))
      .sort((a, b) => a.date.localeCompare(b.date));
  };

  const sevenDayDelta = (key) => {
    const latestDateString = latestSnapshotDate();
    if (!latestDateString) return 0;
    const latestDate = parseDate(latestDateString);
    const windowStart = new Date(latestDate.getTime() - 6 * DAY_MS);
    return dailyDeltas(key)
      .filter(point => {
        const date = parseDate(point.date);
        return date && date >= windowStart && date <= latestDate;
      })
      .reduce((sum, point) => sum + point.value, 0);
  };

  const bestDailyRecord = (key) => dailyDeltas(key)
    .reduce((best, point) => point.value > best.value ? point : best, { label: "—", value: 0 });

  const bestSevenDayRecord = (key) => {
    const points = dailyDeltas(key);
    return points.reduce((best, point, index) => {
      const date = parseDate(point.date);
      if (!date) return best;
      const start = new Date(date.getTime() - 6 * DAY_MS);
      const total = points
        .slice(0, index + 1)
        .filter(item => {
          const itemDate = parseDate(item.date);
          return itemDate && itemDate >= start && itemDate <= date;
        })
        .reduce((sum, item) => sum + item.value, 0);
      return total > best.value ? { label: `${formatDateLabel({ date: start.toISOString().slice(0, 10) })}–${point.label}`, value: total } : best;
    }, { label: "—", value: 0 });
  };

  const renderWeeklySummary = () => {
    const root = document.querySelector("#coc-weekly-summary");
    if (!root) return;

    const rows = [
      { label: "Attacks won", key: "attacksWon" },
      { label: "Donations", key: "donations" },
      { label: "War stars", key: "warStars" },
      { label: "Capital gold", key: "clanCapitalContributions" }
    ].map(item => ({
      ...item,
      value: sevenDayDelta(item.key),
      note: "all accounts, last 7 days"
    }));

    const attackDayRecord = bestDailyRecord("attacksWon");
    const attackWeekRecord = bestSevenDayRecord("attacksWon");

    rows.push(
      {
        label: "Best attack day",
        value: attackDayRecord.value,
        note: attackDayRecord.label
      },
      {
        label: "Best attack week",
        value: attackWeekRecord.value,
        note: attackWeekRecord.label
      }
    );

    root.innerHTML = rows.map(item => `
      <article class="weekly-summary-card">
        <span>${item.label}</span>
        <strong>${number(item.value)}</strong>
        <small>${item.note}</small>
      </article>
    `).join("");
  };

  const renderAccount = (account) => {
    const backgroundImage = account.backgroundImage || "assets/clash-base.png";
    document.body.style.setProperty("--coc-bg-image", `url("${backgroundImage}")`);

    tabsRoot.querySelectorAll("button").forEach(button => {
      const active = button.dataset.account === account.id;
      button.classList.toggle("active", active);
      button.setAttribute("aria-selected", String(active));
    });

    const status = account.demo ? "Waiting for snapshot" : "Updated";
    document.querySelector("#coc-status").textContent = account.updatedAt ? `${status} · ${account.updatedAt}` : status;
    document.querySelector("#coc-name").textContent = account.name;
    document.querySelector("#coc-tag").textContent = account.tag;
    document.querySelector("#coc-description").innerHTML = account.descriptor || "";
    document.querySelector("#coc-townhall").textContent = account.townHall;
    const leagueIcon = document.querySelector("#coc-league-icon");
    const leagueName = account.leagueTier?.name || "Unranked";
    const leagueIconUrl = account.leagueTier?.iconUrls?.large || account.leagueTier?.iconUrls?.small || "";
    document.querySelector("#coc-league-name").textContent = leagueName;
    leagueIcon.src = leagueIconUrl;
    leagueIcon.hidden = !leagueIconUrl;
    document.querySelector("#coc-trophies").textContent = number(account.trophies);
    document.querySelector("#coc-legacy-best").textContent = number(account.bestTrophies);

    renderRankedHistory(account);
    renderMiniCharts("#coc-achievement-graphs", account, achievementMetrics);
    renderMiniCharts("#coc-upgrade-graphs", account, progressMetrics, percent);
    renderPlacements(account.placements);
  };

  tabsRoot.innerHTML = cocAccounts.map((account, index) => `
    <button type="button" role="tab" data-account="${account.id}" aria-selected="${index === 0}">
      <strong>${account.name} <em>(TH${account.townHall})</em></strong>
      ${account.tabDescriptor ? `<span>${account.tabDescriptor}</span>` : ""}
    </button>`).join("");

  tabsRoot.addEventListener("click", (event) => {
    const button = event.target.closest("button[data-account]");
    if (!button) return;
    const account = cocAccounts.find(item => item.id === button.dataset.account);
    if (account) renderAccount(account);
  });

  renderWeeklySummary();
  renderAccount(cocAccounts[0]);
}
