(function () {
  "use strict";

  const AQI_SCALE = [
    { key: "green",  min: 0,   max: 50,  label: "Good",                         color: "--aqi-green",
      desc: "Air quality is satisfactory and poses little or no risk." },
    { key: "yellow", min: 51,  max: 100, label: "Satisfactory",                 color: "--aqi-yellow",
      desc: "Acceptable air quality, though a few pollutants may be a concern for unusually sensitive people." },
    { key: "orange", min: 101, max: 150, label: "Moderate",                     color: "--aqi-orange",
      desc: "Sensitive groups may start to experience mild respiratory discomfort." },
    { key: "red",    min: 151, max: 200, label: "Poor",                         color: "--aqi-red",
      desc: "Everyone may begin to experience breathing discomfort on prolonged exposure." },
    { key: "purple", min: 201, max: 300, label: "Very Poor",                    color: "--aqi-purple",
      desc: "Breathing discomfort on prolonged exposure for most people. Limit outdoor activity." },
    { key: "maroon", min: 301, max: Infinity, label: "Severe",                  color: "--aqi-maroon",
      desc: "Affects healthy people and seriously impacts those with existing conditions. Stay indoors." }
  ];

  const POLLUTANTS = ["PM2.5", "PM10", "NO2", "O3", "CO"];
  const COMPASS_16 = ["N","NNE","NE","ENE","E","ESE","SE","SSE","S","SSW","SW","WSW","W","WNW","NW","NNW"];

  const root = document.documentElement;
  const rootStyles = getComputedStyle(root);

  function categoryFor(value) {
    return AQI_SCALE.find(c => value >= c.min && value <= c.max) || AQI_SCALE[AQI_SCALE.length - 1];
  }

  function hexOf(cssVarName) {
    return rootStyles.getPropertyValue(cssVarName).trim();
  }

  function hexToRgba(hex, alpha) {
    const h = hex.replace("#", "");
    const r = parseInt(h.substring(0, 2), 16);
    const g = parseInt(h.substring(2, 4), 16);
    const b = parseInt(h.substring(4, 6), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }

  function ordinalSuffix(n) {
    const rem100 = n % 100;
    if (rem100 >= 11 && rem100 <= 13) return n + "th";
    switch (n % 10) {
      case 1: return n + "st";
      case 2: return n + "nd";
      case 3: return n + "rd";
      default: return n + "th";
    }
  }

  const SHORT_MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sept", "Oct", "Nov", "Dec"];

  function formatShortDate(date) {
    const day = ordinalSuffix(date.getDate());
    const month = SHORT_MONTHS[date.getMonth()];
    return `${day} ${month}, ${date.getFullYear()}`;
  }

  const themeToggle = document.getElementById("themeToggle");
  const iconSun = document.getElementById("themeIconSun");
  const iconMoon = document.getElementById("themeIconMoon");

  function applyTheme(theme) {
    root.setAttribute("data-theme", theme);
    const isDark = theme === "dark";
    themeToggle.setAttribute("aria-pressed", String(isDark));
    themeToggle.setAttribute("aria-label", isDark ? "Switch to light mode" : "Switch to dark mode");
    iconSun.style.display = isDark ? "none" : "block";
    iconMoon.style.display = isDark ? "block" : "none";
  }

  function initTheme() {
    const prefersDark = window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches;
    applyTheme(prefersDark ? "dark" : "light");
  }

  themeToggle.addEventListener("click", () => {
    const next = root.getAttribute("data-theme") === "dark" ? "light" : "dark";
    applyTheme(next);
  });

  initTheme();

  function setAccent(category) {
    const hex = hexOf(category.color);
    root.style.setProperty("--accent", hex);
    root.style.setProperty("--accent-soft", hexToRgba(hex, 0.14));
  }

  const scaleBarsEl = document.getElementById("scaleBars");
  const BAR_MIN_HEIGHT = 46;
  const BAR_MAX_HEIGHT = 196;

  function barHeightFor(index, total) {
    const t = index / (total - 1);
    const eased = Math.pow(t, 1.65);
    return BAR_MIN_HEIGHT + (BAR_MAX_HEIGHT - BAR_MIN_HEIGHT) * eased;
  }

  function buildScaleBars() {
    scaleBarsEl.innerHTML = "";
    AQI_SCALE.forEach((cat, i) => {
      const bar = document.createElement("div");
      bar.className = "scale_bar";
      bar.dataset.key = cat.key;

      const label = document.createElement("span");
      label.className = "scale_bar_label";
      label.textContent = cat.label;

      const column = document.createElement("div");
      column.className = "scale_bar_column";
      column.style.background = hexOf(cat.color);
      column.style.height = barHeightFor(i, AQI_SCALE.length) + "px";

      const range = document.createElement("span");
      range.className = "scale_bar_range";
      range.textContent = cat.max === Infinity ? `${cat.min}+` : `${cat.min}-${cat.max}`;

      bar.append(label, column, range);
      scaleBarsEl.appendChild(bar);
    });
  }

  function updateScaleBars(category) {
    [...scaleBarsEl.children].forEach(bar => {
      bar.classList.toggle("is_active", bar.dataset.key === category.key);
    });
  }

  buildScaleBars();

  const historyTableBody = document.getElementById("historyTableBody");
  const historyTempHeader = document.getElementById("historyTempHeader");
  const HISTORY_DAYS = 3;
  let historyData = [];

  async function buildHistoryData() {
    const res = await fetch(`/api/history?days=${HISTORY_DAYS}`);
    if (!res.ok) throw new Error("history fetch failed");
    const data = await res.json();
    historyData = data.map(d => ({ date: new Date(d.date), aqi: d.aqi, tempC: d.tempC }));
  }

  function renderHistoryTable() {
    historyTempHeader.textContent = `Temperature (${unitSymbol(activeUnit)})`;
    historyTableBody.innerHTML = "";
    historyData.forEach(entry => {
      const tr = document.createElement("tr");

      const dateTd = document.createElement("td");
      dateTd.className = "history_date";
      dateTd.textContent = formatShortDate(entry.date);

      const aqiTd = document.createElement("td");
      aqiTd.className = "history_aqi";
      const category = categoryFor(entry.aqi);
      const inner = document.createElement("span");
      inner.className = "history_aqi_inner";
      const dot = document.createElement("span");
      dot.className = "history_dot";
      dot.style.background = hexOf(category.color);
      inner.append(dot, document.createTextNode(String(entry.aqi)));
      aqiTd.appendChild(inner);

      const tempTd = document.createElement("td");
      tempTd.className = "history_temp";
      tempTd.textContent = `${Math.round(convertTemp(entry.tempC, activeUnit))}${unitSymbol(activeUnit)}`;

      tr.append(dateTd, aqiTd, tempTd);
      historyTableBody.appendChild(tr);
    });
  }

  const aqiNumberEl = document.getElementById("aqiNumber");
  let currentDisplayed = 0;

  function animateNumber(target, duration = 700) {
    const start = currentDisplayed;
    const startTime = performance.now();
    function tick(now) {
      const t = Math.min(1, (now - startTime) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      const value = Math.round(start + (target - start) * eased);
      aqiNumberEl.textContent = value;
      if (t < 1) requestAnimationFrame(tick);
      else currentDisplayed = target;
    }
    requestAnimationFrame(tick);
  }

  const thermoFill = document.getElementById("thermoFill");
  const thermoBulb = document.getElementById("thermoBulb");
  const tempValueEl = document.getElementById("tempValue");
  const tempUnitLabelEl = document.getElementById("tempUnitLabel");
  const feelsLikeEl = document.getElementById("feelsLike");
  const tempUnitSwitch = document.getElementById("tempUnitSwitch");

  const TUBE_TOP_Y = 24;
  const TUBE_BOTTOM_Y = 150;
  const TEMP_MIN_C = -5;
  const TEMP_MAX_C = 48;

  const TEMP_COLOR_COLD = { r: 0x2E, g: 0x7D, b: 0xE1 };
  const TEMP_COLOR_MID  = { r: 0xE8, g: 0xB9, b: 0x23 };
  const TEMP_COLOR_HOT  = { r: 0xE5, g: 0x42, b: 0x3C };

  let currentTempC = 25;
  let currentFeelsC = 25;
  let activeUnit = "C";

  function convertTemp(celsius, unit) {
    if (unit === "F") return celsius * 9 / 5 + 32;
    if (unit === "K") return celsius + 273.15;
    return celsius;
  }
  function unitSymbol(unit) {
    return unit === "K" ? "K" : `°${unit}`;
  }

  function lerp(a, b, t) { return a + (b - a) * t; }

  function tempColorFor(pct) {
    let c1, c2, localT;
    if (pct <= 0.5) {
      c1 = TEMP_COLOR_COLD; c2 = TEMP_COLOR_MID; localT = pct / 0.5;
    } else {
      c1 = TEMP_COLOR_MID; c2 = TEMP_COLOR_HOT; localT = (pct - 0.5) / 0.5;
    }
    const r = Math.round(lerp(c1.r, c2.r, localT));
    const g = Math.round(lerp(c1.g, c2.g, localT));
    const b = Math.round(lerp(c1.b, c2.b, localT));
    return `rgb(${r}, ${g}, ${b})`;
  }

  function renderThermometer() {
    const clamped = Math.max(TEMP_MIN_C, Math.min(TEMP_MAX_C, currentTempC));
    const pct = (clamped - TEMP_MIN_C) / (TEMP_MAX_C - TEMP_MIN_C);
    const fillHeight = (TUBE_BOTTOM_Y - TUBE_TOP_Y) * pct;
    const fillY = TUBE_BOTTOM_Y - fillHeight;
    thermoFill.setAttribute("y", fillY.toFixed(1));
    thermoFill.setAttribute("height", fillHeight.toFixed(1));

    const displayTemp = convertTemp(currentTempC, activeUnit);
    const displayFeels = convertTemp(currentFeelsC, activeUnit);
    tempValueEl.textContent = Math.round(displayTemp);
    tempUnitLabelEl.textContent = unitSymbol(activeUnit);
    feelsLikeEl.textContent = `${Math.round(displayFeels)}${unitSymbol(activeUnit)}`;

    const tempHex = tempColorFor(pct);
    thermoFill.style.fill = tempHex;
    thermoBulb.style.fill = tempHex;
  }

  tempUnitSwitch.addEventListener("click", (e) => {
    const btn = e.target.closest(".unit_btn");
    if (!btn) return;
    activeUnit = btn.dataset.unit;
    [...tempUnitSwitch.children].forEach(c => c.classList.toggle("is_active", c === btn));
    renderThermometer();
    renderHistoryTable();
  });

  const windNeedle = document.getElementById("windNeedle");
  const windSpeedEl = document.getElementById("windSpeed");
  const windDirEl = document.getElementById("windDir");

  function compassLabel(deg) {
    const idx = Math.round(deg / 22.5) % 16;
    return COMPASS_16[idx];
  }

  function renderWind(speedKmh, directionDeg) {
    windSpeedEl.textContent = Math.round(speedKmh);
    windDirEl.textContent = compassLabel(directionDeg);
    windNeedle.style.transform = `rotate(${directionDeg + 180}deg)`;
  }

  async function getCurrentReading() {
    const res = await fetch("/api/current");
    if (!res.ok) throw new Error("current fetch failed");
    return res.json();
  }

  const aqiCategoryEl = document.getElementById("aqiCategory");
  const aqiPollutantEl = document.getElementById("aqiPollutant");
  const aqiDescriptionEl = document.getElementById("aqiDescription");
  const lastUpdatedEl = document.getElementById("lastUpdated");

  let liveReading = null;

  function renderCurrent(reading, opts) {
    opts = opts || {};
    const category = categoryFor(reading.aqi);
    setAccent(category);
    updateScaleBars(category);
    animateNumber(reading.aqi);
    aqiCategoryEl.textContent = category.label;
    aqiPollutantEl.textContent = reading.pollutant;
    aqiDescriptionEl.textContent = category.desc;

    currentTempC = reading.tempC;
    currentFeelsC = reading.feelsC;
    renderThermometer();
    renderWind(reading.windSpeed, reading.windDir);

    if (opts.preview) {
      lastUpdatedEl.textContent = opts.previewLabel;
    } else {
      const now = new Date();
      lastUpdatedEl.textContent = "Updated at " + now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    }
  }

  const timelineEl = document.getElementById("timeline");
  const timelineScrollEl = document.getElementById("timelineScroll");
  const timelineTrack = document.getElementById("timelineTrack");
  const timelineLabels = document.getElementById("timelineLabels");
  const timelineLine = document.getElementById("timelineLine");
  const timelineGrid = document.getElementById("timelineGrid");
  const timelineGridV = document.getElementById("timelineGridV");
  const timelineYAxis = document.getElementById("timelineYAxis");
  const timelineHoverBar = document.getElementById("timelineHoverBar");
  const forecastSwitch = document.getElementById("forecastSwitch");
  const forecastHint = document.getElementById("forecastHint");
  const SCALE_MAX = 700;
  const GRID_STEPS = [0, 100, 200, 300, 400, 500, 600, 700];
  const PX_PER_POINT = 34;

  const RANGE_LABELS = {
    next24: "the next 24 hours",
    next72: "the next 72 hours"
  };

  function buildYAxisAndGrid() {
    timelineYAxis.innerHTML = "";
    timelineGrid.innerHTML = "";
    GRID_STEPS.forEach(value => {
      const bottomPct = (value / SCALE_MAX) * 100;

      const label = document.createElement("span");
      label.style.bottom = bottomPct + "%";
      label.textContent = value;
      timelineYAxis.appendChild(label);

      const line = document.createElement("span");
      line.style.bottom = bottomPct + "%";
      timelineGrid.appendChild(line);
    });
  }

  function pointFrom(d) {
    const date = new Date(d.datetime);
    return {
      aqi: d.aqi,
      label: String(d.hoursFromNow).padStart(2, "0"),
      fullLabel: date.toLocaleDateString([], { weekday: "long", month: "short", day: "numeric" }) +
        ", " + date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }),
      tempC: d.tempC,
      feelsC: d.tempC,
      windSpeed: d.windSpeed,
      windDir: d.windDir,
      pollutant: d.pollutant
    };
  }

  async function buildForecast(range) {
    const hours = range === "next72" ? 72 : 24;
    const res = await fetch(`/api/forecast?hours=${hours}`);
    if (!res.ok) throw new Error("forecast fetch failed");
    const data = await res.json();
    return data.map(pointFrom);
  }

  function renderTimeline(points) {
    timelineTrack.innerHTML = "";
    timelineLabels.innerHTML = "";
    timelineGridV.innerHTML = "";
    const ns = "http://www.w3.org/2000/svg";
    timelineLine.setAttribute("viewBox", "0 0 100 100");
    timelineLine.innerHTML = "";

    const isFit = currentRange === "next24";
    if (isFit) {
      timelineEl.style.width = "100%";
      timelineEl.style.minWidth = "100%";
    } else {
      timelineEl.style.width = "";
      timelineEl.style.minWidth = Math.max(720, points.length * PX_PER_POINT) + "px";
    }
    timelineScrollEl.classList.toggle("no_scroll", isFit);

    const H_PAD = 3;
    const coords = points.map((p, i) => {
      const x = points.length === 1 ? 50 : H_PAD + (i / (points.length - 1)) * (100 - 2 * H_PAD);
      const y = 100 - (Math.min(SCALE_MAX, p.aqi) / SCALE_MAX) * 100;
      return { x, y };
    });

    const polyline = document.createElementNS(ns, "polyline");
    polyline.setAttribute("points", coords.map(c => `${c.x},${c.y}`).join(" "));
    polyline.setAttribute("fill", "none");
    polyline.setAttribute("stroke", "currentColor");
    polyline.setAttribute("stroke-width", "0.6");
    polyline.setAttribute("vector-effect", "non-scaling-stroke");
    polyline.style.color = "var(--border-strong)";
    timelineLine.appendChild(polyline);

    coords.forEach(({ x }) => {
      const vLine = document.createElement("span");
      vLine.style.left = x + "%";
      timelineGridV.appendChild(vLine);
    });

    points.forEach((p, i) => {
      const category = categoryFor(p.aqi);
      const { x, y } = coords[i];
      const hex = hexOf(category.color);
      const heightPct = 100 - y;

      const valueTag = document.createElement("span");
      valueTag.className = "timeline_value";
      valueTag.style.left = x + "%";
      valueTag.style.bottom = heightPct + "%";
      valueTag.innerHTML =
        `<strong class="tv_aqi">${p.aqi}</strong>` +
        `<span class="tv_sub">${category.label} · ${Math.round(convertTemp(p.tempC, activeUnit))}${unitSymbol(activeUnit)}</span>`;

      const dot = document.createElement("button");
      dot.type = "button";
      dot.className = "timeline_point";
      dot.style.left = x + "%";
      dot.style.bottom = heightPct + "%";
      dot.style.background = hex;
      dot.setAttribute("aria-label", `${p.fullLabel}: AQI ${p.aqi}, ${category.label}`);
      dot.addEventListener("click", () => selectPoint(p, i, dot));
      dot.addEventListener("mouseenter", () => showHoverBar(x, heightPct, hex, valueTag));
      dot.addEventListener("focus", () => showHoverBar(x, heightPct, hex, valueTag));
      dot.addEventListener("mouseleave", () => hideHoverBar(valueTag));
      dot.addEventListener("blur", () => hideHoverBar(valueTag));

      const labelTag = document.createElement("span");
      labelTag.className = "timeline_label";
      labelTag.textContent = p.label;
      labelTag.style.left = x + "%";

      timelineTrack.appendChild(valueTag);
      timelineTrack.appendChild(dot);
      timelineLabels.appendChild(labelTag);
    });
  }

  function showHoverBar(xPct, heightPct, hex, valueTag) {
    timelineHoverBar.style.left = xPct + "%";
    timelineHoverBar.style.height = heightPct + "%";
    timelineHoverBar.style.background = hex;
    timelineHoverBar.classList.add("is_visible");
    if (valueTag) valueTag.classList.add("is_visible");
  }

  function hideHoverBar(valueTag) {
    timelineHoverBar.classList.remove("is_visible");
    if (valueTag) valueTag.classList.remove("is_visible");
  }

  function selectPoint(point, index, dotEl) {
    [...timelineTrack.querySelectorAll(".timeline_point")].forEach(d => d.classList.remove("is_selected"));
    dotEl.classList.add("is_selected");
    renderCurrent(
      {
        aqi: point.aqi,
        pollutant: point.pollutant,
        tempC: point.tempC,
        feelsC: point.feelsC,
        windSpeed: point.windSpeed,
        windDir: point.windDir
      },
      { preview: true, previewLabel: `Previewing ${point.fullLabel}` }
    );
    forecastHint.textContent = `Showing the forecast for ${point.fullLabel}. Select "Now" or reload to return to live conditions.`;
  }

  let currentRange = "next24";
  let lastForecastPoints = [];

  async function refreshTimeline(range) {
    lastForecastPoints = await buildForecast(range);
    renderTimeline(lastForecastPoints);
  }

  forecastSwitch.addEventListener("click", async (e) => {
    const btn = e.target.closest(".range_btn");
    if (!btn) return;
    currentRange = btn.dataset.range;
    [...forecastSwitch.children].forEach(c => c.classList.toggle("is_active", c === btn));
    await refreshTimeline(currentRange);
    forecastHint.textContent = `Showing the forecast for ${RANGE_LABELS[currentRange]}. Hover or select a point to preview that reading.`;
  });

  const SYNC_INTERVAL_MS = 5 * 60 * 1000; // re-poll the API every 5 minutes

  async function syncLive() {
    liveReading = await getCurrentReading();
    renderCurrent(liveReading);
    await buildHistoryData();
    renderHistoryTable();
    await refreshTimeline(currentRange);
  }

  async function init() {
    buildYAxisAndGrid();
    await syncLive();

    window.addEventListener("resize", () => {
      renderTimeline(lastForecastPoints);
    });

    setInterval(syncLive, SYNC_INTERVAL_MS);
  }

  init();
})();
