// ---- Layout config ----
const CANVAS_W = 820;
const MARGIN_LEFT = 70;
const MARGIN_RIGHT = 30;

const SALES_TOP = 50;
const SALES_H = 240;
const GAP = 26;
const VISITS_H = 90;
const AXIS_LABELS_H = 30;

const VISITS_TOP = SALES_TOP + SALES_H + GAP;
const CANVAS_H = VISITS_TOP + VISITS_H + AXIS_LABELS_H;

// ---- Colors (keskmine hall + tumepunane/tumehall aktsent) ----
const COLOR_BG = "#5C5C61";        // surface-1, kanvase taust (keskmine hall)
const COLOR_LINE = "#C1443C";        // accent - müügijoon (tumepunane)
const COLOR_MA = "#BEBEC2";          // libisev keskmine - hele neutraalne hall
const COLOR_VISIT = "#3A3A3D";       // külastuse ring - tumehall täidis
const COLOR_VISIT_RING = "#2E2E30"; // külastuse ringi kontuur (tumehall aktsent)
const COLOR_VISIT_TEXT = "#F7F7F8"; // number ringi sees
const COLOR_AXIS = "#85858B";        // border-strong
const COLOR_TEXT = "#F7F7F8";        // text-primary
const COLOR_SUBTEXT = "#D6D6D9";     // text-secondary
const COLOR_GRID = "#74747A";        // border-default

let data;
let customerSelect;
let allMonths = [];
let current;
let hoverIndex = -1;

// Animeeritud üleminek klientide vahetamisel
let anim = null;
let displayedRevenue = null;
let displayedMA = null;
let displayedMax = null;
const TRANSITION_MS = 380;

