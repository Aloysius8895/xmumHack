/**
 * Brush pot: four brushes fanned in a round pot, one for each kind of night
 * event that Night Canvas paints. The brush under the pointer stands up and
 * lifts; the others lean away from it, staggered by distance on the 700ms lift
 * curve. Each brush is known by its head: a wide flat brush, a round
 * stippler, a long fine liner and a fat wash mop. The read-out names the
 * event and the stroke it becomes. The slider is the stagger, in ms.
 *
 * The pattern: one of many (after Riffle). Tweens, a stagger by distance,
 * identity carried by the heads, and a hit test on the resting heads' screen x.
 */
const {
  Cam, circ, clamp, facing, fit, hull, open, poly, proj, rad, rrect, run,
  tdone, tset, tval, tween, disposer, mk, pointer, reflect, register,
} = HL;

const R = 21, RT = 2.4, PH = 28, FLOOR = 3, LIFT = 12, BACK = 7;
const GAP = 7.2, SPREAD = [-14, -5, 5, 14], AWAY = 11;
const NAMES = ["翻身 · 宽笔", "鼾声 · 点", "关门 · 细线", "安静 · 底色"];

/** A brush: [length, ring at its foot, ring at its top, class] for handle, ferrule and head, bottom to top. */
const handle = [[44, circ(1.25, 12), circ(2.1, 12), ""], [8, circ(2.5, 12), circ(2.35, 12), ""]];
const HEADS = [
  [[13, rrect(-4.6, -1.5, 4.6, 1.5, 1.3, 3), rrect(-6.2, -0.7, 6.2, 0.7, 0.6, 3)]],
  [[8, circ(3.2, 12), circ(2.5, 12)]],
  [[19, circ(2.1, 12), circ(0.3, 8)]],
  [[8, circ(3.6, 12), circ(5.3, 14)], [7, circ(5.3, 14), circ(1.4, 10)]],
];

/** The pot: `far` is painted before the brushes, `near` after; each entry is [d, class]. */
function pot(P, front, outer, inner) {
  const at = (ring, z) => ring.map((q) => P(q.u, q.v, z));
  const LR = (pts) => (pts[0][0] <= pts[pts.length - 1][0] ? pts : pts.slice().reverse());
  const far = [
    [poly(hull(at(outer, 0).concat(at(outer, PH)))), "sil"],
    [poly(at(inner, PH)), "nf"],
    [open(at(run(inner, (q) => !front(q)), FLOOR + 6)), "nf lo"],
  ];
  const iF = LR(at(run(inner, front), PH)), oT = LR(at(run(outer, front), PH)), oB = LR(at(run(outer, front), 0));
  const near = [
    [poly([...iF, oT[oT.length - 1], ...oB.slice().reverse(), oT[0]]), "fo"],
    [open(iF), "nf"],
    [open(oT), "nf lo"],
    [open([oT[0], ...oB, oT[oT.length - 1]]), "nf sil"],
    [open(LR(at(run(outer, front), 7))), "nf lo"],
    [open(LR(at(run(outer, front), 10))), "nf lo"],
  ];
  return { far, near };
}

