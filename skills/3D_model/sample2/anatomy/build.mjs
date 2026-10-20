// Fig 2 · 日光系数测试台 — a daylight-factor bench: a lamp box stands in for the sky, a glass pane with a sheer on
// a track stands in for the glazing (T), an open box lined with the TV-wall finish stands in for the living room (R),
// and a photocell on the box floor reads the ratio inside / outside on a dial: the daylight factor.
// Every number comes from ../shared/daylight.mjs, the same model the 3D apartment uses.
//   node build.mjs           -> daylight-bench.html (light, the theme the apartment page embeds)
//   node build.mjs --dark    -> daylight-bench-dark.html
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import * as k from "../../anatomy/kit/iso-kit.mjs";
import { kitScript } from "../../anatomy/scripts/inline-kit.mjs";
import * as DLm from "../shared/daylight.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const theme = process.argv.includes("--dark") ? "dark" : "light";
const WIDTH = 600, HEIGHT = 380;

// ------------------------------------------------------------------ world (about 1 px per unit, z up)
const PLATE = { x: -172, y: -62, w: 344, d: 126, r: 8 }, PLATE_H = 10, FOOT_H = 5;
const RAILS = [-17, 13], RAIL_X = [-158, 40];
const LAMP = { base: { x: -156, y: -32, w: 32, d: 64, r: 2 }, box: { x: -152, y: -36, w: 20, d: 72, r: 3 }, z0: 7, z1: 84 };
const GL = { base: { x: -104, y: -32, w: 26, d: 64, r: 2 }, x: -93, y0: -30, y1: 30, z0: 10, z1: 70, bar: 3 };
const SHEER = { x: -87.6, y0: -28.5, y1: 28.5, gather: 11, z0: 13, z1: 68, n: 11 };
const BOX = { base: { x: -58, y: -40, w: 88, d: 80, r: 2 }, x0: -54, x1: 26, y0: -36, y1: 36, t: 4, z0: 10, zFar: 44, zNear: 14, port: { y0: -20, y1: 20, z0: 14, z1: 38 } };
const WX = 13, CELL = [-6, 2], TABLE = { x: -14, y: -6, w: 16, d: 16, r: 0.8 }, TABLE_H = 6;
const METER = { pad: { x: 70, y: -30, w: 56, d: 52, r: 4 }, c: [98, -4], R: 22, z: 8, h: 10 };
const RACK = { x: -44, y: 41, w: 82, d: 12, r: 2, h: 8 }, CARDS = [-30, -3, 24];
const FINISH_IDS = ["walnut", "white", "marble"];
const DF_MAX = 15;  // the dial reads 0 to 15 %

const P = k.fitProjection(
  [...k.boxCorners(PLATE, -PLATE_H - FOOT_H, 0), [LAMP.box.x, LAMP.box.y, LAMP.z1 + 6], [LAMP.box.x + LAMP.box.w, LAMP.box.y, LAMP.z1 + 6], [BOX.x0, BOX.y0, BOX.zFar], [CARDS[2] + 12, RACK.y + 6, 50]],
  WIDTH, HEIGHT, { pad: 22, azimuth: 40, elevation: 38 },
);
const at = (p) => k.iso(p, P);
const S = (paths, style) => k.solidSvg(paths, style);
const L = (d, style) => k.lineSvg(d, style);
const D = (pts, style) => k.dotsSvg(pts, style);
const seg = (a, b) => k.segment(a, b, P);
const poly = (pts, closed = false) => k.pathOf(pts.map(at), closed);
const byDepth = (pts) => [...pts].sort((a, b) => k.depthOf([a[0], a[1], 0], P) - k.depthOf([b[0], b[1], 0], P));
const slab = (plan, z, h, steps = 3, bevel = 0) => k.slabOf(plan, z, h, P, steps, bevel);

function knob(x, y, z, r, h, angle) {
  return [
    S(k.cylinder(x, y, r + 0.9, z, 1.2, P, 28), { tone: "lo" }),
    S(k.cylinder(x, y, r, z + 1.2, h, P, 28, 0.4), { tone: "mid" }),
    L(k.knurl(x, y, r, z + 1.2, z + 1.2 + h, 30, P), { tone: "lo" }),
    L(k.lineOnTop([x, y], [x + r * Math.cos(angle), y + r * Math.sin(angle)], z + 1.2 + h, P), { tone: "hi" }),
    D([at([x, y, z + 1.2 + h])], { size: 0.5, tone: "hi" }),
  ].join("");
}

