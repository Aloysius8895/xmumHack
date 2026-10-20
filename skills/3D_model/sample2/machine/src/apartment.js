// 墨石公寓 · the apartment on the Machine kit. build.mjs inlines this file after the kit and the shared
// daylight model (DL, from ../shared/daylight.mjs) into apartment.html.
//
// Research (step 1 of the skill). Metres, Y up, floor at y = 0, +x east, +z south.
//   footprint 12.0 × 10.0 m (120 m² to wall centre lines), floor to ceiling 3.0 m, exterior walls 0.20 m, partitions 0.12 m
//   rooms (centre lines):  living   x −6.0 … −0.6  z −0.4 … 5.0   29.2 m²   (the reference image)
//                          dining   x −0.6 …  2.8  z −0.4 … 5.0   18.4 m²
//                          kitchen  x  2.8 …  6.0  z −0.4 … 2.8   10.2 m²
//                          foyer    x  2.8 …  6.0  z  2.8 … 5.0    7.0 m²
//                          corridor x −6.0 …  6.0  z −1.6 … −0.4  14.4 m²  (with storage behind the TV wall)
//                          master bedroom −6.0 … −1.2, master bath −1.2 … 1.0, bedroom 2 1.0 … 4.2, bath 2 4.2 … 6.0 (z −5.0 … −1.6)
//   living room after the reference image (style and finish taken, layout invented for this plan):
//     TV wall of walnut veneer panels 0.53 m wide on a black backing; a marble frame 3.00 × 1.38 m standing 0.15 m off it,
//     bottom at 0.62 m, a 2400 K strip hidden under its bottom return; a niche with two black steel shelves; a 65-inch TV
//     (1.45 × 0.83 m); a floating marble plinth 0.34 m high and 0.43 m deep; a black steel framed opening 1.4 × 2.7 m to the
//     corridor; a fluted dark return wall with the intercom; floor-to-ceiling glazing on two sides (5.0 m and 4.8 m × 2.85 m)
//     with sheers on ceiling tracks; a 1.52 m six-blade black ceiling fan; two magnetic tracks with six spots; a cove light
//     along the east drop ceiling; two fabric sofas, a marble cube table, two black turned stools, a black floor lamp.
//   materials: walnut veneer ρ 0.12, white marble ρ 0.70 (bookmatched on the TV panel), light grey polished porcelain
//     1200 × 600 ρ 0.45, warm grey fabric, black satin steel, white paint ρ 0.80.
//   physics (shared/daylight.mjs): NOAA sun position for Kuala Lumpur on 2026-10-14, IES partly cloudy daylight, BRE
//     average daylight factor of the living room, the lumen method for four light layers, a scene controller that tops
//     daylight up to a target. Check: noon sky about 44 klx, DF 11.3 % open / 6.2 % behind sheers → about 5,000 / 2,750 lx.
//   the hero: average illuminance in the living room (lx); the input: the clock. No break-it: a room has no failure mode
//     worth inventing (3D_model/README.md asks not to force one). The movie scene computes TV contrast instead.

import { RectAreaLightUniformsLib } from 'three/addons/lights/RectAreaLightUniformsLib.js'
const { THREE, Lab, MAT, mat, setCaps, GEO, clamp, lerp, smoothstep, approach, fmt, ease, rng } = window.LabKit
const { SITE, sunAt, skyAt, onFacade, FINISHES, daylightFactor, LAYERS, layerLux, SCENES, dimsFor, tvContrast, hhmm } = DL

RectAreaLightUniformsLib.init()
setCaps('metal')

const H = 3.0, TE = 0.2, TI = 0.12
const X0 = -6, X1 = 6, Z0 = -5, Z1 = 5
const ROOMS = {
  liv: { name: '客厅', x: [-6, -0.6], z: [-0.4, 5] },
  din: { name: '餐厅', x: [-0.6, 2.8], z: [-0.4, 5] },
  kit: { name: '厨房', x: [2.8, 6], z: [-0.4, 2.8] },
  foy: { name: '玄关', x: [2.8, 6], z: [2.8, 5] },
  cor: { name: '走廊', x: [-6, 6], z: [-1.6, -0.4] },
  mbr: { name: '主卧', x: [-6, -1.2], z: [-5, -1.6] },
  mba: { name: '主卫', x: [-1.2, 1.0], z: [-5, -1.6] },
  br2: { name: '次卧', x: [1.0, 4.2], z: [-5, -1.6] },
  ba2: { name: '次卫', x: [4.2, 6], z: [-5, -1.6] },
}
for (const r of Object.values(ROOMS)) r.area = (r.x[1] - r.x[0] - 0.16) * (r.z[1] - r.z[0] - 0.16)

const narrow = () => innerWidth <= 760
const VIEWS = {
  overview: { az: -32, el: 38, dist: 2.3, target: [0.3, -0.2, 0.2], fov: 30 },
  living: { az: 4, el: -3.2, dist: 0.4, target: [-4.12, 1.52, -0.3], fov: 54 },
  plan: { az: 0, el: 89.4, dist: 2.3, target: [0.35, 0, 0.1], fov: 30 },
  apart: { az: -32, el: 27, dist: 3.25, target: [0.3, 3.0, 0.2], fov: 30 },
}

// ------------------------------------------------------------------ the lab
const lab = new Lab({
  prompt: '帮我用 3D_model 里的 skill，按这张室内设计参考图，设计一个公寓的 3D 模型',
  no: 1, title: '墨石公寓', sub: '三室两卫',
  size: 12,
  ground: -0.25, // Keep the studio floor at the structural slab bottom, below the floor finishes.
  view: VIEWS.overview,
  cut: { a: [0, 1, 0], b: [0, 1, 0], center: [0, 1.25, 0], reach: 0.32 },
  pills: ['three.js', '日光求解', '分层照明'],
})
const K = lab.k
lab.ao.updateGtaoMaterial({ samples: 8 })
lab.ao.updatePdMaterial({ samples: 8 })

// ------------------------------------------------------------------ procedural textures
function canvasTex(w, h, draw, { color = true, mirror = false } = {}) {
  const c = document.createElement('canvas'); c.width = w; c.height = h
  draw(c.getContext('2d'), w, h)
  const t = new THREE.CanvasTexture(c)
  t.wrapS = t.wrapT = mirror ? THREE.MirroredRepeatWrapping : THREE.RepeatWrapping
  t.anisotropy = 8
  t.colorSpace = color ? THREE.SRGBColorSpace : THREE.NoColorSpace
  return t
}
/** call f at the nine wrap offsets, so what it draws tiles without a seam */
const wrap9 = (w, h, f) => { for (const dx of [-w, 0, w]) for (const dy of [-h, 0, h]) f(dx, dy) }
function stroke(g, pts, w, col, blur, W, Hh) {
  g.filter = blur ? `blur(${blur}px)` : 'none'
  g.strokeStyle = col; g.lineWidth = w; g.lineJoin = g.lineCap = 'round'
  wrap9(W, Hh, (dx, dy) => { g.beginPath(); pts.forEach(([x, y], i) => (i ? g.lineTo(x + dx, y + dy) : g.moveTo(x + dx, y + dy))); g.stroke() })
  g.filter = 'none'
}
function blobs(g, R, W, Hh, n, r0, r1, rgb, a) {
  for (let i = 0; i < n; i++) {
    const x = R() * W, y = R() * Hh, r = r0 + R() * (r1 - r0), v = rgb.map((c) => Math.round(c + (R() - 0.5) * 16))
    wrap9(W, Hh, (dx, dy) => { const gr = g.createRadialGradient(x + dx, y + dy, 0, x + dx, y + dy, r); gr.addColorStop(0, `rgba(${v[0]},${v[1]},${v[2]},${a})`); gr.addColorStop(1, `rgba(${v[0]},${v[1]},${v[2]},0)`); g.fillStyle = gr; g.fillRect(x + dx - r, y + dy - r, 2 * r, 2 * r) })
  }
}
/** white marble: a cloudy ground, soft grey veins with crisp cores and branches, all along one drift direction */
function marbleTex(seed, { veins = 6, bold = 1, drift = 0.75, mirror = false } = {}) {
  return canvasTex(1024, 1024, (g, W) => {
    const R = rng(seed)
    g.fillStyle = '#e9e7e2'; g.fillRect(0, 0, W, W)
    blobs(g, R, W, W, 120, 60, 260, [204, 202, 197], 0.18)
    blobs(g, R, W, W, 60, 30, 120, [246, 245, 241], 0.35)
    const walk = (x, y, a, n, step) => { const p = [[x, y]]; for (let i = 0; i < n; i++) { a += (R() - 0.5) * 0.55; a = lerp(a, drift, 0.06); x += Math.cos(a) * step; y += Math.sin(a) * step; p.push([x, y]) } return p }
    for (let v = 0; v < veins; v++) {
      const p = walk(R() * W, R() * W, drift + (R() - 0.5) * 0.8, 150 + R() * 120, 7)
      const w = (0.6 + R() * 1.6) * bold
      stroke(g, p, 16 * w, 'rgba(150,150,154,0.10)', 9, W, W)
      stroke(g, p, 3.4 * w, 'rgba(138,139,144,0.30)', 1.8, W, W)
      stroke(g, p, 0.9 * w, 'rgba(108,109,114,0.55)', 0.3, W, W)
      for (let b = 0; b < 3; b++) {
        const s = p[Math.floor(R() * p.length)]
        const q = walk(s[0], s[1], drift + (R() < 0.5 ? 1 : -1) * (0.5 + R() * 0.6), 30 + R() * 50, 5)
        stroke(g, q, 1.2 * w, 'rgba(132,133,138,0.32)', 0.9, W, W)
      }
    }
    for (let i = 0; i < 40; i++) { const p = walk(R() * W, R() * W, R() * 6.3, 14 + R() * 30, 4); stroke(g, p, 0.7, 'rgba(120,120,124,0.35)', 0.4, W, W) }
  }, { mirror })
}
/** quarter-cut walnut: straight grain streaks, periodic along v so it tiles */
function veneerTex(seed, base = [44, 35, 29]) {
  return canvasTex(512, 1024, (g, W, Hh) => {
    const R = rng(seed)
    g.fillStyle = `rgb(${base})`; g.fillRect(0, 0, W, Hh)
    for (let i = 0; i < 640; i++) {
      const x0 = R() * W, k = 1 + Math.floor(R() * 3), ph = R() * 6.28, amp = 1 + R() * 5, lw = 0.5 + R() * 2.6
      const d = R() < 0.55 ? -1 : 1, s = 10 + R() * 22
      g.strokeStyle = `rgba(${base.map((c) => c + d * s).join(',')},${0.25 + R() * 0.35})`; g.lineWidth = lw
      for (const dx of [-W, 0, W]) { g.beginPath(); for (let y = 0; y <= Hh; y += 16) { const x = x0 + dx + Math.sin((y / Hh) * 6.283 * k + ph) * amp; y ? g.lineTo(x, y) : g.moveTo(x, y) } g.stroke() }
    }
    for (let i = 0; i < 900; i++) { g.fillStyle = `rgba(16,12,10,${0.2 + R() * 0.3})`; g.fillRect(R() * W, R() * Hh, 1, 3 + R() * 9) }
  })
}
/** fluting: rounded ribs across u, for a bump map */
const flutesTex = canvasTex(256, 16, (g, W, Hh) => { const n = 8; for (let x = 0; x < W; x++) { const t = (x / W) * n % 1; const v = Math.round(255 * Math.pow(Math.sin(Math.PI * t), 0.6)); g.fillStyle = `rgb(${v},${v},${v})`; g.fillRect(x, 0, 1, Hh) } }, { color: false })
/** large-format porcelain 1200 × 600, stacked: 2.4 × 2.4 m per tile of texture (colour and roughness) */
function tileTex(rough) {
  return canvasTex(1024, 1024, (g, W) => {
    const R = rng(rough ? 41 : 40), u = W / 2.4
    g.fillStyle = rough ? '#2a2a2a' : '#d1cfca'; g.fillRect(0, 0, W, W)
    for (let i = 0; i < 2; i++) for (let j = 0; j < 4; j++) {
      const x = i * 1.2 * u, y = j * 0.6 * u
      if (!rough) { g.save(); g.beginPath(); g.rect(x, y, 1.2 * u, 0.6 * u); g.clip(); const t = 200 + R() * 10; g.fillStyle = `rgb(${t + 8},${t + 6},${t + 2})`; g.fillRect(x, y, 1.2 * u, 0.6 * u); blobs(g, R, W, W, 18, 30, 140, [222, 221, 217], 0.35); blobs(g, R, W, W, 10, 20, 90, [186, 184, 179], 0.18); g.restore() }
      g.strokeStyle = rough ? '#a8a8a8' : 'rgba(150,147,141,0.95)'; g.lineWidth = 2.2; g.strokeRect(x + 1, y + 1, 1.2 * u - 2, 0.6 * u - 2)
    }
  }, { color: !rough })
}
/** wide oak boards, warm grey */
const oakTex = canvasTex(1024, 1024, (g, W) => {
  const R = rng(9), n = 12, bw = W / n
  for (let i = 0; i < n; i++) {
    const t = 150 + R() * 22
    for (const y0 of [-R() * W, 0]) { g.fillStyle = `rgb(${t},${t - 14},${t - 30})`; g.fillRect(i * bw, y0, bw, W) }
    for (let k = 0; k < 40; k++) { const x = i * bw + R() * bw; g.strokeStyle = `rgba(${t - 40},${t - 52},${t - 66},${0.15 + R() * 0.25})`; g.lineWidth = 0.6 + R() * 1.4; g.beginPath(); g.moveTo(x, 0); g.bezierCurveTo(x + (R() - 0.5) * 8, W / 3, x + (R() - 0.5) * 8, (2 * W) / 3, x, W); g.stroke() }
    g.fillStyle = 'rgba(60,48,38,0.55)'; g.fillRect(i * bw, 0, 1.5, W)
    const j = R() * W; g.fillRect(i * bw, j, bw, 1.5)
  }
})
/** the rug: grey and white strokes, like the one in the reference */
const rugTex = canvasTex(1024, 1024, (g, W) => {
  const R = rng(17)
  g.fillStyle = '#c7c4be'; g.fillRect(0, 0, W, W)
  const cols = ['#8b8781', '#ebe9e4', '#a9a59f', '#6c6863', '#d8d6d0']
  for (let i = 0; i < 4200; i++) { const x = R() * W, y = R() * W, l = 8 + R() * 70; g.strokeStyle = cols[Math.floor(R() * cols.length)]; g.globalAlpha = 0.25 + R() * 0.35; g.lineWidth = 1 + R() * 3; g.beginPath(); g.moveTo(x, y); g.lineTo(x + l, y + (R() - 0.5) * 6); g.stroke() }
  g.globalAlpha = 1
})
/** a dark abstract canvas for the dining wall */
const artTex = canvasTex(768, 576, (g, W, Hh) => {
  const R = rng(5)
  g.fillStyle = '#1e1c1a'; g.fillRect(0, 0, W, Hh)
  for (let i = 0; i < 14; i++) { g.strokeStyle = `rgba(${170 + R() * 60},${150 + R() * 50},${120 + R() * 40},${0.25 + R() * 0.4})`; g.lineWidth = 6 + R() * 40; g.beginPath(); const x = R() * W, y = R() * Hh; g.arc(x, y, 80 + R() * 260, R() * 6, R() * 6 + 1.2 + R()); g.stroke() }
  blobs(g, R, W, Hh, 12, 40, 160, [200, 120, 60], 0.12)
})
/** the cove's wash on the ceiling: bright at the band edge, fading out */
const coveTex = canvasTex(256, 8, (g, W, Hh) => { const gr = g.createLinearGradient(0, 0, W, 0); gr.addColorStop(0, 'rgba(255,255,255,0)'); gr.addColorStop(0.7, 'rgba(255,255,255,0.35)'); gr.addColorStop(1, 'rgba(255,255,255,1)'); g.fillStyle = gr; g.fillRect(0, 0, W, Hh) })