function mount({ stage, svg, read }, value) {
  const bag = disposer();
  let stag = value;
  const C = Cam(45, 0.5, 2.6);
  // fitted with a brush standing lifted and the outer ones leaning furthest, so no pose leaves the frame
  const side = [Math.SQRT1_2, -Math.SQRT1_2], back = [-Math.SQRT1_2, -Math.SQRT1_2];
  const reach = 2 + 44 + 8 + 19 + LIFT;
  fit(C, [[-R, -R, -6], [R, R, -6], [R, -R, 0], [-R, R, 0], [0, 0, reach],
    [side[0] * 46, side[1] * 46, 64], [-side[0] * 46, -side[1] * 46, 64]], 200, 170);
  const P = proj(C), front = facing(C);
  const outer = circ(R, 32), inner = circ(R - RT, 32);
  const paths = pot(P, front, outer, inner);

  const g = mk("g", {}, svg);
  reflect(svg, g, P, front, outer, 0, 12);
  for (const [d, cls] of paths.far) mk("path", { d, class: cls }, g);

  // bases on a line across the pot, so the brushes stand side by side on screen
  const brushes = SPREAD.map((_, i) => {
    const u = (i - 1.5) * GAP, segs = [...handle, ...HEADS[i]];
    const grp = mk("g", {}, g);
    const els = segs.map(() => ({ sil: mk("path", { class: "sil" }, grp), cr: mk("path", { class: "nf lo" }, grp) }));
    return { base: [u * side[0], u * side[1], FLOOR], segs, els, s: tween(SPREAD[i]), b: tween(BACK), z: tween(0) };
  });
  for (const [d, cls] of paths.near) mk("path", { d, class: cls }, g);

  /** The brush's paths with its axis leaning s degrees sideways and b back, lifted by lift. */
  function draw(br, s, b, lift) {
    const ss = Math.sin(rad(s)), sb = Math.sin(rad(b));
    const d = [ss * side[0] + sb * back[0], ss * side[1] + sb * back[1], Math.sqrt(Math.max(0.2, 1 - ss * ss - sb * sb))];
    const ring = (rg, t) => rg.map((q) => P(br.base[0] + d[0] * t + q.u, br.base[1] + d[1] * t + q.v, br.base[2] + d[2] * t + lift));
    let t = 0;
    br.segs.forEach(([len, r0, r1], k) => {
      br.els[k].sil.setAttribute("d", poly(hull(ring(r0, t).concat(ring(r1, t + len)))));
      br.els[k].cr.setAttribute("d", open(run(r1, front).map((q) => P(br.base[0] + d[0] * (t + len) + q.u, br.base[1] + d[1] * (t + len) + q.v, br.base[2] + d[2] * (t + len) + lift))));
      t += len;
    });
  }

  const B = register(stage, (_dt, now) => {
    let moving = false;
    for (const br of brushes) {
      draw(br, tval(br.s, now), tval(br.b, now), tval(br.z, now));
      if (!tdone(br.s, now) || !tdone(br.b, now) || !tdone(br.z, now)) moving = true;
    }
    return moving;
  });
  bag.add(B.unregister);

  // hit: the resting heads' screen x, and a band from above the tallest head down to the pot's rim
  const tipAt = (i) => { const br = brushes[i], ss = Math.sin(rad(SPREAD[i])); return P(br.base[0] + ss * side[0] * 64, br.base[1] + ss * side[1] * 64, 64); };
  const tips = brushes.map((_, i) => tipAt(i));
  const half = Math.abs(tips[1][0] - tips[0][0]) * 0.75, rim = P(0, 0, PH)[1], top = P(0, 0, reach + 8)[1];
  function hit([x, y]) {
    if (y < top || y > rim) return -1;
    let best = -1, dist = Infinity;
    tips.forEach((p, i) => { const dx = Math.abs(p[0] - x); if (dx < dist) { dist = dx; best = i; } });
    return dist <= half ? best : -1;
  }

  let act = -2;
  function setActive(a) {
    if (a === act) return;
    const now = performance.now(), from = a >= 0 ? a : Math.max(0, act);
    act = a;
    brushes.forEach((br, i) => {
      const delay = Math.abs(i - from) * stag;
      const s = a < 0 ? SPREAD[i] : i === a ? 0 : SPREAD[i] + (i < a ? -AWAY : AWAY);
      tset(br.s, clamp(s, -26, 26), now, delay); tset(br.b, a === i ? 0 : BACK, now, delay); tset(br.z, a === i ? LIFT : 0, now, delay);
      // the head is the highlight: the chosen brush's, or the wide brush's at rest
      const head = br.els.slice(2);
      head.forEach((el) => el.sil.classList.toggle("hi", a < 0 ? i === 0 : i === a));
    });
    read.textContent = a < 0 ? "rest" : NAMES[a];
    B.wake();
  }
  setActive(-1);

  bag.add(pointer(stage, { move: (p) => setActive(hit(p)), leave: () => setActive(-1) }));
  bag.add(() => svg.replaceChildren());

  return {
    set: (v) => { stag = v; },
    destroy: bag.dispose,
  };
}

hairline({
  name: "brush-pot",
  means: "笔筒里的四支笔，各对应一类夜间事件：指针下的那支立起来，读数说出它在晨画里画哪一种笔触。",
  rules: [1, 2, 4, 10],
  range: [0, 45, 90],
  tour: [[134, 98], [223, 98], [266, 98], null],
  mount,
});
