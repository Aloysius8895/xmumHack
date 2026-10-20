// 墨石公寓 · the daylight and lighting model shared by the 3D apartment (machine/) and the
// daylight-factor figure (anatomy/). Both pages inline this file at build time, so the numbers
// they show come from one place. Pure functions, no DOM.
//
// Sources
//   sun position      NOAA, "General Solar Position Calculations" (gml.noaa.gov/grad/solcalc/solareqns.PDF)
//   air mass          Kasten & Young (1989), m = 1 / (cos z + 0.50572 (96.07995 − z)^−1.6364)
//   daylight          IES Lighting Handbook, daylight availability, partly cloudy sky:
//                       sky on a horizontal plane  E_sky = 0.3 + 45 sin(α)  klux
//                       direct normal              E_dn  = 127.5 exp(−0.80 m) klux
//   daylight factor   BRE average daylight factor (Littlefair), DF = T · A_w · θ / (A · (1 − R²))   [%]
//   electric light    lumen method, E = Φ · UF · MF / A
// Demonstration assumptions (marked 假设 in the README): the site, the date, the sky type, the
// glass and sheer transmittances, the visible-sky angle, the surface reflectances, the fixtures.

const D2R = Math.PI / 180, R2D = 180 / Math.PI
const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x))

/** Kuala Lumpur, 2026-10-14 (day 287 of the year), local time UTC+8. */
export const SITE = { name: '吉隆坡', lat: 3.139, lon: 101.687, tz: 8, doy: 287, date: '2026-10-14' }

/** Sun altitude and azimuth (degrees, azimuth clockwise from north) at a local clock hour. NOAA equations. */
export function sunAt(hour, site = SITE) {
  const g = (2 * Math.PI / 365) * (site.doy - 1 + (hour - 12) / 24)
  const eqt = 229.18 * (0.000075 + 0.001868 * Math.cos(g) - 0.032077 * Math.sin(g) - 0.014615 * Math.cos(2 * g) - 0.040849 * Math.sin(2 * g))
  const decl = 0.006918 - 0.399912 * Math.cos(g) + 0.070257 * Math.sin(g) - 0.006758 * Math.cos(2 * g) + 0.000907 * Math.sin(2 * g) - 0.002697 * Math.cos(3 * g) + 0.00148 * Math.sin(3 * g)
  const tst = hour * 60 + eqt + 4 * site.lon - 60 * site.tz          // true solar time, minutes
  const ha = (tst / 4 - 180) * D2R                                      // hour angle
  const phi = site.lat * D2R
  const zen = Math.acos(clamp(Math.sin(phi) * Math.sin(decl) + Math.cos(phi) * Math.cos(decl) * Math.cos(ha), -1, 1))
  const a = Math.acos(clamp((Math.sin(decl) - Math.sin(phi) * Math.cos(zen)) / (Math.cos(phi) * Math.sin(zen)), -1, 1)) * R2D
  return { alt: 90 - zen * R2D, az: ha > 0 ? 360 - a : a, decl: decl * R2D, eqt }
}

/** Outdoor daylight for a sun altitude: sky illuminance on an unobstructed horizontal plane and direct normal illuminance (lx). */
export function skyAt(alt) {
  // below the horizon: a twilight decay fitted to 300 lx at sunset and about 3.4 lx at −6° (end of civil twilight)
  if (alt <= 0) return { Esky: 300 * Math.exp(0.746 * Math.max(alt, -18)), Edn: 0, m: Infinity }
  const zd = 90 - alt
  const m = 1 / (Math.cos(zd * D2R) + 0.50572 * Math.pow(96.07995 - zd, -1.6364))
  return { Esky: (0.3 + 45 * Math.sin(alt * D2R)) * 1000, Edn: 127500 * Math.exp(-0.8 * m), m }
}

/**
 * Direct sun on a vertical glazed façade whose outward normal points to azimuth `normalAz`.
 * A slab edge `overhang` metres deep over glazing `height` tall shades part of it (profile angle).
 */
export function onFacade(sun, Edn, normalAz, { overhang = 0.6, height = 2.85 } = {}) {
  const da = (sun.az - normalAz) * D2R
  const ci = Math.cos(sun.alt * D2R) * Math.cos(da)
  if (sun.alt <= 0 || ci <= 0) return { Ev: 0, lit: 0, cosI: Math.max(0, ci) }
  const tanProfile = Math.tan(sun.alt * D2R) / Math.cos(da)
  const shade = clamp((overhang * tanProfile) / height)
  return { Ev: Edn * ci * (1 - shade), lit: 1 - shade, cosI: ci }
}

/** The swappable finish on the living room's dark surfaces (TV wall veneer and the fluted return), with its reflectance. */
export const FINISHES = {
  walnut: { name: '胡桃木饰面', short: '胡桃木', rho: 0.12 },
  white: { name: '白色乳胶漆', short: '白漆', rho: 0.80 },
  marble: { name: '白色大理石', short: '大理石', rho: 0.70 },
}

/**
 * The living room as the daylight formula sees it. Sizes come from the 3D model (metres):
 * x −6 … −0.6, z −0.4 … 5.0, floor to ceiling 3.0. Each surface is [name, area m², reflectance];
 * `feature` marks the area that takes the swappable finish.
 */