const TX = {
  marble: marbleTex(3, { veins: 7, bold: 1 }),
  marbleBook: marbleTex(11, { veins: 3, bold: 1.7, drift: 1.05, mirror: true }),
  marbleTable: marbleTex(23, { veins: 8, bold: 1.15, drift: 0.4 }),
  veneer: veneerTex(5),
  veneerDark: veneerTex(7, [30, 25, 22]),
  tile: tileTex(false),
  tileRough: tileTex(true),
}
TX.marbleBook.repeat.set(2, 1)

// ------------------------------------------------------------------ materials
const M = {
  wall: MAT.paint({ color: [0.76, 0.75, 0.72], roughness: 0.9, clearcoat: 0, finish: null, cap: [0.028, 0.028, 0.03], capRough: 1, envMapIntensity: 0.9 }),
  ceil: MAT.paint({ color: [0.8, 0.79, 0.77], roughness: 0.92, clearcoat: 0, finish: null }),
  slab: mat({ color: [0.3, 0.3, 0.29], roughness: 0.9, finish: 'cast', cap: [0.06, 0.06, 0.06], capRough: 1 }),
  tile: mat({ color: [1, 1, 1], map: TX.tile, roughnessMap: TX.tileRough, roughness: 0.55, metalness: 0, clearcoat: 0.25, clearcoatRoughness: 0.14, finish: null }),
  oak: mat({ color: [1, 1, 1], map: oakTex, roughness: 0.52, clearcoat: 0.12, finish: null }),
  stone: mat({ color: [0.055, 0.055, 0.058], roughness: 0.32, clearcoat: 0.3, finish: 'cast' }),
  marble: mat({ color: [1, 1, 1], map: TX.marble, roughness: 0.16, clearcoat: 0.45, clearcoatRoughness: 0.08, finish: null }),
  marbleBook: mat({ color: [1, 1, 1], map: TX.marbleBook, roughness: 0.15, clearcoat: 0.5, clearcoatRoughness: 0.08, finish: null }),
  marbleTable: mat({ color: [1, 1, 1], map: TX.marbleTable, roughness: 0.2, clearcoat: 0.35, clearcoatRoughness: 0.1, finish: null }),
  veneer: mat({ color: [1, 1, 1], map: TX.veneer, roughness: 0.5, clearcoat: 0.18, clearcoatRoughness: 0.4, finish: null }),
  veneerDark: mat({ color: [1, 1, 1], map: TX.veneerDark, roughness: 0.55, clearcoat: 0.1, finish: null }),
  // the living room's feature surfaces get their own instances, so the finish can be swapped there alone
  feature: mat({ color: [1, 1, 1], map: TX.veneer, roughness: 0.5, clearcoat: 0.18, clearcoatRoughness: 0.4, finish: null }),
  featureFluted: mat({ color: [1, 1, 1], map: TX.veneerDark, bumpMap: flutesTex, bumpScale: 3, roughness: 0.6, finish: null }),
  fluted: mat({ color: [1, 1, 1], map: TX.veneerDark, bumpMap: flutesTex, bumpScale: 3, roughness: 0.6, finish: null }),
  steel: MAT.satin({ color: [0.016, 0.016, 0.018], roughness: 0.42 }),
  steelMatte: MAT.satin({ color: [0.02, 0.02, 0.022], roughness: 0.7 }),
  alu: MAT.anodised({ color: [0.03, 0.03, 0.032], roughness: 0.38 }),
  fabric: mat({ color: [0.15, 0.143, 0.132], roughness: 0.97, sheen: 0.45, sheenRoughness: 0.7, finish: 'cast', rep: [8, 8] }),
  fabricDark: mat({ color: [0.05, 0.05, 0.05], roughness: 0.95, sheen: 0.8, sheenRoughness: 0.6, finish: 'cast', rep: [8, 8] }),
  linen: mat({ color: [0.74, 0.72, 0.68], roughness: 0.98, sheen: 0.6, sheenRoughness: 0.7, finish: 'cast', rep: [6, 6] }),
  woodBlack: mat({ color: [0.022, 0.02, 0.018], roughness: 0.62, finish: 'cast', rep: [4, 4] }),
  lacquer: MAT.paint({ color: [0.8, 0.79, 0.76], roughness: 0.32, clearcoat: 0.4, finish: null }),
  door: MAT.paint({ color: [0.8, 0.79, 0.76], roughness: 0.45, clearcoat: 0.2, finish: null }),
  quartz: mat({ color: [0.85, 0.85, 0.83], roughness: 0.22, clearcoat: 0.3, finish: null }),
  ceramic: MAT.ceramic({ color: [0.92, 0.92, 0.9], roughness: 0.14, finish: null }),
  mirror: MAT.chrome({ roughness: 0.02 }),
  brass: MAT.brass({ roughness: 0.28 }),
  tv: mat({ color: [0.004, 0.004, 0.005], roughness: 0.06, clearcoat: 1, clearcoatRoughness: 0.02, finish: null }),
  glassBlack: mat({ color: [0.01, 0.01, 0.012], roughness: 0.08, clearcoat: 1, finish: null }),
  rug: mat({ color: [1, 1, 1], map: rugTex, roughness: 1, sheen: 0.5, sheenRoughness: 0.8, finish: null }),
  art: mat({ color: [1, 1, 1], map: artTex, roughness: 0.92, finish: null }),
  plant: mat({ color: [0.07, 0.13, 0.05], roughness: 0.7, finish: null }),
  pink: mat({ color: [0.6, 0.34, 0.36], roughness: 0.7, finish: null }),
  bookDark: mat({ color: [0.06, 0.055, 0.05], roughness: 0.7, finish: null }),
  bookLight: mat({ color: [0.58, 0.54, 0.48], roughness: 0.75, finish: null }),
  glass: mat({ color: [1, 1, 1], transparent: true, opacity: 0.13, roughness: 0.03, metalness: 0, noCap: true, envMapIntensity: 1.3, depthWrite: false }),
  shower: mat({ color: [0.9, 0.95, 0.95], transparent: true, opacity: 0.18, roughness: 0.05, metalness: 0, noCap: true, depthWrite: false }),
  sheer: mat({ color: [0.94, 0.92, 0.88], transparent: true, opacity: 0.4, roughness: 1, noCap: true, emissive: [1, 0.97, 0.92], emissiveIntensity: 0, depthWrite: false }),
  drape: mat({ color: [0.11, 0.105, 0.1], roughness: 1, sheen: 0.6, noCap: true, finish: null }),
  ledAmber: MAT.glow({ emissive: [1.0, 0.5, 0.18], emissiveIntensity: 0 }),
  ledCove: MAT.glow({ emissive: [1.0, 0.72, 0.45], emissiveIntensity: 0 }),
  ledSpot: MAT.glow({ emissive: [1.0, 0.8, 0.6], emissiveIntensity: 0 }),
  ledLamp: MAT.glow({ emissive: [1.0, 0.66, 0.36], emissiveIntensity: 0 }),
  // the x-rayed wall layer fades its own materials, so it gets materials nobody else uses
  winFrame: MAT.anodised({ color: [0.03, 0.03, 0.032], roughness: 0.38 }),
  lever: MAT.satin({ color: [0.016, 0.016, 0.018], roughness: 0.42 }),
  entry: mat({ color: [1, 1, 1], roughness: 0.55, clearcoat: 0.1, finish: null }),
  sill: mat({ color: [1, 1, 1], roughness: 0.18, clearcoat: 0.4, finish: null }),
  ledHouse: MAT.glow({ emissive: [1.0, 0.8, 0.6], emissiveIntensity: 0 }),
  orb: mat({ color: [0.85, 0.8, 0.7], emissive: [1, 0.66, 0.36], emissiveIntensity: 0, roughness: 0.55, finish: null }),
}
for (const m of [M.fabric, M.linen, M.fabricDark, M.rug]) m.sheenColor = m.color.clone().lerp(new THREE.Color(1, 1, 1), 0.2)
M.sheer.side = THREE.DoubleSide
M.drape.side = THREE.DoubleSide
M.entry.map = TX.veneerDark; M.sill.map = TX.marble
const SHADOWLESS = new Set([M.glass, M.shower, M.ledAmber, M.ledCove, M.ledSpot, M.ledLamp, M.ledHouse])
const NOAO = new Set([M.glass, M.shower, M.sheer])

// ------------------------------------------------------------------ geometry helpers
/** world-space UVs: every face takes the two world axes across it, in units of `s` metres */
function worldUV(g, s) {
  const p = g.attributes.position, n = g.attributes.normal, uv = new Float32Array(p.count * 2)
  for (let i = 0; i < p.count; i++) {
    const ax = Math.abs(n.getX(i)), ay = Math.abs(n.getY(i)), az = Math.abs(n.getZ(i))
    const [u, v] = ay >= ax && ay >= az ? [p.getX(i), p.getZ(i)] : ax >= az ? [p.getZ(i), p.getY(i)] : [p.getX(i), p.getY(i)]
    uv[i * 2] = u / s; uv[i * 2 + 1] = v / s
  }
  g.setAttribute('uv', new THREE.BufferAttribute(uv, 2))
}
const UVS = new Map([[M.entry, 1.2], [M.sill, 1.6], [M.tile, 2.4], [M.oak, 2.4], [M.marble, 1.6], [M.marbleTable, 1.4], [M.veneer, 1.2], [M.veneerDark, 1.2], [M.feature, 1.2], [M.featureFluted, 0.24], [M.fluted, 0.24], [M.rug, 3.0], [M.stone, 1.5]])

let FRAME = null
/** build children in a local frame: origin at (x, z) on the floor, turned by rotY */
function inFrame(x, z, rotY, fn) { const prev = FRAME; const m = new THREE.Matrix4().makeRotationY(rotY).setPosition(x, 0, z); FRAME = prev ? prev.clone().multiply(m) : m; fn(); FRAME = prev }

