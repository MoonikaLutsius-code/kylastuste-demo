// ---- Layout config ----
const CANVAS_W = 820;
const MARGIN_LEFT = 70;
const MARGIN_RIGHT = 30;

const SALES_TOP = 40;
const SALES_H = 240;
const GAP = 26;
const VISITS_H = 90;
const AXIS_LABELS_H = 30;

const VISITS_TOP = SALES_TOP + SALES_H + GAP;
const CANVAS_H = VISITS_TOP + VISITS_H + AXIS_LABELS_H;

// ---- Colors ----
const COLOR_LINE = "#4A4A4A";     // müügijoon - tumehall
const COLOR_VISIT = "#C9C6C0";    // külastuse ring - helehall
const COLOR_VISIT_TEXT = "#4A4A4A"; // number ringi sees
const COLOR_AXIS = "#B9B4AA";
const COLOR_TEXT = "#2B2B2B";
const COLOR_SUBTEXT = "#8A857A";
const COLOR_GRID = "#E7E3DA";

let data;
let customerSelect;
let allMonths = [];
let current;
let hoverIndex = -1;

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
  current = data.customers.find((c) => c.name === name);
  updateNote();
  updateConclusion();
  redraw();
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
  stroke(170);
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
  stroke(210);
  strokeWeight(1);
  fill(255, 250);
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
  background("#F7F5F1");
  if (!current) return;

  const n = allMonths.length;
  const revenues = current.monthlySales.map((m) => m.revenue);
  const maxRev = Math.max(...revenues) * 1.15;
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
  noFill();
  stroke(COLOR_LINE);
  strokeWeight(2.5);
  beginShape();
  current.monthlySales.forEach((m) => {
    const i = monthIndex(m.month);
    vertex(xForIndex(i, n), yForRev(m.revenue));
  });
  endShape();

  noStroke();
  fill(COLOR_LINE);
  current.monthlySales.forEach((m) => {
    const i = monthIndex(m.month);
    circle(xForIndex(i, n), yForRev(m.revenue), 6);
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
  fill(COLOR_SUBTEXT);
  text("● Külastused sel kuul (arv ringis)", CANVAS_W - 250, 22);
}
