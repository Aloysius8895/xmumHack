// The night recorder's model: what the camera and the microphone are reduced to, and when a mark is made.
// Pure functions of time and the list of injected events, shared by the build (prefill, checks) and the page.
//
// Facts used:
//   quiet bedroom about 30 dBA (WHO night-noise guideline: 30 dB(A) inside a bedroom for undisturbed sleep)
//   snoring roughly 50–60 dBA near the bed, a door slam 70+ dBA (typical published ranges)
//   resting breathing about 12–16 breaths a minute
// Demonstration assumptions (Night Canvas would tune them on real nights):
//   motion energy = share of IR pixels whose brightness changed by more than a fixed step since the last frame
//   a body turn peaks near 7–8 %, a small twitch near 1.3 %, breathing near 0.3 %
//   a movement event needs 2 %, a sound event 45 dBA, each with hysteresis

export const V = 6; // paper speed, world units per second (the figure runs in real time)
export const FPS = 10; // camera frames per second, the same as the device page
export const MOTION_T = 2.0; // % of pixels changed -> a movement event
export const MOTION_RE = 1.5; // re-arm below this
export const SOUND_T = 45; // dBA -> a sound event (the class comes from YAMNet on the device)
export const SOUND_RE = 41;
export const QUIET = 30; // dBA

// smooth bump: rise, hold, fall in seconds; 0 before the event
export function bump(age, rise, hold, fall) {
  if (age <= 0) return 0;
  if (age < rise) { const t = age / rise; return t * t * (3 - 2 * t); }
  if (age < rise + hold) return 1;
  const t = (age - rise - hold) / fall;
  return t >= 1 ? 0 : 1 - t * t * (3 - 2 * t);
}

// what each kind of event does to the two numbers
export const KINDS = {
  turn: { motion: [[0, 7.6, 0.5, 2.2, 1.1]], sound: [[0.2, 38, 0.4, 2.0, 0.8]] },
  twitch: { motion: [[0, 1.3, 0.15, 0.3, 0.4]], sound: [] },
  snore: { motion: [[0, 0.25, 0.4, 0.5, 0.5], [3.6, 0.25, 0.4, 0.5, 0.5], [7.2, 0.25, 0.4, 0.5, 0.5]], sound: [[0, 56, 0.25, 0.6, 0.45], [3.6, 57, 0.25, 0.6, 0.45], [7.2, 55, 0.25, 0.6, 0.45]] },
  door: { motion: [], sound: [[0, 72, 0.02, 0.08, 0.5]] },
};
export const SPAN = { turn: 4.5, twitch: 1.2, snore: 9, door: 1 };

export function motionAt(t, events) {
  let m = 0.32 + 0.1 * Math.sin((2 * Math.PI * t) / 4.3);
  for (const e of events) for (const [at, peak, r, h, f] of KINDS[e.kind].motion) m += peak * bump(t - e.t - at, r, h, f);
  return m;
}

// sound pressures add, so levels combine as 10 log10 of the summed powers
export function soundAt(t, events) {
  let p = Math.pow(10, QUIET / 10) * (1 + 0.18 * Math.sin(t * 1.7) * Math.sin(t * 0.61));
  for (const e of events) for (const [at, level, r, h, f] of KINDS[e.kind].sound) p += Math.pow(10, level / 10) * bump(t - e.t - at, r, h, f);
  return 10 * Math.log10(p);
}

// which injected event is loudest right now (on the device YAMNet names the class; here the source is known)
export function loudestAt(t, events) {
  let best = null, top = 0;
  for (const e of events) for (const [at, level, r, h, f] of KINDS[e.kind].sound) { const w = Math.pow(10, level / 10) * bump(t - e.t - at, r, h, f); if (w > top) { top = w; best = e.kind; } }
  return best;
}

// threshold crossing with hysteresis: returns the new armed flag and whether a mark is made now
export function cross(value, armed, on, off) {
  if (armed && value >= on) return { armed: false, mark: true };
  if (!armed && value < off) return { armed: true, mark: false };
  return { armed, mark: false };
}

// pen positions on the paper (world y): channel A motion 0..10 %, channel B sound 25..75 dBA
export const A0 = -33, A_PER = 2.2, B0 = 11, B_PER = 0.44, B_FROM = 25;
export const penA = (m) => A0 + A_PER * Math.max(0, Math.min(10, m));
export const penB = (L) => B0 + B_PER * (Math.max(B_FROM, Math.min(75, L)) - B_FROM);
