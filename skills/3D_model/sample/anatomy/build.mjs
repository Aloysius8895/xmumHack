// Fig 2 · 画就是数据 — a strip-chart recorder that keeps numbers, never pictures.
// node build.mjs            -> night-recorder.html (dark, tuned to the Night Canvas page)
// node build.mjs --light    -> night-recorder-light.html
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import * as k from "../../anatomy/kit/iso-kit.mjs";
import { kitScript } from "../../anatomy/scripts/inline-kit.mjs";
import * as M from "./model.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const theme = process.argv.includes("--light") ? "light" : "dark";

const WIDTH = 600;
const HEIGHT = 380;

// ------------------------------------------------------------------ world (units of about 1 px, z up)
const BASE = { x: -150, y: -64, w: 300, d: 128, r: 8 };
const BASE_H = 10, FOOT_H = 5;
const SUP = { x: -142, y: -48, w: 42, d: 96, r: 3 }, SUP_H = 34;     // supply housing: paper comes out of it
const TAK = { x: 100, y: -48, w: 42, d: 96, r: 3 }, TAK_H = 26;      // take-up housing: paper goes into it
const PLATEN = { x: -100, y: -42, w: 200, d: 84, r: 1 }, PLATEN_H = 4;
const PAPER = { x: -100, y: -37, w: 200, d: 74, r: 0 }, PZ = PLATEN_H + 0.4;
const FOOTPLATE = { x: -61, y: -63, w: 20, d: 16, r: 2 };
const COLUMN = { x: -57, y: -61, w: 12, d: 12, r: 1.5 };
const BAR = { x: -57, y: -61, w: 12, d: 111, r: 1.5 }, BAR_Z = 50, BAR_H = 8;
const BAR_TOP = BAR_Z + BAR_H;
const PEN_X = -40.75;                       // where every pen and plunger touches the paper
const PULLEY = { x: -51, far: -55, near: 45.5, r: 4.5 };
const CORD_A = { x: PULLEY.x + PULLEY.r, z: 59.4 }, CORD_B = { x: PULLEY.x - PULLEY.r, z: 62.1 };
const LIFT = 3.5;                            // plunger rest height over the paper
const MARK_Y = { m: -2.4, s: 2.4 };          // the two event plungers: movement, sound
const A_REST = M.penA(0.32), B_REST = M.penB(M.QUIET);

const P = k.fitProjection(
  [...k.boxCorners(BASE, -BASE_H - FOOT_H, 0), [PULLEY.x, PULLEY.far, 74], [BAR.x, BAR.y + BAR.d, BAR_TOP], ...k.boxCorners(SUP, 0, SUP_H), ...k.boxCorners(TAK, 0, TAK_H)],
  WIDTH, HEIGHT, { pad: 22, azimuth: 58 },
);

const at = (point) => k.iso(point, P);
const S = (paths, style) => k.solidSvg(paths, style);
const L = (d, style) => k.lineSvg(d, style);
const D = (points, style) => k.dotsSvg(points, style);
const poly = (points, closed = false) => k.pathOf(points.map(at), closed);
const byDepth = (points) => [...points].sort((a, b) => k.depthOf([a[0], a[1], 0], P) - k.depthOf([b[0], b[1], 0], P));

function knob(x, y, z, r, h, angle, grip = 36) {
  const out = [];
  out.push(S(k.cylinder(x, y, r + 1, z, 1.2, P, 32), { tone: "lo" }));
  out.push(S(k.cylinder(x, y, r, z + 1.2, h, P, 32, 0.4), { tone: "mid" }));
  out.push(L(k.knurl(x, y, r, z + 1.2, z + 1.2 + h, grip, P), { tone: "lo" }));
  out.push(L(k.lineOnTop([x, y], [x + r * Math.cos(angle), y + r * Math.sin(angle)], z + 1.2 + h, P), { tone: "hi" }));
  out.push(D([at([x, y, z + 1.2 + h])], { size: 0.55, tone: "hi" }));
  return out.join("");
}