// ------------------------------------------------------------------ the bench
function plate() {
  const out = [`<path class="iso-halo" d="${k.haloOf(PLATE, -PLATE_H - FOOT_H, PLATE_H, P)}"/>`];
  for (const [x, y] of byDepth(k.corners(PLATE, 22))) {
    out.push(S(k.cylinder(x, y, 7, -PLATE_H - FOOT_H, 1.6, P, 28), { tone: "lo" }));
    out.push(S(k.cylinder(x, y, 5.4, -PLATE_H - FOOT_H + 1.6, FOOT_H - 1.6, P, 28), { tone: "mid" }));
  }
  out.push(S(slab(PLATE, -PLATE_H, PLATE_H, 8, 1.6), { tone: "mid" }));
  out.push(L(k.planOutline(k.insetPlan(PLATE, 5), 0, P), { tone: "lo" }));
  const screws = k.corners(PLATE, 10);
  out.push(L(screws.map(([x, y]) => k.ring(x, y, 2.2, 0, P, 16)).join(""), { tone: "lo" }));
  out.push(D(screws.map(([x, y]) => at([x, y, 0])), { size: 0.5 }));
  // a ruler strip along the front edge and a label plate at its end
  const strip = { x: -150, y: PLATE.y + PLATE.d - 13, w: 206, d: 6, r: 1 };
  out.push(S(slab(strip, 0, 0.6, 3), { tone: "lo", crease: "none" }));
  const t = k.topTicks(strip.x + 4, strip.x + strip.w - 4, 4, 5, strip.y + 0.8, 0.6, [1.8, 3.4], P);
  out.push(L(t.minor, { tone: "lo" }), L(t.major, { tone: "mid" }));
  const lp = { x: 74, y: PLATE.y + PLATE.d - 16, w: 52, d: 11, r: 1.5 };
  out.push(S(slab(lp, 0, 0.8, 4), { tone: "mid" }));
  out.push(L(k.planOutline(k.insetPlan(lp, 1.6), 0.8, P), { tone: "faint" }));
  for (const [i, w] of [[0, 30], [1, 22], [2, 26]]) out.push(L(k.lineOnTop([lp.x + 6, lp.y + 3.2 + i * 2.4], [lp.x + 6 + w, lp.y + 3.2 + i * 2.4], 0.8, P), { tone: "lo", free: true }));
  out.push(D([at([lp.x + 3, lp.y + 5.5, 0.8]), at([lp.x + lp.w - 3, lp.y + 5.5, 0.8])], { size: 0.45 }));
  return out.join("");
}
function rails() {
  const out = [];
  for (const y of RAILS) {
    out.push(S(slab({ x: RAIL_X[0], y, w: RAIL_X[1] - RAIL_X[0], d: 4, r: 1 }, 0, 3, 3, 0.4), { tone: "mid" }));
    out.push(D([RAIL_X[0] + 6, -40, RAIL_X[1] - 6].map((x) => at([x, y + 2, 3])), { size: 0.4 }));
  }
  for (const x of [RAIL_X[0] - 5, RAIL_X[1]]) {
    out.push(S(slab({ x, y: RAILS[0] - 3, w: 5, d: RAILS[1] - RAILS[0] + 10, r: 1.2 }, 0, 7, 3, 0.5), { tone: "mid" }));
    out.push(D([at([x + 2.5, RAILS[0] + 1, 7]), at([x + 2.5, RAILS[1] + 3, 7])], { size: 0.45 }));
  }
  return out.join("");
}
/** a carriage plate on the rails, with bushings at its corners */
function carriage(plan) {
  const out = [S(slab(plan, 3, 4, 3, 0.5), { tone: "mid" })];
  for (const [x, y] of byDepth([[plan.x + 4, RAILS[0] + 2], [plan.x + plan.w - 4, RAILS[0] + 2], [plan.x + 4, RAILS[1] + 2], [plan.x + plan.w - 4, RAILS[1] + 2]])) out.push(D([at([x, y, 7])], { size: 0.45, tone: "mid" }));
  return out.join("");
}

// ------------------------------------------------------------------ the sky: a lamp box with a diffuser facing the glass
function lamp() {
  const { base, box, z0, z1 } = LAMP, fx = box.x + box.w;
  const out = [carriage(base)];
  out.push(S(slab(box, z0, z1 - z0, 4, 0.8), { tone: "mid" }));
  // the diffuser: a lit panel on the face toward the glass, with its frame and a grid of LED rows behind it
  const pan = { y0: box.y + 6, y1: box.y + box.d - 6, z0: z0 + 7, z1: z1 - 7 };
  out.push(S(k.extrude([[fx, pan.y0], [fx + 1.2, pan.y0], [fx + 1.2, pan.y1], [fx, pan.y1]], pan.z0, pan.z1 - pan.z0, P), { tone: "hi", crease: "lo" }));
  const grid = [];
  for (let z = pan.z0 + 6; z < pan.z1 - 2; z += 6) grid.push(seg([fx + 1.2, pan.y0, z], [fx + 1.2, pan.y1, z]));
  out.push(L(grid.join(""), { tone: "faint" }));
  // vents on the top, a dimmer knob, a power lead to the bench edge
  for (let i = 0; i < 5; i++) out.push(L(k.planOutline({ x: box.x + 4, y: box.y + 10 + i * 6, w: 8, d: 2.2, r: 1.1 }, z1, P, 3), { tone: "lo" }));
  out.push(knob(box.x + 10, box.y + box.d - 10, z1, 3.2, 3, 0.6));
  out.push(k.wireSvg(at([box.x + 3, box.y + box.d - 4, z0 + 4]), at([box.x - 3, PLATE.y + PLATE.d - 20, 0]), { via: [at([box.x - 3, box.y + box.d - 4, z0 + 4]), at([box.x - 3, box.y + box.d + 6, 0])], tone: "lo" }));
  return out.join("");
}