/** an explode layer: geometry is collected per material and merged into one mesh per material */
class Layer {
  constructor(name) { this.name = name; this.byMat = new Map(); this.count = 0 }
  put(geo, m, { pos, rot, uv } = {}) {
    const g = geo.index ? geo.toNonIndexed() : geo.clone()
    if (rot) g.applyMatrix4(new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(...rot)))
    if (pos) g.translate(pos[0], pos[1], pos[2])
    if (FRAME) g.applyMatrix4(FRAME)
    for (const k of Object.keys(g.attributes)) if (!['position', 'normal', 'uv'].includes(k)) g.deleteAttribute(k)
    if (!g.attributes.normal) g.computeVertexNormals()
    const s = uv ?? UVS.get(m)
    if (s) worldUV(g, s)
    if (!g.attributes.uv) g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2))
    if (!this.byMat.has(m)) this.byMat.set(m, [])
    this.byMat.get(m).push(g); this.count++
    return g
  }
  build() {
    const grp = new THREE.Group(); grp.name = this.name
    for (const [m, list] of this.byMat) { const mesh = new THREE.Mesh(GEO.merge(list), m); mesh.userData.mat = m; grp.add(mesh) }
    return grp
  }
}
/** a box between two corners (metres); `r` rounds it */
function bx(L, m, x0, y0, z0, x1, y1, z1, o = {}) {
  const w = x1 - x0, h = y1 - y0, d = z1 - z0
  const g = o.r ? GEO.rbox(w, h, d, Math.min(o.r, w / 2.05, h / 2.05, d / 2.05), o.seg ?? 3) : new THREE.BoxGeometry(w, h, d)
  return L.put(g, m, { pos: [(x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2], rot: o.rot, uv: o.uv })
}
const cyl = (L, m, x, y0, z, r, h, seg = 32, r2 = r) => L.put(new THREE.CylinderGeometry(r2, r, h, seg), m, { pos: [x, y0 + h / 2, z] })
const lathe = (L, m, prof, x, y, z, seg = 48) => L.put(GEO.lathe(prof, seg), m, { pos: [x, y, z] })

// layers (assembly order = fly-in order)
const floorL = new Layer('楼板与地面')
const wallL = new Layer('墙体与门')
const glazL = new Layer('玻璃与纱帘')
const tvL = new Layer('电视墙')
const livF = new Layer('客厅与餐厅家具')
const kitF = new Layer('厨房与玄关')
const bedF = new Layer('卧室')
const bathF = new Layer('卫生间')
const ceilL = new Layer('天花与灯具')

// ------------------------------------------------------------------ floor: structural slab and finishes (finish tops at y = 0)
bx(floorL, M.slab, X0 - 0.1, -0.25, Z0 - 0.1, X1 + 0.1, -0.02, Z1 + 0.1)
const fin = (m, r) => bx(floorL, m, r.x[0], -0.02, r.z[0], r.x[1], 0, r.z[1])
for (const id of ['liv', 'din', 'kit', 'foy', 'cor']) fin(M.tile, ROOMS[id])
for (const id of ['mbr', 'br2']) fin(M.oak, ROOMS[id])
for (const id of ['mba', 'ba2']) fin(M.stone, ROOMS[id])

// ------------------------------------------------------------------ walls, windows and doors
const doors = []
/**
 * A straight wall along x (at z = c) or along z (at x = c) from a0 to a1, thickness t, with holes
 * { a0, a1, y0, y1, win: 'full' | 'std', inSign, door: { hinge: 'a0' | 'a1', swing: ±1, ang }, frame: 'black' }.
 */
function wall(L, m, axis, c, a0, a1, t, holes = []) {
  const seg = (s0, s1, h0, h1) => {
    if (s1 - s0 < 1e-4 || h1 - h0 < 1e-4) return
    if (axis === 'x') bx(L, m, s0, h0, c - t / 2, s1, h1, c + t / 2); else bx(L, m, c - t / 2, h0, s0, c + t / 2, h1, s1)
  }
  let cur = a0
  for (const h of [...holes].sort((p, q) => p.a0 - q.a0)) {
    seg(cur, h.a0, 0, H); seg(h.a0, h.a1, 0, h.y0 ?? 0); seg(h.a0, h.a1, h.y1, H); cur = h.a1
    if (h.win) windowIn(axis, c, t, h)
    if (h.door) doorIn(axis, c, t, h)
  }
  seg(cur, a1, 0, H)
}
/** place a box given along-wall (a), height (y) and across-wall (n) extents */
const wbx = (L, m, axis, a0, a1, y0, y1, n0, n1, o) => (axis === 'x' ? bx(L, m, a0, y0, n0, a1, y1, n1, o) : bx(L, m, n0, y0, a0, n1, y1, a1, o))
function windowIn(axis, c, t, h) {
  const f = 0.05, d = 0.08, n0 = c - d / 2, n1 = c + d / 2
  const y0 = h.y0 ?? 0, y1 = h.y1
  wbx(wallL, M.winFrame, axis, h.a0, h.a1, y0, y0 + f, n0, n1)
  wbx(wallL, M.winFrame, axis, h.a0, h.a1, y1 - f, y1, n0, n1)
  wbx(wallL, M.winFrame, axis, h.a0, h.a0 + f, y0 + f, y1 - f, n0, n1)
  wbx(wallL, M.winFrame, axis, h.a1 - f, h.a1, y0 + f, y1 - f, n0, n1)
  const n = Math.max(1, Math.round((h.a1 - h.a0) / (h.win === 'full' ? 1.25 : 1.0)))
  const pw = (h.a1 - h.a0 - 2 * f) / n
  for (let i = 1; i < n; i++) { const a = h.a0 + f + i * pw; wbx(wallL, M.winFrame, axis, a - 0.022, a + 0.022, y0 + f, y1 - f, n0, n1) }
  wbx(glazL, M.glass, axis, h.a0 + f, h.a1 - f, y0 + f, y1 - f, c - 0.006, c + 0.006)
  if (h.win === 'std' && h.inSign) { const s = h.inSign; const e0 = c + (s * t) / 2, e1 = e0 + s * 0.05; wbx(wallL, M.sill, axis, h.a0 - 0.04, h.a1 + 0.04, y0 - 0.03, y0, Math.min(c, e1), Math.max(c, e1)) }
}
function doorIn(axis, c, t, h) {
  const D = h.door, y1 = h.y1, th = 0.04, lin = 0.02
  // jamb linings and the head, flush with both wall faces
  const fm = D.dark ? M.lever : M.door
  wbx(wallL, fm, axis, h.a0, h.a0 + lin, 0, y1, c - t / 2, c + t / 2)
  wbx(wallL, fm, axis, h.a1 - lin, h.a1, 0, y1, c - t / 2, c + t / 2)
  wbx(wallL, fm, axis, h.a0, h.a1, y1 - lin, y1, c - t / 2, c + t / 2)
  if (D.ang === undefined) return
  const w = h.a1 - h.a0 - 2 * lin - 0.006, hingeA = D.hinge === 'a0' ? h.a0 + lin + 0.003 : h.a1 - lin - 0.003
  const dir = D.hinge === 'a0' ? 1 : -1, th0 = THREE.MathUtils.degToRad(D.ang)
  const phi = axis === 'x' ? th0 * -D.swing * dir : th0 * D.swing * dir
  const leaf = new THREE.Group(); leaf.rotation.y = phi
  if (axis === 'x') leaf.position.set(hingeA, 0, c); else leaf.position.set(c, 0, hingeA)
  const lm = D.dark ? M.entry : M.door
  const geo = axis === 'x' ? GEO.rbox(w, y1 - lin - 0.01, th, 0.004, 2).translate((dir * w) / 2, (y1 - lin) / 2, 0) : GEO.rbox(th, y1 - lin - 0.01, w, 0.004, 2).translate(0, (y1 - lin) / 2, (dir * w) / 2)
  leaf.add(new THREE.Mesh(geo, lm))
  // a black lever on both faces near the free edge, or a long pull on the entry door
  const hx = dir * (w - 0.07)
  for (const s of [-1, 1]) {
    const g = D.dark ? GEO.rbox(0.025, 0.9, 0.025, 0.008, 2) : GEO.rbox(0.13, 0.018, 0.018, 0.006, 2)
    const at = axis === 'x' ? [hx - (D.dark ? 0 : dir * 0.05), D.dark ? 1.15 : 1.02, s * (th / 2 + 0.03)] : [s * (th / 2 + 0.03), D.dark ? 1.15 : 1.02, hx - (D.dark ? 0 : dir * 0.05)]
    const lever = new THREE.Mesh(axis === 'x' ? g : g.clone().rotateY(Math.PI / 2), M.lever); lever.position.set(...at); leaf.add(lever)
    const rose = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 0.03, 20).rotateX(Math.PI / 2), M.lever)
    rose.position.set(at[0], at[1], at[2]); if (axis === 'x') rose.position.z = s * (th / 2 + 0.015); else { rose.rotation.y = Math.PI / 2; rose.position.x = s * (th / 2 + 0.015) }
    if (!D.dark) leaf.add(rose)
  }
  doors.push(leaf)
}

// exterior walls (the x-runs take the corners)
const ext = [
  ['x', Z0, X0 - TE / 2, X1 + TE / 2, [
    { a0: -0.55, a1: 0.35, y0: 1.6, y1: 2.4, win: 'std', inSign: 1 },
    { a0: 1.6, a1: 3.6, y0: 0.6, y1: 2.6, win: 'std', inSign: 1 },
    { a0: 4.7, a1: 5.5, y0: 1.6, y1: 2.4, win: 'std', inSign: 1 },
  ]],
  ['x', Z1, X0 - TE / 2, X1 + TE / 2, [
    { a0: -5.8, a1: -1.0, y0: 0, y1: 2.85, win: 'full' },
    { a0: -0.2, a1: 2.4, y0: 0, y1: 2.85, win: 'full' },
    { a0: 4.45, a1: 5.65, y0: 0.9, y1: 2.4, win: 'std', inSign: -1 },
  ]],
  ['z', X0, Z0 + TE / 2, Z1 - TE / 2, [
    { a0: -4.4, a1: -2.2, y0: 0.45, y1: 2.6, win: 'std', inSign: 1 },
    { a0: -1.4, a1: -0.6, y0: 0.6, y1: 2.6, win: 'std', inSign: 1 },
    { a0: -0.2, a1: 4.8, y0: 0, y1: 2.85, win: 'full' },
  ]],
  ['z', X1, Z0 + TE / 2, Z1 - TE / 2, [
    { a0: -1.4, a1: -0.6, y0: 0.6, y1: 2.6, win: 'std', inSign: -1 },
    { a0: 3.5, a1: 4.5, y0: 0, y1: 2.4, door: { hinge: 'a0', swing: -1, ang: 0, dark: true } },
  ]],
]
for (const [axis, c, a0, a1, holes] of ext) wall(wallL, M.wall, axis, c, a0, a1, TE, holes)
// partitions: they stop on the inner faces of what they meet, so no two faces overlap
const IN = { x0: X0 + TE / 2, x1: X1 - TE / 2, z0: Z0 + TE / 2 }
wall(wallL, M.wall, 'x', -1.6, IN.x0, IN.x1, TI, [
  { a0: -2.6, a1: -1.8, y1: 2.4, door: { hinge: 'a0', swing: -1, ang: 72 } },
  { a0: 1.3, a1: 2.1, y1: 2.4, door: { hinge: 'a0', swing: -1, ang: 70 } },
  { a0: 4.5, a1: 5.3, y1: 2.4, door: { hinge: 'a1', swing: -1, ang: 64 } },
])
wall(wallL, M.wall, 'x', -0.4, IN.x0, IN.x1, TI, [
  { a0: -2.6, a1: -1.2, y1: 2.7 },
  { a0: 0.0, a1: 1.2, y1: 2.4 },
])
wall(wallL, M.wall, 'z', -1.2, IN.z0, -1.6 - TI / 2, TI, [{ a0: -2.6, a1: -1.8, y1: 2.4, door: { hinge: 'a1', swing: 1, ang: 68 } }])
wall(wallL, M.wall, 'z', 1.0, IN.z0, -1.6 - TI / 2, TI)
wall(wallL, M.wall, 'z', 4.2, IN.z0, -1.6 - TI / 2, TI)
wall(wallL, M.wall, 'z', -0.6, -0.4 + TI / 2, 0.8, TI)                       // the fluted return between living and dining
// the black steel lining of the corridor opening, proud of both faces, with a face flange on the living side
{ const zA = -0.4 - TI / 2 - 0.035, zB = -0.4 + TI / 2 + 0.035
  bx(tvL, M.steel, -2.6, 0, zA, -2.54, 2.7, zB); bx(tvL, M.steel, -1.26, 0, zA, -1.2, 2.7, zB); bx(tvL, M.steel, -2.6, 2.64, zA, -1.2, 2.7, zB)
  const zf = -0.4 + TI / 2
  bx(tvL, M.steel, -2.72, 0, zf, -2.6, 2.76, zf + 0.03); bx(tvL, M.steel, -1.2, 0, zf, -1.08, 2.76, zf + 0.03); bx(tvL, M.steel, -2.72, 2.7, zf, -1.08, 2.76, zf + 0.03) }