function base() {
  const out = [`<path class="iso-halo" d="${k.haloOf(BASE, -BASE_H - FOOT_H, BASE_H, P)}"/>`];
  for (const [x, y] of byDepth(k.corners(BASE, 22))) {
    out.push(S(k.cylinder(x, y, 7, -BASE_H - FOOT_H, 1.6, P, 28), { tone: "lo" }));
    out.push(S(k.cylinder(x, y, 5.4, -BASE_H - FOOT_H + 1.6, FOOT_H - 1.6, P, 28), { tone: "mid" }));
  }
  out.push(S(k.slabOf(BASE, -BASE_H, BASE_H, P, 8, 1.4), { tone: "mid", inner: L(k.sideSeam(BASE, -4, P, 8), { tone: "faint" }) }));
  out.push(L(k.planOutline(k.insetPlan(BASE, 5), 0, P), { tone: "lo" }));
  const screws = k.corners(BASE, 10);
  out.push(L(screws.map(([x, y]) => k.ring(x, y, 2.2, 0, P, 16)).join(""), { tone: "lo" }));
  out.push(D(screws.map(([x, y]) => at([x, y, 0])), { size: 0.5 }));
  // a time ruler along the near edge: one tick per second of paper, a long one every five
  const strip = { x: -96, y: 46, w: 192, d: 7, r: 1 };
  out.push(S(k.slabOf(strip, 0, 0.6, P, 3), { tone: "lo", crease: "none" }));
  const ticks = k.topTicks(strip.x + 3, strip.x + strip.w - 3, M.V, 5, strip.y + 0.8, 0.6, [2, 3.6], P);
  out.push(L(ticks.minor, { tone: "lo" }), L(ticks.major, { tone: "mid" }));
  out.push(D([at([strip.x + 1.6, strip.y + 4, 0.6]), at([strip.x + strip.w - 1.6, strip.y + 4, 0.6])], { size: 0.45 }));
  return out.join("");
}

function column() {
  const out = [];
  out.push(S(k.slabOf(FOOTPLATE, 0, 1.5, P, 3, 0.4), { tone: "mid" }));
  out.push(D(k.corners(FOOTPLATE, 2.6).map(([x, y]) => at([x, y, 1.5])), { size: 0.45 }));
  out.push(S(k.slabOf(COLUMN, 1.5, BAR_Z - 1.5, P, 4, 0.5), { tone: "mid", inner: L(k.sideSeam(COLUMN, 12, P, 4), { tone: "faint" }) }));
  return out.join("");
}

function supply() {
  const out = [];
  out.push(S(k.slabOf(SUP, 0, SUP_H, P, 5, 0.8), { tone: "mid", inner: L(k.sideSeam(SUP, SUP_H - 5, P, 5), { tone: "faint" }) }));
  out.push(L(k.planOutline(k.insetPlan(SUP, 3), SUP_H, P, 4), { tone: "faint" }));
  out.push(D(k.corners(SUP, 5).map(([x, y]) => at([x, y, SUP_H])), { size: 0.45 }));
  // the slot the paper leaves through, on the face toward the pens
  out.push(L(poly([[SUP.x + SUP.w, -38.6, 3.3], [SUP.x + SUP.w, 38.6, 3.3], [SUP.x + SUP.w, 38.6, 5.5], [SUP.x + SUP.w, -38.6, 5.5]], true), { tone: "lo" }));
  // controls on top: gain for each pen, paper speed, a pilot lamp and the run switch
  const top = SUP_H;
  out.push(knob(-130, 0, top, 7, 4.4, 0.4, 44));
  out.push(knob(-112, -24, top, 5, 3.6, -1.9, 32));
  out.push(knob(-112, 24, top, 5, 3.6, 1.2, 32));
  out.push(S(k.cylinder(-131, 34, 3.2, top, 1, P, 24), { tone: "lo" }));
  out.push(S(k.cylinder(-131, 34, 2.2, top + 1, 2.2, P, 24, 0.3), { tone: "hi" }));
  out.push(S(k.slabOf({ x: -135, y: -38, w: 8, d: 5, r: 1 }, top, 1.2, P, 3), { tone: "lo" }));
  out.push(S(k.slabOf({ x: -131.6, y: -37, w: 2.6, d: 3, r: 0.8 }, top + 1.2, 4, P, 3), { tone: "mid" }));
  // two counters on the near face: frames looked at, frames kept
  const face = k.sideMatrix([SUP.x, SUP.y + SUP.d], SUP_H, P, "left");
  const win = (y, part, text) => `<rect class="nc-win" x="6" y="${y}" width="30" height="7.4" rx="1"/><text class="iso-face-text nc-digits" data-part="${part}" data-tone="hi" x="21" y="${y + 5.6}" font-size="5.2" text-anchor="middle">${text}</text>`;
  out.push(`<g transform="${face}">${win(7, "frames", "0000000")}${win(17.4, "stored", "0000000")}<circle class="nc-dot" cx="39" cy="10.7" r=".6"/><circle class="nc-dot" cx="39" cy="21.1" r=".6"/></g>`);
  return out.join("");
}