// ------------------------------------------------------------------ the glazing: a framed pane on a carriage, and a sheer on a track in front of it
function glazing(back) {
  const { x, y0, y1, z0, z1, bar } = GL;
  const out = [];
  if (back === true) {
    out.push(carriage(GL.base));
    out.push(knob(GL.base.x + GL.base.w - 4, GL.base.y + GL.base.d - 5, 7, 2.2, 2.6, 1.2));
    out.push(S(k.cylinder(x, y0 - 3, 2.4, 7, z1 + 4 - 7, P, 18), { tone: "mid", crease: "none" }));
    // frame bars: bottom, far side, top
    out.push(S(slab({ x: x - 2, y: y0, w: 4, d: y1 - y0, r: 0.6 }, z0 - bar, bar, 2), { tone: "mid" }));
    out.push(S(slab({ x: x - 2, y: y0, w: 4, d: bar, r: 0.6 }, z0, z1 - z0, 2), { tone: "mid" }));
    // the pane: no fill, two glints from frame to frame
    const gx = x + 2;   // on the frame's front plane, so each glint lands on a bar's edge
    out.push(L([seg([gx, y0 + bar + 6, z0], [gx, y0 + bar + 26, z1]), seg([gx, y0 + bar + 14, z0], [gx, y0 + bar + 30, z1])].join(""), { tone: "faint" }));
    return out.join("");
  }
  if (back === "frame") {
    out.push(S(slab({ x: x - 2, y: y1 - bar, w: 4, d: bar, r: 0.6 }, z0, z1 - z0, 2), { tone: "mid" }));
    out.push(S(slab({ x: x - 2, y: y0, w: 4, d: y1 - y0, r: 0.6 }, z1, bar, 2), { tone: "mid" }));
    out.push(S(k.cylinder(x, y1 + 3, 2.4, 7, z1 + 4 - 7, P, 18), { tone: "mid", crease: "none" }));
    return out.join("");
  }
  // the sheer's track: a bar on two brackets over the pane
  out.push(S(slab({ x: SHEER.x - 1, y: y0 - 2, w: 3, d: y1 - y0 + 4, r: 0.8 }, z1 + 1, 2.4, 2), { tone: "mid" }));
  for (const y of [y0 - 1, y1 - 1]) out.push(S(slab({ x: x + 2, y, w: SHEER.x - x - 2, d: 2, r: 0.4 }, z1 + 1.6, 1.6, 2), { tone: "lo" }));
  return out.join("");
}
/** the sheer: a pleated strip hanging from the track, from y0 to y0 + span */
function sheerRing(span) {
  const { x, y0, n } = SHEER, a = 2.4, t = 0.6, front = [], back = [];
  for (let i = 0; i <= n; i++) { const y = y0 + (span * i) / n; front.push([x + (i % 2 ? a : 0), y]); back.push([x + (i % 2 ? a : 0) + t, y]) }
  return [...front, ...back.reverse()];
}
const sheerPaths = (span) => k.extrude(sheerRing(span), SHEER.z0, SHEER.z1 - SHEER.z0, P, { convex: false });

