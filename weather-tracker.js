{
  const data = window.WEATHER_DATA;

  if (!data?.snapshots?.length) {
    document.body.innerHTML = "<main style='padding:3rem;font-family:system-ui'>Weather data is missing.</main>";
    throw new Error("Missing WEATHER_DATA");
  }

  const $ = selector => document.querySelector(selector);
  const percent = value => value == null ? "—" : `${Math.round(value * 100)}%`;
  const money = value => value == null ? "—" : new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2
  }).format(value);
  const cents = value => value == null ? "—" : `${Math.round(value * 100)}¢`;
  const dateLabel = value => new Date(/^\d{4}-\d{2}-\d{2}$/.test(value) ? `${value}T12:00:00` : value)
    .toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  const timeLabel = value => new Date(value).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: "short"
  });
  const escapeHtml = value => String(value ?? "").replace(/[&<>"']/g, character => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#039;"
  })[character]);

  const palette = {
    night: "#071313",
    paper: "#eef0e8",
    muted: "#768983",
    grid: "rgba(154,171,165,.20)",
    lime: "#c8ff3d",
    aqua: "#50dfcc",
    coral: "#ff765c"
  };

  const prepareCanvas = canvas => {
    const ratio = Math.min(window.devicePixelRatio || 1, 2);
    const rect = canvas.getBoundingClientRect();
    canvas.width = Math.round(rect.width * ratio);
    canvas.height = Math.round(rect.height * ratio);
    const context = canvas.getContext("2d");
    context.setTransform(ratio, 0, 0, ratio, 0, 0);
    context.clearRect(0, 0, rect.width, rect.height);
    return { context, width: rect.width, height: rect.height };
  };

  const drawAxes = (context, width, height, options = {}) => {
    const pad = options.pad || { top: 22, right: 18, bottom: 40, left: 48 };
    const chartWidth = width - pad.left - pad.right;
    const chartHeight = height - pad.top - pad.bottom;
    context.save();
    context.font = "10px 'DM Mono', monospace";
    context.fillStyle = palette.muted;
    context.strokeStyle = palette.grid;
    context.lineWidth = 1;
    for (let index = 0; index <= 4; index += 1) {
      const y = pad.top + chartHeight * index / 4;
      const value = options.maxY * (1 - index / 4);
      context.beginPath();
      context.moveTo(pad.left, y);
      context.lineTo(width - pad.right, y);
      context.stroke();
      context.textAlign = "right";
      context.textBaseline = "middle";
      context.fillText(options.yFormatter(value), pad.left - 9, y);
    }
    context.restore();
    return { pad, chartWidth, chartHeight };
  };

  const drawDistribution = snapshot => {
    const canvas = $("#distribution-chart");
    const { context, width, height } = prepareCanvas(canvas);
    const maxProbability = Math.max(...snapshot.distribution.map(item => item.probability), .3);
    const { pad, chartWidth, chartHeight } = drawAxes(context, width, height, {
      maxY: maxProbability,
      yFormatter: value => `${Math.round(value * 100)}%`
    });
    const slot = chartWidth / snapshot.distribution.length;
    const barWidth = Math.max(8, slot * .62);

    const focusStrike = snapshot.focusStrike ?? snapshot.thresholds[Math.floor(snapshot.thresholds.length / 2)]?.strike;
    snapshot.distribution.forEach((item, index) => {
      const x = pad.left + slot * index + (slot - barWidth) / 2;
      const barHeight = item.probability / maxProbability * chartHeight;
      const y = pad.top + chartHeight - barHeight;
      context.fillStyle = item.temperatureF > focusStrike ? palette.lime : "rgba(80,223,204,.62)";
      context.fillRect(x, y, barWidth, barHeight);
      context.fillStyle = palette.muted;
      context.font = "10px 'DM Mono', monospace";
      context.textAlign = "center";
      context.textBaseline = "top";
      context.fillText(item.label, x + barWidth / 2, height - pad.bottom + 12);
      if (item.probability >= .025) {
        context.fillStyle = palette.paper;
        context.textBaseline = "bottom";
        context.fillText(`${Math.round(item.probability * 100)}%`, x + barWidth / 2, y - 7);
      }
    });

    const firstWinningIndex = snapshot.distribution.findIndex(item => item.temperatureF > focusStrike);
    const splitX = pad.left + slot * (firstWinningIndex < 0 ? snapshot.distribution.length : firstWinningIndex);
    const focusProbability = snapshot.thresholds.find(item => item.strike === focusStrike)?.modelProbability;
    context.save();
    context.strokeStyle = palette.lime;
    context.setLineDash([4, 5]);
    context.beginPath();
    context.moveTo(splitX, pad.top);
    context.lineTo(splitX, pad.top + chartHeight);
    context.stroke();
    context.fillStyle = palette.lime;
    context.font = "10px 'DM Mono', monospace";
    context.textAlign = "left";
    context.fillText(`YES >${focusStrike}: ${percent(focusProbability)}`, Math.min(splitX + 7, width - pad.right - 112), pad.top + 12);
    context.restore();
    canvas.setAttribute("aria-label", `Forecast distribution. Median ${snapshot.predictedMedianF} degrees Fahrenheit and ${percent(focusProbability)} chance of exceeding ${focusStrike}.`);
  };

  const drawThresholds = snapshot => {
    const canvas = $("#threshold-chart");
    const { context, width, height } = prepareCanvas(canvas);
    const { pad, chartWidth, chartHeight } = drawAxes(context, width, height, {
      maxY: 1,
      yFormatter: value => `${Math.round(value * 100)}%`
    });
    const points = snapshot.thresholds;
    const xAt = index => pad.left + (points.length === 1 ? chartWidth / 2 : chartWidth * index / (points.length - 1));
    const yAt = value => pad.top + chartHeight * (1 - value);

    context.font = "10px 'DM Mono', monospace";
    context.textAlign = "center";
    context.textBaseline = "top";
    context.fillStyle = palette.muted;
    points.forEach((item, index) => context.fillText(`>${item.strike}`, xAt(index), height - pad.bottom + 12));

    const drawSeries = (key, color) => {
      context.strokeStyle = color;
      context.fillStyle = color;
      context.lineWidth = 2.5;
      context.beginPath();
      let started = false;
      points.forEach((item, index) => {
        const value = item[key];
        if (value == null) { started = false; return; }
        const x = xAt(index);
        const y = yAt(value);
        if (!started) context.moveTo(x, y); else context.lineTo(x, y);
        started = true;
      });
      context.stroke();
      points.forEach((item, index) => {
        if (item[key] == null) return;
        context.beginPath();
        context.arc(xAt(index), yAt(item[key]), 4, 0, Math.PI * 2);
        context.fill();
      });
    };
    drawSeries("marketMidpoint", palette.coral);
    drawSeries("modelProbability", palette.lime);
    canvas.setAttribute("aria-label", "Line chart comparing model and market probabilities across temperature thresholds.");
  };

  const markedPnl = snapshot => {
    const position = snapshot.position;
    if (!position) return 0;
    if (snapshot.outcome?.realizedPnl != null) return snapshot.outcome.realizedPnl;
    return (position.estimatedExitNet ?? position.quantity * position.sellBid) - position.totalCost;
  };

  const drawHistory = snapshots => {
    const canvas = $("#history-chart");
    const { context, width, height } = prepareCanvas(canvas);
    const values = snapshots.map(markedPnl);
    const bound = Math.max(1, ...values.map(value => Math.abs(value)));
    const pad = { top: 22, right: 18, bottom: 42, left: 50 };
    const chartWidth = width - pad.left - pad.right;
    const chartHeight = height - pad.top - pad.bottom;
    const xAt = index => pad.left + (values.length === 1 ? chartWidth / 2 : chartWidth * index / (values.length - 1));
    const yAt = value => pad.top + chartHeight / 2 - value / bound * chartHeight * .42;

    context.font = "10px 'DM Mono', monospace";
    context.strokeStyle = palette.grid;
    context.fillStyle = palette.muted;
    context.textBaseline = "middle";
    [-bound, 0, bound].forEach(value => {
      const y = yAt(value);
      context.beginPath(); context.moveTo(pad.left, y); context.lineTo(width - pad.right, y); context.stroke();
      context.textAlign = "right"; context.fillText(money(value), pad.left - 8, y);
    });
    context.strokeStyle = palette.aqua;
    context.lineWidth = 2.5;
    context.beginPath();
    values.forEach((value, index) => index ? context.lineTo(xAt(index), yAt(value)) : context.moveTo(xAt(index), yAt(value)));
    context.stroke();
    values.forEach((value, index) => {
      context.fillStyle = value >= 0 ? palette.lime : palette.coral;
      context.beginPath(); context.arc(xAt(index), yAt(value), 5, 0, Math.PI * 2); context.fill();
      context.fillStyle = palette.muted; context.textAlign = "center"; context.textBaseline = "top";
      context.fillText(new Date(snapshots[index].eventDate + "T12:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" }), xAt(index), height - pad.bottom + 14);
    });
    canvas.setAttribute("aria-label", `Tracked marked or realized profit and loss across ${snapshots.length} snapshots.`);
  };

  const renderTable = snapshot => {
    $("#threshold-table").innerHTML = snapshot.thresholds.map(item => {
      const edge = item.marketMidpoint == null ? null : item.modelProbability - item.marketMidpoint;
      return `<tr>
        <td>YES &gt;${item.strike}°F</td>
        <td>${percent(item.modelProbability)}</td>
        <td>${percent(item.marketMidpoint)}</td>
        <td class="${edge == null ? "" : edge >= 0 ? "edge-positive" : "edge-negative"}">${edge == null ? "—" : `${edge >= 0 ? "+" : ""}${Math.round(edge * 100)} pts`}</td>
        <td>${cents(item.yesAsk)}</td>
      </tr>`;
    }).join("");
  };

  const renderHistorySummary = () => {
    const snapshots = data.snapshots;
    const eventDays = new Set(snapshots.map(item => item.eventDate)).size;
    const settled = snapshots.filter(item => item.outcome?.realizedPnl != null);
    const realized = settled.reduce((sum, item) => sum + item.outcome.realizedPnl, 0);
    const openRisk = snapshots.filter(item => item.position?.status === "open").reduce((sum, item) => sum + item.position.totalCost, 0);
    $("#history-summary").innerHTML = [
      ["Event days", eventDays],
      ["Settled", settled.length],
      ["Realized P&L", money(realized)],
      ["Open cost", money(openRisk)]
    ].map(([label, value]) => `<article><span>${label}</span><strong>${value}</strong></article>`).join("");
  };

  const renderLog = () => {
    $("#snapshot-log").innerHTML = [...data.snapshots].reverse().map(snapshot => {
      const focusStrike = snapshot.focusStrike ?? snapshot.thresholds[Math.floor(snapshot.thresholds.length / 2)]?.strike;
      const focusProbability = snapshot.thresholds.find(item => item.strike === focusStrike)?.modelProbability;
      const status = snapshot.outcome ? `Settled ${snapshot.outcome.officialHighF}°F` : snapshot.position?.status || "forecast";
      return `<article class="log-entry">
        <time datetime="${escapeHtml(snapshot.observedAt)}">${dateLabel(snapshot.eventDate)}<br>${timeLabel(snapshot.observedAt)}</time>
        <div><h3>${escapeHtml(snapshot.station)} median ${snapshot.predictedMedianF}°F · P(&gt;${focusStrike}) ${percent(focusProbability)}</h3><p>${escapeHtml(snapshot.notes || "Forecast snapshot")}</p></div>
        <span class="log-entry-status">${escapeHtml(status)}</span>
      </article>`;
    }).join("");
  };

  const renderSnapshot = snapshot => {
    const focusStrike = snapshot.focusStrike ?? snapshot.thresholds[Math.floor(snapshot.thresholds.length / 2)]?.strike;
    const focusContract = snapshot.thresholds.find(item => item.strike === focusStrike);
    const position = snapshot.position;
    const positionStrike = position?.strike ?? focusStrike;
    const positionProbability = snapshot.thresholds.find(item => item.strike === positionStrike)?.modelProbability;
    const holdValue = position ? position.quantity * (positionProbability || 0) : null;
    const change = position ? markedPnl(snapshot) : null;

    $("#hero-predicted-high").textContent = `${snapshot.predictedMedianF}°`;
    $("#hero-current-high").textContent = `Current observed max ${snapshot.currentHighF}°F · mean ${snapshot.predictedMeanF.toFixed(1)}°F`;
    $("#metric-station").textContent = snapshot.station;
    $("#metric-probability-label").textContent = `Model P(>${focusStrike})`;
    $("#metric-market-label").textContent = `Market P(>${focusStrike})`;
    $("#metric-probability").textContent = percent(focusContract?.modelProbability);
    $("#metric-market").textContent = percent(focusContract?.marketMidpoint);
    $("#metric-position").textContent = position ? `${position.quantity} × YES` : "None";
    $("#metric-position-note").textContent = position ? position.contract : "no live exposure";
    $("#position-heading").textContent = position
      ? position.status === "settled" ? "Settled position" : "Open position"
      : "No position";
    $("#position-description").textContent = position
      ? `${position.quantity} ${position.contract} contract${position.quantity === 1 ? "" : "s"} recorded with this snapshot.`
      : "No position was logged for this snapshot.";
    $("#threshold-legend").innerHTML = snapshot.thresholds.some(item => item.marketMidpoint != null)
      ? '<i class="model-key"></i>Model <i class="market-key"></i>Market'
      : '<i class="model-key"></i>Model · market quotes not captured';
    $("#decision-action").textContent = snapshot.recommendation?.action || "No model call";
    $("#decision-note").textContent = snapshot.recommendation?.note || "No recommendation was logged for this snapshot.";
    $("#hold-value").textContent = money(holdValue);
    $("#sell-value").textContent = money(position?.estimatedExitNet);
    $("#break-even").textContent = percent(snapshot.recommendation?.breakEvenProbability);

    $("#position-quantity").textContent = position?.quantity ?? "—";
    $("#position-entry").textContent = cents(position?.entryPrice);
    $("#position-fees").textContent = money(position?.fees);
    $("#position-cost").textContent = money(position?.totalCost);
    $("#position-bid").textContent = cents(position?.sellBid);
    $("#position-mark").textContent = money(position?.estimatedExitNet);
    $("#position-pnl").textContent = change == null ? "—" : `${change >= 0 ? "+" : ""}${money(change)}`;
    $("#position-pnl").classList.toggle("positive", change != null && change >= 0);
    $("#footer-updated").textContent = `Updated ${dateLabel(snapshot.observedAt)} · ${timeLabel(snapshot.observedAt)}`;

    drawDistribution(snapshot);
    drawThresholds(snapshot);
    renderTable(snapshot);
  };

  const selector = $("#snapshot-select");
  [...data.snapshots].reverse().forEach(snapshot => {
    const option = document.createElement("option");
    option.value = snapshot.id;
    option.textContent = `${dateLabel(snapshot.eventDate)} · ${timeLabel(snapshot.observedAt)}`;
    selector.append(option);
  });
  selector.addEventListener("change", () => renderSnapshot(data.snapshots.find(item => item.id === selector.value)));

  renderHistorySummary();
  renderLog();
  renderSnapshot(data.snapshots.at(-1));
  drawHistory(data.snapshots);

  let resizeFrame;
  window.addEventListener("resize", () => {
    cancelAnimationFrame(resizeFrame);
    resizeFrame = requestAnimationFrame(() => {
      const selected = data.snapshots.find(item => item.id === selector.value) || data.snapshots.at(-1);
      drawDistribution(selected);
      drawThresholds(selected);
      drawHistory(data.snapshots);
    });
  });
}