function paper() {
  const out = [];
  out.push(S(k.slabOf(PLATEN, 0, PLATEN_H, P, 3, 0.4), { tone: "mid" }));
  out.push(S(k.slabOf(PAPER, PLATEN_H, PZ - PLATEN_H, P, 1), { tone: "hi", crease: "none" }));
  const x0 = PAPER.x, x1 = PAPER.x + PAPER.w;
  const row = (y) => k.lineOnTop([x0, y], [x1, y], PZ, P);
  out.push(L(row(M.A0) + row(M.B0), { tone: "lo" }));                                   // zero lines
  out.push(L(row(-6) + row(6), { tone: "faint" }));                                       // event lane
  out.push(L(row(M.penA(M.MOTION_T)) + row(M.penB(M.SOUND_T)), { tone: "mid", dashed: true })); // thresholds
  return out.join("");
}

// the ink that moves with the paper: rebuilt every frame by the page
const ink = `<g data-part="ink"><path class="iso-line" data-tone="faint" data-part="grid" d=""/><path class="iso-line nc-ink" data-tone="hi" data-part="traceA" d=""/><path class="iso-line nc-ink" data-tone="hi" data-part="traceB" d=""/><g class="iso-dots" data-tone="lit" data-part="stamps"></g></g>`;

function bar() {
  const out = [];
  out.push(S(k.slabOf(BAR, BAR_Z, BAR_H, P, 4, 0.5), { tone: "mid" }));
  for (const z of [51, 55.4]) out.push(S(k.slabOf({ x: BAR.x + BAR.w, y: BAR.y + 3, w: 1.2, d: BAR.d - 6, r: 0.4 }, z, 1.4, P, 2), { tone: "lo" }));
  out.push(D([at([BAR.x + BAR.w / 2, BAR.y + 3, BAR_TOP]), at([BAR.x + BAR.w / 2, BAR.y + 9, BAR_TOP])], { size: 0.45 }));
  // drive cords: pen A on the front run, pen B on the back run
  out.push(L(k.segment([CORD_A.x, PULLEY.far, CORD_A.z], [CORD_A.x, PULLEY.near, CORD_A.z], P) + k.segment([CORD_B.x, PULLEY.far, CORD_B.z], [CORD_B.x, PULLEY.near, CORD_B.z], P), { tone: "lo" }));
  return out.join("");
}