// ------------------------------------------------------------------ the room: an open box whose far walls carry the finish sample
function boxBack() {
  const { x0, x1, y0, y1, t, z0, zFar, port } = BOX;
  const out = [carriage(BOX.base)];
  out.push(S(slab({ x: x0, y: y0, w: x1 - x0, d: y1 - y0, r: 1.5 }, 7, z0 - 7, 3, 0.5), { tone: "mid" }));
  // west wall with the window port: four pieces round the opening
  const W = (ya, yb, za, zb) => S(slab({ x: x0, y: ya, w: t, d: yb - ya, r: 0.6 }, za, zb - za, 2), { tone: "mid" });
  out.push(W(y0, y1, z0, port.z0), W(y0, port.y0, port.z0, port.z1), W(port.y1, y1 - t, port.z0, port.z1), W(y0, y1 - t, port.z1, zFar));
  out.push(S(slab({ x: x0 + t, y: y0, w: x1 - x0 - t, d: t, r: 0.6 }, z0, zFar - z0, 2), { tone: "mid" }));
  out.push(D([[x0 + 2, y0 + 6], [x0 + 2, y1 - 8], [x0 + 12, y0 + 2], [x1 - 6, y0 + 2]].map(([a, b]) => at([a, b, zFar])), { size: 0.42 }));
  return out.join("");
}
/** the lining on the two far walls, in one finish: walnut (dark, straight grain), white (plain), marble (veins) */
function lining(id) {
  const { x0, x1, y0, y1, t, z0, zFar, port } = BOX, lx = x0 + t, ly = y0 + t, top = zFar - 0.6, ft = 1.0;
  const tone = id === "walnut" ? "lo" : "hi";
  const out = [];
  const west = (ya, yb, za, zb) => S(k.extrude([[lx, ya], [lx + ft, ya], [lx + ft, yb], [lx, yb]], za, zb - za, P), { tone, crease: "faint", className: `lin-${id}` });
  out.push(west(ly, port.y0, z0, top), west(port.y1, y1 - t, z0, top), west(port.y0, port.y1, z0, port.z0 - 0.2), west(port.y0, port.y1, port.z1 + 0.2, top));
  out.push(S(k.extrude([[lx + ft, ly], [x1, ly], [x1, ly + ft], [lx + ft, ly + ft]], z0, top - z0, P), { tone, crease: "faint", className: `lin-${id}` }));
  const marks = [];
  if (id === "walnut") {
    for (let x = lx + 7; x < x1 - t - 3; x += 5.5 + ((x * 7) % 3)) marks.push(seg([x, ly + ft, z0], [x, ly + ft, top]));
  } else if (id === "marble") {
    marks.push(poly([[lx + 10, ly + ft, z0], [lx + 18, ly + ft, z0 + 12], [lx + 24, ly + ft, z0 + 15], [lx + 36, ly + ft, z0 + 31], [lx + 44, ly + ft, top]]));
    marks.push(poly([[lx + 46, ly + ft, z0], [lx + 52, ly + ft, z0 + 10], [lx + 66, ly + ft, z0 + 21], [x1, ly + ft, z0 + 26]]));
    marks.push(poly([[lx + 30, ly + ft, z0 + 24], [lx + 26, ly + ft, z0 + 36], [lx + 28, ly + ft, top]]));
    marks.push(poly([[lx + ft, port.y1 + 2, top], [lx + ft, port.y1 + 6, top - 9], [lx + ft, y1 - t, top - 18]]));
    marks.push(poly([[lx + ft, ly + 2, z0], [lx + ft, ly + 6, z0 + 3], [lx + ft, port.y0, z0 + 4]]));
  }
  if (marks.length) out.push(L(marks.join(""), { tone: id === "walnut" ? "faint" : "lo" }));
  return `<g data-finish="${id}" class="fin-${id}">${out.join("")}</g>`;
}
/** the room's floor tiles and its furniture at 1:20, so the box reads as the living room */
function roomModel() {
  const { x0, x1, y0, y1, t, z0 } = BOX, fz = z0 + 0.01, out = []
  const tiles = []
  for (let x = x0 + t + 12; x < x1 - t; x += 12) tiles.push(k.lineOnTop([x, y0 + t + 1], [x, y1 - t], fz, P))
  for (let y = y0 + t + 7; y < y1 - t; y += 6) tiles.push(k.lineOnTop([x0 + t + 1, y], [x1 - t, y], fz, P))
  out.push(L(tiles.join(""), { tone: "faint" }))
  // a sofa along the near low wall, its back to the camera like the photograph, and a stool
  out.push(S(slab({ x: x0 + 18, y: y1 - t - 12, w: 40, d: 9, r: 1.6 }, z0, 4, 3, 0.3), { tone: "mid" }))
  out.push(S(slab({ x: x0 + 18, y: y1 - t - 4, w: 40, d: 3.6, r: 1.2 }, z0 + 4, 4, 3), { tone: "mid" }))
  for (const x of [x0 + 18, x0 + 54.4]) out.push(S(slab({ x, y: y1 - t - 12, w: 3.6, d: 8.6, r: 1.2 }, z0 + 4, 2.6, 3), { tone: "mid" }))
  out.push(S(k.cylinder(x1 - t - 10, -6, 3.2, z0, 5, P, 20), { tone: "mid" }))
  return out.join("")
}
function cell() {
  const [x, y] = CELL, tz = BOX.z0 + TABLE_H;
  return [
    S(slab(TABLE, BOX.z0, TABLE_H, 2, 0.4), { tone: "hi", crease: "lo" }),
    S(k.cylinder(x, y, 5, tz, 1.8, P, 32, 0.4), { tone: "mid" }),
    S(k.cylinder(x, y, 3.2, tz + 1.8, 1.4, P, 28), { tone: "hi" }),
    L(k.ring(x, y, 2, tz + 3.2, P, 20), { tone: "lo" }),
    D([at([x - 4, y, tz + 1.8]), at([x + 4, y, tz + 1.8])], { size: 0.4 }),
  ].join("");
}
/** the TV frame on the back wall, over whichever lining is in: a marble surround, the screen, a plinth */
function tvWall() {
  const ly = BOX.y0 + BOX.t + 1.0, fx0 = BOX.x0 + 16, fx1 = BOX.x1 - 12, z0 = BOX.z0
  return [
    S(k.extrude([[fx0, ly], [fx1, ly], [fx1, ly + 1.4], [fx0, ly + 1.4]], z0 + 11, 13, P), { tone: "mid", crease: "faint" }),
    S(k.extrude([[fx0 + 9, ly + 1.4], [fx1 - 4, ly + 1.4], [fx1 - 4, ly + 1.9], [fx0 + 9, ly + 1.9]], z0 + 13.5, 8, P), { tone: "lo", crease: "none", className: "fin-walnut" }),
    S(slab({ x: fx0 - 2, y: ly, w: fx1 - fx0 + 4, d: 4.4, r: 0.6 }, z0, 3.4, 2), { tone: "mid" }),
  ].join("")
}
function boxFront() {
  const { x0, x1, y0, y1, t, z0, zNear } = BOX;
  return [
    S(slab({ x: x1 - t, y: y0 + t, w: t, d: y1 - y0 - t, r: 0.6 }, z0, zNear - z0, 2), { tone: "mid" }),
    S(slab({ x: x0, y: y1 - t, w: x1 - x0, d: t, r: 0.6 }, z0, zNear - z0, 2), { tone: "mid" }),
    L(k.planOutline({ x: WX - 3, y: y1 - t - 0.2, w: 6, d: t + 0.4, r: 1.5 }, zNear, P, 3), { tone: "lo" }),
  ].join("");
}