// ------------------------------------------------------------------ the TV wall (after the reference)
const TVW = { x0: IN.x0, x1: -2.72, z: -0.4 + TI / 2 }        // the wall face the cladding sits on
const FR = { x0: -5.81, x1: -2.81, y0: 0.62, y1: 2.0, b: 0.08, z0: TVW.z + 0.03, z1: TVW.z + 0.18 }
{
  const z0 = TVW.z, n = 6, pw = (TVW.x1 - TVW.x0) / n
  bx(tvL, M.steelMatte, TVW.x0, 0, z0, TVW.x1, H, z0 + 0.006)
  for (let i = 0; i < n; i++) bx(tvL, M.feature, TVW.x0 + i * pw + 0.002, 0, z0 + 0.006, TVW.x0 + (i + 1) * pw - 0.002, H, z0 + 0.03)
  // the marble frame: four bars, a bookmatched back panel, the niche divider and two black shelves
  const { x0, x1, y0, y1, b } = FR
  bx(tvL, M.marble, x0, y1 - b, FR.z0, x1, y1, FR.z1)
  bx(tvL, M.marble, x0, y0, FR.z0, x1, y0 + b, FR.z1)
  bx(tvL, M.marble, x0, y0 + b, FR.z0, x0 + b, y1 - b, FR.z1)
  bx(tvL, M.marble, x1 - b, y0 + b, FR.z0, x1, y1 - b, FR.z1)
  tvL.put(new THREE.BoxGeometry(x1 - x0 - 2 * b, y1 - y0 - 2 * b, 0.03), M.marbleBook, { pos: [(x0 + x1) / 2, (y0 + y1) / 2, FR.z0 + 0.015], uv: 0 })
  const nx = x0 + b + 0.5
  bx(tvL, M.marble, nx, y0 + b, FR.z0 + 0.03, nx + 0.03, y1 - b, FR.z1 - 0.005)
  for (const y of [1.06, 1.44]) bx(tvL, M.steel, x0 + b, y, FR.z0 + 0.03, nx, y + 0.008, FR.z1 - 0.01)
  // the TV, 65 inch, on a slim mount
  bx(tvL, M.steel, -4.25, 1.15, FR.z0 + 0.03, -3.85, 1.45, FR.z0 + 0.05)
  bx(tvL, M.tv, -4.79, 0.9, FR.z0 + 0.05, -3.34, 1.73, FR.z0 + 0.075, { r: 0.004, seg: 2 })
  // the hidden strip under the bottom return, and the dark AV slot under the frame
  bx(tvL, M.alu, x0 + 0.1, y0 - 0.014, FR.z0 + 0.02, x1 - 0.1, y0, FR.z0 + 0.06)
  bx(tvL, M.steelMatte, -4.9, 0.4, z0 + 0.03, -3.7, 0.52, z0 + 0.034)
  // the floating plinth: a marble block on a black toe recess
  bx(tvL, M.steelMatte, TVW.x0 + 0.06, 0, z0 + 0.03, -2.82, 0.08, z0 + 0.39)
  bx(tvL, M.marble, TVW.x0 + 0.02, 0.08, z0 + 0.03, -2.78, 0.34, z0 + 0.46, { r: 0.006, seg: 2 })
  // on the plinth: two turned risers, a stacked black sculpture; in the niche: a vase, a bird, a stone
  for (const [x, s] of [[-5.55, 1], [-5.18, 0.8]]) lathe(tvL, M.woodBlack, [[0, 0], [0.09 * s, 0], [0.09 * s, 0.012], [0.025, 0.02], [0.022, 0.09 * s], [0.12 * s, 0.1 * s], [0.12 * s, 0.115 * s], [0, 0.115 * s]], x, 0.34, z0 + 0.22)
  bx(tvL, M.steel, -3.25, 0.34, z0 + 0.12, -3.05, 0.52, z0 + 0.26, { r: 0.01 })
  bx(tvL, M.steel, -3.2, 0.52, z0 + 0.15, -3.0, 0.62, z0 + 0.24, { r: 0.01, rot: [0, 0.4, 0] })
  lathe(tvL, M.steel, [[0, 0], [0.035, 0], [0.05, 0.05], [0.04, 0.12], [0.018, 0.16], [0.02, 0.19], [0, 0.19]], x0 + b + 0.24, 1.448, z0 + 0.12)
  bx(tvL, M.steel, x0 + b + 0.12, 1.068, z0 + 0.09, x0 + b + 0.22, 1.13, z0 + 0.14, { r: 0.01 })
  bx(tvL, M.steel, x0 + b + 0.28, 1.068, z0 + 0.1, x0 + b + 0.31, 1.16, z0 + 0.13, { r: 0.006 })
  tvL.put(new THREE.SphereGeometry(0.075, 24, 16).scale(1, 0.8, 1), M.steel, { pos: [x0 + b + 0.22, y0 + b + 0.06, z0 + 0.12] })
}
// the fluted return wall with the intercom (white handset on a coiled cord) and a black switch plate
{
  const xf = -0.6 - TI / 2
  bx(tvL, M.featureFluted, xf - 0.03, 0, -0.4 + TI / 2, xf, H, 0.8)
  bx(tvL, M.featureFluted, xf - 0.03, 0, 0.8, -0.6 + TI / 2, H, 0.83)
  bx(tvL, M.lacquer, xf - 0.045, 1.3, 0.24, xf - 0.03, 1.62, 0.33, { r: 0.004 })
  bx(tvL, M.lacquer, xf - 0.075, 1.34, 0.255, xf - 0.045, 1.58, 0.295, { r: 0.012 })
  tvL.put(GEO.spring(0.009, 0.0022, 26, 0.26), M.lacquer, { pos: [xf - 0.06, 1.08, 0.275] })
  bx(tvL, M.steel, xf - 0.04, 1.08, 0.5, xf - 0.03, 1.165, 0.68, { r: 0.004 })
}

// ------------------------------------------------------------------ living room furniture
function sofa(L, x0, x1, zF, zB, { arms = [1, 1], cushions = 2 } = {}) {
  bx(L, M.steelMatte, x0 + 0.06, 0, zF + 0.06, x1 - 0.06, 0.09, zB - 0.06)
  bx(L, M.fabric, x0, 0.09, zF, x1, 0.3, zB, { r: 0.045 })
  const a0 = x0 + (arms[0] ? 0.2 : 0), a1 = x1 - (arms[1] ? 0.2 : 0), w = (a1 - a0) / cushions
  for (let i = 0; i < cushions; i++) {
    bx(L, M.fabric, a0 + i * w + 0.006, 0.29, zF + 0.015, a0 + (i + 1) * w - 0.006, 0.45, zB - 0.2, { r: 0.07, seg: 4 })
    bx(L, M.fabric, a0 + i * w + 0.012, 0.42, zB - 0.44, a0 + (i + 1) * w - 0.012, 0.84, zB - 0.17, { r: 0.1, seg: 4, rot: [0.13, 0, 0] })
  }
  bx(L, M.fabric, x0, 0.3, zB - 0.2, x1, 0.64, zB, { r: 0.06 })
  if (arms[0]) bx(L, M.fabric, x0, 0.3, zF, x0 + 0.21, 0.6, zB - 0.04, { r: 0.09, seg: 4 })
  if (arms[1]) bx(L, M.fabric, x1 - 0.21, 0.3, zF, x1, 0.6, zB - 0.04, { r: 0.09, seg: 4 })
}
const pillow = (L, m, x, y, z, ry, s = 1) => L.put(GEO.rbox(0.44 * s, 0.42 * s, 0.13, 0.06, 4), m, { pos: [x, y, z], rot: [-0.25, ry, 0] })
{
  const L = livF
  // rug, after the grey and white one in the reference
  bx(L, M.rug, -5.45, 0, 0.3, -2.45, 0.012, 2.95)
  // sofas: their backs toward the south glazing, a small black table between them
  sofa(L, -5.64, -4.3, 2.5, 3.55, { cushions: 2 })
  bx(L, M.fabric, -5.64, 0.09, 1.7, -4.86, 0.3, 2.52, { r: 0.045 })
  bx(L, M.fabric, -5.63, 0.29, 1.72, -4.87, 0.45, 2.5, { r: 0.07, seg: 4 })
  bx(L, M.steelMatte, -5.58, 0, 1.76, -4.92, 0.09, 2.5)
  sofa(L, -3.88, -2.0, 2.5, 3.55, { cushions: 2 })
  pillow(L, M.linen, -5.3, 0.6, 3.17, 0.15)
  pillow(L, M.fabricDark, -2.32, 0.6, 3.17, -0.18)
  pillow(L, M.linen, -2.6, 0.58, 3.12, -0.05, 0.9)
  bx(L, M.woodBlack, -4.28, 0, 3.08, -3.92, 0.5, 3.5, { r: 0.012 })
  L.put(new THREE.SphereGeometry(0.075, 32, 20).scale(1, 1.22, 1), M.orb, { pos: [-4.17, 0.59, 3.27] })
  lathe(L, M.glassBlack, [[0, 0], [0.035, 0], [0.04, 0.03], [0.04, 0.09], [0.014, 0.11], [0.012, 0.14], [0, 0.14]], -4.0, 0.5, 3.38)
  for (let i = 0; i < 7; i++) { const a = i * 0.9, l = 0.24 + (i % 3) * 0.03; L.put(new THREE.CylinderGeometry(0.0022, 0.0022, l, 5), M.woodBlack, { pos: [-4.0 + Math.cos(a) * 0.03, 0.63 + l / 2 - 0.02, 3.38 + Math.sin(a) * 0.03], rot: [Math.sin(a) * 0.14, 0, Math.cos(a) * 0.14] }) }
  cyl(L, M.steel, -4.12, 0.5, 3.4, 0.03, 0.07)
  // the marble cube table and its lower slab
  bx(L, M.marbleTable, -4.45, 0, 1.05, -3.55, 0.36, 1.95, { r: 0.008, seg: 2 })
  bx(L, M.marbleTable, -3.55, 0, 1.18, -3.06, 0.21, 1.88, { r: 0.008, seg: 2 })
  // on the table: books, a bowl of pink lotus, a succulent, a black stone
  bx(L, M.bookDark, -3.9, 0.36, 1.28, -3.62, 0.39, 1.5, { r: 0.004, seg: 2, rot: [0, 0.08, 0] })
  bx(L, M.bookLight, -3.88, 0.39, 1.29, -3.64, 0.415, 1.48, { r: 0.004, seg: 2, rot: [0, -0.05, 0] })
  bx(L, M.steel, -3.8, 0.415, 1.35, -3.72, 0.44, 1.42, { r: 0.004, seg: 2 })
  lathe(L, M.brass, [[0, 0], [0.11, 0], [0.16, 0.04], [0.165, 0.05], [0.155, 0.05], [0.105, 0.012], [0, 0.012]], -4.12, 0.36, 1.48)
  for (let i = 0; i < 9; i++) { const a = (i / 9) * Math.PI * 2, r = i % 2 ? 0.05 : 0.08; L.put(new THREE.SphereGeometry(0.05, 14, 10).scale(0.55, 0.32, 1), M.pink, { pos: [-4.12 + Math.cos(a) * r, 0.43 + (i % 2) * 0.02, 1.48 + Math.sin(a) * r], rot: [0.5, -a, 0] }) }
  cyl(L, M.ceramic, -4.33, 0.36, 1.2, 0.05, 0.07, 24)
  for (let i = 0; i < 7; i++) { const a = i * 0.9; L.put(new THREE.ConeGeometry(0.018, 0.06, 6), M.plant, { pos: [-4.33 + Math.cos(a) * 0.02, 0.45, 1.2 + Math.sin(a) * 0.02], rot: [Math.sin(a) * 0.5, 0, Math.cos(a) * 0.5] }) }
  L.put(new THREE.SphereGeometry(0.055, 20, 14).scale(1.2, 0.7, 1), M.steel, { pos: [-3.7, 0.4, 1.78] })
  // two black stools: a split pebble and a turned hourglass
  for (const dx of [-0.1, 0.1]) cyl(L, M.woodBlack, -5.05 + dx, 0, 1.22, 0.14, 0.43, 40)
  bx(L, M.steelMatte, -5.065, 0.18, 1.075, -5.035, 0.431, 1.365)
  lathe(L, M.woodBlack, [[0, 0], [0.15, 0], [0.15, 0.025], [0.08, 0.2], [0.055, 0.26], [0.07, 0.3], [0.17, 0.47], [0.17, 0.5], [0, 0.5]], -2.62, 0, 1.42, 56)
  // the floor lamp: weighted disc, a thin arc, a cone shade with a warm inside
  cyl(L, M.steel, -5.52, 0, 0.72, 0.15, 0.025, 40)
  L.put(GEO.pipe([[-5.52, 0.02, 0.72], [-5.52, 0.8, 0.72], [-5.52, 1.38, 0.73], [-5.47, 1.58, 0.78], [-5.34, 1.66, 0.86], [-5.24, 1.64, 0.92]], 0.009, { seg: 48, radial: 10 }), M.steel)
}
const lampAt = new THREE.Vector3(-5.2, 1.57, 0.95)
const lampShade = new THREE.Group()
{
  lampShade.position.copy(lampAt); lampShade.rotation.set(0.45, 0, -0.5)
  const shell = new THREE.Mesh(GEO.shell([[0.035, 0.07], [0.15, -0.07]], 0.004, 48, true), M.steel)
  const glow = new THREE.Mesh(GEO.lathe([[0.03, 0.064], [0.142, -0.066], [0.14, -0.068], [0, 0.06]], 48), M.ledLamp)
  lampShade.add(shell, glow)
}
// dining: a marble table on two dark pedestals, six chairs, a linear pendant (in the ceiling layer), an artwork, an olive tree
function chair(L, x, z, ry) {
  inFrame(x, z, ry, () => {
    for (const [a, b] of [[-0.19, -0.19], [0.19, -0.19], [-0.19, 0.19], [0.19, 0.19]]) bx(L, M.steel, a - 0.012, 0, b - 0.012, a + 0.012, 0.43, b + 0.012)
    bx(L, M.fabric, -0.23, 0.42, -0.23, 0.23, 0.5, 0.23, { r: 0.03 })
    bx(L, M.fabric, -0.23, 0.5, 0.18, 0.23, 0.88, 0.25, { r: 0.03, rot: [0.08, 0, 0] })
  })
}
{
  const L = livF
  bx(L, M.marbleTable, 0.6, 0.72, 1.3, 1.6, 0.76, 3.5, { r: 0.006, seg: 2 })
  for (const z of [1.62, 2.98]) { bx(L, M.veneerDark, 0.92, 0, z, 1.28, 0.72, z + 0.18, { r: 0.01 }); bx(L, M.steel, 0.86, 0, z - 0.06, 1.34, 0.02, z + 0.24) }
  for (const z of [1.75, 2.4, 3.05]) { chair(L, 0.28, z, -Math.PI / 2); chair(L, 1.92, z, Math.PI / 2) }
  bx(L, M.steel, 1.4, 1.15, -0.4 + TI / 2, 2.62, 2.05, -0.4 + TI / 2 + 0.03)
  bx(L, M.art, 1.43, 1.18, -0.4 + TI / 2 + 0.03, 2.59, 2.02, -0.4 + TI / 2 + 0.035)
  lathe(L, M.steelMatte, [[0, 0], [0.2, 0], [0.24, 0.1], [0.24, 0.5], [0.22, 0.52], [0, 0.52]], -0.2, 0, 4.55)
  L.put(GEO.pipe([[-0.2, 0.5, 4.55], [-0.18, 1.0, 4.55], [-0.24, 1.45, 4.5]], 0.025, { seg: 16, radial: 8 }), M.woodBlack)
  const R = rng(31)
  for (let i = 0; i < 26; i++) { const a = R() * 6.28, r = R() * 0.42, y = 1.35 + R() * 0.7; L.put(new THREE.IcosahedronGeometry(0.1 + R() * 0.09, 0), M.plant, { pos: [-0.22 + Math.cos(a) * r, y, 4.48 + Math.sin(a) * r * 0.8], rot: [R() * 3, R() * 3, 0] }) }
}