function pulleys(y, servo) {
  const out = [];
  out.push(S(k.cylinder(PULLEY.x, y, PULLEY.r, BAR_TOP, 2.8, P, 32), { tone: "mid", inner: L(k.sideArc(PULLEY.x, y, PULLEY.r, BAR_TOP + 1.4, P, 24), { tone: "faint" }) }));
  out.push(S(k.cylinder(PULLEY.x, y, PULLEY.r, BAR_TOP + 2.8, 2.6, P, 32), { tone: "mid", inner: L(k.sideArc(PULLEY.x, y, PULLEY.r, BAR_TOP + 4.1, P, 24), { tone: "faint" }) }));
  if (servo) {
    out.push(S(k.cylinder(PULLEY.x, y, 5.6, BAR_TOP + 5.4, 9.6, P, 40, 0.5), { tone: "mid", inner: L(k.sideArc(PULLEY.x, y, 5.6, BAR_TOP + 11.6, P, 32), { tone: "faint" }) }));
    out.push(S(k.cylinder(PULLEY.x, y, 2.4, BAR_TOP + 15, 1, P, 20), { tone: "lo" }));
  } else {
    out.push(S(k.cylinder(PULLEY.x, y, 1.6, BAR_TOP + 5.4, 1, P, 16), { tone: "lo" }));
  }
  return out.join("");
}

// a pen carriage, built at rest y and moved along y by the page
function carriage(y, cord) {
  const out = [];
  const plan = { x: BAR.x + BAR.w + 1, y: y - 4, w: 6.5, d: 8, r: 1.2 };
  out.push(S(k.cylinder(PEN_X, y, 0.9, PZ, 4.6, P, 16), { tone: "hi" }));                          // felt tip
  out.push(S(k.cylinder(PEN_X, y, 2.3, PZ + 4.6, 47 - PZ - 4.6, P, 24), { tone: "hi", inner: L(k.sideArc(PEN_X, y, 2.3, 30, P, 16), { tone: "faint" }) })); // ink cartridge
  out.push(S(k.cylinder(PEN_X, y, 3.1, 40, 3, P, 24), { tone: "mid" }));                            // clamp ring
  out.push(S(k.slabOf(plan, 47, 12, P, 3, 0.5), { tone: "mid" }));
  out.push(D([at([plan.x + plan.w, y - 2, 56]), at([plan.x + plan.w, y + 2, 56])].map((p) => p), { size: 0.4 }));
  if (cord === "A") out.push(S(k.slabOf({ x: CORD_A.x - 0.9, y: y - 1.5, w: 3.6, d: 3, r: 0.5 }, BAR_TOP + 1, 1.2, P, 2), { tone: "lo" }));
  else {
    out.push(S(k.slabOf({ x: plan.x, y: y - 1.5, w: 2.2, d: 3, r: 0.5 }, 59, 2.6, P, 2), { tone: "lo" }));
    out.push(S(k.slabOf({ x: CORD_B.x - 0.9, y: y - 1.5, w: plan.x + 2.2 - CORD_B.x + 0.9, d: 3, r: 0.6 }, 61.6, 1.2, P, 2), { tone: "lo" }));
  }
  return out.join("");
}

function marker() {
  const out = [];
  out.push(`<g data-part="plungers">`);
  for (const y of [MARK_Y.m, MARK_Y.s]) {
    out.push(S(k.cylinder(PEN_X, y, 0.9, PZ + LIFT + 1.8, 48 - PZ - LIFT - 1.8, P, 16), { tone: "mid", crease: "none" }));
    out.push(S(k.cylinder(PEN_X, y, 1.3, PZ + LIFT, 1.8, P, 20), { tone: "hi", lit: true }));
  }
  out.push(`</g>`);
  out.push(S(k.slabOf({ x: BAR.x + BAR.w + 1, y: -4.2, w: 6.5, d: 8.4, r: 1.2 }, 36, 23, P, 3, 0.5), { tone: "mid", inner: L(k.sideSeam({ x: BAR.x + BAR.w + 1, y: -4.2, w: 6.5, d: 8.4, r: 1.2 }, 47, P, 3), { tone: "faint" }) }));
  out.push(D([at([PEN_X + 3.25, -2, 55]), at([PEN_X + 3.25, 2, 55])], { size: 0.4 }));
  return out.join("");
}