// ------------------------------------------------------------------ the sample rack: three finish cards, the one in the box is out of its slot
function rack() {
  const out = [S(slab(RACK, 0, RACK.h, 3, 0.6), { tone: "mid" })];
  for (const x of CARDS) out.push(L(k.planOutline({ x: x - 12, y: RACK.y + 4.6, w: 24, d: 2.8, r: 0.8 }, RACK.h, P, 2), { tone: "lo" }));
  out.push(D([at([RACK.x + 3, RACK.y + 6, RACK.h]), at([RACK.x + RACK.w - 3, RACK.y + 6, RACK.h])], { size: 0.45 }));
  return out.join("");
}
function card(i) {
  const id = FINISH_IDS[i], x = CARDS[i], z0 = RACK.h - 4, z1 = RACK.h + 30;
  const plan = { x: x - 11, y: RACK.y + 5, w: 22, d: 2, r: 0.6 };
  const tone = id === "walnut" ? "lo" : "hi";
  const out = [S(slab(plan, z0, z1 - z0, 2, 0.3), { tone, crease: id === "walnut" ? "faint" : "lo" })];
  const fy = plan.y + plan.d, marks = [];
  if (id === "walnut") for (const dx of [-7, -3.5, 1, 5, 8]) marks.push(seg([x + dx, fy, z0 + 4], [x + dx, fy, z1]));
  if (id === "marble") { marks.push(poly([[x - 11, fy, z0 + 10], [x - 4, fy, z0 + 15], [x + 2, fy, z0 + 24], [x + 6, fy, z1]])); marks.push(poly([[x + 1, fy, z0 + 20], [x + 11, fy, z0 + 18]])) }
  if (id === "white") marks.push(seg([x - 11, fy, z1 - 6], [x + 11, fy, z1 - 6]));
  if (marks.length) out.push(L(marks.join(""), { tone: id === "walnut" ? "faint" : "lo" }));
  return `<g data-card="${id}" class="fin-${id}">${out.join("")}</g>`;
}

// ------------------------------------------------------------------ the meter: a face-up dial reading DF from 0 to 15 %
function meter() {
  const { pad, c: [x, y], R, z, h } = METER, top = z + h;
  const out = [S(slab(pad, 0, z, 4, 0.8), { tone: "mid" })];
  out.push(D(k.corners(pad, 4).map(([a, b]) => at([a, b, z])), { size: 0.45 }));
  out.push(S(k.cylinder(x, y, R, z, h, P, 72, 0.8), { tone: "hi", crease: "lo" }));
  out.push(L(k.knurl(x, y, R, top - 3.4, top, 90, P, 0.3), { tone: "lo" }));
  out.push(L(k.sideArc(x, y, R, top - 3.4, P, 40), { tone: "faint" }));
  out.push(L(k.ring(x, y, R - 2.2, top, P, 72), { tone: "lo" }));
  const span = (300 / 360) * Math.PI * 2, from = Math.PI - span / 2 + Math.PI;
  const t = k.radialTicks(x, y, R - 3, 30, 5, top, [1.3, 2.8], P, from, span);
  out.push(L(t.minor, { tone: "lo" }), L(t.major, { tone: "mid" }));
  out.push(k.faceTextSvg(k.topMatrix([x, y + 9], top, P, "x"), "DF %", { size: 2.6, tone: "lo", anchor: "middle" }));
  out.push(S(k.slabOf({ x: x + R - 1, y: y - 2.4, w: 5, d: 4.8, r: 1.2 }, z + 2, 5, P, 3), { tone: "mid" }));
  out.push(knob(x + R + 7, y, z + 1, 2.6, 4, 0.3));
  out.push(L(k.ring(x, y, 1.6, top, P, 16), { tone: "mid" }));
  return out.join("");
}
const NEEDLE = { span: (300 / 360) * Math.PI * 2 };
const needleAt = (df) => {
  const [x, y] = METER.c, R = METER.R, top = METER.z + METER.h;
  const a = Math.PI - NEEDLE.span / 2 + Math.PI + (Math.min(df, 15) / 15) * NEEDLE.span;
  // radialTicks: angle 0 points to −y and grows clockwise seen from above
  return k.lineOnTop([x - Math.sin(a) * 3.4, y + Math.cos(a) * 3.4], [x + Math.sin(a) * (R - 4.5), y - Math.cos(a) * (R - 4.5)], top + 0.2, P);
};