export const ROOM = {
  w: 5.4, d: 5.4, h: 3.0,
  glazing: [
    { name: '西窗', w: 5.0, h: 2.85, az: 270 },
    { name: '南窗', w: 4.8, h: 2.85, az: 180 },
  ],
  frameFactor: 0.85,   // glass share of each opening (假设: slim aluminium frames)
  Tglass: 0.62,        // low-E double glazing, light transmittance with dirt (假设)
  tSheer: 0.55,        // sheer voile, light transmittance (假设; typical 0.5–0.7)
  theta: 75,           // visible-sky angle at the window, degrees (假设: high floor, open view)
  surfaces: [
    ['地面 · 抛光灰砖', 29.16, 0.45],
    ['天花 · 白漆', 29.16, 0.85],
    ['西窗玻璃', 14.25, 0.10],
    ['西墙其余', 1.95, 0.80],
    ['南窗玻璃', 13.68, 0.10],
    ['南墙其余', 2.52, 0.80],
    ['电视框 · 大理石', 4.05, 0.70],
    ['电视墙饰面', 6.15, 'feature'],
    ['走廊门洞', 3.78, 0.30],
    ['北墙其余', 2.22, 0.80],
    ['竖纹墙饰面', 3.60, 'feature'],
    ['通往餐厅的开口', 11.34, 0.35],
    ['开口上方', 1.26, 0.80],
  ],
}

/** Average daylight factor (%) of the living room for a finish and a sheer cover (0 open … 1 drawn). */
export function daylightFactor(finish = 'walnut', sheer = 0, room = ROOM) {
  const rhoF = (FINISHES[finish] ?? FINISHES.walnut).rho
  let A = 0, RA = 0
  for (const [, area, rho] of room.surfaces) { A += area; RA += area * (rho === 'feature' ? rhoF : rho) }
  const R = RA / A
  const Aw = room.glazing.reduce((s, g) => s + g.w * g.h, 0) * room.frameFactor
  const s = clamp(sheer)
  const T = room.Tglass * (1 - s + s * room.tSheer)
  return { DF: (T * Aw * room.theta) / (A * (1 - R * R)), T, Aw, A, R, rhoF }
}

/**
 * Electric light in the living room, lumen method. Each layer: power (W), flux (lm), utilisation factor.
 * Fixtures are typical catalogue values (假设); UF reflects a room with one dark wall.
 */
export const MF = 0.8
export const LAYERS = [
  { id: 'cove', name: '天花灯槽', note: '9 m · 10 W/m · 2700 K', W: 90, lm: 9000, UF: 0.30, K: 2700 },
  { id: 'track', name: '磁吸轨道灯', note: '6 × 10 W · 36°', W: 60, lm: 5100, UF: 0.55, K: 3000 },
  { id: 'strip', name: '电视墙灯带', note: '6.4 m · 10 W/m · 2400 K', W: 64, lm: 5760, UF: 0.12, K: 2400 },
  { id: 'lamp', name: '落地灯', note: '8 W · 806 lm', W: 8, lm: 806, UF: 0.45, K: 2700 },
]
export const layerLux = (L, dim = 1, floor = ROOM.w * ROOM.d) => (L.lm * dim * L.UF * MF) / floor

/** Lighting scenes: a target the controller holds against daylight, or a fixed recipe (dims 0–1). */
export const SCENES = {
  daily: { name: '日常', target: 140, recipe: { cove: 1, track: 0.7, strip: 0.6, lamp: 0.3 }, accent: 0.35 },
  host: { name: '会客', target: 175, recipe: { cove: 1, track: 1, strip: 1, lamp: 1 }, accent: 0.5 },
  movie: { name: '观影', fixed: { cove: 0, track: 0, strip: 0.7, lamp: 0.4 }, sheer: 1 },
  night: { name: '夜间', fixed: { cove: 0.08, track: 0, strip: 0.2, lamp: 0 }, sheer: 1 },
}

/** Dimmer levels for a scene given the daylight already on the floor (lx). */
export function dimsFor(sceneId, Eday) {
  const sc = SCENES[sceneId] ?? SCENES.daily
  if (sc.fixed) return { ...sc.fixed }
  const full = LAYERS.reduce((s, L) => s + layerLux(L, sc.recipe[L.id] ?? 0), 0)
  const k = clamp(Math.max(0, sc.target - Eday) / full)
  const d = Object.fromEntries(LAYERS.map((L) => [L.id, (sc.recipe[L.id] ?? 0) * k]))
  // after dusk the TV-wall strip stays on as an accent, even when the target is met
  if (Eday < 80) d.strip = Math.max(d.strip, sc.accent * clamp((80 - Eday) / 60))
  return d
}

/** TV picture contrast with room light reflected off the screen (movie scene). */
export const TV = { white: 450, black: 0.09, rho: 0.015 }   // cd/m², cd/m², screen diffuse reflectance (假设)
export function tvContrast(Eavg) {
  const Lr = (TV.rho * 0.5 * Eavg) / Math.PI                // vertical illuminance on the screen ≈ half the room average
  return (TV.white + Lr) / (TV.black + Lr)
}

export const hhmm = (h) => { const m = Math.round(h * 60); return `${String(Math.floor(m / 60) % 24).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}` }
