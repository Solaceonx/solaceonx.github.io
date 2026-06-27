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
    { key: "attacksWon", label: "Attacks won", color: cocPalette.green, note: "Lifetime multiplayer wins" },
    { key: "donations", label: "Donations", color: cocPalette.gold, note: "Lifetime donations" },
    { key: "warStars", label: "War stars", color: cocPalette.green, note: "Lifetime war stars" },
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
        ${options.labels === false ? "" : plotted.map(point => `<text x="${point.x}" y="${height - 8}" text-anchor="middle">${point.label}</text>`).join("")}
      </svg>`;
  };

  const renderRankedHistory = (account) => {
    const rows = account.rankedHistory || [];
    const chartPoints = rows
      .map(row => ({ label: row.label, value: row.endingTrophies }))
      .filter(point => typeof point.value === "number" && Number.isFinite(point.value));
    const chart = renderSvgChart(
      chartPoints,
      { key: "rankedTrophies", label: "Ending trophies", color: cocPalette.gold },
      { width: 760, height: 220, pad: 34, yLabelWidth: 54, dot: 4, formatter: number }
    );

    document.querySelector("#coc-league-season").innerHTML = rows.length
      ? `
        <div class="ranked-table" role="table" aria-label="Ranked battle weekly history">
          <div class="ranked-row ranked-row-head" role="row">
            <span>Week</span>
            <span>League</span>
            <span>Finish</span>
            <span>Ending trophies</span>
            <span>Result</span>
          </div>
          ${rows.slice().reverse().map(row => `
            <div class="ranked-row" role="row">
              <span>${row.label}</span>
              <span>${row.league}</span>
              <span>${row.finish ? `${number(row.finish)}${ordinalSuffix(row.finish)}` : "—"}</span>
              <span>${number(row.endingTrophies)}</span>
              <span>${row.result}</span>
            </div>`).join("")}
        </div>
        <div class="ranked-chart">
          <div class="mini-chart-head">
            <div><h4>Ending trophies</h4></div>
            <strong>${number(rows.at(-1)?.endingTrophies)}</strong>
          </div>
          <div class="line-chart">${chart}</div>
        </div>`
      : '<div class="tracker-empty">Run the updater to start ranked battle history.</div>';
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
    root.innerHTML = metrics.map(metric => {
      const points = metricPoints(account, metric);
      const latest = points.at(-1)?.value;
      const first = points[0]?.value;
      const delta = latest != null && first != null && points.length > 1 ? latest - first : null;
      const deltaLabel = delta == null ? "First snapshot" : `${delta >= 0 ? "+" : ""}${formatter(delta)} since first snapshot`;

      return `
        <article class="mini-chart-card">
          <div class="mini-chart-head">
            <div>
              <h4>${metric.label}</h4>
            </div>
            <strong>${formatter(latest)}</strong>
          </div>
          <div class="mini-chart">${renderSvgChart(points, metric, { width: 320, height: 146, pad: 18, yLabelWidth: 48, dot: 3, labels: true, formatter })}</div>
        </article>`;
    }).join("");
  };

  const renderPlacements = (placements) => {
    document.querySelector("#coc-placements").innerHTML = placements.length
      ? `<ul class="placement-bullets">${placements.map(item => `
          <li><strong>#${number(item.rank)}</strong> ${item.label}${item.date ? ` <span>(${item.date})</span>` : ""}</li>
        `).join("")}</ul>`
      : "<div class=\"tracker-empty\">Add notable finishes for this account.</div>";
  };

  const weeklyDelta = (account, key) => {
    const points = account.history || [];
    const latest = points.at(-1)?.[key] ?? 0;
    if (points.length <= 1) return latest;
    return latest - (points[0]?.[key] ?? latest);
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
      value: cocAccounts.reduce((sum, account) => sum + weeklyDelta(account, item.key), 0)
    }));

    root.innerHTML = rows.map(item => `
      <article class="weekly-summary-card">
        <span>${item.label}</span>
        <strong>${number(item.value)}</strong>
        <small>all accounts since first snapshot</small>
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
      <span>${account.tabDescriptor || account.descriptor}</span>
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