// the cable: photocell, over the low wall through its grommet, down the box, along the bench to the meter
const wire = k.wireSvg(at([CELL[0] + 4.6, CELL[1] + 1, BOX.z0 + TABLE_H + 1]), at([METER.pad.x, -10, 3]), {
  via: [at([TABLE.x + TABLE.w, CELL[1] + 1, BOX.z0 + TABLE_H - 1]), at([TABLE.x + TABLE.w + 1, CELL[1] + 1, BOX.z0 + 0.4]), at([WX, CELL[1] + 1, BOX.z0 + 0.4]), at([WX, BOX.y1 - BOX.t - 1, BOX.z0 + 0.4]), at([WX, BOX.y1 - BOX.t + 0.2, BOX.zNear + 0.4]), at([WX, BOX.y1 + 2, BOX.zNear - 2]), at([WX, BOX.y1 + 2.5, 3]), at([52, BOX.y1 + 2.5, 3]), at([METER.pad.x - 8, -10, 3])],
  tone: "mid",
});

const R0 = DLm.daylightFactor("walnut", 0);
const body = [
  plate(), rails(), lamp(), glazing(true), glazing("frame"),
  `<g data-part="sheer" class="sheer"></g>`,
  glazing(false),
  boxBack(),
  ...FINISH_IDS.map((id) => lining(id)),
  roomModel(), tvWall(), cell(), boxFront(), wire, rack(),
  ...FINISH_IDS.map((_, i) => card(i)),
  meter(),
  `<path data-part="needle" class="iso-line" data-tone="lit" data-free="" d="${needleAt(R0.DF)}" style="stroke-width:1.15"/>`,
];
const svg = k.figureSvg({
  width: WIDTH, height: HEIGHT,
  label: "日光系数测试台：左边的灯箱当作天空，中间是玻璃和一块可以拉开、拉上的纱帘，右边是一个敞口的盒子，代表客厅，它的两面内壁贴着电视墙饰面的样板；盒底的光电池接到表上，读数就是室内与室外照度之比，即日光系数。",
  body: body.join(""),
});