function easeInOutCubic(t) {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

const MONTH_NAMES_ET = [
  "Jaanuar", "Veebruar", "Märts", "Aprill", "Mai", "Juuni",
  "Juuli", "August", "September", "Oktoober", "November", "Detsember",
];

function preload() {
  data = loadJSON("customers.json");
}

function setup() {
  const holder = document.getElementById("canvas-holder");
  const cnv = createCanvas(CANVAS_W, CANVAS_H);
  cnv.parent(holder);
  textFont("Helvetica");

  buildMonthScale();
  buildOverviewTable();

  customerSelect = createSelect();
  customerSelect.parent(document.getElementById("controls"));
  customerSelect.id("customerSelect");
  data.customers.forEach((c) => customerSelect.option(c.name));
  customerSelect.selected(data.customers[0].name);
  customerSelect.changed(onCustomerChange);

  onCustomerChange();
  noLoop();
}

function onCustomerChange() {
  const name = customerSelect.value();
  const newCustomer = data.customers.find((c) => c.name === name);
  current = newCustomer;
  updateNote();
  updateConclusion();
  startTransition(newCustomer);
}

// Valmistab ette sujuva ülemineku eelmiselt kliendilt uuele
function startTransition(newCustomer) {
  const toRevenue = {};
  newCustomer.monthlySales.forEach((m) => (toRevenue[m.month] = m.revenue));
  const toMA = {};
  computeMovingAverage(newCustomer.monthlySales, 3).forEach((m) => (toMA[m.month] = m.avg));
  const toMax = Math.max(...newCustomer.monthlySales.map((m) => m.revenue)) * 1.15;

  if (!displayedRevenue) {
    // esimene laadimine - ilma animatsioonita
    displayedRevenue = toRevenue;
    displayedMA = toMA;
    displayedMax = toMax;
    anim = null;
    redraw();
    return;
  }

  anim = {
    fromRevenue: displayedRevenue,
    toRevenue,
    fromMA: displayedMA,
    toMA,
    fromMax: displayedMax,
    toMax,
    start: millis(),
    duration: TRANSITION_MS,
  };
  loop();
}

// Väga lihtne, KIRJELDAV (mitte põhjuslik) enne/pärast võrdlus:
// iga külastuse kuu jaoks vaatame 2 kuud enne vs. külastuskuu+järgmine kuu,
// ja keskmistame kõik külastused kokku.
function computeVisitEffect(customer) {
  const monthToRevenue = {};
  customer.monthlySales.forEach((m) => (monthToRevenue[m.month] = m.revenue));

  const visitMonths = Array.from(
    new Set(customer.visits.map((v) => v.date.slice(0, 7)))
  ).sort();

  let deltas = [];
  visitMonths.forEach((vm) => {
    const i = monthIndex(vm);
    if (i < 2 || i + 1 >= allMonths.length) return; // pole piisavalt andmeid ümber

    const beforeMonths = [allMonths[i - 2], allMonths[i - 1]];
    const afterMonths = [allMonths[i], allMonths[i + 1]];

    const beforeVals = beforeMonths.map((m) => monthToRevenue[m]).filter((v) => v !== undefined);
    const afterVals = afterMonths.map((m) => monthToRevenue[m]).filter((v) => v !== undefined);
    if (beforeVals.length === 0 || afterVals.length === 0) return;

    const avgBefore = beforeVals.reduce((a, b) => a + b, 0) / beforeVals.length;
    const avgAfter = afterVals.reduce((a, b) => a + b, 0) / afterVals.length;
    if (avgBefore <= 0) return;

    deltas.push(((avgAfter - avgBefore) / avgBefore) * 100);
  });

  if (deltas.length === 0) return null;
  const avgPct = deltas.reduce((a, b) => a + b, 0) / deltas.length;
  return { avgPct, visitsAnalyzed: deltas.length, totalVisitMonths: visitMonths.length };
}

function updateConclusion() {
  const box = document.getElementById("conclusion");
  const effect = computeVisitEffect(current);

  if (!effect) {
    box.textContent =
      "Selle kliendi kohta pole piisavalt andmeid (enne/pärast kuud), et külastuste ja müügi mustrit kirjeldada.";
    return;
  }

  const pct = effect.avgPct;
  const pctStr = (pct >= 0 ? "+" : "") + pct.toFixed(0) + "%";

  let verdict;
  if (pct >= 10) {
    verdict = `Külastuste järel kasvas müük keskmiselt ${pctStr} — muster viitab võimalikule kasule, kuid ei tõesta, et külastus oli müügikasvu põhjus.`;
  } else if (pct <= -10) {
    verdict = `Külastuste järel müük pigem langes (keskmiselt ${pctStr}) — see ei toeta külastuste kasulikkust, ehkki langus võis olla ka külastuse põhjus, mitte tagajärg.`;
  } else {
    verdict = `Külastuste ja müügi vahel ei ole selget seost näha (keskmine muutus ${pctStr}) — müük kõigub, kuid mitte külastustega selgelt kooskõlas.`;
  }

  box.textContent = `📊 ${verdict} (arvutatud ${effect.visitsAnalyzed}/${effect.totalVisitMonths} külastuskuu põhjal, 2 kuud enne vs. külastuskuu+1)`;
}

function updateNote() {
  const note = document.getElementById("note");
  if (current.synthetic) {
    note.textContent =
      "⚠ See on tehisandmetega näidisklient (" +
      (current.note || "lisatud demo eesmärgil") +
      "). Ei kajasta reaalset äritulemust.";
    note.classList.add("visible");
  } else {
    note.classList.remove("visible");
    note.textContent = "";
  }
}

function buildMonthScale() {
  const set = new Set();
  data.customers.forEach((c) => {
    c.monthlySales.forEach((m) => set.add(m.month));
  });
  allMonths = Array.from(set).sort();
}

function monthIndex(monthStr) {
  return allMonths.indexOf(monthStr);
}

// Aastane trend: viimased 12 kuud vs eelnevad 12 kuud (vajab vähemalt 24 kuud andmeid)
function computeYoYTrend(customer) {
  const sales = customer.monthlySales;
  if (sales.length < 24) return null;
  const last12 = sales.slice(-12);
  const prev12 = sales.slice(-24, -12);
  const sum = (arr) => arr.reduce((a, b) => a + b.revenue, 0);
  const avgPrev = sum(prev12) / 12;
  const avgLast = sum(last12) / 12;
  if (avgPrev <= 0) return null;
  return ((avgLast - avgPrev) / avgPrev) * 100;
}

function computeVisitsPerYear(customer) {
  const sales = customer.monthlySales;
  if (sales.length === 0) return 0;
  const totalVisits = customer.visits.reduce((a, v) => a + v.count, 0);
  return totalVisits / (sales.length / 12);
}

function trendCell(pct) {
  if (pct === null) return '<span class="trend-flat">vähe andmeid</span>';
  const str = (pct >= 0 ? "+" : "") + pct.toFixed(0) + "%";
  if (pct >= 8) return `<span class="trend-badge up">↑</span><span class="trend-up">${str}</span>`;
  if (pct <= -8) return `<span class="trend-badge down">↓</span><span class="trend-down">${str}</span>`;
  return `<span class="trend-flat">→ ${str}</span>`;
}

function verdictCell(customer) {
  const effect = computeVisitEffect(customer);
  if (!effect) return '<span class="trend-flat">vähe andmeid</span>';
  const pct = effect.avgPct;
  if (pct >= 10) return '<span class="trend-up">kasvas külastuste järel</span>';
  if (pct <= -10) return '<span class="trend-down">langes külastuste järel</span>';
  return '<span class="trend-flat">selget seost pole</span>';
}

function buildOverviewTable() {
  const table = document.getElementById("overview");
  let html = `<tr>
    <th>Klient</th>
    <th class="num">Külastusi kokku</th>
    <th class="num">Külastusi/aasta</th>
    <th>Aastane müügitrend</th>
    <th>Külastusjärgne muster</th>
  </tr>`;

  data.customers.forEach((c) => {
    const totalVisits = c.visits.reduce((a, v) => a + v.count, 0);
    const perYear = computeVisitsPerYear(c).toFixed(1);
    const yoy = trendCell(computeYoYTrend(c));
    const verdict = verdictCell(c);
    const label = c.synthetic ? c.name + " ⚠" : c.name;
    html += `<tr>
      <td>${label}</td>
      <td class="num">${totalVisits}</td>
      <td class="num">${perYear}</td>
      <td>${yoy}</td>
      <td>${verdict}</td>
    </tr>`;
  });

  table.innerHTML = html;
}

// Liigutav (libisev) keskmine, kuni 3 viimase kuu põhjal, et müügi trend paremini paistaks
function computeMovingAverage(monthlySales, windowSize = 3) {
  return monthlySales.map((m, idx, arr) => {
    const start = Math.max(0, idx - windowSize + 1);
    const slice = arr.slice(start, idx + 1);
    const avg = slice.reduce((a, b) => a + b.revenue, 0) / slice.length;
    return { month: m.month, avg };
  });
}

// Liidab ühe kliendi külastused kuude kaupa kokku: { "2025-05": 2, "2025-08": 3, ... }
function monthlyVisitCounts(customer) {
  const map = {};
  customer.visits.forEach((v) => {
    const mk = v.date.slice(0, 7);
    map[mk] = (map[mk] || 0) + v.count;
  });
  return map;
}

function xForIndex(i, n) {
  const plotW = CANVAS_W - MARGIN_LEFT - MARGIN_RIGHT;
  return MARGIN_LEFT + (plotW * i) / (n - 1);
}

function formatMonthLabel(monthStr) {
  const [y, m] = monthStr.split("-");
  return MONTH_NAMES_ET[parseInt(m, 10) - 1] + " " + y;
}

// ---- Hiire hõljutus (tooltip) ----
function mouseMoved() {
  updateHoverIndex();
  redraw();
}

function updateHoverIndex() {
  const n = allMonths.length;
  const plotLeft = MARGIN_LEFT;
  const plotRight = CANVAS_W - MARGIN_RIGHT;
  const plotTop = SALES_TOP;
  const plotBottom = VISITS_TOP + VISITS_H;

  if (mouseX < plotLeft || mouseX > plotRight || mouseY < plotTop || mouseY > plotBottom) {
    hoverIndex = -1;
    return;
  }
  const plotW = plotRight - plotLeft;
  const idx = Math.round(((mouseX - plotLeft) / plotW) * (n - 1));
  hoverIndex = constrain(idx, 0, n - 1);
}

function drawHoverTooltip(n) {
  if (hoverIndex < 0) return;

  const x = xForIndex(hoverIndex, n);

  // vertikaalne juhtjoon
  stroke(210, 210, 214);
  strokeWeight(1);
  drawingContext.setLineDash([4, 4]);
  line(x, SALES_TOP, x, VISITS_TOP + VISITS_H);
  drawingContext.setLineDash([]);

  const monthStr = allMonths[hoverIndex];
  const salesEntry = current.monthlySales.find((m) => m.month === monthStr);
  const revenue = salesEntry ? salesEntry.revenue : null;
  const counts = monthlyVisitCounts(current);
  const visitCount = counts[monthStr] || 0;

  const lineTitle = formatMonthLabel(monthStr);
  const lineSales = "Müük: " + (revenue !== null ? revenue.toLocaleString("et-EE") + " €" : "—");
  const lineVisits = "Külastusi: " + visitCount;

  const boxW = 170;
  const boxH = 68;
  const padX = 12;
  const padY = 10;

  let bx = x + 14;
  let by = SALES_TOP - 2;
  if (bx + boxW > CANVAS_W - 4) bx = x - boxW - 14;
  if (by + boxH > CANVAS_H - 4) by = CANVAS_H - boxH - 4;
  if (by < 4) by = 4;

  rectMode(CORNER);
  stroke(COLOR_AXIS);
  strokeWeight(1);
  fill(100, 100, 106, 245); // surface-2, peaaegu läbipaistmatu
  rect(bx, by, boxW, boxH, 6);

  noStroke();
  textAlign(LEFT, TOP);
  fill(COLOR_TEXT);
  textSize(12);
  textStyle(BOLD);
  text(lineTitle, bx + padX, by + padY);
  textStyle(NORMAL);
  textSize(11);
  fill(COLOR_LINE);
  text(lineSales, bx + padX, by + padY + 19);
  fill(COLOR_SUBTEXT);
  text(lineVisits, bx + padX, by + padY + 36);
}

function draw() {
  background(COLOR_BG);
  if (!current) return;

  const n = allMonths.length;
  let maxRev;

  if (anim) {
    const t = constrain((millis() - anim.start) / anim.duration, 0, 1);
    const e = easeInOutCubic(t);

    const revenueMap = {};
    const revKeys = new Set([...Object.keys(anim.fromRevenue), ...Object.keys(anim.toRevenue)]);
    revKeys.forEach((k) => {
      const fromV = anim.fromRevenue[k] !== undefined ? anim.fromRevenue[k] : anim.toRevenue[k];
      const toV = anim.toRevenue[k] !== undefined ? anim.toRevenue[k] : anim.fromRevenue[k];
      revenueMap[k] = lerp(fromV, toV, e);
    });

    const maMap = {};
    const maKeys = new Set([...Object.keys(anim.fromMA), ...Object.keys(anim.toMA)]);
    maKeys.forEach((k) => {
      const fromV = anim.fromMA[k] !== undefined ? anim.fromMA[k] : anim.toMA[k];
      const toV = anim.toMA[k] !== undefined ? anim.toMA[k] : anim.fromMA[k];
      maMap[k] = lerp(fromV, toV, e);
    });

    maxRev = lerp(anim.fromMax, anim.toMax, e);

    displayedRevenue = revenueMap;
    displayedMA = maMap;
    displayedMax = maxRev;

    if (t >= 1) {
      anim = null;
      noLoop();
    }
  } else {
    maxRev = displayedMax;
  }

  const yForRev = (v) => SALES_TOP + SALES_H - (SALES_H * v) / maxRev;

  drawSalesGrid(maxRev, yForRev, n);
  drawSalesLine(yForRev, n);
  drawVisitsLane(n);
  drawMonthLabels(n);
  drawTitleAndLegend();
  drawHoverTooltip(n);
}

function drawSalesGrid(maxRev, yForRev, n) {
  const steps = 4;
  for (let s = 0; s <= steps; s++) {
    const v = (maxRev / steps) * s;
    const y = yForRev(v);
    stroke(COLOR_GRID);
    strokeWeight(1);
    line(MARGIN_LEFT, y, CANVAS_W - MARGIN_RIGHT, y);
    noStroke();
    fill(COLOR_SUBTEXT);
    textSize(11);
    textAlign(RIGHT, CENTER);
    text(Math.round(v).toLocaleString("et-EE"), MARGIN_LEFT - 10, y);
  }
}

function drawSalesLine(yForRev, n) {
  const baselineY = SALES_TOP + SALES_H;
  const months = allMonths.filter((m) => displayedRevenue[m] !== undefined);
  if (months.length === 0) return;

  // õrn täidis müügijoone all (aktsendivärvi toonis)
  noStroke();
  fill(193, 68, 60, 30);
  beginShape();
  months.forEach((m) => {
    const i = monthIndex(m);
    vertex(xForIndex(i, n), yForRev(displayedRevenue[m]));
  });
  vertex(xForIndex(monthIndex(months[months.length - 1]), n), baselineY);
  vertex(xForIndex(monthIndex(months[0]), n), baselineY);
  endShape(CLOSE);

  // 3 kuu libisev keskmine - siledam, õrnem joon trendi näitamiseks
  const maMonths = allMonths.filter((m) => displayedMA[m] !== undefined);
  noFill();
  stroke(COLOR_MA);
  strokeWeight(2);
  drawingContext.setLineDash([5, 4]);
  beginShape();
  maMonths.forEach((m) => {
    const i = monthIndex(m);
    vertex(xForIndex(i, n), yForRev(displayedMA[m]));
  });
  endShape();
  drawingContext.setLineDash([]);

  // tegelik kuine müük - täisjoon + punktid
  noFill();
  stroke(COLOR_LINE);
  strokeWeight(2.5);
  beginShape();
  months.forEach((m) => {
    const i = monthIndex(m);
    vertex(xForIndex(i, n), yForRev(displayedRevenue[m]));
  });
  endShape();

  noStroke();
  fill(COLOR_LINE);
  const counts = monthlyVisitCounts(current);
  months.forEach((m) => {
    const i = monthIndex(m);
    const px = xForIndex(i, n);
    const py = yForRev(displayedRevenue[m]);
    const visitCount = counts[m];

    if (visitCount) {
      // külastuse kuu - suurem, esiletõstetud punkt
      const d = 11 + visitCount * 2;
      fill(COLOR_VISIT);
      stroke(COLOR_VISIT_RING);
      strokeWeight(2);
      circle(px, py, d);
      noStroke();
      fill(COLOR_LINE);
      circle(px, py, 5);
    } else {
      circle(px, py, 6);
    }
  });
}

function drawVisitsLane(n) {
  // lahutav joon ja silt
  stroke(COLOR_GRID);
  strokeWeight(1);
  line(MARGIN_LEFT, VISITS_TOP, CANVAS_W - MARGIN_RIGHT, VISITS_TOP);

  noStroke();
  fill(COLOR_SUBTEXT);
  textSize(11);
  textAlign(RIGHT, CENTER);
  text("Külastused", MARGIN_LEFT - 10, VISITS_TOP + VISITS_H / 2);

  const counts = monthlyVisitCounts(current);
  const centerY = VISITS_TOP + VISITS_H / 2;

  for (let i = 0; i < n; i++) {
    const count = counts[allMonths[i]];
    if (!count) continue;
    const x = xForIndex(i, n);
    const d = 16 + count * 7; // rohkem külastusi -> suurem ring

    noStroke();
    fill(COLOR_VISIT);
    circle(x, centerY, d);

    fill(COLOR_VISIT_TEXT);
    textAlign(CENTER, CENTER);
    textSize(12);
    textStyle(BOLD);
    text(count, x, centerY + 1);
    textStyle(NORMAL);
  }
}

function drawMonthLabels(n) {
  noStroke();
  fill(COLOR_SUBTEXT);
  textSize(10);
  textAlign(CENTER, TOP);
  const y = VISITS_TOP + VISITS_H + 10;
  for (let i = 0; i < n; i += 3) {
    text(allMonths[i], xForIndex(i, n), y);
  }

  stroke(COLOR_AXIS);
  line(MARGIN_LEFT, VISITS_TOP + VISITS_H, CANVAS_W - MARGIN_RIGHT, VISITS_TOP + VISITS_H);
}

function drawTitleAndLegend() {
  noStroke();
  fill(COLOR_TEXT);
  textAlign(LEFT, TOP);
  textSize(14);
  textStyle(BOLD);
  text(current.name, MARGIN_LEFT, 8);
  textStyle(NORMAL);

  textSize(11);
  fill(COLOR_LINE);
  textAlign(LEFT, TOP);
  text("● Müük (kuine käive)", CANVAS_W - 250, 8);
  fill(COLOR_MA);
  text("- - 3 kuu libisev keskmine", CANVAS_W - 250, 22);
  fill(COLOR_SUBTEXT);
  text("● Külastused sel kuul (arv ringis)", CANVAS_W - 250, 36);
}