// ------------------------------------------------------------------ kitchen and foyer
{
  const L = kitF, zW = -0.4 + TI / 2
  bx(L, M.steelMatte, 2.9, 0, zW + 0.04, 5.3, 0.1, zW + 0.56)
  bx(L, M.veneerDark, 2.86, 0.1, zW, 5.3, 0.88, zW + 0.6)
  for (let i = 1; i < 4; i++) bx(L, M.steelMatte, 2.86 + i * 0.61 - 0.002, 0.1, zW + 0.6, 2.86 + i * 0.61 + 0.002, 0.88, zW + 0.602)
  bx(L, M.quartz, 2.84, 0.88, zW, 5.32, 0.92, zW + 0.63)
  bx(L, M.steelMatte, 3.65, 0.917, zW + 0.12, 4.25, 0.921, zW + 0.5)
  L.put(GEO.pipe([[3.95, 0.92, zW + 0.06], [3.95, 1.22, zW + 0.06], [3.95, 1.28, zW + 0.14], [3.95, 1.22, zW + 0.26]], 0.012, { seg: 24, radial: 10 }), M.steel)
  bx(L, M.glassBlack, 4.5, 0.92, zW + 0.08, 5.1, 0.926, zW + 0.55)
  bx(L, M.veneerDark, 2.86, 1.55, zW, 5.3, 2.4, zW + 0.36)
  bx(L, M.alu, 2.9, 1.53, zW + 0.02, 5.26, 1.55, zW + 0.34)
  bx(L, M.ledHouse, 2.95, 1.525, zW + 0.28, 5.2, 1.531, zW + 0.3)
  // the tall column: fridge and oven, against the east wall
  bx(L, M.veneerDark, 5.3, 0, zW, 6 - TE / 2, 2.4, 1.7)
  bx(L, M.glassBlack, 5.296, 0.86, 0.55, 5.3, 1.46, 1.15)
  bx(L, M.steel, 5.27, 1.5, 0.12, 5.3, 2.2, 0.15, { r: 0.008 })
  // the island: a marble waterfall over a dark body
  bx(L, M.veneerDark, 3.36, 0.06, 1.2, 5.04, 0.88, 2.0)
  bx(L, M.marble, 3.3, 0.88, 1.15, 5.1, 0.92, 2.05)
  bx(L, M.marble, 3.3, 0, 1.15, 3.34, 0.88, 2.05)
  bx(L, M.marble, 5.06, 0, 1.15, 5.1, 0.88, 2.05)
  for (const x of [3.9, 4.4]) { lathe(L, M.ceramic, [[0, 0], [0.06, 0], [0.11, 0.07], [0.12, 0.09], [0, 0.09]], x, 0.92, 1.6) }
  // foyer: a full-height fluted shoe cabinet as the divider, a lit niche, a bench, a round mirror
  bx(L, M.fluted, 3.4, 0, 2.8, 6 - TE / 2, 2.4, 3.2)
  bx(L, M.veneerDark, 3.6, 1.0, 3.16, 5.6, 1.36, 3.201)
  bx(L, M.marble, 3.6, 1.0, 2.86, 5.6, 1.03, 3.2)
  bx(L, M.ledHouse, 3.65, 1.355, 3.12, 5.55, 1.36, 3.14)
  lathe(L, M.ceramic, [[0, 0], [0.05, 0], [0.07, 0.12], [0.03, 0.2], [0.035, 0.24], [0, 0.24]], 4.2, 1.03, 3.0)
  bx(L, M.oak, 3.05, 0.38, 4.5, 4.25, 0.43, 4.86, { r: 0.008 })
  for (const x of [3.11, 4.19]) bx(L, M.steel, x - 0.02, 0, 4.52, x + 0.02, 0.38, 4.84)
  L.put(new THREE.CylinderGeometry(0.4, 0.4, 0.015, 64).rotateX(Math.PI / 2), M.mirror, { pos: [3.62, 1.55, 5 - TE / 2 - 0.012] })
  L.put(new THREE.TorusGeometry(0.4, 0.012, 10, 64), M.steel, { pos: [3.62, 1.55, 5 - TE / 2 - 0.014] })
  // corridor storage behind the TV wall: white lacquer, shadow-gap doors
  bx(L, M.lacquer, IN.x0 + 0.02, 0, -0.4 - TI / 2 - 0.4, -2.75, 2.6, -0.4 - TI / 2)
  for (let x = IN.x0 + 0.62; x < -2.8; x += 0.6) bx(L, M.steelMatte, x - 0.003, 0.02, -0.4 - TI / 2 - 0.401, x + 0.003, 2.58, -0.4 - TI / 2 - 0.39)
}

// ------------------------------------------------------------------ bedrooms
function bed(L, w, len, { head = 1.0, throwM = M.fabricDark } = {}) {
  // local frame: headboard at z = 0, foot at z = len, centred on x
  bx(L, M.fabric, -w / 2 - 0.08, 0.3, 0, w / 2 + 0.08, 0.3 + head, 0.09, { r: 0.04 })
  bx(L, M.fabric, -w / 2, 0.08, 0.09, w / 2, 0.32, len, { r: 0.03 })
  bx(L, M.steelMatte, -w / 2 + 0.08, 0, 0.17, w / 2 - 0.08, 0.08, len - 0.08)
  bx(L, M.linen, -w / 2 + 0.01, 0.32, 0.1, w / 2 - 0.01, 0.53, len - 0.01, { r: 0.06, seg: 4 })
  bx(L, M.linen, -w / 2 - 0.03, 0.44, 0.55, w / 2 + 0.03, 0.58, len + 0.03, { r: 0.05, seg: 4 })
  bx(L, throwM, -w / 2 - 0.035, 0.5, len - 0.55, w / 2 + 0.035, 0.6, len + 0.035, { r: 0.04, seg: 3 })
  for (const s of [-1, 1]) for (const [dz, dy, m] of [[0.2, 0.62, M.linen], [0.3, 0.6, M.fabric]]) L.put(GEO.rbox(w / 2 - 0.14, 0.17, 0.14, 0.06, 4), m, { pos: [s * (w / 4), dy, dz], rot: [-0.35, 0, 0] })
}
function nightstand(L, x, z, ry) {
  inFrame(x, z, ry, () => {
    bx(L, M.woodBlack, -0.24, 0.12, -0.2, 0.24, 0.5, 0.2, { r: 0.01 })
    bx(L, M.steelMatte, -0.2, 0, -0.16, 0.2, 0.12, 0.16)
    lathe(L, M.ceramic, [[0, 0], [0.07, 0], [0.09, 0.08], [0.05, 0.2], [0.012, 0.24], [0, 0.24]], 0.08, 0.5, 0)
    lathe(L, M.ledHouse, [[0, 0], [0.13, 0], [0.11, 0.17], [0, 0.17]], 0.08, 0.72, 0)
  })
}
{
  const L = bedF
  // master bedroom: walnut panel behind the bed, a king bed, nightstands, a bench, wardrobe, armchair, rug, drapes
  bx(L, M.veneer, -5.75, 0, IN.z0, -2.25, 2.6, IN.z0 + 0.025)
  bx(L, M.ledHouse, -5.7, 2.6, IN.z0 + 0.005, -2.3, 2.606, IN.z0 + 0.02)
  bx(L, M.rug, -5.45, 0, -4.1, -2.55, 0.012, -1.95)
  inFrame(-4.0, IN.z0 + 0.025, 0, () => bed(L, 1.95, 2.15))
  nightstand(L, -5.32, -4.62, 0); nightstand(L, -2.68, -4.62, 0)
  bx(L, M.fabric, -4.7, 0.32, -2.55, -3.3, 0.45, -2.15, { r: 0.04 })
  for (const x of [-4.62, -3.38]) for (const z of [-2.5, -2.2]) bx(L, M.steel, x - 0.015, 0, z - 0.015, x + 0.015, 0.32, z + 0.015)
  bx(L, M.veneerDark, -1.2 - TI / 2 - 0.6, 0, IN.z0 + 0.02, -1.2 - TI / 2, 2.6, -2.72)
  for (let z = IN.z0 + 0.6; z < -2.8; z += 0.55) bx(L, M.steelMatte, -1.2 - TI / 2 - 0.602, 0.05, z - 0.003, -1.2 - TI / 2 - 0.59, 2.55, z + 0.003)
  inFrame(-5.2, -2.45, -2.3, () => {
    bx(L, M.steelMatte, -0.3, 0, -0.28, 0.3, 0.12, 0.28)
    bx(L, M.fabric, -0.38, 0.12, -0.35, 0.38, 0.42, 0.35, { r: 0.08, seg: 4 })
    bx(L, M.fabric, -0.38, 0.4, 0.17, 0.38, 0.85, 0.35, { r: 0.08, seg: 4 })
    bx(L, M.fabric, -0.46, 0.12, -0.35, -0.3, 0.62, 0.3, { r: 0.06 })
    bx(L, M.fabric, 0.3, 0.12, -0.35, 0.46, 0.62, 0.3, { r: 0.06 })
  })
  // bedroom 2: queen bed head to the west wall, a desk under the window, a wardrobe on the east wall
  inFrame(1.0 + TI / 2, -3.45, Math.PI / 2, () => bed(L, 1.55, 2.0, { head: 0.85, throwM: M.fabric }))
  nightstand(L, 1.33, -4.55, Math.PI / 2)
  bx(L, M.oak, 3.2, 0.72, IN.z0 + 0.02, 4.12, 0.75, IN.z0 + 0.6, { r: 0.006 })
  for (const x of [3.23, 4.09]) bx(L, M.steel, x - 0.015, 0, IN.z0 + 0.04, x + 0.015, 0.72, IN.z0 + 0.58)
  chair(L, 3.66, -3.98, 0)
  bx(L, M.veneerDark, 4.2 - TI / 2 - 0.58, 0, -3.55, 4.2 - TI / 2, 2.6, -1.6 - TI / 2 - 0.02)
  bx(L, M.rug, 1.5, 0, -4.4, 3.4, 0.012, -2.4)
}
// curtains in the master bedroom: a drawn sheer and two dark drapes stacked at the ends (static)
{
  const g = new THREE.PlaneGeometry(2.3, 2.75, 120, 1); const p = g.attributes.position
  for (let i = 0; i < p.count; i++) p.setZ(i, 0.03 * Math.sin((p.getX(i) / 0.11) * Math.PI * 2))
  g.computeVertexNormals(); g.rotateY(Math.PI / 2); g.translate(IN.x0 + 0.12, 1.4, -3.3)
  bedF.put(g, M.sheer)
  for (const z of [-4.62, -1.98]) { const d = new THREE.PlaneGeometry(0.42, 2.85, 40, 1); const q = d.attributes.position; for (let i = 0; i < q.count; i++) q.setZ(i, 0.05 * Math.sin((q.getX(i) / 0.08) * Math.PI * 2)); d.computeVertexNormals(); d.rotateY(Math.PI / 2); d.translate(IN.x0 + 0.2, 1.44, z); bedF.put(d, M.drape) }
}

