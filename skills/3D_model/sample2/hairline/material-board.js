/**
 * Material board: a rounded tray holding six sample chips from the living room in the
 * reference, the way a designer presents a palette. The chip under the pointer stands up
 * and lifts; the ones in front lean forward and the ones behind lean back, staggered
 * outwards from it on the 700ms lift curve. Each chip is known by its own edge: a voile
 * sheer with a wavy hem, a fabric swatch with a pinked edge, a walnut veneer with its
 * grain, a thick marble slab with a chamfer and a vein, a porcelain tile, a black steel
 * angle. The read-out names the material and the number the daylight model uses for it.
 * The slider is the stagger, in ms.
 *
 * The pattern: one of many (after Riffle). Tweens, a stagger by distance, identity carried
 * by each chip's outline, and a hit test on static bands along the resting top edges.
 */
const {
  Cam, clamp, fillet, fit, hull, open, poly, proj, rad, ringAt, rrect, run, seg, facing,
  tdone, tset, tval, tween, disposer, mk, place, pointer, reflect, register,
} = HL;

const W = 64, H = 50, G = 15, N = 6;
const REST = -12, BACK = -26, FWD = 20, LIFT = 15;
const X0 = -6, X1 = W + 6, Y0 = -10, Y1 = (N - 1) * G + 10, WH = 16, WR = 6, WT = 2.4;
const NAMES = ["纱帘 · τ 0.55", "布艺 · 暖灰", "胡桃木 · ρ 0.12", "大理石 · ρ 0.70", "地砖 · ρ 0.45", "黑钢 · 哑光"];
const THICK = [0.5, 0.9, 1.1, 3.2, 2.6, 1.8];
const MARBLE = 3;

/** A run of points ordered left to right on screen. */
const LR = (pts) => (pts[0][0] <= pts[pts.length - 1][0] ? pts : pts.slice().reverse());

/** Each chip's outline in its own plane (u across, v up), and the marks it really carries. */
function chip(i) {
  const top = [];
  if (i === 0) { for (let u = W; u >= 0; u -= 2) top.push([u, H - 2 + 2 * Math.sin((u / 8) * Math.PI * 2)]) }
  else if (i === 1) { for (let u = W, k = 0; u > 0; u -= 3.2, k++) top.push([u, H - (k % 2 ? 2.4 : 0)]); top.push([0, H]) }
  if (top.length) return { shape: [[0, 0], [W, 0], ...top], marks: [] };
  if (i === 2) return { shape: fillet([[0, 0], [W, 0], [W, H], [0, H]], [1, 1, 2.4, 2.4]), marks: [[[14, 4], [14, H - 4]], [[27, 4], [27, H - 4]], [[44, 4], [44, H - 4]]] };
  if (i === 3) return { shape: fillet([[0, 0], [W, 0], [W, H - 9], [W - 9, H], [0, H]], [1, 1, 1, 1, 2]), marks: [[[5, 9], [17, 15], [29, 20], [41, 28], [W - 12, H - 5]]] };
  if (i === 4) return { shape: fillet([[0, 0], [W, 0], [W, H - 6], [0, H - 6]], [1, 1, 1.4, 1.4]), marks: [[[3, 5], [W - 3, 5]]] };
  return { shape: fillet([[0, 0], [W, 0], [W, H - 14], [W - 14, H - 14], [W - 14, H], [0, H]], [1, 1, 1.2, 1.2, 1.2, 1.2]), marks: [], holes: [[8, H - 8], [W - 22, H - 22]] };
}

/** The tray, which never moves: `far` is painted before the chips, `near` after them. */
function tray(P, front, outer, inner) {
  const far = [
    [poly(hull(ringAt(P, outer, 0).concat(ringAt(P, outer, WH)))), "sil"],
    [poly(ringAt(P, inner, WH)), "nf"],
    [open(ringAt(P, run(inner, (q) => !front(q)), 2.5)), "nf lo"],
  ];
  const iF = LR(ringAt(P, run(inner, front), WH)), oT = LR(ringAt(P, run(outer, front), WH)), oB = LR(ringAt(P, run(outer, front), 0));
  const hx = (X0 + X1) / 2, onFront = (ring) => ring.map((q) => P(q.u, Y1, q.v));
  const near = [
    [poly([...iF, oT[oT.length - 1], ...oB.slice().reverse(), oT[0]]), "fo"],
    [open(oT), "nf lo"],
    [open(iF), "nf"],
    [open([oT[0], ...oB, oT[oT.length - 1]]), "nf sil"],
    [poly(onFront(rrect(hx - 11, 5.5, hx + 11, 10.5, 2.5, 5))), "nf"],
  ];
  return { far, near };
}