function takeup() {
  const out = [];
  out.push(S(k.slabOf(TAK, 0, TAK_H, P, 5, 0.8), { tone: "mid", inner: L(k.sideSeam(TAK, TAK_H - 5, P, 5), { tone: "faint" }) }));
  out.push(D(k.corners(TAK, 5).map(([x, y]) => at([x, y, TAK_H])), { size: 0.45 }));
  const plate = { x: 108, y: -38, w: 26, d: 20, r: 1 };
  out.push(S(k.slabOf(plate, TAK_H, 0.8, P, 3), { tone: "lo", crease: "none" }));
  out.push(L(k.planOutline(k.insetPlan(plate, 1.6), TAK_H + 0.8, P, 3), { tone: "faint" }));
  out.push(L([[-33, 22], [-28, 16], [-23, 19]].map(([y, len]) => k.lineOnTop([plate.x + 4, y], [plate.x + 4 + len, y], TAK_H + 0.8, P)).join(""), { tone: "lo", free: true }));
  out.push(D([at([plate.x + plate.w - 3, plate.y + 3, TAK_H + 0.8]), at([plate.x + plate.w - 3, plate.y + plate.d - 3, TAK_H + 0.8])], { size: 0.45 }));
  for (let i = 0; i < 5; i++) out.push(L(k.planOutline({ x: 108, y: 4 + i * 6.4, w: 26, d: 2.4, r: 1.2 }, TAK_H, P, 3), { tone: "faint" }));
  return out.join("");
}

const svg = k.figureSvg({
  width: WIDTH,
  height: HEIGHT,
  label: "一台条形图记录仪：纸带从左侧机箱出来，经过两支记录笔和一对事件打点器，进入右侧机箱。笔 A 画出每帧画面的运动能量，笔 B 画出声级；数值越过虚线阈值时，打点器在中间一栏落下一个点。左侧机箱的两个计数窗分别显示已处理的帧数和已保存的帧数，后者始终为零。",
  body: [
    base(),
    column(),
    supply(),
    paper(),
    ink,
    bar(),
    pulleys(PULLEY.far, true),
    `<g data-part="carA">${carriage(A_REST, "A")}</g>`,
    marker(),
    `<g data-part="carB">${carriage(B_REST, "B")}</g>`,
    pulleys(PULLEY.near, false),
    takeup(),
  ],
});