// ------------------------------------------------------------------ the live page
const shared = readFileSync(join(HERE, "../shared/daylight.mjs"), "utf8").replace(/\r\n/g, "\n");
const names = [...shared.matchAll(/^export\s+(?:const|function)\s+(\w+)/gm)].map((m) => m[1]);
const DL = `const DL = (() => {\n${shared.replace(/^export\s+/gm, "")}\nreturn { ${names.join(", ")} }\n})();`;
const live = `
${DL}
const P = ${JSON.stringify(P)};
const SHEER = ${JSON.stringify(SHEER)}, METER = ${JSON.stringify(METER)}, NEEDLE = ${JSON.stringify(NEEDLE)};
const FINISH_IDS = ${JSON.stringify(FINISH_IDS)};
const stage = document.querySelector(".iso-stage"), svg = stage.querySelector("svg");
const sheerG = svg.querySelector('[data-part="sheer"]'), needle = svg.querySelector('[data-part="needle"]');
const readout = document.querySelector("[data-readout]"), liveEl = document.querySelector("[data-live]");
const still = matchMedia("(prefers-reduced-motion: reduce)");
const sheerRing = ${sheerRing.toString()};
const needleAt = ${needleAt.toString().replace(/k\.lineOnTop/g, "lineOnTop")};
const state = { finish: "walnut", sheer: 0 };
const anim = { span: SHEER.gather, spanV: 0, df: DL.daylightFactor("walnut", 0).DF, dfV: 0, cover: 0 };
let frame = 0, last = 0, visible = false, touring = !still.matches, tourT = 0, tourI = 0, idle = 0;
const TOUR = [["walnut", 0], ["walnut", 1], ["white", 1], ["white", 0], ["marble", 0]];
const fmt1 = (v) => v.toFixed(1);
function apply(user) {
  for (const g of svg.querySelectorAll("[data-finish]")) g.style.opacity = g.dataset.finish === state.finish ? "1" : "0";
  for (const g of svg.querySelectorAll("[data-card]")) g.style.opacity = g.dataset.card === state.finish ? "0" : "1";
  for (const b of document.querySelectorAll("[data-set]")) { const [kk, v] = b.dataset.set.split(":"); const on = kk === "finish" ? state.finish === v : String(state.sheer) === v; b.classList.toggle("on", on); b.setAttribute("aria-pressed", on) }
  if (user && window.parent !== window) window.parent.postMessage({ ns: "moshi", type: "daylight", finish: state.finish, sheer: state.sheer ? "closed" : "open", df: DL.daylightFactor(state.finish, state.sheer).DF }, "*");
  run();
}
function draw() {
  const span = anim.span;
  sheerG.innerHTML = solidSvg(extrude(sheerRing(span), SHEER.z0, SHEER.z1 - SHEER.z0, P, { convex: false }), { tone: "lo", crease: "none" });
  needle.setAttribute("d", needleAt(anim.df));
  const r = DL.daylightFactor(state.finish, state.sheer);
  const text = "DF " + fmt1(anim.df) + " % · T " + r.T.toFixed(2) + " · R " + r.R.toFixed(2);
  if (readout.textContent !== text) readout.textContent = text;
  stage.setAttribute("aria-valuetext", text);
}
function tick(now) {
  const dt = last ? Math.min((now - last) / 1000, 1 / 30) : 1 / 60; last = now;
  if (touring) { tourT += dt; if (tourT > 2.6) { tourT = 0; tourI = (tourI + 1) % TOUR.length; state.finish = TOUR[tourI][0]; state.sheer = TOUR[tourI][1]; apply(false) } }
  const span = state.sheer ? SHEER.y1 - SHEER.y0 : SHEER.gather, df = DL.daylightFactor(state.finish, state.sheer).DF;
  const calm = still.matches;
  // the sheer runs on its track (a spring); the needle settles like a damped meter movement
  const step = (x, v, to, kk, c) => { for (let i = 0; i < 4; i++) { v += ((to - x) * kk - v * c) * dt / 4; x += v * dt / 4 } return [x, v] };
  if (calm) { anim.span = span; anim.df = df; anim.spanV = anim.dfV = 0 } else { [anim.span, anim.spanV] = step(anim.span, anim.spanV, span, 60, 15); [anim.df, anim.dfV] = step(anim.df, anim.dfV, df, 90, 11) }
  draw();
  const settled = !touring && Math.abs(anim.span - span) < 0.01 && Math.abs(anim.df - df) < 0.002 && Math.abs(anim.spanV) < 0.01 && Math.abs(anim.dfV) < 0.01;
  frame = visible && !settled ? requestAnimationFrame(tick) : 0;
}
const run = () => { if (!frame && visible) { last = 0; frame = requestAnimationFrame(tick) } };
function act(kk, v) {
  touring = false; clearTimeout(idle); idle = setTimeout(() => { touring = !still.matches; tourT = 0; run() }, 9000);
  if (kk === "finish" && FINISH_IDS.includes(v)) state.finish = v;
  if (kk === "sheer") state.sheer = v === "toggle" ? 1 - state.sheer : Number(v) ? 1 : 0;
  apply(true);
  const r = DL.daylightFactor(state.finish, state.sheer);
  liveEl.textContent = DL.FINISHES[state.finish].name + "，纱帘" + (state.sheer ? "拉上" : "拉开") + "，日光系数 " + fmt1(r.DF) + " %";
}
for (const b of document.querySelectorAll("[data-set]")) b.addEventListener("click", () => { const [kk, v] = b.dataset.set.split(":"); act(kk, v) });
stage.addEventListener("keydown", (e) => {
  const m = { "1": ["finish", "walnut"], "2": ["finish", "white"], "3": ["finish", "marble"], s: ["sheer", "toggle"], S: ["sheer", "toggle"] }[e.key];
  if (!m) return; e.preventDefault(); act(...m);
});
stage.addEventListener("pointerenter", () => { touring = false; clearTimeout(idle) });
stage.addEventListener("pointerleave", () => { clearTimeout(idle); idle = setTimeout(() => { touring = !still.matches; tourT = 0; run() }, 4000) });
new IntersectionObserver((es) => { visible = es[es.length - 1].isIntersecting; if (visible) run() }, { rootMargin: "120px 0px" }).observe(stage);
// the page that embeds this figure can set it too (the apartment page keeps it in step with nothing else: one way only)
addEventListener("message", (e) => { if (e.source !== window.parent || window.parent === window) return; const d = e.data; if (!d || d.ns !== "moshi" || d.type !== "bench") return; if (FINISH_IDS.includes(d.finish)) state.finish = d.finish; if (d.sheer === "open" || d.sheer === "closed") state.sheer = d.sheer === "closed" ? 1 : 0; touring = false; apply(false) });
window.bench = { act, state };
// tell the embedding page how tall this page is (under file:// it cannot measure a frame from another file)
if (window.parent !== window) { const tell = () => { const last = document.querySelector(".db-controls").getBoundingClientRect(); window.parent.postMessage({ ns: "moshi", type: "size", h: Math.ceil(last.bottom + scrollY + 28) }, "*") }; new ResizeObserver(tell).observe(document.body); tell() }
apply(false); draw();
`;