// ------------------------------------------------------------------ bathrooms
{
  const L = bathF
  // master bath: shower behind glass, wall-hung WC, a floating double vanity with a lit mirror
  bx(L, M.stone, 0.0, 0, IN.z0, 1.0 - TI / 2, 0.04, -3.75)
  bx(L, M.shower, 0.0, 0.04, -3.76, 0.01, 2.1, -3.75)
  bx(L, M.shower, 0.0, 0.04, -3.75, 0.62, 2.1, -3.74)
  bx(L, M.steel, 0.0, 2.08, -3.77, 0.62, 2.1, -3.73)
  lathe(L, M.steel, [[0, 0], [0.12, 0], [0.12, 0.01], [0, 0.01]], 0.5, 2.25, -4.4)
  bx(L, M.ceramic, -0.95, 0.38, IN.z0, -0.55, 0.56, IN.z0 + 0.52, { r: 0.08, seg: 4 })
  bx(L, M.steelMatte, -1.0, 1.0, IN.z0, -0.5, 1.15, IN.z0 + 0.012)
  bx(L, M.veneerDark, 1.0 - TI / 2 - 0.5, 0.35, -3.35, 1.0 - TI / 2, 0.8, -1.82)
  bx(L, M.marble, 1.0 - TI / 2 - 0.52, 0.8, -3.37, 1.0 - TI / 2, 0.84, -1.8)
  for (const z of [-2.95, -2.2]) lathe(L, M.ceramic, [[0, 0], [0.14, 0], [0.19, 0.1], [0.19, 0.12], [0, 0.12]], 0.7, 0.84, z)
  bx(L, M.mirror, 1.0 - TI / 2 - 0.02, 1.1, -3.3, 1.0 - TI / 2, 2.0, -1.87)
  bx(L, M.ledHouse, 1.0 - TI / 2 - 0.025, 2.0, -3.3, 1.0 - TI / 2, 2.012, -1.87)
  // bath 2
  bx(L, M.stone, 4.2 + TI / 2, 0, IN.z0, 6 - TE / 2, 0.04, -4.0)
  bx(L, M.shower, 4.9, 0.04, -4.01, 6 - TE / 2, 2.1, -4.0)
  bx(L, M.ceramic, 4.3, 0.38, -3.55, 4.82, 0.56, -3.15, { r: 0.08, seg: 4 })
  bx(L, M.veneerDark, 5.45, 0.35, -3.4, 6 - TE / 2, 0.8, -2.3)
  bx(L, M.marble, 5.43, 0.8, -3.42, 6 - TE / 2, 0.84, -2.28)
  lathe(L, M.ceramic, [[0, 0], [0.13, 0], [0.17, 0.1], [0.17, 0.12], [0, 0.12]], 5.65, 0.84, -2.85)
  bx(L, M.mirror, 6 - TE / 2 - 0.02, 1.1, -3.3, 6 - TE / 2, 2.0, -2.4)
}

// ------------------------------------------------------------------ ceiling layer (seen from inside, or when the apartment comes apart)
const FAN = new THREE.Vector3(-4.05, 0, 1.7)
const TRACKS = [-5.2, -2.75]
{
  const L = ceilL
  bx(L, M.ceil, X0 - 0.1, H, Z0 - 0.1, X1 + 0.1, H + 0.18, Z1 + 0.1)
  // the drop band along the living room's east side, with the cove's LED on its lip
  bx(L, M.ceil, -1.6, 2.74, -0.4 + TI / 2, -0.6 - TI / 2, H, Z1 - TE / 2)
  bx(L, M.ledCove, -1.62, 2.74, -0.25, -1.6, 2.76, 4.85)
  // curtain tracks in their pockets, the magnetic tracks and their six spots
  bx(L, M.alu, IN.x0 + 0.06, H - 0.04, -0.25, IN.x0 + 0.12, H, 4.85)
  bx(L, M.alu, -5.85, H - 0.04, Z1 - TE / 2 - 0.12, -1.0, H, Z1 - TE / 2 - 0.06)
  for (const x of TRACKS) {
    bx(L, M.steel, x - 0.03, H - 0.035, 0.25, x + 0.03, H, 4.45)
    for (const z of [0.85, 1.95, 3.05]) {
      bx(L, M.steel, x - 0.012, H - 0.06, z - 0.012, x + 0.012, H - 0.035, z + 0.012)
      const tilt = new THREE.Matrix4().makeRotationX(0.5).premultiply(new THREE.Matrix4().makeTranslation(x, H - 0.11, z))
      L.put(new THREE.CylinderGeometry(0.03, 0.03, 0.12, 24).applyMatrix4(tilt), M.steel)
      L.put(new THREE.CylinderGeometry(0.024, 0.024, 0.004, 24).translate(0, -0.061, 0).applyMatrix4(tilt), M.ledSpot)
    }
  }
  // the fan's canopy and downrod (the rotor turns, so it is its own mesh)
  lathe(L, M.steel, [[0, 0], [0.075, 0], [0.065, -0.05], [0.02, -0.065], [0, -0.065]], FAN.x, H, FAN.z)
  cyl(L, M.steel, FAN.x, 2.6, FAN.z, 0.012, 0.34, 16)
  lathe(L, M.steel, [[0, 0], [0.13, 0], [0.145, 0.03], [0.13, 0.08], [0.05, 0.11], [0, 0.11]], FAN.x, 2.5, FAN.z)
  // dining pendant: a black bar on two cables, with a warm diffuser underneath
  for (const z of [1.75, 3.05]) cyl(L, M.steel, 1.1, 1.82, z, 0.0025, H - 1.82, 6)
  bx(L, M.steel, 1.06, 1.76, 1.6, 1.14, 1.82, 3.2, { r: 0.01 })
  bx(L, M.ledHouse, 1.07, 1.758, 1.62, 1.13, 1.762, 3.18)
  // downlights through the rest of the flat
  for (const [x, z] of [[-4.6, -3.6], [-3.0, -3.6], [-4.6, -2.3], [-3.0, -2.3], [2.0, -3.6], [3.2, -2.6], [-0.1, -2.6], [5.1, -2.8], [-4.2, -1.0], [-2.0, -1.0], [0.4, -1.0], [2.8, -1.0], [5.0, -1.0], [3.6, 0.6], [4.6, 0.6], [4.2, 4.0], [5.2, 4.0], [0.1, 0.4]]) {
    cyl(L, M.ceil, x, H - 0.006, z, 0.045, 0.006, 24)
    cyl(L, M.ledHouse, x, H - 0.008, z, 0.032, 0.003, 24)
  }
}
const coveWash = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 5.05).rotateX(Math.PI / 2).rotateY(0), new THREE.MeshBasicMaterial({ color: 0x000000, map: coveTex, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }))
coveWash.position.set(-2.05, H - 0.004, 2.3); coveWash.rotation.y = 0
// the fan rotor: six black paddles on a hub, 1.52 m across
const rotor = new THREE.Group()
{
  const sh = new THREE.Shape(); sh.moveTo(0.14, -0.035); sh.lineTo(0.7, -0.055); sh.quadraticCurveTo(0.76, 0, 0.7, 0.055); sh.lineTo(0.14, 0.035); sh.closePath()
  const blade = GEO.extrude(sh, 0.007, 0.0015).rotateX(-Math.PI / 2).rotateX(0.0)
  const one = blade.clone().applyMatrix4(new THREE.Matrix4().makeRotationX(0.2))
  rotor.add(new THREE.Mesh(GEO.ring(one, 6, 'y'), M.steelMatte))
  rotor.add(new THREE.Mesh(GEO.lathe([[0, -0.02], [0.15, -0.02], [0.15, 0.02], [0, 0.02]], 48), M.steel))
  rotor.position.set(FAN.x, 2.53, FAN.z)
}

// ------------------------------------------------------------------ sheers on the living room glazing (they draw and stack)
const sheers = []
function sheerRun(axis, c, a0, a1) {
  const mid = (a0 + a1) / 2
  for (const [s0, s1, stackAt] of [[a0, mid, a0], [mid, a1, a1]]) {
    const len = s1 - s0 + 0.04, g = new THREE.PlaneGeometry(len, 2.93, Math.ceil(len / 0.012), 1), p = g.attributes.position
    for (let i = 0; i < p.count; i++) p.setZ(i, 0.028 * Math.sin(((p.getX(i) + len / 2) / 0.12) * Math.PI * 2))
    g.translate(stackAt === s0 ? len / 2 : -len / 2, 0, 0); g.computeVertexNormals()
    const m = new THREE.Mesh(g, M.sheer)
    const pivot = new THREE.Group(); pivot.add(m)
    if (axis === 'z') { pivot.rotation.y = -Math.PI / 2; pivot.position.set(c, 1.47, stackAt) } else pivot.position.set(stackAt, 1.47, c)
    m.userData.noAO = true
    sheers.push(pivot)
  }
}
sheerRun('z', IN.x0 + 0.09, -0.24, 4.8)
sheerRun('x', Z1 - TE / 2 - 0.09, -5.82, -1.02)

// ------------------------------------------------------------------ assemble: one group per layer, registered for explode, x-ray, labels
const UP = { floor: [0, 0, 0], furn: [0, 1.5, 0], wall: [0, 3.9, 0], ceil: [0, 7.4, 0] }
const addLayer = (L, explode, extra = []) => {
  const g = L.build(); for (const e of extra) g.add(e)
  lab.add(g, { name: L.name, explode, count: L.count + extra.length, xray: L === wallL ? 'shell' : undefined })
  g.traverse((m) => { if (!m.isMesh) return; const mm = m.material; if (SHADOWLESS.has(mm)) m.castShadow = false; if (NOAO.has(mm)) m.userData.noAO = true })
  return g
}
const gFloor = addLayer(floorL, UP.floor)
const gWall = addLayer(wallL, UP.wall, doors)
const gGlaz = addLayer(glazL, UP.wall, sheers)
const gTv = addLayer(tvL, UP.wall)
const gLiv = addLayer(livF, UP.furn, [lampShade])
const gKit = addLayer(kitF, UP.furn)
const gBed = addLayer(bedF, UP.furn)
const gBath = addLayer(bathF, UP.furn)
// the ceiling: what you see (shown from inside, or apart) in its own group, and a shadow-only slab that always
// keeps the sun out from above, so daylight comes in through the windows only
const ceilVis = ceilL.build(); ceilVis.add(rotor, coveWash)
const shadowCeil = new THREE.Mesh(new THREE.BoxGeometry(X1 - X0 + 0.2, 0.2, Z1 - Z0 + 0.2).translate(0, H + 0.1, 0), new THREE.MeshBasicMaterial({ colorWrite: false, depthWrite: false }))
shadowCeil.userData.noAO = true
const gCeil = new THREE.Group(); gCeil.add(ceilVis, shadowCeil)
lab.add(gCeil, { name: ceilL.name, explode: UP.ceil, count: ceilL.count + 7 })
gCeil.traverse((m) => { if (m.isMesh && SHADOWLESS.has(m.material)) m.castShadow = false })
shadowCeil.castShadow = true; shadowCeil.receiveShadow = false
coveWash.castShadow = false