// ------------------------------------------------------------------ the page's live code
const model = readFileSync(join(HERE, "model.mjs"), "utf8").replace(/^export /gm, "");
const live = `
${model}
const P = ${JSON.stringify(P)};
const PEN_X = ${PEN_X}, PZ = ${PZ}, LIFT = ${LIFT}, X_IN = ${PAPER.x}, X_OUT = ${PAPER.x + PAPER.w}, Y_EDGE = ${PAPER.y + PAPER.d};
const A_REST = ${A_REST}, B_REST = ${B_REST}, MARK_Y = ${JSON.stringify(MARK_Y)};
const NAMES = { turn: "翻身", twitch: "小动作", snore: "鼾声", door: "关门声" };
const stage = document.querySelector(".iso-stage");
const svg = stage.querySelector("svg");
const $ = (part) => svg.querySelector('[data-part="' + part + '"]');
const carA = $("carA"), carB = $("carB"), plungers = $("plungers"), grid = $("grid"), traceA = $("traceA"), traceB = $("traceB"), stamps = $("stamps"), framesEl = $("frames"), storedEl = $("stored");
const readout = document.querySelector("[data-readout]");
const live = document.querySelector("[data-live]");
const still = matchMedia("(prefers-reduced-motion: reduce)");
const HISTORY = (X_OUT - PEN_X) / V + 1.5;

let t = 0, frame = 0, last = 0, visible = false, touring = !still.matches, tourClock = 0, idleTimer = 0;
let events = [], samples = [], marks = [], count = 0;
const pens = { a: { x: A_REST, v: 0 }, b: { x: B_REST, v: 0 } };
let armM = true, armS = true, lastSample = -1;
const tourPlan = [[1.2, "turn"], [8, "snore"], [19.5, "twitch"], [23, "door"]], TOUR_LEN = 30;
let tourNext = 0;

// a galvanometer pen: a stiff, nearly critically damped spring toward the value
function penTo(pen, target, dt, calm) {
  if (calm) { pen.x = target; pen.v = 0; return; }
  const w = 2 * Math.PI * 2.6, z = 0.8, n = 6, h = dt / n;
  for (let i = 0; i < n; i++) { pen.v += (w * w * (target - pen.x) - 2 * z * w * pen.v) * h; pen.x += pen.v * h; }
}
function inject(kind) { events.push({ kind, t }); events = events.filter((e) => t - e.t < 30); }
function post(kind) { if (window.parent !== window) window.parent.postMessage({ ns: "night-canvas", type: "event", kind, count }, "*"); }
function step(dt, calm) {
  t += dt;
  const m = motionAt(t, events), Ls = soundAt(t, events);
  penTo(pens.a, penA(m), dt, calm); penTo(pens.b, penB(Ls), dt, calm);
  const cm = cross(m, armM, MOTION_T, MOTION_RE); armM = cm.armed;
  if (cm.mark) { marks.push({ t, lane: "m" }); count++; post("turn"); say("体动 " + m.toFixed(1) + " % 越过 2 % · 记一笔"); }
  const cs = cross(Ls, armS, SOUND_T, SOUND_RE); armS = cs.armed;
  if (cs.mark) { const kind = loudestAt(t, events) || "door"; marks.push({ t, lane: "s", kind }); count++; post(kind); say(NAMES[kind] + " " + Ls.toFixed(0) + " dBA 越过 45 dBA · 记一笔"); }
  if (t - lastSample >= 1 / 30) { samples.push({ t, a: pens.a.x, b: pens.b.x }); lastSample = t; }
  while (samples.length && t - samples[0].t > HISTORY) samples.shift();
  while (marks.length && t - marks[0].t > HISTORY) marks.shift();
  return { m, Ls };
}
function say(text) { if (live) live.textContent = text; }
function traceOf(key) {
  const pts = [];
  for (let i = samples.length - 1; i >= 0; i--) {
    const x = PEN_X + (t - samples[i].t) * V;
    pts.push(iso([Math.min(x, X_OUT + 1), samples[i][key], PZ], P));
    if (x > X_OUT + 1) break;
  }
  return pathOf(pts);
}
let now = { m: 0, Ls: 30 };
function draw() {
  carA.setAttribute("transform", translateAlong(P, [0, pens.a.x - A_REST, 0]));
  carB.setAttribute("transform", translateAlong(P, [0, pens.b.x - B_REST, 0]));
  let press = 0;
  for (const mk of marks) { const age = t - mk.t; if (age >= 0 && age < 0.45) press = Math.max(press, age < 0.06 ? age / 0.06 : Math.exp(-(age - 0.06) / 0.09)); }
  plungers.setAttribute("transform", translateAlong(P, [0, 0, -LIFT * (still.matches ? 0 : press)]));
  traceA.setAttribute("d", traceOf("a"));
  traceB.setAttribute("d", traceOf("b"));
  const phase = ((t * V) % 12 + 12) % 12;
  let g = "";
  for (let x = X_IN + phase; x < X_OUT - 0.4; x += 12) if (x > X_IN + 0.4) g += pathOf([iso([x, -Y_EDGE, PZ], P), iso([x, Y_EDGE, PZ], P)]);
  grid.setAttribute("d", g);
  stamps.innerHTML = marks.map((mk) => { const x = PEN_X + (t - mk.t) * V; if (x > X_OUT - 1) return ""; const [sx, sy] = iso([x, MARK_Y[mk.lane], PZ], P); return '<circle cx="' + sx.toFixed(1) + '" cy="' + sy.toFixed(1) + '" r="1.25"/>'; }).join("");
  framesEl.textContent = String(Math.floor(Math.max(0, t) * FPS)).padStart(7, "0");
  storedEl.textContent = "0000000";
  const text = "运动 " + now.m.toFixed(1) + " % · " + now.Ls.toFixed(0) + " dBA · 已记 " + count + " 笔 · 存图 0";
  if (readout.textContent !== text) readout.textContent = text;
}
function tick(stamp) {
  const dt = last ? Math.min((stamp - last) / 1000, 1 / 30) : 1 / 60;
  last = stamp;
  if (touring) {
    tourClock += dt;
    while (tourNext < tourPlan.length && tourClock >= tourPlan[tourNext][0]) { inject(tourPlan[tourNext][1]); tourNext++; }
    if (tourClock >= TOUR_LEN) { tourClock -= TOUR_LEN; tourNext = 0; }
  }
  now = step(dt, false);
  draw();
  frame = visible && !still.matches ? requestAnimationFrame(tick) : 0;
}
const run = () => { if (!frame && visible && !still.matches) { last = 0; frame = requestAnimationFrame(tick); } };
// reduced motion: no tour and no scrolling; an event advances the paper in one jump
function jump(seconds) { for (let s = 0; s < seconds; s += 1 / 30) now = step(1 / 30, true); draw(); }
function act(kind) {
  touring = false; clearTimeout(idleTimer);
  idleTimer = setTimeout(() => { if (!still.matches) { touring = true; tourClock = 0; tourNext = 0; } }, 3600);
  inject(kind);
  if (still.matches) jump(SPAN[kind] + 2); else run();
}
// prefill: the strip already carries the last 25 s of a quiet night
for (let s = 0; s < HISTORY; s += 1 / 30) step(1 / 30, true);
count = 0; marks = [];
if (still.matches) { touring = false; for (const [at2, kind] of tourPlan) { inject(kind); jump(at2 === 1.2 ? 6 : SPAN[kind] + 2); } }
draw();
new IntersectionObserver((entries) => { visible = entries[entries.length - 1].isIntersecting; if (visible) run(); }, { rootMargin: "120px 0px" }).observe(stage);
const KEYS = { "1": "turn", "2": "twitch", "3": "snore", "4": "door" };
stage.addEventListener("keydown", (e) => { const kind = KEYS[e.key]; if (!kind) return; e.preventDefault(); act(kind); });
stage.addEventListener("pointerenter", () => { touring = false; clearTimeout(idleTimer); });
stage.addEventListener("pointerleave", () => { clearTimeout(idleTimer); idleTimer = setTimeout(() => { if (!still.matches) { touring = true; tourClock = 0; tourNext = 0; } }, 3600); });
stage.addEventListener("focus", () => say("记录仪在走纸；按 1 到 4 加入一个夜间事件"));
for (const b of document.querySelectorAll("[data-kind]")) b.addEventListener("click", () => act(b.dataset.kind));
window.nightRecorder = { act, get count() { return count; } };
`;