const css = `
.fin-walnut{--anatomy-paper:#3b3029;--anatomy-face:#3b3029;--anatomy-top:#463a31;--anatomy-shade-0:#2b231e;--anatomy-shade-1:#312822;--anatomy-shade-2:#372d26;--anatomy-shade-3:#3e332b;--anatomy-faint:#5a4b3f;--anatomy-lo:#6e5d4f}
.iso[data-theme="dark"] .fin-walnut,.iso:not([data-theme]) .fin-walnut{--anatomy-paper:#2a221d;--anatomy-face:#2a221d;--anatomy-top:#33291f;--anatomy-shade-0:#1d1814;--anatomy-shade-1:#221c17;--anatomy-shade-2:#271f1a;--anatomy-shade-3:#2d241e;--anatomy-faint:#43372d;--anatomy-lo:#57483b}
.sheer{--anatomy-shade-0:var(--anatomy-shade-3);--anatomy-shade-1:var(--anatomy-shade-3);--anatomy-shade-2:var(--anatomy-top);--anatomy-shade-3:var(--anatomy-top)}
.iso [data-finish],.iso [data-card]{transition:opacity .55s ease}
@media (prefers-reduced-motion: reduce){.iso [data-finish],.iso [data-card]{transition:none}}
.iso .lin-walnut .iso-top,.iso .lin-walnut path{}
.iso-stage{outline:none;touch-action:pan-y}
.iso-stage:focus-visible{outline:1px solid var(--anatomy-muted);outline-offset:6px}
.db-controls{display:flex;flex-wrap:wrap;gap:8px;margin:14px 0 0;align-items:center;font:12px/1 var(--anatomy-mono)}
.db-controls span{color:var(--anatomy-muted);margin-right:2px}
.db-controls button{font:inherit;color:var(--anatomy-text);background:transparent;border:1px solid var(--anatomy-lo);border-radius:999px;padding:7px 12px;cursor:pointer}
.db-controls button:hover{border-color:var(--anatomy-mid);color:var(--anatomy-strong)}
.db-controls button.on{background:var(--anatomy-strong);color:var(--anatomy-card);border-color:var(--anatomy-strong)}
.db-controls button:focus-visible{outline:1px solid var(--anatomy-muted);outline-offset:3px}
.db-controls kbd{font:inherit;opacity:.6;margin-left:6px}
.db-sr{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap}
.iso-page{margin:24px auto 32px}
body{font-family:ui-sans-serif,system-ui,-apple-system,"Segoe UI","PingFang SC","Microsoft YaHei",sans-serif}
`;
const plateHtml = k.plateHtml({
  fig: "Fig 2",
  title: "日光系数测试台",
  hint: "按 1–3 换饰面，S 拉纱帘",
  readout: `DF ${R0.DF.toFixed(1)} % · T ${R0.T.toFixed(2)} · R ${R0.R.toFixed(2)}`,
  keys: [
    { mark: "lit", label: "照度计指针：盒内与灯箱照度之比，就是日光系数 DF（0–15 %）" },
    { mark: "raised", label: "盒子内壁的样板：电视墙饰面，决定室内平均反射率 R" },
    { mark: "flat", label: "纱帘：拉上时玻璃透光率 T 从 0.62 降到 0.34" },
  ],
  caption: `左边的灯箱当作天空，中间是落地玻璃和纱帘，右边敞口的盒子代表客厅，内壁贴着电视墙的饰面样板，盒底的光电池把盒内照度与灯箱照度之比读在表上。读数按 BRE 平均日光系数公式 DF = T·Aw·θ / (A(1 − R²)) 计算，参数与 3D 模型相同：拉上纱帘，T 从 0.62 降到 0.34，DF 从 ${DLm.daylightFactor("walnut", 0).DF.toFixed(1)} % 降到 ${DLm.daylightFactor("walnut", 1).DF.toFixed(1)} %；把胡桃木换成白漆，R 只从 ${DLm.daylightFactor("walnut", 0).R.toFixed(2)} 升到 ${DLm.daylightFactor("white", 0).R.toFixed(2)}，DF 只多 ${((DLm.daylightFactor("white", 0).DF / DLm.daylightFactor("walnut", 0).DF - 1) * 100).toFixed(0)} %——客厅的日光主要由窗决定。台子是示意，不按比例。`,
  body: `<div class="iso-stage" tabindex="0" role="group" aria-label="日光系数测试台：按 1 胡桃木、2 白漆、3 大理石，按 S 拉开或拉上纱帘">${svg}</div><span class="db-sr" aria-live="polite" data-live></span>`,
});
const controls = `<div class="db-controls" role="group" aria-label="测试条件"><span>饰面</span><button type="button" data-set="finish:walnut">胡桃木<kbd>1</kbd></button><button type="button" data-set="finish:white">白漆<kbd>2</kbd></button><button type="button" data-set="finish:marble">大理石<kbd>3</kbd></button><span style="margin-left:8px">纱帘</span><button type="button" data-set="sheer:0">拉开</button><button type="button" data-set="sheer:1">拉上<kbd>S</kbd></button></div>`;
const out = theme === "dark" ? "daylight-bench-dark.html" : "daylight-bench.html";
const html = k.pageHtml({ title: "墨石公寓 · 日光系数测试台", theme, body: `<style>${css}</style>${plateHtml}${controls}`, script: kitScript() + live, width: 680 }).replace('<html lang="en">', '<html lang="zh-CN">');
writeFileSync(join(HERE, out), html);
console.log("wrote", out, `(${(html.length / 1024).toFixed(0)} KB)`, "DF walnut/open", R0.DF.toFixed(2));