// ------------------------------------------------------------------ lights
const KC = { cove: new THREE.Color(1.0, 0.8, 0.6), track: new THREE.Color(1.0, 0.86, 0.72), strip: new THREE.Color(1.0, 0.58, 0.28), lamp: new THREE.Color(1.0, 0.74, 0.48), house: new THREE.Color(1.0, 0.82, 0.64) }
const rect = (parent, color, w, h, x, y, z, rx = -Math.PI / 2, ry = 0) => { const l = new THREE.RectAreaLight(color, 0, w * K, h * K); l.position.set(x, y, z); l.rotation.set(rx, ry, 0, 'YXZ'); parent.add(l); return l }
const spot = (parent, color, x, y, z, tx, ty, tz, angle, pen) => { const l = new THREE.SpotLight(color, 0, 0, angle, pen, 2); l.position.set(x, y, z); l.target.position.set(tx, ty, tz); parent.add(l, l.target); return l }
const point = (parent, color, x, y, z) => { const l = new THREE.PointLight(color, 0, 0, 2); l.position.set(x, y, z); parent.add(l); return l }
const LIGHT = {
  cove: rect(gCeil, KC.cove, 4.0, 4.9, -3.5, H - 0.02, 2.3),
  trackA: spot(gCeil, KC.track, TRACKS[0], H - 0.1, 1.6, -4.3, 0.9, -0.3, 0.55, 0.65),
  trackB: spot(gCeil, KC.track, TRACKS[1], H - 0.1, 2.3, -4.0, 0.3, 1.5, 0.6, 0.7),
  strip: rect(gTv, KC.strip, FR.x1 - FR.x0 - 0.2, 0.08, (FR.x0 + FR.x1) / 2, FR.y0 - 0.02, FR.z0 + 0.04, -Math.PI / 2 - 0.35),
  lamp: spot(gLiv, KC.lamp, lampAt.x, lampAt.y - 0.03, lampAt.z, -4.4, 0.35, 1.7, 0.85, 0.85),
  sky: rect(gGlaz, new THREE.Color(0.92, 0.95, 1.0), 4.9, 2.7, IN.x0 + 0.02, 1.45, 2.3, 0, -Math.PI / 2),
  // the rest of the flat, on a simple schedule (not part of the living room's numbers)
  house: [
    point(gCeil, KC.house, 1.1, 1.6, 2.4),
    point(gCeil, KC.house, 4.2, 2.5, 1.2),
    point(gCeil, KC.house, -3.4, 2.6, -3.2),
    point(gCeil, KC.house, 2.6, 2.6, -3.2),
  ],
}
// the dining pendant is a ceiling fixture: hide its light with the ceiling only when the ceiling is apart (its cable hangs from it)

// ------------------------------------------------------------------ the solver state and the editorial layer
const sim = { apart: false, before: 'overview', scene: 'daily', sheerMode: 'auto', finish: 'walnut', sheer: 0.0, sheerWant: 0, dim: { cove: 0, track: 0, strip: 0, lamp: 0 }, house: 0, fanA: 0, view: 'overview', out: null }
lab.hero({ label: '客厅平均照度', unit: 'lx', max: 1000, digits: 0 })
const timeC = lab.slider({ id: 'time', label: '时间 · 吉隆坡 10 月 14 日', min: 6, max: 24, value: 18, step: 0.05, fmt: hhmm, ends: ['06:00', '24:00'] })
const rows = document.createElement('div'); rows.className = 'apt-rows on'
const pills = (key, label, opts) => `<div class="apt-row"><span>${label}</span><div class="apt-pills" data-key="${key}" role="group" aria-label="${label}">${opts.map(([v, t]) => `<button type="button" data-v="${v}">${t}</button>`).join('')}</div></div>`
rows.innerHTML = pills('scene', '场景', Object.entries(SCENES).map(([k, s]) => [k, s.name]))
  + pills('sheer', '纱帘', [['auto', '自动'], ['closed', '拉上'], ['open', '拉开']])
  + pills('finish', '电视墙', Object.entries(FINISHES).map(([k, f]) => [k, f.short]))
lab.$('.lab-ctls').appendChild(rows)
const views = document.createElement('div'); views.className = 'apt-views on'
views.innerHTML = `<span>视角</span><button type="button" data-view="overview">鸟瞰</button><button type="button" data-view="living">客厅（参考图）</button><button type="button" data-view="plan">平面</button>`
lab.ui.appendChild(views)
// labels: room names and areas from above, the reference's pieces from inside the living room
const _ul = lab._updateLabels.bind(lab)
lab._updateLabels = () => {
  const all = lab.labels, room = sim.view !== 'living'
  lab.labels = all.filter((L) => !!L.room === room)
  for (const L of all) if (!!L.room !== room) L.el.style.opacity = '0'
  _ul(); lab.labels = all
}
function syncPills() {
  for (const b of rows.querySelectorAll('button')) { const k = b.parentElement.dataset.key; b.classList.toggle('act', ({ scene: sim.scene, sheer: sim.sheerMode, finish: sim.finish })[k] === b.dataset.v); b.setAttribute('aria-pressed', b.classList.contains('act')) }
  for (const b of views.querySelectorAll('button')) { b.classList.toggle('act', b.dataset.view === (sim.view === 'apart' ? 'overview' : sim.view)); b.setAttribute('aria-pressed', b.classList.contains('act')) }
}
const setScene = (v) => { if (SCENES[v]) { sim.scene = v; syncPills() } }
const setSheer = (v) => { if (['auto', 'open', 'closed'].includes(v)) { sim.sheerMode = v; syncPills() } }
const FIN_LOOK = {
  walnut: () => [[M.feature, { map: TX.veneer, color: 0xffffff, roughness: 0.5, clearcoat: 0.18 }], [M.featureFluted, { map: TX.veneerDark, color: 0xffffff, roughness: 0.6, clearcoat: 0 }]],
  white: () => [[M.feature, { map: null, color: new THREE.Color(0.76, 0.75, 0.72), roughness: 0.85, clearcoat: 0 }], [M.featureFluted, { map: null, color: new THREE.Color(0.76, 0.75, 0.72), roughness: 0.85, clearcoat: 0 }]],
  marble: () => [[M.feature, { map: TX.marble, color: 0xffffff, roughness: 0.16, clearcoat: 0.45 }], [M.featureFluted, { map: TX.marble, color: 0xffffff, roughness: 0.2, clearcoat: 0.3 }]],
}
function setFinish(v) {
  if (!FINISHES[v]) return
  sim.finish = v
  for (const [m, o] of FIN_LOOK[v]()) { const had = !!m.map; m.map = o.map; m.color.set(o.color); m.roughness = o.roughness; m.clearcoat = o.clearcoat; if (had !== !!o.map) m.needsUpdate = true }
  syncPills()
}
rows.addEventListener('click', (e) => { const b = e.target.closest('button'); if (!b) return; const k = b.parentElement.dataset.key; ({ scene: setScene, sheer: setSheer, finish: setFinish })[k](b.dataset.v) })
views.addEventListener('click', (e) => { const b = e.target.closest('button'); if (b) goView(b.dataset.view) })

lab.how('太阳位置用 NOAA 公式按吉隆坡（3.14°N, 101.69°E）2026-10-14 逐分钟计算；室外天光取 IES 多云天公式。客厅的平均日光系数用 BRE 公式：玻璃与纱帘的透光率、窗的净面积、可见天空角、室内表面的平均反射率（换电视墙饰面会改变它）。日光照度 = DF × 室外天光；灯光用流明法，控制器按场景目标补足日光不足的部分。数字是房间平均值，不是逐点光照计算；3D 里的光影只是示意。', [
  'α, A = NOAA(φ, λ, 第 287 天, t)',
  'E_sky = 0.3 + 45 sin α   klx',
  'DF = T · A_w · θ / (A (1 − R²))',
  'E_day = DF · E_sky',
  'E_el = Σ Φ · d · UF · MF / A',
  'd = (E_target − E_day) / E_full',
])

// labels: rooms on the floor, the reference's key pieces in the living room
const roomLab = (id, value) => { const r = ROOMS[id]; lab.label(gFloor, r.name, { at: [(r.x[0] + r.x[1]) / 2, 0.05, (r.z[0] + r.z[1]) / 2], value: value ?? (() => `约 ${fmt(r.area, 1)} m²`) }) }
for (const id of Object.keys(ROOMS)) if (id !== 'liv') roomLab(id)
roomLab('liv', () => `约 ${fmt(ROOMS.liv.area, 1)} m² · ${fmt(sim.out?.E ?? 0)} lx`)
for (const L of lab.labels) L.room = true
lab.label(gTv, '大理石电视框', { at: [FR.x1, FR.y1, FR.z1], value: () => 'ρ 0.70 · 书页对纹' })
lab.label(gTv, '电视墙饰面', { at: [TVW.x0 + 0.3, 2.5, TVW.z + 0.03], value: () => `${FINISHES[sim.finish].name} · ρ ${FINISHES[sim.finish].rho.toFixed(2)}` })
lab.label(gTv, '暖光灯带', { at: [FR.x0 + 0.4, FR.y0 - 0.01, FR.z1], value: () => `${fmt(LAYERS[2].W * sim.dim.strip)} W · 2400 K` })
lab.label(gGlaz, '纱帘', { at: [IN.x0 + 0.1, 2.3, 3.6], value: () => `τ 0.55 · ${sim.sheer > 0.5 ? '拉上' : '拉开'}` })
lab.label(gLiv, '落地灯', { at: [lampAt.x, lampAt.y + 0.05, lampAt.z], value: () => `${fmt(LAYERS[3].lm * sim.dim.lamp)} lm` })
lab.label(ceilVis, '吊扇', { at: [FAN.x + 0.76, 2.53, FAN.z], value: () => '1.52 m · 6 叶 · 140 rpm' })
lab.label(ceilVis, '磁吸轨道灯', { at: [TRACKS[1], H - 0.1, 0.85], value: () => `${fmt(LAYERS[1].lm * sim.dim.track)} lm` })

// room tags in the plan view: name and area at each room's centre, the way a drawing is annotated
const tags = document.createElement('div'); tags.className = 'apt-tags'
tags.innerHTML = Object.entries(ROOMS).map(([id, r]) => `<div data-room="${id}"><b>${r.name}</b><span>约 ${fmt(r.area, 1)} m²</span></div>`).join('')
lab.ui.insertBefore(tags, lab.ui.firstChild)
const tagEls = [...tags.children].map((el) => ({ el, r: ROOMS[el.dataset.room] }))
const tagP = new THREE.Vector3()
function placeTags() {
  const a = sim.view === 'plan' ? smoothstep(0.6, 1, lab.state.cut) : 0
  tags.style.opacity = a.toFixed(3)
  if (a <= 0) return
  for (const { el, r } of tagEls) {
    tagP.set((r.x[0] + r.x[1]) / 2, 1.3, (r.z[0] + r.z[1]) / 2 + (el.dataset.room === 'liv' ? 0.55 : 0)).multiplyScalar(K).project(lab.camera)
    el.style.transform = `translate(${((tagP.x * 0.5 + 0.5) * innerWidth).toFixed(1)}px, ${((-tagP.y * 0.5 + 0.5) * innerHeight).toFixed(1)}px) translate(-50%, -50%)`
  }
}
const _render = lab.render.bind(lab)
lab.render = (dt) => { _render(dt); placeTags() }

// ------------------------------------------------------------------ views: an eased move between three framings
let camAnim = null
const R2D = 180 / Math.PI
function frameX() { return narrow() ? 0 : -0.16 }
function currentView() {
  const t = lab.controlsOrbit.target, off = lab.camera.position.clone().sub(t), r = off.length()
  return { az: Math.atan2(off.x, off.z) * R2D, el: Math.asin(clamp(off.y / r, -1, 1)) * R2D, dist: r / 2.4, target: t.clone().divideScalar(K).toArray(), fov: lab.camera.fov }
}
function viewFor(id) {
  const v = { ...VIEWS[id], frameX: frameX() }
  if (!narrow()) return v
  // portrait: lift the subject into the top half, clear of the readout band
  if (id === 'living') return { ...v, fov: 80, el: 4, target: [v.target[0], 0.9, v.target[2]] }
  if (id === 'plan') return { ...v, dist: v.dist * 2.15, target: [v.target[0], v.target[1], v.target[2] + 4.6] }
  return { ...v, dist: v.dist * 1.5, target: [v.target[0], v.target[1] - 3.2, v.target[2]] }
}
function goView(id, instant = false) {
  if (!VIEWS[id]) return
  const prev = sim.view; sim.view = id; syncPills()
  if (id === 'plan') lab.toggle('cut', true); else if (prev === 'plan') lab.toggle('cut', false)
  lab.controlsOrbit.maxPolarAngle = id === 'living' ? Math.PI * 0.6 : Math.PI * 0.495
  if (id !== 'apart' && lab.target.explode > 0.5) { lab.toggle('explode', false); sim.apart = false }
  lab._cam = id !== 'overview' && id !== 'apart'
  const to = viewFor(id)
  if (instant || still) { lab.setView(to); return }
  camAnim = { from: currentView(), to, t: 0 }
  lab.controlsOrbit.enabled = false
}