const css = `
.iso[data-theme="dark"],.iso:not([data-theme]){
  --anatomy-page:#0c0f17;--anatomy-card:#10141f;--anatomy-text:#a3a8b4;--anatomy-strong:#e8eaf0;--anatomy-muted:#6f7584;
  --anatomy-paper:#10141f;--anatomy-face:#171c29;--anatomy-top:#192030;
  --anatomy-shade-0:#0d111a;--anatomy-shade-1:#10151f;--anatomy-shade-2:#131824;--anatomy-shade-3:#161c29;
  --anatomy-lit-top:#2a2418;--anatomy-lit-shade:#211c13;
  --anatomy-hi:#d6dae3;--anatomy-mid:#68708a;--anatomy-lo:#3b4256;--anatomy-faint:#262c3c;--anatomy-lit:#f0a43a;
  --anatomy-halo:#04060b;--anatomy-dot:#e6e9f0;
}
.iso[data-theme="light"]{--anatomy-lit:#b86b00}
.iso-dots[data-tone="lit"] circle{fill:var(--anatomy-lit);opacity:1}
.nc-win{fill:var(--anatomy-halo);stroke:var(--anatomy-lo);stroke-width:.6px;vector-effect:non-scaling-stroke}
.nc-dot{fill:var(--anatomy-dot);opacity:.45}
.nc-digits{font-variant-numeric:tabular-nums;letter-spacing:.08em}
.nc-ink{stroke-width:.85px}
.iso-stage{outline:none;touch-action:pan-y}
.iso-stage:focus-visible{outline:1px solid var(--anatomy-muted);outline-offset:6px}
.nc-events{display:flex;flex-wrap:wrap;gap:8px;margin:14px 0 0}
.nc-events button{font:12px/1 var(--anatomy-mono);color:var(--anatomy-text);background:transparent;border:1px solid var(--anatomy-lo);border-radius:999px;padding:7px 12px;cursor:pointer}
.nc-events button:hover{border-color:var(--anatomy-mid);color:var(--anatomy-strong)}
.nc-events button:focus-visible{outline:1px solid var(--anatomy-muted);outline-offset:3px}
.nc-events kbd{font:inherit;color:var(--anatomy-muted);margin-left:6px}
.nc-sr{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap}
.iso-page{margin:24px auto 32px}
body{font-family:ui-sans-serif,system-ui,-apple-system,"Segoe UI","PingFang SC","Microsoft YaHei",sans-serif}
`;