/** Chip i leaning th degrees (negative leans back) and lifted: its paths and its marks. */
function pose(P, i, c, th, lift) {
  const yb = i * G, s = Math.sin(rad(th)), co = Math.cos(rad(th)), tk = THICK[i];
  const w = (u, v) => P(u, yb + v * s, v * co + lift);
  const wb = (u, v) => P(u, yb + v * s - tk * co, v * co + tk * s + lift);
  return {
    back: poly(c.shape.map((p) => wb(p[0], p[1]))),
    face: poly(c.shape.map((p) => w(p[0], p[1]))),
    marks: c.marks.map((m) => m.slice(1).map((q, k) => seg(w(...m[k]), w(...q))).join("")).join(""),
    holes: (c.holes ?? []).map((h) => w(h[0], h[1])),
  };
}

function mount({ stage, svg, read }, value) {
  const bag = disposer();
  let stag = value;
  const C = Cam(45, 0.5, 1.9);
  fit(C, [[X0, Y0, 0], [X1, Y1, -8], [X1, Y0, 0], [X0, Y1, 0], [X0, Y0, H], [X1, Y0, H + LIFT]], 200, 168);
  const P = proj(C), front = facing(C);
  const outer = rrect(X0, Y0, X1, Y1, WR, 6), inner = rrect(X0 + WT, Y0 + WT, X1 - WT, Y1 - WT, WR - WT, 6);
  const paths = tray(P, front, outer, inner);

  const g = mk("g", {}, svg);
  reflect(svg, g, P, front, outer, 0, 14);
  for (const [d, cls] of paths.far) mk("path", { d, class: cls }, g);

  const chips = [];
  for (let i = 0; i < N; i++) {
    const c = chip(i), grp = mk("g", {}, g);
    const back = mk("path", { class: "lo" }, grp), face = mk("path", { class: "sil" }, grp);
    const marks = mk("path", { class: i === MARBLE ? "nf hi" : "nf lo" }, grp);
    const holes = (c.holes ?? []).map(() => mk("circle", { r: 1.1, class: "dot off" }, grp));
    chips.push({ c, back, face, marks, holes, a: tween(REST), z: tween(0) });
  }
  for (const [d, cls] of paths.near) mk("path", { d, class: cls }, g);

  // hit bands along the RESTING top edges: they never move, and nothing draws them
  const top = (i) => P(W / 2, i * G + H * Math.sin(rad(REST)), H * Math.cos(rad(REST)));
  const c0 = top(0), c1 = top(1), d = [c1[0] - c0[0], c1[1] - c0[1]];
  const px0 = P(0, 0, 0), px1 = P(1, 0, 0), ex = [px1[0] - px0[0], px1[1] - px0[1]];
  const HALF = W / 2 + 6, det = d[0] * ex[1] - d[1] * ex[0];
  function hit([x, y]) {
    const qx = x - c0[0], qy = y - c0[1];
    const s = (qx * ex[1] - qy * ex[0]) / det, r = (d[0] * qy - d[1] * qx) / det;
    if (Math.abs(r) > HALF || s < -0.5 || s > N + 0.5) return -1;
    return clamp(Math.round(s), 0, N - 1);
  }

  function draw(i, th, lift) {
    const ch = chips[i], q = pose(P, i, ch.c, th, lift);
    ch.back.setAttribute("d", q.back);
    ch.face.setAttribute("d", q.face);
    ch.marks.setAttribute("d", q.marks);
    ch.holes.forEach((el, k) => place(el, q.holes[k]));
  }

  const B = register(stage, (_dt, now) => {
    let moving = false;
    chips.forEach((ch, i) => { draw(i, tval(ch.a, now), tval(ch.z, now)); if (!tdone(ch.a, now) || !tdone(ch.z, now)) moving = true; });
    return moving;
  });
  bag.add(B.unregister);

  let act = -1;
  /** Pulls chip a (-1 puts them all back); the stagger spreads out from the chip pulled, or the one let go. */
  function setActive(a) {
    if (a === act) return;
    const now = performance.now(), from = a >= 0 ? a : act;
    act = a;
    chips.forEach((ch, i) => {
      const delay = Math.abs(i - from) * stag;
      const th = a < 0 ? REST : i < a ? BACK : i > a ? FWD : 0;
      tset(ch.a, th, now, delay); tset(ch.z, a === i ? LIFT : 0, now, delay);
      ch.face.classList.toggle("hi", i === a);
      ch.marks.classList.toggle("hi", a < 0 ? i === MARBLE : i === a && ch.c.marks.length > 0);
      ch.marks.classList.toggle("lo", !(a < 0 ? i === MARBLE : i === a && ch.c.marks.length > 0));
    });
    read.textContent = a < 0 ? "rest" : NAMES[a];
    B.wake();
  }

  bag.add(pointer(stage, { move: (p) => setActive(hit(p)), leave: () => setActive(-1) }));
  bag.add(() => svg.replaceChildren());
  return { set: (v) => { stag = v; }, destroy: bag.dispose };
}

hairline({
  name: "material-board",
  means: "A material board from the reference room: the chip under the pointer stands up and gives its reflectance.",
  rules: [1, 2, 9, 10],
  range: [0, 45, 90],
  tour: [[200, 116], [262, 92], [150, 140], null],
  mount,
});