// ------------------------------------------------------------------ the studio follows the sun: day paper, night ink
const DAY = { bg: lab.bgColor.clone(), floor: lab.floor.material.color.clone() }
const NIGHT = { bg: new THREE.Color(0x0e0f11).convertSRGBToLinear(), floor: new THREE.Color(0x101113).convertSRGBToLinear() }
const rim = lab.scene.children.find((o) => o.isDirectionalLight && o !== lab.key)
const fill = lab.scene.children.find((o) => o.isHemisphereLight)
const sunCol = new THREE.Color()
const CENTER = new THREE.Vector3(0, 1.2, 0)

// ------------------------------------------------------------------ run
lab.onTick((dt, lab, rdt) => {
  const hour = timeC.value
  const sun = sunAt(hour), sky = skyAt(sun.alt)
  const west = onFacade(sun, sky.Edn, 270), south = onFacade(sun, sky.Edn, 180)
  // sheers: forced, or automatic (closed after dark for privacy, closed while direct sun on the glass passes 8 klx)
  const sc = SCENES[sim.scene]
  let want = sim.sheerMode === 'open' ? 0 : sim.sheerMode === 'closed' ? 1 : sim.sheerWant
  let why = ''
  if (sim.sheerMode === 'auto') {
    const Ev = Math.max(west.Ev, south.Ev)
    if (sun.alt < -1) { want = 1; why = '入夜' } else if (Ev > 8000) { want = 1; why = west.Ev >= south.Ev ? '西晒' : '南窗直射' } else if (Ev < 6000) want = 0
    else why = sim.sheerWant ? '直射' : ''
  }
  if (sc.sheer) { want = Math.max(want, sc.sheer); why = sc.name }
  sim.sheerWant = want
  sim.sheer = approach(sim.sheer, want, 0.9, rdt)
  const d = daylightFactor(sim.finish, sim.sheer)
  const Eday = (d.DF / 100) * sky.Esky
  const dims = dimsFor(sim.scene, Eday)
  let Eel = 0, Wt = 0
  for (const L of LAYERS) { sim.dim[L.id] = approach(sim.dim[L.id], dims[L.id], 0.7, rdt); Eel += layerLux(L, sim.dim[L.id]); Wt += L.W * sim.dim[L.id] }
  const E = Eday + Eel
  sim.out = { sun, sky, d, Eday, Eel, E, Wt }

  // the scene in 3D: sheers stack toward their ends, curtains glow with the light behind them, the lamps follow the dimmers
  const open = 1 - sim.sheer
  for (const s of sheers) s.children[0].scale.x = lerp(1, 0.13, open)
  M.sheer.emissiveIntensity = 0.03 + 0.22 * smoothstep(0, 20000, sky.Esky) + 0.25 * smoothstep(1000, 20000, Math.max(west.Ev, south.Ev))
  M.ledAmber.emissiveIntensity = 5 * sim.dim.strip
  M.ledCove.emissiveIntensity = 4 * sim.dim.cove
  M.ledSpot.emissiveIntensity = 4 * sim.dim.track
  M.ledLamp.emissiveIntensity = 3 * sim.dim.lamp
  coveWash.material.color.copy(KC.cove).multiplyScalar(0.55 * sim.dim.cove)
  M.orb.emissiveIntensity = 2.2 * Math.max(sim.dim.lamp, sim.dim.strip * 0.6)
  LIGHT.cove.intensity = 1.5 * sim.dim.cove
  LIGHT.trackA.intensity = 0.9 * sim.dim.track
  LIGHT.trackB.intensity = 0.9 * sim.dim.track
  LIGHT.strip.intensity = 26 * sim.dim.strip
  LIGHT.lamp.intensity = 0.55 * sim.dim.lamp
  LIGHT.sky.intensity = 1.6 * smoothstep(0, 30000, sky.Esky) * d.T / 0.62
  LIGHT.sky.color.setRGB(1, lerp(0.8, 0.96, smoothstep(0, 25, sun.alt)), lerp(0.62, 1.0, smoothstep(0, 25, sun.alt)))
  // the rest of the flat: lights come on at dusk; the night scene leaves only the corridor at a glow
  const houseWant = sky.Esky > 3000 ? 0 : sim.scene === 'night' ? 0.12 : sim.scene === 'movie' ? 0.3 : 0.8
  sim.house = approach(sim.house, houseWant, 0.8, rdt)
  LIGHT.house.forEach((l) => { l.intensity = 0.32 * sim.house })
  M.ledHouse.emissiveIntensity = 2.6 * sim.house
  sim.fanA += rdt * (140 / 60) * Math.PI * 2
  rotor.rotation.y = -sim.fanA

  const cam = lab.camera.position.clone().divideScalar(K)
  const inside = cam.y < H - 0.05 && Math.abs(cam.x) < X1 && Math.abs(cam.z) < Z1
  // the studio: sun as the key light, paper by day, ink by night
  const dayK = smoothstep(-7, 6, sun.alt)
  lab.bgColor.copy(NIGHT.bg).lerp(DAY.bg, dayK); lab.scene.background.copy(lab.bgColor)
  lab.floor.material.color.copy(NIGHT.floor).lerp(DAY.floor, dayK)
  lab.scene.environmentIntensity = lerp(0.06, 0.8, dayK) * lerp(0.7, 1, smoothstep(2, 30, sun.alt)) * (inside ? 0.55 : 1)
  lab.ao.blendIntensity = 0.85 * (1 - smoothstep(0.02, 0.4, lab.state.explode))
  const up = Math.max(sun.alt, 2) * Math.PI / 180, az = sun.az * Math.PI / 180
  const dir = new THREE.Vector3(Math.sin(az) * Math.cos(up), Math.sin(up), -Math.cos(az) * Math.cos(up))
  lab.key.target.position.copy(CENTER).multiplyScalar(K)
  lab.key.position.copy(lab.key.target.position).addScaledVector(dir, 9)
  lab.key.intensity = 2.7 * smoothstep(-0.5, 8, sun.alt) * lerp(0.55, 1, smoothstep(5, 40, sun.alt))
  sunCol.setRGB(1, lerp(0.62, 0.95, smoothstep(0, 30, sun.alt)), lerp(0.36, 0.88, smoothstep(0, 35, sun.alt)))
  lab.key.color.copy(sunCol)
  if (rim) rim.intensity = 0.9 * dayK
  if (fill) fill.intensity = 0.04 + 0.16 * dayK
  lab.bloom.strength = lerp(0.42, 0.18, dayK); lab.bloom.threshold = lerp(0.85, 1.6, dayK)
  lab.bloom.enabled = dayK < 0.85 || Math.max(sim.dim.strip, sim.dim.lamp, sim.dim.cove) > 0.05   // nothing glows by day: skip the pass
  lab.grade.uniforms.uVig.value = lerp(0.3, 0.1, dayK)
  document.documentElement.classList.toggle('lab-night', dayK < 0.35)

  // the ceiling shows from inside, and when the flat comes apart
  ceilVis.visible = inside || lab.state.explode > 0.02
  // explode: pull back to a framing that holds the whole stack, and come back when it closes
  const apart = lab.target.explode > 0.5
  if (apart !== sim.apart) {
    sim.apart = apart
    if (apart && sim.view !== 'apart') { sim.before = sim.view === 'apart' ? 'overview' : sim.view; goView('apart') } else if (!apart && sim.view === 'apart') goView(sim.before ?? 'overview')
  }
  document.documentElement.classList.toggle('apt-inside', inside)
  // view moves
  if (camAnim) {
    camAnim.t += rdt / 1.6
    const k = ease.io(clamp(camAnim.t)), a = camAnim.from, b = camAnim.to
    const daz = ((b.az - a.az + 540) % 360) - 180
    lab.setView({ az: a.az + daz * k, el: lerp(a.el, b.el, k), dist: lerp(a.dist, b.dist, k), fov: lerp(a.fov, b.fov, k), frameX: b.frameX, target: a.target.map((v, i) => lerp(v, b.target[i], k)) })
    if (camAnim.t >= 1) { camAnim = null; lab.controlsOrbit.enabled = true }
  }

  // hero
  const stateWord = sc.fixed ? sc.name : Eday >= sc.target - 1 ? '日光充足' : Eday > 3 ? '日光 + 补光' : '全靠灯光'
  const sheerTxt = `纱帘${sim.sheer > 0.5 ? '拉上' : '拉开'}${why && sim.sheerMode === 'auto' && !sc.sheer ? `（${why}）` : sc.sheer ? '' : sim.sheerMode === 'auto' ? '' : '（手动）'}`
  const line2 = sim.scene === 'movie'
    ? `电视对比度 <span class="warm">${fmt(tvContrast(E))} : 1</span> · ${sheerTxt}`
    : sun.alt > 0 ? `太阳 高度 ${fmt(sun.alt)}° · 方位 ${fmt(sun.az)}° · ${sheerTxt}` : `日落后 · ${sheerTxt}`
  lab.setHero(E, { state: stateWord, sub: `日光 ${fmt(Eday)} lx（DF ${fmt(d.DF, 1)} %）· 灯光 <span class="warm">${fmt(Eel)} lx</span> · ${fmt(Wt)} W<br><small>${line2}</small>` })
})
{
  // the glowing strip itself: an emissive line inside the aluminium channel under the frame
  const m = new THREE.Mesh(new THREE.BoxGeometry(FR.x1 - FR.x0 - 0.24, 0.004, 0.012), M.ledAmber)
  m.position.set((FR.x0 + FR.x1) / 2, FR.y0 - 0.016, FR.z0 + 0.045); m.castShadow = false
  const slot = new THREE.Mesh(new THREE.BoxGeometry(1.16, 0.004, 0.006), M.ledAmber)
  slot.position.set(-4.3, 0.518, TVW.z + 0.037); slot.castShadow = false
  gTv.add(m, slot)
}

// ------------------------------------------------------------------ adaptive resolution: hold about 30 fps on slow GPUs and 2x screens
// every 1.5 s, drop the pixel ratio by 15 % below 27 fps (down to 0.7) and raise it above 50 fps (up to the kit's cap)
const PR = { max: Math.min(devicePixelRatio, 2), cur: Math.min(devicePixelRatio, 2), t0: performance.now(), n: 0 }
lab.onTick(() => {
  if (lab.filmMode) return
  PR.n++
  const now = performance.now(), span = (now - PR.t0) / 1000
  if (span < 1.5) return
  const fps = PR.n / span; PR.t0 = now; PR.n = 0
  const next = fps < 27 ? Math.max(0.7, PR.cur * 0.85) : fps > 50 ? Math.min(PR.max, PR.cur * 1.15) : PR.cur
  if (Math.abs(next - PR.cur) < 0.01 || document.hidden) return
  PR.cur = next; lab.renderer.setPixelRatio(next); lab.composer.setPixelRatio(next); lab._resize()
})

// ------------------------------------------------------------------ messages from the page that embeds this one (index.html)
addEventListener('message', (e) => {
  if (window.parent === window || e.source !== window.parent) return
  const d = e.data
  if (!d || d.ns !== 'moshi' || d.type !== 'set') return
  if (typeof d.sheer === 'string') setSheer(d.sheer)
  if (typeof d.finish === 'string') setFinish(d.finish)
  if (typeof d.scene === 'string') setScene(d.scene)
  if (typeof d.view === 'string') goView(d.view)
  if (Number.isFinite(d.hour)) timeC.set(clamp(d.hour, 6, 24))
})
window.moshi = { sim, setScene, setSheer, setFinish, goView, time: timeC, pr: PR }

// Chinese captions for the kit's buttons (the kit itself is untouched)
const ZH = { run: ['暂停', '运行'], explode: '爆炸', cut: '剖切', xray: 'X 光', slow: '慢放', labels: '标签' }
const _sync = lab._syncButtons.bind(lab)
lab._syncButtons = () => { _sync(); for (const b of lab.ui.querySelectorAll('.lab-modes button')) { const k = b.dataset.k; if (k === 'run') b.firstChild.textContent = lab.paused ? ZH.run[1] : ZH.run[0]; else if (ZH[k]) b.firstChild.textContent = ZH[k] } }
lab.$('.lab-how summary').textContent = '如何计算'
const _hud = lab._buildHUD.bind(lab)
lab._buildHUD = (A) => { _hud(A); if (lab._building) { lab.metricEl.querySelector('.lbl').firstChild.textContent = '组装中 · '; const i = lab.metricEl.querySelector('.lab-big i'); i.textContent = i.textContent.replace(/^of (.*) parts$/, '/ $1 件'); lab._hsub.textContent = lab._hsub.textContent.replace('triangles', '三角面').replace('materials', '种材质') } }

// the film (not recorded for this project; node machine/scripts/record.mjs can make it)
lab.autoFilm({ runBeat: '时间从下午走到深夜。', runSub: '日光由公式算出，灯光按场景补足。', sliderTo: 0.85 })

// reduced motion: no fly-in, no idle orbit, instant view changes; every control still works
const still = matchMedia('(prefers-reduced-motion: reduce)').matches
if (still) lab.o.autoOrbit = false
syncPills()
lab.start()
if (still) lab._assembly = 0
goView('overview', true)
addEventListener('resize', () => { if (!camAnim) lab.setView(viewFor(sim.view)) })