const body = k.plateHtml({
  fig: "Fig 2",
  title: "画就是数据",
  hint: "按 1–4 加入事件",
  readout: "运动 0.3 % · 30 dBA · 已记 0 笔 · 存图 0",
  keys: [
    { mark: "lit", label: "事件打点器：数值越过阈值才落下一个点（上排体动，下排声音）" },
    { mark: "raised", label: "笔 A：运动能量 %（相邻两帧变化像素的比例）· 笔 B：声级 dBA" },
    { mark: "dashed", label: "虚线：阈值 2 % 与 45 dBA" },
    { mark: "flat", label: "计数窗：上 = 已看过的帧，下 = 已保存的帧（始终为 0）" },
  ],
  caption:
    "夜画的记录方式。摄像头每帧只换算成一个数，麦克风只换算成一个声级；数值越过阈值时打点器记一笔，画面当场丢弃。第二天早上的画只从这条纸带生成。小动作约 1.3 %，不过阈值，所以不记。纸带按真实时间走，每秒 6 个单位；安静卧室约 30 dBA（WHO 夜间指南），阈值和事件幅度是演示假设。",
  body: `<div class="iso-stage" tabindex="0" role="group" aria-label="夜间记录仪：按 1 翻身、2 小动作、3 打鼾、4 关门声">${svg}</div><span class="nc-sr" aria-live="polite" data-live></span>`,
});
const controls = `<div class="nc-events" role="group" aria-label="加入一个夜间事件"><button type="button" data-kind="turn">翻身<kbd>1</kbd></button><button type="button" data-kind="twitch">小动作<kbd>2</kbd></button><button type="button" data-kind="snore">打鼾<kbd>3</kbd></button><button type="button" data-kind="door">关门声<kbd>4</kbd></button></div>`;

const out = theme === "light" ? "night-recorder-light.html" : "night-recorder.html";
const html = k.pageHtml({ title: "夜画 · 画就是数据", theme, body: `<style>${css}</style>${body}${controls}`, script: kitScript() + live, width: 680 }).replace('<html lang="en">', '<html lang="zh-CN">');
writeFileSync(join(HERE, out), html);
console.log("wrote", out, `(${(html.length / 1024).toFixed(0)} KB)`);
