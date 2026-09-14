// ---- Config ----
const CANVAS_W = 820;
const CANVAS_H = 420;
const MARGIN = { top: 30, right: 30, bottom: 50, left: 70 };

const COLOR_LINE = "#2F5D8A";      // müügijoon
const COLOR_POINT = "#2F5D8A";
const COLOR_VISIT = "#D97D34";     // külastuse marker
const COLOR_AXIS = "#B9B4AA";
const COLOR_TEXT = "#2B2B2B";
const COLOR_GRID = "#E7E3DA";

let data;               // täis customers.json sisu
let customerSelect;     // p5 dom select element
let allMonths = [];      // nt ["2024-01", "2024-02", ...] kõigi kuude ühine skaala
let current;             // hetkel valitud kliendi objekt

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

  onCustomerChange(); // laadi esimene klient kohe
  noLoop();           // joonistame ainult siis, kui valik muutub
}

function onCustomerChange() {
  const name = customerSelect.value();
  current = data.customers.find((c) => c.name === name);
  updateNote();
  redraw();
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

// Koguda kõigi klientide kuude liit, et x-telg oleks järjepidev
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

function draw() {
  background("#F7F5F1");
  if (!current) return;

  const plotW = CANVAS_W - MARGIN.left - MARGIN.right;
  const plotH = CANVAS_H - MARGIN.top - MARGIN.bottom;
  const n = allMonths.length;

  const xForIndex = (i) => MARGIN.left + (plotW * i) / (n - 1);

  const revenues = current.monthlySales.map((m) => m.revenue);
  const maxRev = Math.max(...revenues) * 1.15;
  const yForRev = (v) => MARGIN.top + plotH - (plotH * v) / maxRev;

  drawAxes(maxRev, yForRev, xForIndex, n);
  drawVisitMarkers(xForIndex, plotH);
  drawSalesLine(xForIndex, yForRev);
  drawTitle();
}

function drawAxes(maxRev, yForRev, xForIndex, n) {
  stroke(COLOR_GRID);
  strokeWeight(1);
  // horisontaalsed abijooned + y-telje sildid
  const steps = 4;
  for (let s = 0; s <= steps; s++) {
    const v = (maxRev / steps) * s;
    const y = yForRev(v);
    line(MARGIN.left, y, CANVAS_W - MARGIN.right, y);
    noStroke();
    fill(COLOR_TEXT);
    textSize(11);
    textAlign(RIGHT, CENTER);
    text(Math.round(v).toLocaleString("et-EE"), MARGIN.left - 10, y);
    stroke(COLOR_GRID);
  }

  // x-telje kuude sildid (iga 3. kuu, et ei läheks tihedaks)
  noStroke();
  fill(COLOR_TEXT);
  textSize(10);
  textAlign(CENTER, TOP);
  for (let i = 0; i < n; i += 3) {
    const x = xForIndex(i);
    text(allMonths[i], x, CANVAS_H - MARGIN.bottom + 10);
  }

  stroke(COLOR_AXIS);
  line(MARGIN.left, CANVAS_H - MARGIN.bottom, CANVAS_W - MARGIN.right, CANVAS_H - MARGIN.bottom);
}

function drawVisitMarkers(xForIndex, plotH) {
  current.visits.forEach((v) => {
    const mIdx = monthIndex(v.date.slice(0, 7));
    if (mIdx === -1) return;
    const x = xForIndex(mIdx);
    const w = 6 + v.count * 3; // rohkem külastusi -> laiem marker
    noStroke();
    fill(217, 125, 52, 60); // poolläbipaistev riba (COLOR_VISIT toonis)
    rectMode(CENTER);
    rect(x, MARGIN.top + plotH / 2, w, plotH);
  });
}

function drawSalesLine(xForIndex, yForRev) {
  noFill();
  stroke(COLOR_LINE);
  strokeWeight(2.5);
  beginShape();
  current.monthlySales.forEach((m) => {
    const i = monthIndex(m.month);
    vertex(xForIndex(i), yForRev(m.revenue));
  });
  endShape();

  noStroke();
  fill(COLOR_POINT);
  current.monthlySales.forEach((m) => {
    const i = monthIndex(m.month);
    circle(xForIndex(i), yForRev(m.revenue), 5);
  });
}

function drawTitle() {
  noStroke();
  fill(COLOR_TEXT);
  textAlign(LEFT, TOP);
  textSize(14);
  text(current.name, MARGIN.left, 6);

  // legend
  textSize(11);
  fill(COLOR_LINE);
  text("● Müük (kuine käive)", CANVAS_W - 260, 6);
  fill(COLOR_VISIT);
  text("▮ Külastus (riba laius = arv)", CANVAS_W - 260, 20);
}
