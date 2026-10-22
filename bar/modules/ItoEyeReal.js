.pragma library

// The realistic manga eye (eyes-v2.md, section 2): anatomy, a tone field, tone turned into ink, the seven archetypes, the size tiers.
//
// Pure functions, no I/O, no QML types, no colours (a stroke only names the ink ROLE it is drawn with): the same file loads in the
// shell, in the offscreen lab and in `node --test`. A `.pragma library` (fluidity.md): ONE copy of the caches below is shared by every eye of the shell, so a stroke list
// is built once per (face, size, tier) instead of once per eye instance (60-80 ms each at tier 2-3). No JS-to-JS import, so the few
// helpers of that file are repeated here.
//
// Units: the eye is drawn in a box of 100 x 62 units, scaled to S px by `S / 100`; the inner corner is on the left, a mirrored eye
// is flipped about x = 50 by the host; y grows downward.
//
// A stroke: { id, layer, role, a, poly, poly2?, clip?, m? }   (poly is flat [x0, y0, x1, y1, ...])
//   role   paper | ink | skin | tint | caruncle | vein | tear   (vein: `m` 0..1 is the bloodshot weight; the host maps a role to a colour)
//   clip   drawn inside the opening (how the lids cover the iris)
// The list is ordered: paper first, the catchlight and the cornea (paper again) last.
//
// Tone (0 paper .. 1 solid) is a function of place (`toneField`). It becomes marks only: long contour lines that swell in the dark and
// taper out into the light, a crossing family, a third in the corners, solid brush masses, and (T3) screentone dots and stipple.

var BOX = { w: 100, h: 62 }
var HAIRLINE = 0.6               // px: no stroke is drawn thinner, thinner reads fainter instead
var MUD_PX = 1.8                 // px: no hatch family is spaced closer than this
var TIER = { t1: 24, t2: 56, t3: 120, hyst: 3 }
var CAP = { 1: 120, 2: 900, 3: 2600 }       // stroke list caps (T1 is the design's; T2 and T3 are ceilings, not targets)
var PLATE_PMIN = 0.1             // plates: the iris plate is baked with the pupil at this fraction of the iris radius (the pin), a bigger pupil covers the fibres
var ARCHETYPES = ["stare", "heavy", "lidless", "spiral", "weeping", "poly", "slit"]

// Colour factors of the real-eye tokens (read by ItoSealInk; no colour is written anywhere).
var REAL_INK = {
  paper: { target: 2.0 },                        // liquid: lightenTo(brightest(bone, panel), body, target); frame: brightest(bone, panel)
  ink: { clotMix: 0.35, target: 7.0 },           // liquid: mix(darkest(bone, panel), clot, clotMix); frame: darkest; both darkened to target on paper
  tint: { liquid: 0.14, frame: 0.16 },           // mix(paper, blood | lit, f): the iris base
  vein: { mix: 0.3, per: 0.5, target: 3.0 },     // mix(ink, blood, mix + per * bloodshot), darkened to target on paper
  tear: { mix: 0.55, target: 3.0 },              // mix(ink, warn, mix): the hot veins and the tear
  caruncle: 0.32,                                // mix(paper, blood, f)
  skin: { need: 3.0, mix: 0.35 },                // the ink of the skin marks: `ink` when it reads 3:1 on the ground, else the paper mixed toward the ground
  pupil: { target: 3.0 },                        // realTint vs the pupil (ink)
  edgeBelow: 1.6                                 // paper vs body under this: the eye turns its edge mode on
}

// ---- small helpers (the same as ItoEyeModel.js) ------------------------------------------------------------------------
function pt(x, y) { return { x: x, y: y } }
function add(p, q) { return pt(p.x + q.x, p.y + q.y) }
function sub(p, q) { return pt(p.x - q.x, p.y - q.y) }
function mul(p, k) { return pt(p.x * k, p.y * k) }
function len(p) { return Math.sqrt(p.x * p.x + p.y * p.y) }
function unit(p) { var l = len(p); return l > 1e-9 ? pt(p.x / l, p.y / l) : pt(0, -1) }
function lerp(p, q, t) { return pt(p.x + (q.x - p.x) * t, p.y + (q.y - p.y) * t) }
function rot(d, deg) { var a = deg * Math.PI / 180, c = Math.cos(a), s = Math.sin(a); return pt(d.x * c - d.y * s, d.x * s + d.y * c) }
function perp(d) { return pt(d.y, -d.x) }
function clamp(v, lo, hi) { return v < lo ? lo : (v > hi ? hi : v) }
function smoothstep(a, b, x) { var t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t) }
function ss01(a, b, x) { return b <= a ? 1 : smoothstep(a, b, x) }
function hash(seed, salt, i) {
  var x = ((seed | 0) * 374761393 + salt * 668265263 + i * 362437) | 0
  x = Math.imul(x ^ (x >>> 13), 1274126177)
  x = x ^ (x >>> 16)
  return (x >>> 0) / 4294967296
}
function hs(seed, salt, i, lo, hi) { return lo + (hi - lo) * hash(seed, salt, i) }
function vnoise(seed, salt, t, knots) {
  var x = clamp(t, 0, 1) * knots, i = Math.min(knots - 1, Math.floor(x)), f = x - i
  var a = 2 * hash(seed, salt, i) - 1, b = 2 * hash(seed, salt, i + 1) - 1
  return a + (b - a) * f * f * (3 - 2 * f)
}
function polyLen(pts) { var l = 0; for (var i = 1; i < pts.length; i++) l += len(sub(pts[i], pts[i - 1])); return l }
function flat(pts) { var o = []; for (var i = 0; i < pts.length; i++) o.push(pts[i].x, pts[i].y); return o }
function flatRev(pts) { var o = []; for (var i = pts.length - 1; i >= 0; i--) o.push(pts[i].x, pts[i].y); return o }
function r2(v) { return Math.round(v * 100) / 100 }

var RS = { param: 100, pupil: 101, lash: 102, brow: 103, vein: 104, hatch: 105, fibre: 106, crypt: 107, stipple: 108, tone: 109, gap: 110,
           tear: 111, poly: 112, spiral: 113, cat: 114, tuck: 115, line: 116, veil: 117, dot: 118, ball: 119, pair: 120, edge: 121 }

// ---- 2.2 the parameters: the realistic envelope, then the archetype presets over it ------------------------------------------
// Ranges are [lo, hi] rolled from the seed. The box is 62 units tall and holds the brow, the fold, the lids and the bag, so the lid
// heights are the design's (18-30 / 7-13) scaled to fit it: the upper lid is further capped by `capUp` so the fold and the brow stay in.
var RANGE = {
  ix: [6, 10], iy: [38, 41], ox: [90, 95], oy: [31, 36],
  upPeak: [0.36, 0.46], upH: [14, 22], loLow: [0.55, 0.66], loH: [7, 13],
  outerTuck: [1.5, 3.5], lidThick: [1.2, 2.4], foldH: [3, 9], foldHang: [0, 1],
  caruncle: [2.2, 3.4], globeR: [1.05, 1.25],
  browY: [10, 20], browTilt: [-6, 8], browArch: [0, 1],
  aperture: [0.8, 1.1], lidCover: [0.12, 0.35], lowerGap: [0, 2],
  yaw: [-0.25, 0.25], pitch: [-0.1, 0.1], irisR: [10, 12.5],
  wet: [0, 0.5], bloodshot: [0, 0.4], droop: [0, 2.5], tilt: [-2, 2], upLashes: [18, 30], loLashes: [6, 12]
}
var PRESET = {
  stare:   { aperture: [1.2, 1.35], lidCover: [0, 0], lowerGap: [2, 5], irisR: [9, 11], pupilState: "pin", browTilt: [12, 18], browY: [10, 13],
             foldH: [7, 9], foldHang: [0, 0], catchStyle: "pin", bloodshot: [0.1, 0.4], droop: [0, 1], upH: [16, 20], loH: [5.5, 6.5] },
  heavy:   { aperture: [0.6, 0.75], lidCover: [0.35, 0.5], foldHang: [1.5, 3], lashHeavy: true, pupilState: "dilated", browTilt: [-3, 2], browY: [6, 9],
             browArch: [0, 0.2], mole: true, catchStyle: "paper", foldH: [4, 6], upH: [18, 24], irisR: [11, 13] },
  lidless: { aperture: [1.15, 1.3], lidCover: [0, 0], lowerGap: [0, 1], irisR: [13, 16], pupilState: "calm", catchStyle: "none", bloodshot: [0.6, 0.8],
             bulge: [4, 5], lidless: true, browTilt: [-2, 2], foldH: [0, 0], foldHang: [0, 0], lidThick: [0.6, 0.9], upH: [12, 14], loH: [9, 11], outerTuck: [0.6, 1], upPeak: [0.48, 0.52], loLow: [0.48, 0.52] },
  spiral:  { aperture: [1.0, 1.1], lidCover: [0.05, 0.12], irisR: [13, 15], pupilState: "spiral", light: "under", catchStyle: "none", bloodshot: [0.2, 0.4],
             browTilt: [0, 6], upPeak: [0.4, 0.42], loLow: [0.5, 0.52], upH: [18, 20], loH: [10, 12] },
  weeping: { aperture: [0.85, 1.0], bloodshot: [0.8, 1], loH: [11, 15], bag: 0.45, tear: true, catchStyle: "paper", pupilState: "torn", browTilt: [10, 16], wet: [0.8, 1],
             droop: [1.5, 3], upPeak: [0.36, 0.4], loLow: [0.6, 0.66], lidCover: [0.18, 0.3], upH: [14, 18] },
  poly:    { aperture: [1.08, 1.2], irisR: [14, 16], pupilState: "poly", catchStyle: "paper", browTilt: [-3, 3], lidCover: [0.05, 0.12], 
             upPeak: [0.44, 0.46], loLow: [0.62, 0.66], bloodshot: [0.1, 0.3], upH: [22, 26], loH: [9.5, 10.5] },
  slit:    { aperture: [0.18, 0.3], lidCover: [0.5, 0.6], irisR: [9, 10], lashDown: true, pupilState: "calm", browTilt: [-4, 4], foldH: [2, 3], foldHang: [0, 0],
             upLashes: [10, 16], catchStyle: "paper", upH: [18, 22], loH: [8, 10] }
}
var PUPIL_FIXED = { stare: "pin", heavy: "dilated", lidless: "calm", spiral: "spiral", poly: "poly", slit: "calm" }

function roll(a, seed, over) {
  var pre = PRESET[a], p = { archetype: a }, i = 0, k, v
  for (k in RANGE) {
    v = pre[k] !== undefined ? pre[k] : RANGE[k]
    p[k] = v[0] === v[1] ? v[0] : hs(seed, RS.param, i, v[0], v[1])
    i++
  }
  for (k in pre) if (RANGE[k] === undefined) p[k] = Array.isArray(pre[k]) ? hs(seed, RS.param, 200 + i++, pre[k][0], pre[k][1]) : pre[k]
  p.pupilState = pre.pupilState !== undefined ? pre.pupilState : (hash(seed, RS.pupil, 0) < 0.5 ? "torn" : "calm")
  if (p.catchStyle === undefined) p.catchStyle = hash(seed, RS.cat, 0) < 0.22 ? "none" : (hash(seed, RS.cat, 1) < 0.35 ? "pin" : "paper")
  if (p.light === undefined) p.light = "normal"
  p.lightDeg = p.light === "under" ? 90 : -120 + hs(seed, RS.tone, 0, -12, 12)
  p.blink = 0
  p.veil = 0
  p.gaze = 0
  if (over) for (k in over) p[k] = over[k]
  return p
}
function realParams(arch, seed, over) { return roll(PRESET[arch] ? arch : "heavy", seed | 0, over) }

// The hidden second eye of a pair: another archetype from {stare, heavy, slit}, droop + 2, the brow angle +-6 degrees, behind a veil.
var PAIR_ARCH = ["stare", "heavy", "slit"]
function realPair(p, seed) {
  var pool = PAIR_ARCH.filter(function(a) { return a !== p.archetype }), a = pool[Math.floor(hash(seed, RS.pair, 0) * pool.length) % pool.length]
  var q = roll(a, seed + 17, null)
  q.droop = p.droop + 2
  q.browTilt = p.browTilt + (hash(seed, RS.pair, 1) < 0.5 ? -6 : 6)
  q.veil = 0.55
  return q
}

// ---- 2.2 geometry ---------------------------------------------------------------------------------------------------------------
// Everything below the parameters reads the lids through two tables (y of the upper and the lower lid at every half unit of x), so
// the tone field and the hatch walkers never call a power or a sine.
var TAB = 0.5
function buildGeo(p) {
  var tl = p.tilt * Math.PI / 180
  var I = pt(p.ix, p.iy), O = pt(p.ox, p.oy + p.droop), W = O.x - I.x
  var ap = clamp(p.aperture, 0.12, 1.5), b = clamp(p.blink, 0, 1)
  var apL = 0.5 + 0.5 * clamp(ap, 0, 1.35)
  var chordAt = function(x) { return I.y + (O.y - I.y) * (x - I.x) / W }
  // the fold and the brow need room above the lid: the lid is capped by what is left over the fold
  var foldTop = p.foldH + (p.foldH > 0 ? 7 : 5)
  var capUp = chordAt(I.x + p.upPeak * W) - foldTop - 2
  var upH = Math.min(p.upH * ap, capUp) * (1 - 0.94 * b), loH = (p.loH + (p.bag ? 3 : 0)) * apL * (1 - 0.45 * b)
  var bulge = (p.bulge || 0) * (1 - b)
  function bumpU(s) {
    if (s <= 0 || s >= 1) return 0
    var pk = p.upPeak
    if (s < pk) return Math.pow(Math.sin(Math.PI / 2 * s / pk), 0.75)
    return Math.pow(Math.cos(Math.PI / 2 * (s - pk) / (1 - pk)), 1.6)
  }
  function bumpL(s) {
    if (s <= 0 || s >= 1) return 0
    var pk = p.loLow
    if (s < pk) return Math.pow(Math.sin(Math.PI / 2 * s / pk), 0.9)
    return Math.pow(Math.cos(Math.PI / 2 * (s - pk) / (1 - pk)), 1.3)
  }
  var n = Math.round(100 / TAB) + 1, UY = new Array(n), LY = new Array(n), x, i, s
  for (i = 0; i < n; i++) {
    x = i * TAB; s = clamp((x - I.x) / W, 0, 1)
    var inside = x > I.x && x < O.x
    UY[i] = chordAt(x) - (inside ? upH * bumpU(s) + bulge * Math.pow(Math.sin(Math.PI * s), 0.6) : 0)
    LY[i] = chordAt(x) + (inside ? loH * bumpL(s) + bulge * Math.pow(Math.sin(Math.PI * s), 0.6) : 0)
  }
  function tab(a, x) {
    var g = clamp(x, 0, 100) / TAB, i0 = Math.min(n - 2, Math.floor(g)), f = g - i0
    return a[i0] + (a[i0 + 1] - a[i0]) * f
  }
  var G = {
    I: I, O: O, W: W, upH: upH, loH: loH, chord: chordAt, tilt: tl,
    yU: function(x) { return tab(UY, x) }, yL: function(x) { return tab(LY, x) },
    s: function(x) { return clamp((x - I.x) / W, 0, 1) }
  }
  // inside the opening by `m` units (negative: outside by that much)
  G.open = function(x, y, m) {
    if (x <= I.x || x >= O.x) return false
    return y - tab(UY, x) > m && tab(LY, x) - y > m
  }
  // the opening as a polygon (cos-spaced in x: dense at the corners)
  G.openPts = function(N) {
    var up = [], lo = [], k, xx
    for (k = 0; k <= N; k++) { xx = I.x + W * (0.5 - 0.5 * Math.cos(Math.PI * k / N)); up.push(pt(xx, G.yU(xx))); lo.push(pt(xx, G.yL(xx))) }
    lo.reverse()
    return up.concat(lo.slice(1, lo.length - 1))
  }
  G.normalU = function(x) { var d = pt(1, (G.yU(x + 0.6) - G.yU(x - 0.6)) / 1.2); return perp(unit(d)) }   // out of the eye (up)
  G.normalL = function(x) { var d = pt(1, (G.yL(x + 0.6) - G.yL(x - 0.6)) / 1.2); return mul(perp(unit(d)), -1) }   // out of the eye (down)
  // the fold above the lash line; foldHang brings its outer end down over the lid
  G.foldY = function(x) {
    var s0 = G.s(x), off = p.foldH * (1 - 0.18 * p.foldHang * smoothstep(0.3, 0.9, s0))
    return G.yU(x) - off - 0.8 * Math.sin(Math.PI * s0)
  }
  // the globe behind the opening, and the iris on it
  var gr = p.globeR * W / 2, gx = (I.x + O.x) / 2 + 2, gy = chordAt(gx) + 2
  G.globe = { x: gx, y: gy, r: gr }
  var R = p.irisR, yaw = clamp(p.yaw, -0.6, 0.6), pitch = clamp(p.pitch, -0.35, 0.35)
  var xc = gx + gr * Math.sin(yaw) * 0.8, uy = G.yU(xc), ly = G.yL(xc), free = (ly - uy) - 2 * R, top
  var ncos = Math.cos(yaw)
  if (p.lidCover > 0.001) top = uy - 2 * R * p.lidCover
  else top = uy + Math.max(0.6, 0.5 * free - 0.5 * p.lowerGap)
  var cy = top + R + gr * Math.sin(pitch) * 0.2
  if (cy + R > ly - 0.4 && p.lidCover <= 0.001) cy = ly - 0.4 - R
  if (p.archetype === "slit") cy = ly - R * 0.55
  var pr
  switch (p.pupilState) {
    case "pin": pr = 1.4; break
    case "dilated": pr = (p.archetype === "heavy" ? 0.7 : 0.78) * R; break
    case "torn": pr = 0.5 * R; break
    case "spiral": pr = 1.6; break
    case "poly": pr = 0.3 * R; break
    default: pr = 0.42 * R
  }
  G.iris = { x: xc, y: cy, rx: R * ncos, ry: R, r: R, pupil: pr, state: p.pupilState }
  G.inIris = function(x, y, m) {
    var dx = (x - xc) / (G.iris.rx + m), dy = (y - cy) / (R + m)
    return dx * dx + dy * dy < 1
  }
  var lr = (p.lightDeg) * Math.PI / 180
  G.light = { x: Math.cos(lr) * 0.83, y: Math.sin(lr) * 0.83, z: 0.55 }
  G.region = function(x, y) {   // 0 inside the socket region .. 1 at its edge (it fades to nothing there)
    var dx = (x - 50) / 50, dy = (y - 32) / 31
    return Math.sqrt(dx * dx + dy * dy)
  }
  return G
}

// ---- 2.3 the tone field ----------------------------------------------------------------------------------------------------------
// -> { sclera(x, y), iris(x, y), skin(x, y), cast(x, y) } in 0..1
function toneField(p, G) {
  var gb = G.globe, L = G.light, I = G.I, O = G.O, ir = G.iris
  var depthC = 2 + 8 / Math.max(0.5, p.aperture), under = p.light === "under"
  var lid0 = p.foldHang > 0.5 ? 0.3 : p.lidThick
  var lidless = !!p.lidless
  function cast(x, y) {
    var s = G.s(x), d, taper = 0.35 + 0.65 * smoothstep(0.0, 0.3, s) * (0.6 + 0.4 * smoothstep(1, 0.7, s))
    if (under) {
      d = G.yL(x) - y - 0.6
      return d < 0 ? 0 : 0.75 * (1 - smoothstep(0, depthC * 0.8, d)) * taper
    }
    d = y - G.yU(x) - lid0
    if (d < -lid0) return 0
    if (d < 0) return 0
    return 0.75 * (1 - smoothstep(0, depthC, d)) * taper
  }
  function sphere(x, y) {
    var nx = (x - gb.x) / gb.r, ny = (y - gb.y) / gb.r, q = nx * nx + ny * ny
    var nz = Math.sqrt(Math.max(0.02, 1 - Math.min(0.98, q)))
    var lam = nx * L.x + ny * L.y + nz * L.z
    var t = 0.55 * smoothstep(0.5, 0.0, lam)
    if (lidless) t = Math.max(t, 0.85 * smoothstep(0.55, 0.95, q) * (0.6 + 0.4 * smoothstep(0.5, -0.2, lam)))
    return t
  }
  function corners(x, y) {
    var di = Math.sqrt((x - I.x) * (x - I.x) + (y - I.y) * (y - I.y)), dO = Math.sqrt((x - O.x) * (x - O.x) + (y - O.y) * (y - O.y))
    return 0.35 * Math.max(1 - di / 6, 0, 1 - dO / 6)
  }
  function contact(x, y) {
    var d = G.yL(x) - y
    return d < 1.5 ? 0.2 * (1 - clamp(d, 0, 1.5) / 1.5) : 0
  }
  function comb(a, b) { return 1 - (1 - a) * (1 - b) }
  var out = {}
  out.cast = cast
  out.sclera = function(x, y) {
    return comb(comb(sphere(x, y), cast(x, y)), comb(corners(x, y), contact(x, y)))
  }
  // iris: 0.35 at the pupil margin, 0.2 at the collarette (0.55), rising to 0.85 at the limbus
  out.iris = function(x, y) {
    var dx = (x - ir.x) / Math.max(1, ir.rx), dy = (y - ir.y) / ir.ry, rho = Math.sqrt(dx * dx + dy * dy), pm = ir.pupil / ir.r, t
    if (rho < 0.55) t = 0.35 + (0.2 - 0.35) * smoothstep(pm, 0.55, rho)
    else t = 0.2 + (0.85 - 0.2) * smoothstep(0.55, 1.0, rho)
    return comb(t, cast(x, y))
  }
  // skin and socket: the orbital hollow, the lid surface, the under-eye trough, the bag, the cheek; all fall to 0 at the region's edge
  var hx = I.x + 12, hy = G.foldY(I.x + 12) - 3
  var bag = p.bag || 0.3
  out.skin = function(x, y) {
    if (G.open(x, y, -0.3)) return 0
    var rg = G.region(x, y)
    if (rg >= 1) return 0
    var fall = 1 - smoothstep(0.62, 1.0, rg), t = 0, d
    var dxh = (x - hx) / 28, dyh = (y - hy) / 11
    t = 0.7 * Math.max(0, 1 - (dxh * dxh + dyh * dyh))
    var yu = G.yU(x), fy = G.foldY(x)
    if (y < yu && y > fy) t = Math.max(t, 0.15 + 0.15 * smoothstep(yu, fy, y))                          // the lid surface, rounding
    // the trough: a diagonal from the inner corner down and out
    var tx = x - I.x, ty = y - I.y
    if (tx > -2 && tx < 34) { d = Math.abs(ty - tx * 0.45 - 2); t = Math.max(t, 0.5 * (1 - smoothstep(0, 2.6, d))) }
    var yl = G.yL(x)
    d = Math.abs(y - (yl + 6.5))
    if (x > I.x + 6 && x < O.x - 4) t = Math.max(t, bag * (1 - smoothstep(0, 3.2, d)))                  // the bag
    if (y > yl + 11) t = Math.max(t, 0.12 + 0.06 * smoothstep(yl + 11, yl + 20, y))                     // the cheek plane
    return t * fall
  }
  return out
}

// ---- tiers and the mud rule -------------------------------------------------------------------------------------------------------
function tierFor(S, prev) {
  var up = S >= TIER.t3 ? 3 : (S >= TIER.t2 ? 2 : (S >= TIER.t1 ? 1 : 0))
  if (prev === undefined || prev === null || prev === up) return up
  if (up > prev) return S >= (prev === 0 ? TIER.t1 : (prev === 1 ? TIER.t2 : TIER.t3)) + TIER.hyst ? up : prev
  return S < (prev === 3 ? TIER.t3 : (prev === 2 ? TIER.t2 : TIER.t1)) - TIER.hyst ? up : prev
}
function tierConfig(tier, S) {
  if (tier <= 1) return { tier: 1, fibres: 14, limbalArcs: 7, collarette: false, crypts: 0, ruff: 0, upLash: 12, loLash: 4, veinCap: 4,
                          browHairs: 0, screentone: false, stipple: false, skinHatch: false, f2: false, f3: false, bold: true }
  if (tier === 2) return { tier: 2, fibres: 80, limbalArcs: 8, collarette: true, crypts: 0, ruff: 0, upLash: 22, loLash: 8, veinCap: 12,
                           browHairs: S >= 80 ? 70 : 0, screentone: false, stipple: true, skinHatch: true, f2: true, f3: true, bold: false }
  return { tier: 3, fibres: 160, limbalArcs: 12, collarette: true, crypts: 7, ruff: 13, upLash: 28, loLash: 10, veinCap: 18,
           browHairs: 100, screentone: true, stipple: true, skinHatch: true, f2: true, f3: true, bold: false }
}

// ---- the strokes of one eye ------------------------------------------------------------------------------------------------------
// -> null below T1 (the host draws the T0 sigil), else { clip, strokes, tier, count, minStrokePx, families, iris, edge, opening, G }
var CACHE = [], CACHE_MAX = 64
function sig(p, S) {
  var k, o = "" + S
  for (k in p) o += "|" + (typeof p[k] === "number" ? Math.round(p[k] * 1000) / 1000 : p[k])
  return o
}
function realParts(p, S, tier, edge) {
  var t = tier === undefined || tier === null ? tierFor(S) : tier
  if (t < 1) return null
  var key = sig(p, S) + "|" + t + "|" + (edge ? 1 : 0), i
  for (i = 0; i < CACHE.length; i++) if (CACHE[i].key === key) { var hit = CACHE.splice(i, 1)[0]; CACHE.unshift(hit); return hit.val }
  var val = build(p, S, t, !!edge)
  CACHE.unshift({ key: key, val: val })
  if (CACHE.length > CACHE_MAX) CACHE.pop()
  return val
}
function clearCache() { CACHE = []; PCACHE = [] }

// ---- plates (eyes-animation.md section 3.1): the same strokes, split by layer so the iris can move as a texture ----------------------------------
// realPlates(p, S, tier, edge, opt) -> null below T1, else
//   { tier, clip, opening, band { d, poly }, back, veins, front, iris { size, R, rx, ry, cx, cy, strokes }, pupils, spec, pupilBase, params, count }
//   back    the sclera: paper, caruncle, hatch (it runs on under the iris), stipple, glint (clipped to the opening)
//   veins   the sclera's veins on their own, only when opt.veins (a plate that pulses); else they are in `back`
//   iris    the iris, baked UNCLIPPED in a box of (2R + 2) units square: tint, fibres, collarette, crypts, limbal arcs, the pupil-margin stipple and the
//           cornea sliver (it sits on the limbus, so it rides the iris); the pupil at its smallest (PLATE_PMIN), so a bigger pupil covers the fibres.
//           (cx, cy) is the iris centre in the iris box; coordinates in `strokes` are in that box
//   pupils  unit shapes (radius 1) with their centre offset from the iris centre and their radius `r` (units) at the baked state; see plateUnitPupils
//   spec    the catchlight (paper), coordinates relative to the iris centre
//   front   what goes over the iris: lids, lashes, fold, skin, brow, veil, meniscus, the baked tear. The host paints the occluder band first
//   band    the opening dilated by `d` = gaze box + R + 1, minus the opening: an opaque ground-coloured band, so the iris that strays under a lid is
//           hidden with no clip or mask (the host strokes the opening `d` wide with round joins, then clears the opening). `sweep` { x, y, rx, ry, r } is the
//           tighter shape the host paints instead: the iris disc (radius r) swept over the gaze ellipse round the iris centre (the open frame's, `irisAt`, on a frame with the lids partly shut), minus the opening
// opt: { veins: bool, gaze: { x, y } (the half extents of the gaze box in units), irisAt: { x, y, r } (r: the open frame's sweep radius) }. p.blink picks the lids (the iris plate is only meaningful
// at blink 0). For a frame with the lids partly shut the iris is still where the OPEN frame put it, which can be outside this frame's smaller opening: the host
// gives that place as `irisAt` and the band is widened by its distance to the opening, so the iris still cannot show outside it.
var PCACHE = [], PCACHE_MAX = 64
function realPlates(p, S, tier, edge, opt) {
  var t = tier === undefined || tier === null ? tierFor(S) : tier
  if (t < 1) return null
  var o = opt || {}, gz = o.gaze || { x: 0, y: 0 }
  var key = sig(p, S) + "|" + t + "|" + (edge ? 1 : 0) + "|" + (o.veins ? 1 : 0) + "|" + gz.x + "," + gz.y + "|" + (o.irisAt ? o.irisAt.x + "," + o.irisAt.y + "," + (o.irisAt.r || 0) : "") + "|" + (o.flap ? (o.flapOpen ? 2 : 1) : 0), i
  for (i = 0; i < PCACHE.length; i++) if (PCACHE[i].key === key) { var hit = PCACHE.splice(i, 1)[0]; PCACHE.unshift(hit); return hit.val }
  var val = splitPlates(build(p, S, t, !!edge, true), o, gz)
  PCACHE.unshift({ key: key, val: val })
  if (PCACHE.length > PCACHE_MAX) PCACHE.pop()
  return val
}
function shiftPoly(poly, dx, dy) {
  var o = new Array(poly.length), i
  for (i = 0; i < poly.length; i += 2) { o[i] = r2(poly[i] + dx); o[i + 1] = r2(poly[i + 1] + dy) }
  return o
}
// the distance from a point to the opening (0 inside it), to the polygon's own points (they are dense: 80 of them, cos-spaced)
function distToOpening(G, poly, x, y) {
  if (G.open(x, y, 0)) return 0
  var best = 1e9, i, dx, dy, d
  for (i = 0; i < poly.length; i += 2) { dx = poly[i] - x; dy = poly[i + 1] - y; d = dx * dx + dy * dy; if (d < best) best = d }
  return Math.sqrt(best)
}
function splitPlates(parts, o, gz) {
  var ir = parts.iris, R = ir.r, box = 2 * R + 2, ox = ir.x - (R + 1), oy = ir.y - (R + 1)
  var away = o.irisAt ? distToOpening(parts.G, parts.clip, o.irisAt.x, o.irisAt.y) : 0
  var back = [], veins = [], front = [], irisS = [], spec = [], list = parts.strokes, i, s, c, k
  for (i = 0; i < list.length; i++) {
    s = list[i]
    if (s.layer === "iris" || s.layer === "spec") {
      c = {}
      for (k in s) c[k] = s[k]
      delete c.clip                                           // unclipped: the band and the lids cover what leaves the opening
      if (s.layer === "iris") { c.poly = shiftPoly(s.poly, -ox, -oy); if (s.poly2) c.poly2 = shiftPoly(s.poly2, -ox, -oy); irisS.push(c) }
      else { c.poly = shiftPoly(s.poly, -ir.x, -ir.y); spec.push(c) }
    } else if (s.layer === "sclera") {
      if (o.veins && s.role === "vein") veins.push(s); else back.push(s)
    } else front.push(s)
  }
  // how far the iris plate's ink reaches from its centre (the sweep's radius is that, with room for the spiral's breath and 5 units for the plate's raster rim: EM-L2 leaks at 2)
  var reach = R
  for (i = 0; i < irisS.length; i++) for (k = 0; k < irisS[i].poly.length; k += 2) reach = Math.max(reach, Math.hypot(irisS[i].poly[k] - (R + 1), irisS[i].poly[k + 1] - (R + 1)))
  var sweep = { x: r2(o.irisAt ? o.irisAt.x : ir.x), y: r2(o.irisAt ? o.irisAt.y : ir.y), rx: gz.x, ry: gz.y, r: o.irisAt && o.irisAt.r > 0 ? o.irisAt.r : r2(reach * 1.02 + 5) }
  // the drowned eye's skin flap (opt.flap): the host paints this instead of the sweep; the open frame's opening (opt.flapOpen, for the shut frames) keeps its outline the same on every frame
  var flap = o.flap ? flapShape(o.flapOpen || parts.clip, sweep, parts.params.seed | 0, parts.G.light) : null
  return { tier: parts.tier, clip: parts.clip, opening: parts.opening, count: parts.count,
           band: { d: r2(Math.max(gz.x, gz.y) + R + 1 + away), poly: parts.clip, flap: flap,
                   // the tight occluder the host paints: only where the iris can be (its disc swept over the gaze box, with room for the spiral's breath),
                   // minus the opening. Off a flat panel (the liquid's strata, a textured frame) a band round the whole opening shows as a patch.
                   sweep: { x: r2(o.irisAt ? o.irisAt.x : ir.x), y: r2(o.irisAt ? o.irisAt.y : ir.y), rx: gz.x, ry: gz.y, r: o.irisAt && o.irisAt.r > 0 ? o.irisAt.r : r2(reach * 1.02 + 5) } },
           back: back, veins: veins, front: front,
           iris: { size: box, R: R, rx: ir.rx, ry: ir.ry, cx: R + 1, cy: R + 1, x: ir.x, y: ir.y, strokes: irisS },
           pupils: parts.pupils, spec: spec, tear: parts.tearBead, pupilBase: ir.pupil / R, params: parts.params, minStrokePx: parts.minStrokePx }
}

// ---- the drowned eye's skin flap (master-queue section 2) -------------------------------------------------------------------------------------------
// What the host paints over the liquid in place of the occluder band: a torn piece of the eye's own skin, the union of the opening and the iris's
// swept disc (the same cover `band.sweep` gives), its outline roughened by seeded radial noise (+-FLAP.noise units) with FLAP.notches tear notches,
// grown by FLAP.grow units so the deepest notch still reaches the cover (nothing of the iris can show: EM-L2 holds). Pure; every number is finite.
//   -> { poly [x, y, ...], contour [[x, y, ...], ...] (the outline minus the lit side: broken there), cx, cy, up, down, left, right (extents from the
//        centre, units) }
var FLAP = { noise: 0.8, notches: 3, notchDepth: 1.2, notchHalf: 0.14, rays: 128, grow: 2.0, rmax: 64, litCos: 0.35, margin: 0.4 }
var FLAPC = [], FLAPC_MAX = 8
function segDist2(px, py, ax, ay, bx, by) {
  var dx = bx - ax, dy = by - ay, l = dx * dx + dy * dy, t = l > 1e-12 ? ((px - ax) * dx + (py - ay) * dy) / l : 0
  t = t < 0 ? 0 : (t > 1 ? 1 : t)
  var qx = ax + t * dx - px, qy = ay + t * dy - py
  return qx * qx + qy * qy
}
function pipFlat(poly, x, y) {
  var inside = false, n = poly.length, j = n - 2
  for (var i = 0; i < n; i += 2) {
    var xi = poly[i], yi = poly[i + 1], xj = poly[j], yj = poly[j + 1]
    if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) inside = !inside
    j = i
  }
  return inside
}
function flapShape(openPoly, sw, seed, light) {
  if (!openPoly || openPoly.length < 6 || !sw) return null
  var key = [seed, sw.x, sw.y, sw.rx, sw.ry, sw.r, openPoly.length, openPoly[0], openPoly[1], openPoly[openPoly.length >> 1], openPoly[openPoly.length - 2]].join("|"), i, k
  for (i = 0; i < FLAPC.length; i++) if (FLAPC[i].key === key) { var hit = FLAPC.splice(i, 1)[0]; FLAPC.unshift(hit); return hit.val }
  var cx = sw.x, cy = sw.y, r = Math.max(0.5, sw.r), ell = []
  if (sw.rx >= 0.01 || sw.ry >= 0.01) for (k = 0; k < 24; k++) ell.push(sw.x + sw.rx * Math.cos(k / 24 * 2 * Math.PI), sw.y + sw.ry * Math.sin(k / 24 * 2 * Math.PI))
  var inSweep = function(x, y) {
    if (ell.length === 0) return (x - cx) * (x - cx) + (y - cy) * (y - cy) <= r * r
    if (sw.rx >= 0.01 && sw.ry >= 0.01 && Math.pow((x - sw.x) / sw.rx, 2) + Math.pow((y - sw.y) / sw.ry, 2) <= 1) return true
    var best = 1e18, n = ell.length
    for (var q = 0; q < n; q += 2) { var d2 = segDist2(x, y, ell[q], ell[q + 1], ell[(q + 2) % n], ell[(q + 3) % n]); if (d2 < best) best = d2 }
    return best <= r * r
  }
  var inside = function(x, y) { return inSweep(x, y) || pipFlat(openPoly, x, y) }
  var ph1 = 2 * Math.PI * hash(seed, RS.edge + 40, 1), ph2 = 2 * Math.PI * hash(seed, RS.edge + 40, 2), ph3 = 2 * Math.PI * hash(seed, RS.edge + 40, 3)
  var notch = []
  for (k = 0; k < FLAP.notches; k++) notch.push(2 * Math.PI * (k + 0.2 + 0.6 * hash(seed, RS.edge + 41, k)) / FLAP.notches)
  var bound = r + Math.max(sw.rx, sw.ry) + 1                                 // no point of the union is further from the centre than this
  for (i = 0; i < openPoly.length; i += 2) bound = Math.max(bound, Math.hypot(openPoly[i] - cx, openPoly[i + 1] - cy) + 1)
  bound = Math.min(FLAP.rmax, Math.ceil(bound))
  var N = FLAP.rays, reach = []                            // the opening's own points reach further than a ray that missed a thin tip: each ray takes the furthest of its bin and the next
  for (i = 0; i < N; i++) reach.push(0)
  for (i = 0; i < openPoly.length; i += 2) {
    var ox = openPoly[i] - cx, oy = openPoly[i + 1] - cy, ob = Math.round((Math.atan2(oy, ox) + 2 * Math.PI) % (2 * Math.PI) / (2 * Math.PI) * N) % N, od = Math.hypot(ox, oy)
    if (od > reach[ob]) reach[ob] = od
  }
  var pts = [], norm = [], lo = FLAP.margin, hiX = 100 - FLAP.margin, hiY = 62 - FLAP.margin
  for (i = 0; i < N; i++) {
    var th = i / N * 2 * Math.PI, ct = Math.cos(th), st = Math.sin(th), rr = 0, rs = bound
    while (rs > 0 && !inside(cx + rs * ct, cy + rs * st)) rs -= 1            // the outermost point of the union along this ray
    if (rs > 0) { var a = rs, b = rs + 1; for (k = 0; k < 4; k++) { var m = (a + b) / 2; if (inside(cx + m * ct, cy + m * st)) a = m; else b = m } rr = a }
    rr = Math.max(rr, reach[i], 0.9 * reach[(i + 1) % N], 0.9 * reach[(i + N - 1) % N])
    var nz = 0.6 * Math.sin(3 * th + ph1) + 0.3 * Math.sin(7 * th + ph2) + 0.1 * Math.sin(17 * th + ph3)
    var nt = 0
    for (k = 0; k < notch.length; k++) {
      var dd = Math.abs(Math.atan2(Math.sin(th - notch[k]), Math.cos(th - notch[k])))
      nt = Math.max(nt, FLAP.notchDepth * Math.max(0, 1 - dd / FLAP.notchHalf))
    }
    var rf = Math.max(0, rr + FLAP.grow + FLAP.noise * nz - nt)
    pts.push(r2(Math.min(hiX, Math.max(lo, cx + rf * ct))), r2(Math.min(hiY, Math.max(lo, cy + rf * st))))
    norm.push(ct, st)
  }
  // the contour: the outline except where its outward normal faces the light (the lit side), as runs of points
  var Ln = light ? Math.sqrt(light.x * light.x + light.y * light.y) || 1 : 1, lx = light ? light.x / Ln : 0, ly = light ? light.y / Ln : -1
  var lit = function(j) { return norm[2 * j] * lx + norm[2 * j + 1] * ly > FLAP.litCos }
  var runs = [], cur = null, start = 0
  while (start < N && !lit(start)) start++                     // begin the walk at a lit point so a run never wraps the seam
  if (start >= N) start = 0
  for (i = 0; i <= N; i++) {
    var j2 = (start + i) % N
    if (i < N && !lit(j2)) { if (!cur) { cur = []; if (i > 0) { var pj = (j2 + N - 1) % N; cur.push(pts[2 * pj], pts[2 * pj + 1]) } } cur.push(pts[2 * j2], pts[2 * j2 + 1]) }
    else if (cur) { if (i < N) cur.push(pts[2 * j2], pts[2 * j2 + 1]); if (cur.length >= 6) runs.push(cur); cur = null }
  }
  if (cur && cur.length >= 6) runs.push(cur)
  var up = 0, down = 0, left = 0, right = 0
  for (i = 0; i < N; i++) { up = Math.max(up, cy - pts[2 * i + 1]); down = Math.max(down, pts[2 * i + 1] - cy); left = Math.max(left, cx - pts[2 * i]); right = Math.max(right, pts[2 * i] - cx) }
  var val = { poly: pts, contour: runs, cx: r2(cx), cy: r2(cy), up: r2(up), down: r2(down), left: r2(left), right: r2(right) }
  FLAPC.unshift({ key: key, val: val })
  if (FLAPC.length > FLAPC_MAX) FLAPC.pop()
  return val
}

function build(p, S, t, edge, plate) {
  var C = tierConfig(t, S), seed = p.seed | 0, cap = CAP[C.tier], G = buildGeo(p), tone = toneField(p, G)
  var pupilDescs = []              // plate mode: the pupil is not a stroke but a unit shape the host scales (eyes-animation.md section 3.1)
  var tearBead = null
  var strokes = [], families = [], minPx = 1e9, ir = G.iris, R = ir.r, ic = pt(ir.x, ir.y)
  var pxu = S / 100, mudU = MUD_PX / pxu, shut = p.blink > 0.8
  var reserve = 12                     // room kept for the paper strokes that go last
  var i, k

  function room() { return strokes.length < cap - reserve }
  // one stroke; widths are in units and carry the hairline floor (a thinner line reads fainter, never aliased)
  function put(id, layer, role, a, poly, extra) {
    // what is drawn on the skin, outside the paper (hatch, brow, lashes, fold) takes the `skin` ink: the ink itself on a light ground, a
    // tone of the paper on a dark one, so a dark panel never swallows it
    var s = { id: id, layer: layer, role: role === "ink" && (layer === "skin" || layer === "lash") ? "skin" : role, a: a, poly: poly }
    if (extra) for (var k in extra) s[k] = extra[k]
    strokes.push(s)
  }
  function floorW(w, a) {
    var px = w * pxu
    if (px >= HAIRLINE) { if (px < minPx) minPx = px; return { k: 1, a: a } }
    minPx = Math.min(minPx, HAIRLINE)
    return { k: HAIRLINE / px, a: a * px / HAIRLINE }
  }
  // a ribbon with a width per point; e0 / e1: the pressure taper over the first / last fraction
  function ribbon(pts, ws, e0, e1) {
    var n = pts.length, left = [], right = [], out = [], j, u, d, w, h, nn
    for (j = 0; j < n; j++) {
      u = n > 1 ? j / (n - 1) : 0
      d = unit(sub(pts[Math.min(n - 1, j + 1)], pts[Math.max(0, j - 1)]))
      w = ws[j] * ss01(0, e0, u) * ss01(0, e1, 1 - u)
      h = 0.5 * w; nn = perp(d)
      left.push(add(pts[j], mul(nn, h))); right.push(sub(pts[j], mul(nn, h)))
    }
    for (j = 0; j < n; j++) out.push(r2(left[j].x), r2(left[j].y))
    for (j = n - 1; j >= 0; j--) out.push(r2(right[j].x), r2(right[j].y))
    return out
  }
  function wsOf(n, wf) { var o = [], j; for (j = 0; j < n; j++) o.push(wf(n > 1 ? j / (n - 1) : 0)); return o }
  // a stroke along `pts` with a width function of u (0..1), floor applied
  function pen(id, layer, role, a, pts, wf, e0, e1, extra) {
    var wmax = 0, ws = wsOf(pts.length, wf), j
    for (j = 0; j < ws.length; j++) if (ws[j] > wmax) wmax = ws[j]
    if (wmax <= 0) return
    var f = floorW(wmax * Math.min(1, 0.5 + 2 * Math.min(e0, e1)), a)
    for (j = 0; j < ws.length; j++) ws[j] *= f.k
    put(id, layer, role, f.a, ribbon(pts, ws, e0, e1), extra)
  }
  function wob(pts, salt, amp) {
    var o = [], j, d, nn, u
    for (j = 0; j < pts.length; j++) {
      u = pts.length > 1 ? j / (pts.length - 1) : 0
      d = unit(sub(pts[Math.min(pts.length - 1, j + 1)], pts[Math.max(0, j - 1)])); nn = perp(d)
      o.push(add(pts[j], mul(nn, amp * vnoise(seed, salt, u, 4))))
    }
    return o
  }
  function circ(c, rr, n, noise, salt) {
    var o = [], j, a, q
    for (j = 0; j < n; j++) { a = 2 * Math.PI * j / n; q = rr + (noise ? noise * (2 * hash(seed, salt, j) - 1) : 0); o.push(pt(c.x + Math.cos(a) * q, c.y + Math.sin(a) * q)) }
    return o
  }

  // plate mode: the pupil as a unit shape (radius 1, centred on its own origin), the host scales it by the pupil's radius and puts it at (cx, cy) from
  // the iris centre. -> [{ cx, cy, r, poly (flat), beads? (the ruff, T3, in the same unit frame) }]
  function plateUnitPupils(shape) {
    var out = [], j, xs = Math.max(0.6, ir.rx / R), unit1 = function(n, noise, salt) {
      var o = [], a, q
      for (var jj = 0; jj < n; jj++) { a = 2 * Math.PI * jj / n; q = 1 + (noise ? noise * (2 * hash(seed, salt, jj) - 1) : 0); o.push(r2(Math.cos(a) * q), r2(Math.sin(a) * q)) }
      return o
    }
    if (shape === "poly") {
      var pcs = [{ x: -0.26, y: 0.04, r: 0.3 }, { x: 0.46, y: -0.2, r: 0.2 }, { x: 0.22, y: 0.56, r: 0.14 }]
      if (hash(seed, RS.poly, 0) < 0.5) pcs.pop()
      for (j = 0; j < pcs.length; j++) out.push({ cx: r2(pcs[j].x * ir.rx), cy: r2(pcs[j].y * ir.ry), r: r2(pcs[j].r * R), poly: unit1(20, 0.05, RS.pupil + j) })
    } else if (shape === "torn") {
      var tp = [], notches = [hs(seed, RS.pupil, 5, 0, 2.1), hs(seed, RS.pupil, 6, 2.1, 4.2), hs(seed, RS.pupil, 7, 4.2, 6.2)]
      for (j = 0; j < 36; j++) {
        var ta = 2 * Math.PI * j / 36, dep = 0
        for (var k2 = 0; k2 < 3; k2++) { var da = Math.abs(Math.atan2(Math.sin(ta - notches[k2]), Math.cos(ta - notches[k2]))); dep = Math.max(dep, 0.5 * Math.max(0, 1 - da / 0.28)) }
        var rq = (1 + 0.1 * (2 * hash(seed, RS.pupil, 100 + j) - 1) * 0.5) * (1 - dep)
        tp.push(r2(Math.cos(ta) * rq * xs), r2(Math.sin(ta) * rq))
      }
      out.push({ cx: 0, cy: 0, r: r2(ir.pupil), poly: tp })
    } else {
      var pp = unit1(28, 0.04, RS.pupil)
      for (j = 0; j < pp.length; j += 2) pp[j] = r2(pp[j] * xs)
      out.push({ cx: 0, cy: 0, r: r2(ir.pupil), poly: pp })
    }
    if (C.ruff > 0 && out.length) {
      var beads = [], rho = (ir.pupil / R) * 1.12 + 0.02, bj, bq, bp
      for (j = 0; j < C.ruff; j++) {
        var rb = 2 * Math.PI * (j + hash(seed, RS.dot, j) * 0.6) / C.ruff, br = hs(seed, RS.dot, 40 + j, 0.3, 0.5) / ir.pupil
        var bx = Math.cos(rb) * rho * ir.rx / ir.pupil, by = Math.sin(rb) * rho * ir.ry / ir.pupil
        bp = []
        for (bj = 0; bj < 7; bj++) { bq = 2 * Math.PI * bj / 7; bp.push(r2(bx + Math.cos(bq) * br), r2(by + Math.sin(bq) * br)) }
        beads.push(bp)
      }
      out[0].beads = beads
    }
    return out
  }

  // ---- the hatch walker ---------------------------------------------------------------------------------------------------------
  // walks a line, emitting a run only where `toneF` is above `thr`; the pen swells with the tone: w0 * (0.6 + 0.8 * (tone - thr))
  function walk(id, layer, pf, t0, t1, step, accept, toneF, thr, w0, a, extra, minLen) {
    var cur = null, tt, q, tn, n0 = 0
    function close() {
      if (!cur) return
      var c = cur; cur = null
      if (c.pts.length < 3 || polyLen(c.pts) < (minLen || 1.6) || !room()) return
      var pts = wob(c.pts, RS.hatch + strokes.length, 0.2), ws = []
      for (var j = 0; j < c.tn.length; j++) ws.push(w0 * (0.6 + 0.8 * clamp(c.tn[j] - thr, 0, 1)))
      var wmax = 0
      for (j = 0; j < ws.length; j++) if (ws[j] > wmax) wmax = ws[j]
      var f = floorW(wmax * 0.6, a)
      for (j = 0; j < ws.length; j++) ws[j] *= f.k
      put(id + "_" + (n0++), layer, "ink", f.a, ribbon(pts, ws, 0.12, 0.2), extra)
    }
    for (tt = t0; tt <= t1 + 1e-9; tt += step) {
      q = pf(tt)
      if (accept(q)) {
        tn = toneF(q.x, q.y)
        if (cur ? tn > thr * 0.85 : tn > thr) {
          if (!cur) cur = { pts: [], tn: [] }
          cur.pts.push(q); cur.tn.push(tn)
          continue
        }
      }
      close()
    }
    close()
  }

  var X0 = G.I.x, X1 = G.O.x, XS = 0.8
  // plate mode: the sclera's hatch runs on under the iris (it is a plate of its own, and the iris moves over it)
  var openAccept = function(m) { return function(q) { return G.open(q.x, q.y, m) && (plate || !G.inIris(q.x, q.y, 0.3)) } }
  var sp1 = Math.max(2.8, mudU), sp2 = Math.max(2.8, mudU), sp3 = Math.max(3.2, mudU)
  var wLine = C.bold ? 0.45 : 0.3

  // ================= 1. paper: the sclera, and the caruncle at the inner corner ================================================
  var openPoly = G.openPts(40)
  put("sclera", "sclera", "paper", 1, flat(openPoly))
  var crc = pt(G.I.x + 2.6, G.I.y - 0.4)
  var cr = p.caruncle
  put("caruncle", "sclera", "caruncle", 1, flat(circ(crc, cr, 14, 0.15, RS.dot)), { clip: true })

  // ================= 2. the iris =======================================================================================================
  var irisClip = { clip: true }
  var ell = []
  for (i = 0; i < 40; i++) { var ea = 2 * Math.PI * i / 40; ell.push(pt(ic.x + Math.cos(ea) * ir.rx, ic.y + Math.sin(ea) * ir.ry)) }
  put("iris", "iris", "tint", 1, flat(ell), irisClip)
  function irisPt(rho, ang) { return pt(ic.x + Math.cos(ang) * rho * ir.rx, ic.y + Math.sin(ang) * rho * ir.ry) }
  var pr = (plate ? Math.min(ir.pupil, PLATE_PMIN * R) : ir.pupil) / R     // plate mode: the fibres reach the smallest pupil, a bigger one covers them
  var iriFib = 0
  if (p.pupilState === "spiral") {
    // the iris IS the spiral: 2.5 turns, two arms, thickening outward
    var arms = 2, turns = C.bold ? 1.75 : 2.5, st0 = hs(seed, RS.spiral, 0, 0, 6.28)
    for (var am = 0; am < arms; am++) {
      var sp = [], steps = 56
      for (i = 0; i <= steps; i++) {
        var u = i / steps, ang = st0 + am * Math.PI + turns * 2 * Math.PI * u, rho = 0.1 + 0.86 * u
        sp.push(irisPt(rho, ang))
      }
      pen("spi" + am, "iris", "ink", 1, sp, function(uu) { return (C.bold ? 1.4 : 0.5) + (C.bold ? 3.4 : 2.1) * uu }, 0.05, 0.12, irisClip)
    }
  } else {
    var nF = C.fibres, f0 = pr + 0.04
    for (i = 0; i < nF; i++) {
      var th = 2 * Math.PI * (i + hash(seed, RS.fibre, 10 + i) * 0.8) / nF
      // denser toward the rim: every other fibre is long, the rest start at 0.55
      var long = i % 2 === 0, ra = long ? f0 : Math.max(f0, 0.5 + 0.1 * hash(seed, RS.fibre, 20 + i)), rb = 0.97 - 0.08 * hash(seed, RS.fibre, 30 + i)
      if (C.tier === 1) ra = f0
      var wob2 = (hash(seed, RS.fibre, 40 + i) - 0.5) * 0.18, fp = []
      for (var k = 0; k <= 4; k++) { var rr = ra + (rb - ra) * k / 4; fp.push(irisPt(rr, th + wob2 * Math.sin(k * 1.3 + i))) }
      var fw = hs(seed, RS.fibre, 50 + i, 0.16, 0.42) * (C.bold ? 2.6 : 1)
      pen("fib" + i, "iris", "ink", 0.85, fp, function(uu) { return fw * (0.5 + 0.5 * Math.sin(Math.PI * Math.min(1, uu * 1.15))) }, 0.2, 0.5, irisClip)
      iriFib++
    }
    if (C.collarette) {
      var cp = []
      for (i = 0; i <= 42; i++) {
        var ca = 2 * Math.PI * i / 42, zz = (i % 2 === 0 ? 0.52 : 0.6) + 0.03 * vnoise(seed, RS.fibre, i / 42, 7)
        cp.push(irisPt(zz, ca))
      }
      var cw = floorW(0.3, 0.8)
      pen("coll", "iris", "ink", cw.a, cp, function() { return 0.3 * cw.k }, 0.01, 0.01, irisClip)
    }
    for (i = 0; i < C.crypts; i++) {   // crypts: paper lozenges between fibres
      var cth = 2 * Math.PI * (i + hash(seed, RS.crypt, i) * 0.7) / C.crypts, cc = irisPt(hs(seed, RS.crypt, 10 + i, 0.58, 0.78), cth)
      var cl = hs(seed, RS.crypt, 20 + i, 0.8, 1.4), cd = pt(Math.cos(cth), Math.sin(cth))
      var cn = perp(cd), lz = [add(cc, mul(cd, cl)), add(cc, mul(cn, 0.35)), sub(cc, mul(cd, cl)), sub(cc, mul(cn, 0.35))]
      put("cry" + i, "iris", "paper", 0.9, flat(lz), irisClip)
    }
  }
  // the limbal ring EMERGES: brush crescents along the rim, heavy where the lid's shadow falls (the top) and on the shadow side
  var la0 = p.light === "under" ? Math.PI / 2 : -Math.PI / 2
  for (i = 0; i < C.limbalArcs; i++) {
    var span = hs(seed, RS.fibre, 300 + i, 0.5, 1.0) * (C.bold ? 1.6 : 1), ca2 = la0 + (i - C.limbalArcs / 2) * (2 * Math.PI / C.limbalArcs) * 1.0, lp = []
    var topw = 0.55 + 0.45 * Math.max(0, Math.cos(ca2 - la0))
    for (k = 0; k <= 5; k++) lp.push(irisPt(0.93 - 0.02 * Math.sin(k), ca2 - span * 0.3 + span * 0.6 * k / 5))
    var lwid = (C.bold ? 2.7 : 1.2) * topw
    pen("lim" + i, "iris", "ink", 0.9, lp, function(uu) { return lwid * Math.sin(Math.PI * uu) + 0.1 }, 0.1, 0.1, irisClip)
  }
  // the pupil: solid brush with +-4 % edge noise
  var shape = ir.state
  if (plate) {
    pupilDescs = plateUnitPupils(shape)
  } else if (shape === "poly") {
    var pcs = [{ x: -0.26, y: 0.04, r: 0.3 }, { x: 0.46, y: -0.2, r: 0.2 }, { x: 0.22, y: 0.56, r: 0.14 }]
    if (hash(seed, RS.poly, 0) < 0.5) pcs.pop()
    for (i = 0; i < pcs.length; i++) put("pup" + i, "iris", "ink", 1, flat(circ(pt(ic.x + pcs[i].x * ir.rx, ic.y + pcs[i].y * ir.ry), pcs[i].r * R, 20, pcs[i].r * R * 0.05, RS.pupil + i)), irisClip)
  } else if (shape === "torn") {
    var tp = [], notches = [hs(seed, RS.pupil, 5, 0, 2.1), hs(seed, RS.pupil, 6, 2.1, 4.2), hs(seed, RS.pupil, 7, 4.2, 6.2)]
    for (i = 0; i < 36; i++) {
      var ta = 2 * Math.PI * i / 36, dep = 0
      for (k = 0; k < 3; k++) { var da = Math.abs(Math.atan2(Math.sin(ta - notches[k]), Math.cos(ta - notches[k]))); dep = Math.max(dep, 0.5 * Math.max(0, 1 - da / 0.28)) }
      var rq = ir.pupil * (1 + 0.1 * (2 * hash(seed, RS.pupil, 100 + i) - 1) * 0.5) * (1 - dep)
      tp.push(pt(ic.x + Math.cos(ta) * rq * Math.max(0.6, ir.rx / R), ic.y + Math.sin(ta) * rq))
    }
    put("pupil", "iris", "ink", 1, flat(tp), irisClip)
  } else {
    var pe = ir.pupil * 0.04
    var pp = circ(ic, ir.pupil, 28, pe, RS.pupil)
    for (i = 0; i < pp.length; i++) pp[i] = pt(ic.x + (pp[i].x - ic.x) * Math.max(0.6, ir.rx / R), pp[i].y)
    put("pupil", "iris", "ink", 1, flat(pp), irisClip)
  }
  // the ruff of beads at the pupil margin (T3)
  for (i = 0; i < C.ruff && !plate; i++) {
    var rb = 2 * Math.PI * (i + hash(seed, RS.dot, i) * 0.6) / C.ruff, rc = irisPt((ir.pupil / R) * 1.12 + 0.02, rb)
    put("ruf" + i, "iris", "ink", 0.9, flat(circ(rc, hs(seed, RS.dot, 40 + i, 0.3, 0.5), 7, 0, RS.dot)), irisClip)
  }

  // ================= 3. sclera: tone as ink (contour lines, a crossing family, a third in the corners) =====================
  var openOK = openAccept(0.5), toneS = tone.sclera
  families.push({ name: "sclera1", spacing: sp1, px: sp1 * pxu })
  var fi = 0, dd, yy
  var lineN = Math.floor(18 / sp1) + 1
  for (var side = 0; side < 2; side++) {
    for (var kq = 0; kq < lineN; kq++) {
      dd = (kq + 0.5) * sp1 + (hash(seed, RS.hatch, 100 + kq + 40 * side) - 0.5) * 0.4
      var up = side === 0, wl = hs(seed, RS.hatch, 200 + kq + 40 * side, 0.2, wLine)
      var lineF = (function(dd2, up2) { return function(x) {
        var yu = G.yU(x), yl = G.yL(x), h = yl - yu
        if (dd2 > h * 0.5) return pt(x, -50)
        return pt(x, up2 ? yu + dd2 : yl - dd2)
      } })(dd, up)
      walk("s1" + side + "_" + kq, "sclera", lineF, X0, X1, XS, openOK, toneS, 0.12, wl, 0.92, irisClip)
      // where it is dark, a line between this one and the next (only if the spacing allows it)
      if (sp1 / 2 >= mudU) {
        var lineH = (function(f0) { return function(x) { var q = f0(x); return pt(q.x, q.y + (up ? 0.5 : -0.5) * sp1) } })(lineF)
        walk("s1h" + side + "_" + kq, "sclera", lineH, X0, X1, XS, openOK, toneS, 0.45, wl * 0.8, 0.9, irisClip)
      }
    }
  }
  function crossFamily(name, deg, spc, thr, wmax, layer) {
    families.push({ name: name, spacing: spc, px: spc * pxu })
    var d = rot(pt(1, 0), deg), n = perp(d)
    var ox = (X0 + X1) / 2, oy = 34, c0 = -80, c1 = 80, cc, kk = 0
    for (cc = c0; cc <= c1; cc += spc) {
      var base = add(pt(ox, oy), mul(n, cc)), tr = 0
      var pf = function(tt) { return add(base, mul(d, tt)) }
      // t range: where the line crosses the opening's bounding box (x in [X0, X1], y in [8, 56])
      var ta = -90, tb = 90
      var q0 = pf(ta), q1 = pf(tb)
      // clip to x in [X0, X1] (the d vector has x != 0 for every angle used)
      var tx0 = (X0 - base.x) / d.x, tx1 = (X1 - base.x) / d.x
      ta = Math.min(tx0, tx1); tb = Math.max(tx0, tx1)
      walk(name + "_" + (kk++), layer, pf, ta, tb, XS, openOK, toneS, thr, wmax * (0.7 + 0.3 * hash(seed, RS.hatch, 300 + kk)), 0.85, irisClip)
    }
  }
  if (C.f2) crossFamily("sclera2", 40 + hs(seed, RS.hatch, 7, -5, 8), sp2, 0.4, 0.28, "sclera")
  if (C.f3) crossFamily("sclera3", -55, sp3, 0.65, 0.3, "sclera")

  // ================= 4. solid masses: the lid's cast shadow core, and the pupil already above ======================================
  // the upper lid's margin: a solid band under the lash line, heavy at the outer two thirds (the cast shadow's brush core)
  if (!shut) {
    var core = []
    for (i = 0; i <= 24; i++) { var xx2 = G.I.x + (G.W) * (0.04 + 0.92 * i / 24); core.push(pt(xx2, G.yU(xx2) + 0.9)) }
    var coreW = 0.9 + (C.bold ? 1.1 : 0.7) + (p.archetype === "heavy" ? 0.7 : 0)
    pen("core", "lid", "ink", 0.95, core, function(uu) { return coreW * (0.25 + 0.75 * smoothstep(0.05, 0.5, uu)) * (1 - 0.7 * smoothstep(0.85, 1, uu)) }, 0.1, 0.25, { clip: true })
  }

  // ================= 5. veins: tortuous walks from the corners, on the turned-away side ============================================
  var bs = clamp(p.bloodshot, 0, 1), nVeins = Math.min(C.veinCap, 3 + Math.round(12 * bs))
  for (i = 0; i < nVeins && room(); i++) {
    var fromO = i % 2 === 1, rt = fromO ? pt(G.O.x - 2.5 - hash(seed, RS.vein, i) * 2, G.O.y + hs(seed, RS.vein, 20 + i, -3, 3)) : pt(G.I.x + 5 + hash(seed, RS.vein, i) * 2, G.I.y + hs(seed, RS.vein, 20 + i, -3, 3))
    var hd = Math.atan2(ic.y - rt.y, ic.x - rt.x), cur = rt, wk = [rt], steps = Math.round(hs(seed, RS.vein, 40 + i, 12, 24)), curl = hs(seed, RS.vein, 60 + i, -0.07, 0.07)
    for (k = 0; k < steps; k++) {
      hd += (hash(seed, RS.vein, 100 + 53 * i + k) - 0.5) * 2 * 35 * Math.PI / 180 * 0.5 + curl
      hd += 0.05 * (Math.atan2(ic.y - cur.y, ic.x - cur.x) - hd)
      var nx = pt(cur.x + 0.9 * Math.cos(hd), cur.y + 0.9 * Math.sin(hd))
      if (!G.open(nx.x, nx.y, 0.8) || G.inIris(nx.x, nx.y, 0.6)) break
      wk.push(nx); cur = nx
    }
    if (wk.length > 3) {
      var vw = hs(seed, RS.vein, 80 + i, 0.3, 0.45)
      pen("vein" + i, "sclera", "vein", 0.95, wk, function(uu) { return Math.max(0.1, vw * (1 - uu) + 0.1 * uu) }, 0.05, 0.4, { clip: true, m: bs })
    }
  }

  // ================= 6. lids ===========================================================================================================
  var UP = [], LO = [], xs
  for (i = 0; i <= 28; i++) { xs = G.I.x + G.W * i / 28; UP.push(pt(xs, G.yU(xs))); LO.push(pt(xs, G.yL(xs))) }
  // the upper lash line: a G-pen, 0.5 -> 2.8 units, heavy at the outer two thirds, lost at the inner 10 %
  var upW = p.archetype === "lidless" ? 0.55 : (p.archetype === "slit" ? 2.4 : 2.8) * (p.archetype === "heavy" ? 1.1 : 1)
  pen("lash", "lid", "ink", 1, UP, function(uu) {
    return 0.5 + (upW - 0.5) * (0.15 + 0.85 * smoothstep(0.0, 0.45, uu)) * (0.55 + 0.45 * Math.sin(Math.PI * Math.min(1, uu * 1.05)))
  }, 0.1, 0.01)
  // outerTuck: the upper lid overlaps the lower one past O, as a short heavy stroke
  var tuck = p.outerTuck, tk = [UP[28], add(UP[28], pt(tuck * 0.55, tuck * 0.35)), add(UP[28], pt(tuck, tuck * 1.1))]
  pen("tuck", "lid", "ink", 1, tk, function(uu) { return (upW * 0.75) * (1 - 0.8 * uu) }, 0.02, 0.5)
  // the fold (crease); foldHang drops its outer end onto the lid, a monolid has none
  if (p.foldH > 0.4) {
    var CR = []
    for (i = 0; i <= 20; i++) { xs = G.I.x + G.W * (0.1 + 0.8 * i / 20); CR.push(pt(xs, G.foldY(xs))) }
    var gapA = hs(seed, RS.gap, 0, 0.55, 0.72), gapL = 0.07
    var cw = hs(seed, RS.line, 0, 1.0, 1.5)
    var c1 = CR.slice(0, Math.round(gapA * 20)), c2 = CR.slice(Math.round((gapA + gapL) * 20))
    if (p.archetype !== "lidless" && !shut) {
      pen("fold1", "skin", "ink", 0.95, c1, function(uu) { return cw * (0.4 + 0.6 * Math.sin(Math.PI * uu)) }, 0.3, 0.3)
      if (c2.length > 2) pen("fold2", "skin", "ink", 0.9, c2, function(uu) { return cw * 0.9 * (1 - 0.6 * uu) }, 0.05, 0.4)
    }
  }
  // the lower lid: heavy on the shadow side, thin and broken on the lit side; width follows the tone beside it
  var lowW = (p.archetype === "weeping" ? 1.9 : 1.5) * (C.bold ? 1.2 : 1)
  var lowRuns = [], cur2 = null, nGap = 0
  for (i = 0; i <= 40; i++) {
    xs = G.I.x + G.W * (0.03 + 0.94 * i / 40)
    var yq = G.yL(xs), tn = toneS(xs, yq - 0.7), heavyHere = tn > 0.28
    var gapHere = !heavyHere && hash(seed, RS.gap, 30 + Math.floor(i / 6)) < 0.38 && i % 6 !== 0
    if (gapHere) { if (cur2) { lowRuns.push(cur2); cur2 = null }; continue }
    if (!cur2) cur2 = { pts: [], w: [] }
    cur2.pts.push(pt(xs, yq)); cur2.w.push(lowW * (heavyHere ? 0.55 + 0.45 * clamp((tn - 0.28) / 0.4, 0, 1) : 0.3))
  }
  if (cur2) lowRuns.push(cur2)
  for (i = 0; i < lowRuns.length; i++) {
    if (lowRuns[i].pts.length < 3) continue
    var lw = lowRuns[i].w
    pen("lower" + i, "lid", "ink", 1, lowRuns[i].pts, (function(ww) { return function(uu) { return ww[Math.min(ww.length - 1, Math.round(uu * (ww.length - 1)))] } })(lw), 0.12, 0.25)
  }
  // weeping: the waterline rim in blood
  if (p.tear) {
    var rim = []
    for (i = 0; i <= 18; i++) { xs = G.I.x + G.W * (0.12 + 0.76 * i / 18); rim.push(pt(xs, G.yL(xs) - 1.1)) }
    pen("rim", "lid", "vein", 0.95, rim, function(uu) { return 0.55 * Math.sin(Math.PI * uu) + 0.1 }, 0.1, 0.1, { clip: true, m: 1 })
  }

  // ================= 7. lashes: sparse, fine, nearly straight (heavy: clumps of 2-3, long) =======================================
  var nUp = Math.round(Math.min(p.upLashes, C.upLash)), heavy = !!p.lashHeavy
  if (heavy) nUp = Math.round(hs(seed, RS.lash, 0, 26, 40) * (C.tier === 1 ? 0.45 : 1))
  if (p.archetype !== "lidless" && !shut && room()) {
    for (i = 0; i < nUp; i++) {
      var tt = heavy ? (Math.floor(i / 2.5) + hash(seed, RS.lash, 10 + i) * 0.4) / (nUp / 2.5) : (i + 0.5 + hs(seed, RS.lash, 10 + i, -0.3, 0.3)) / nUp
      tt = 0.15 + 0.85 * clamp(tt, 0, 1)
      // denser and longer in the outer half
      if (!heavy && tt < 0.5 && hash(seed, RS.lash, 200 + i) < 0.4) continue
      var lx = G.I.x + G.W * tt, nrm = G.normalU(lx), ln = (heavy ? hs(seed, RS.lash, 30 + i, 6, 11) : hs(seed, RS.lash, 30 + i, 2.5, 6)) * (0.7 + 0.5 * tt)
      var curl = heavy ? hs(seed, RS.lash, 50 + i, 15, 25) : hs(seed, RS.lash, 50 + i, 4, 12)
      var lead = p.lashDown ? rot(pt(0, 1), hs(seed, RS.lash, 70 + i, -12, 12)) : rot(nrm, hs(seed, RS.lash, 70 + i, 14, 30) * (nrm.x >= 0 ? 1 : -1) * 0.8 + 8)
      var lroot = pt(lx, G.yU(lx)), lp = [lroot], dir = lead, ls = 4
      for (k = 1; k <= ls; k++) { dir = rot(dir, curl / ls); lp.push(add(lp[k - 1], mul(dir, ln / ls))) }
      pen("lu" + i, "lash", "ink", 0.92, lp, function(uu) { return (heavy ? 0.7 : 0.45) * (1 - uu * 0.9) }, 0.05, 0.5)
    }
    var nLo = Math.round(Math.min(p.loLashes, C.loLash))
    for (i = 0; i < nLo; i++) {
      if (hash(seed, RS.lash, 300 + i) < 0.35) continue
      var tl2 = 0.18 + 0.66 * (i + 0.5) / nLo, lx2 = G.I.x + G.W * tl2, ln2 = hs(seed, RS.lash, 330 + i, 1, 3)
      var lq = pt(lx2, G.yL(lx2)), dl = rot(G.normalL(lx2), hs(seed, RS.lash, 360 + i, -8, 8))
      pen("ll" + i, "lash", "ink", 0.85, [lq, add(lq, mul(dl, ln2 * 0.5)), add(lq, mul(dl, ln2))], function(uu) { return 0.35 * (1 - uu * 0.9) }, 0.05, 0.5)
    }
  }

  // ================= 8. skin: the socket, the fold's rounding, the trough, the bag, the cheek ==================================
  var toneK = tone.skin
  var skinOK = function(q) { return q.y > 0.6 && q.y < 61.4 && q.x > 0.6 && q.x < 99.4 && !G.open(q.x, q.y, -0.3) }
  if (C.skinHatch && room()) {
    families.push({ name: "skin1", spacing: sp1, px: sp1 * pxu })
    var kk2, wls
    // offsets of the upper lid, upward (the hollow, the lid surface)
    for (kk2 = 1; kk2 < 9; kk2++) {
      dd = kk2 * sp1 - 0.4
      wls = hs(seed, RS.hatch, 500 + kk2, 0.2, 0.4)
      walk("k1u" + kk2, "skin", (function(d3) { return function(x) { var s0 = G.s(x), xx3 = x; return pt(xx3, G.yU(xx3) - d3 + (x < G.I.x ? 0 : 0) * s0) } })(dd), X0 - 8, X1 + 6, XS, skinOK, toneK, 0.12, wls, 0.85, null, 2)
    }
    // offsets of the lower lid, downward (the trough, the bag)
    for (kk2 = 1; kk2 < 7; kk2++) {
      dd = kk2 * sp1 - 0.4
      wls = hs(seed, RS.hatch, 540 + kk2, 0.2, 0.4)
      walk("k1d" + kk2, "skin", (function(d3) { return function(x) { return pt(x, G.yL(x) + d3) } })(dd), X0 - 2, X1 + 2, XS, skinOK, toneK, 0.12, wls, 0.8, null, 2)
    }
    if (C.f2) {
      families.push({ name: "skin2", spacing: sp2, px: sp2 * pxu })
      var d2 = rot(pt(1, 0), -38), n2 = perp(d2), kq2 = 0
      for (var c2 = -70; c2 <= 70; c2 += sp2) {
        var b2 = add(pt(50, 26), mul(n2, c2)), tx0b = (4 - b2.x) / d2.x, tx1b = (96 - b2.x) / d2.x
        walk("k2_" + (kq2++), "skin", (function(bb) { return function(tt) { return add(bb, mul(d2, tt)) } })(b2), Math.min(tx0b, tx1b), Math.max(tx0b, tx1b), XS, skinOK, toneK, 0.4, 0.28, 0.85, null, 2)
      }
    }
    if (C.f3) {
      families.push({ name: "skin3", spacing: sp3, px: sp3 * pxu })
      var d3v = rot(pt(1, 0), 62), n3 = perp(d3v), kq3 = 0
      for (var c3 = -70; c3 <= 70; c3 += sp3) {
        var b3 = add(pt(30, 20), mul(n3, c3))
        walk("k3_" + (kq3++), "skin", (function(bb) { return function(tt) { return add(bb, mul(d3v, tt)) } })(b3), -40, 40, XS, skinOK, toneK, 0.65, 0.3, 0.85, null, 2)
      }
    }
  }
  // the deepest socket corner: a solid brush wedge toward the nose (dark only where the eye is tense or lowered)
  var sol = p.archetype === "stare" || p.archetype === "heavy" || p.archetype === "spiral" ? 1 : 0.55
  var sw = [pt(G.I.x - 0.5, G.I.y - 6), pt(G.I.x + 1.5, G.I.y - 13), pt(G.I.x + 5.5, G.foldY(G.I.x + 5.5) - 1.5)]
  pen("socket", "skin", "ink", 0.95, sw, function(uu) { return (C.bold ? 3.6 : 2.6) * sol * Math.sin(Math.PI * Math.min(1, uu * 0.9 + 0.05)) }, 0.25, 0.5)
  // the under-eye trough line: a G-pen from the inner corner, lost along its way
  var tr0 = pt(G.I.x + 1, G.I.y + 3), trp = []
  for (i = 0; i <= 8; i++) trp.push(add(tr0, pt(i * 3.1, i * 1.6 + 0.5 * vnoise(seed, RS.line, i / 8, 3))))
  pen("trough", "skin", "ink", 0.9, trp, function(uu) { return 0.75 * (1 - uu) }, 0.1, 0.1)
  if (p.tear) {   // a tear bead at the inner corner with a trail down the cheek (ink, filled with the blood mix, and a paper glint)
    var tb = pt(G.I.x + 3.2, G.yL(G.I.x + 4) + 1.8), tbp = []
    for (i = 0; i < 12; i++) { var ga = 2 * Math.PI * i / 12; tbp.push(pt(tb.x + Math.cos(ga) * 1.5, tb.y + Math.sin(ga) * 2.0)) }
    var trail = [add(tb, pt(0.6, 2)), add(tb, pt(1.4, 6)), add(tb, pt(1.1, 10)), add(tb, pt(2.2, 15))]
    if (plate) {
      // plate mode (EM5, P7): the bead and its glint are not baked; the host moves them along the baked trail (tearAt). `tearBead` is where they rest
      tearBead = { x: r2(tb.x), y: r2(tb.y), rx: 1.5, ry: 2.0, gx: -0.5, gy: -0.6, gr: 0.45, trail: [[r2(tb.x), r2(tb.y)]].concat(trail.map(function(q) { return [r2(q.x), r2(q.y)] })) }
    } else put("tear", "skin", "tear", 1, flat(tbp))
    pen("tearTrail", "skin", "tear", 0.9, trail, function(uu) { return 1.1 * (1 - 0.8 * uu) }, 0.05, 0.5)
    if (!plate) put("tearGlint", "skin", "paper", 0.95, flat(circ(add(tb, pt(-0.5, -0.6)), 0.45, 6, 0, RS.tear)))
  }
  if (p.mole) put("mole", "skin", "ink", 1, flat(circ(pt(G.O.x - 8, G.yL(G.O.x - 8) + 6), 0.9, 8, 0, RS.dot)))

  // ---- the brow (T1: one tapered stroke; T2 from 80 px and T3: hairs) -----------------------------------------------------------
  var bx0 = G.I.x + 1, bx1 = G.O.x + 3, bL = bx1 - bx0
  var foldPeak = 1e9
  for (i = 0; i <= 10; i++) { var fx = G.I.x + G.W * i / 10; foldPeak = Math.min(foldPeak, p.foldH > 0.4 ? G.foldY(fx) : G.yU(fx) - 3) }
  var baseY = Math.max(5.2, foldPeak - Math.min(p.browY, 12) * 0.6) + 0
  var tanT = Math.tan(p.browTilt * Math.PI / 180)
  function browAt(u) {
    var yy2 = baseY + (u - 0.5) * bL * tanT * 0.55 - p.browArch * 3.4 * Math.sin(Math.PI * u) + 3 * (p.archetype === "heavy" ? 0.5 : 0)
    return pt(bx0 + u * bL, clamp(yy2, 2.2, 40))
  }
  var bp = []
  for (i = 0; i <= 12; i++) bp.push(browAt(i / 12))
  if (C.browHairs === 0) {
    pen("brow", "skin", "ink", 0.95, bp, function(uu) { return (C.bold ? 2.8 : 2.2) * (0.5 + 0.5 * Math.sin(Math.PI * Math.pow(uu, 0.8))) * (1 - 0.35 * uu) }, 0.15, 0.7)
  } else if (room()) {
    for (i = 0; i < C.browHairs && room(); i++) {
      var ub = Math.pow(hash(seed, RS.brow, i), 0.9), bq = browAt(ub)
      var head = 1 - smoothstep(0, 0.35, ub)
      var hd2 = rot(pt(1, 0), -(60 * head + 5 + hs(seed, RS.brow, 20 + i, -6, 6)) - (p.browTilt * (0.5 - ub)) * 0.3)
      var hl = hs(seed, RS.brow, 40 + i, 3, 9) * (0.55 + 0.45 * (1 - ub * 0.5))
      var hp = [bq, add(bq, mul(hd2, hl * 0.5)), add(bq, mul(hd2, hl))]
      if (hp[2].y < 0.8 || hp[2].y > 40) continue
      pen("bh" + i, "skin", "ink", 0.9, hp, function(uu) { return 0.34 * (1 - 0.8 * uu) }, 0.05, 0.6)
      if (i % 7 === 6) {
        var hd3 = rot(hd2, 55)
        pen("bx" + i, "skin", "ink", 0.8, [bq, add(bq, mul(hd3, hl * 0.8))], function(uu) { return 0.28 * (1 - 0.8 * uu) }, 0.05, 0.6)
      }
    }
    // a crosshatch shadow under the brow head
    for (i = 0; i < 12; i++) {
      var sx = bx0 + 2 + hash(seed, RS.brow, 300 + i) * 18, sy = browAt((sx - bx0) / bL).y + 2.2 + hash(seed, RS.brow, 320 + i) * 3
      var sd = rot(pt(1, 0), i % 2 ? 40 : -35)
      pen("bs" + i, "skin", "ink", 0.7, [pt(sx, sy), add(pt(sx, sy), mul(sd, hs(seed, RS.brow, 340 + i, 2.5, 4.5)))], function(uu) { return 0.26 * (1 - 0.7 * uu) }, 0.1, 0.5)
    }
  }
  // ---- screentone (T3 only): a 45 degree dot grid on the skin planes, faded out at the region edge, skipped where hatch is --------------
  if (C.screentone && room()) {
    var pitch = 1.6, kx, ky, nDots = 0
    for (ky = 0; ky < 62; ky += pitch * 0.5) {
      for (kx = ((Math.round(ky / (pitch * 0.5)) % 2) ? 0 : pitch * 0.5); kx < 100; kx += pitch) {
        if (strokes.length >= cap - reserve) break
        var dq = pt(kx, ky)
        if (!skinOK(dq)) continue
        var th0 = toneK(dq.x, dq.y)
        // only the flat planes: the cheek (y below the bag) and the lid surface; the hatch zones carry their own tone
        var yl0 = G.yL(kx), isCheek = ky > yl0 + 12, isLid = ky < G.yU(kx) && ky > G.foldY(kx)
        if (!isCheek && !isLid) continue
        if (th0 < 0.1) continue
        var dr = pitch * 0.5 * Math.sqrt(th0 * (isCheek ? 1.0 : 0.9)) * 0.9
        if (dr * pxu < 0.28) continue
        put("tn" + (nDots++), "skin", "ink", 0.85, flat(circ(dq, dr, 6, 0, RS.dot)))
      }
    }
    if (bs > 0.6) {   // the blood wash: dots of the vein colour in both corners
      for (i = 0; i < 60 && room(); i++) {
        var fromI = i % 2 === 0, bxp = fromI ? G.I.x + 3 + hash(seed, RS.dot, 500 + i) * 9 : G.O.x - 3 - hash(seed, RS.dot, 500 + i) * 9
        var byp = (fromI ? G.I.y : G.O.y) + hs(seed, RS.dot, 600 + i, -9, 9)
        if (!G.open(bxp, byp, 0.6) || G.inIris(bxp, byp, 0.5)) continue
        put("bw" + i, "sclera", "vein", 0.8, flat(circ(pt(bxp, byp), hs(seed, RS.dot, 700 + i, 0.25, 0.45), 6, 0, RS.dot)), { clip: true, m: bs })
      }
    }
  }
  // ---- stipple (T2+): the caruncle, the inner corner and the pupil margin ----------------------------------------------------------------
  if (C.stipple && room()) {
    for (i = 0; i < 14; i++) {
      var sa = 2 * Math.PI * hash(seed, RS.stipple, i), sr = cr * Math.sqrt(hash(seed, RS.stipple, 20 + i))
      put("st" + i, "sclera", "ink", 0.8, flat(circ(pt(crc.x + Math.cos(sa) * sr, crc.y + Math.sin(sa) * sr * 0.8), hs(seed, RS.stipple, 40 + i, 0.18, 0.3), 6, 0, RS.dot)), { clip: true })
    }
    for (i = 0; i < 12; i++) {
      var pa = 2 * Math.PI * hash(seed, RS.stipple, 80 + i), pq = irisPt((ir.pupil / R) * (1.05 + 0.4 * hash(seed, RS.stipple, 100 + i)), pa)
      put("sp" + i, "iris", "ink", 0.8, flat(circ(pq, hs(seed, RS.stipple, 120 + i, 0.18, 0.28), 6, 0, RS.dot)), irisClip)
    }
    // the plica: a fold line at the caruncle
    pen("plica", "sclera", "ink", 0.85, [pt(crc.x + 0.8, crc.y - cr * 0.9), pt(crc.x + cr * 0.9, crc.y), pt(crc.x + 0.6, crc.y + cr * 0.9)], function(uu) { return 0.4 * Math.sin(Math.PI * uu) + 0.08 }, 0.1, 0.1, { clip: true })
  } else if (!C.stipple) {
    pen("plica", "sclera", "ink", 0.85, [pt(crc.x + 0.8, crc.y - cr * 0.9), pt(crc.x + cr * 0.9, crc.y), pt(crc.x + 0.6, crc.y + cr * 0.9)], function(uu) { return 0.9 * Math.sin(Math.PI * uu) + 0.15 }, 0.1, 0.1, { clip: true })
  }

  // ---- the veil of a hidden eye: crosshatch darkness from the inner corner, three families on the tone engine --------------------------------
  if (p.veil > 0) {
    var vedge = 100 * clamp(p.veil, 0, 1), vtone = function(x, y) { return clamp(1.1 * (1 - x / vedge), 0, 1) * smoothstep(0.3, 4, Math.min(y, 62 - y, x + 2)) }
    var vfams = [{ deg: 28, thr: 0.12 }, { deg: -42, thr: 0.4 }, { deg: 76, thr: 0.62 }], vsp = Math.max(3.4, mudU)
    families.push({ name: "veil", spacing: vsp, px: vsp * pxu })
    for (var vf = 0; vf < vfams.length; vf++) {
      var vd = rot(pt(1, 0), vfams[vf].deg), vn = perp(vd), vk = 0
      for (var vc = -80; vc <= 80; vc += vsp) {
        var vb = add(pt(vedge / 2, 31), mul(vn, vc))
        walk("v" + vf + "_" + (vk++), "veil", (function(bb, dd2) { return function(tt) { return add(bb, mul(dd2, tt)) } })(vb, vd), -80, 80, XS,
          function(q) { return q.x > 0.5 && q.x < vedge && q.y > 0.5 && q.y < 61.5 }, vtone, vfams[vf].thr, 0.5, 0.9, null, 2)
      }
    }
  }

  // ================= 9. the paper that goes last: cornea, meniscus, catchlight ========================================================
  // the cornea: a paper sliver along the lower limbus
  if (p.archetype !== "lidless" && !shut) {
    var cs = [], cw0 = hs(seed, RS.cat, 10, 0.3, 0.6)
    for (i = 0; i <= 10; i++) cs.push(irisPt(0.985, (30 + 120 * i / 10) * Math.PI / 180))
    pen("cornea", "iris", "paper", 0.95, cs, function(uu) { return cw0 * Math.sin(Math.PI * uu) + 0.05 }, 0.05, 0.05, irisClip)
  }
  // the wet meniscus: a paper sliver on the lower waterline, and a glint at the inner corner
  if (p.wet > 0.35 && !shut) {
    var ml = []
    for (i = 0; i <= 14; i++) { xs = G.I.x + G.W * (0.2 + 0.6 * i / 14); ml.push(pt(xs, G.yL(xs) - 0.95)) }
    pen("meniscus", "lid", "paper", 0.95, ml, function(uu) { return 0.34 * Math.sin(Math.PI * uu) + 0.04 }, 0.1, 0.1, { clip: true })
    put("glint", "sclera", "paper", 0.95, flat(circ(pt(crc.x - 0.3, crc.y - cr * 0.35), 0.45, 6, 0, RS.dot)), { clip: true })
  }
  // the catchlight: always paper, never a colour; at the light side, overlapping the pupil edge by 30-50 %; none = the dead eye
  var cstyle = p.catchStyle
  if (shut || p.veil > 0.3 || p.pupilState === "spiral" || p.archetype === "lidless") cstyle = "none"
  if (cstyle !== "none") {
    var la = Math.atan2(G.light.y, G.light.x), ov = hs(seed, RS.cat, 20, 0.3, 0.5)
    var pupR = ir.pupil, cd = pupR * (1 - 2 * ov)
    var cat = function(id, off, rr) {
      var cc = pt(ic.x + Math.cos(la) * off, ic.y + Math.sin(la) * off)
      put(id, "spec", "paper", 1, flat(circ(cc, rr, 10, rr * 0.12, RS.cat + 50)), irisClip)
    }
    if (cstyle === "pin") cat("catchPin", Math.max(pupR * 0.4, 0.8), hs(seed, RS.cat, 30, 0.7, 1.0))
    else {
      var wr = p.archetype === "heavy" ? hs(seed, RS.cat, 31, 1.2, 1.6) : hs(seed, RS.cat, 31, 1.7, 2.5)
      var base = pt(ic.x + Math.cos(la) * Math.max(pupR * 0.55, wr * 0.7), ic.y + Math.sin(la) * Math.max(pupR * 0.55, wr * 0.7))
      var lobe2 = add(base, mul(rot(pt(1, 0), 20), wr * 1.5))
      put("catchA", "spec", "paper", 1, flat(circ(base, wr, 10, wr * 0.1, RS.cat + 60)), irisClip)
      if (p.archetype !== "heavy") put("catchB", "spec", "paper", 1, flat(circ(lobe2, wr * 0.55, 8, 0, RS.cat + 61)), irisClip)
      if (p.pupilState === "poly") for (i = 1; i < 2; i++) put("catchP" + i, "spec", "paper", 1, flat(circ(pt(ic.x + 0.46 * ir.rx - 0.4, ic.y - 0.2 * ir.ry - 1), 0.5, 6, 0, RS.cat)), irisClip)
    }
  }
  if (p.pupilState === "pin" && cstyle === "none") { /* a pin pupil with no light: the dead stare */ }

  // the edge mode (a pale liquid): a lost-edge G-pen contour on the shadow side, and the socket's outer hatch band denser (the host
  // asks for it with `edge`); it is never a closed keyline
  if (edge) {
    var ex0 = G.I.x + G.W * 0.4, ep = []
    for (i = 0; i <= 18; i++) { xs = ex0 + (G.O.x - ex0 + 1.5) * i / 18; ep.push(pt(xs, G.yL(xs) + 1.1)) }
    pen("edge", "lid", "ink", 0.9, ep, function(uu) { return 1.2 * Math.sin(Math.PI * Math.min(1, uu * 1.05)) * (1 - 0.6 * uu) + 0.15 }, 0.15, 0.35)
  }

  return { clip: flat(openPoly), strokes: strokes, tier: C.tier, count: strokes.length, minStrokePx: minPx === 1e9 ? 0 : minPx,
           families: families, iris: ir, opening: openPoly, params: p, G: G, tone: tone, edge: edge, pupils: pupilDescs, tearBead: tearBead }
}

// ---- the T0 sigil (< 24 px): <= 6 filled paths, no Canvas --------------------------------------------------------------------------
// -> [{ id, role, a, path }] in the unit box. `opt.paper: false` leaves the sclera out (the core seal draws on its own ground).
function ellPath(c, rx, ry, n, deg) {
  var pts = [], i
  for (i = 0; i < n; i++) { var a = 2 * Math.PI * i / n; pts.push(add(c, rot(pt(rx * Math.cos(a), ry * Math.sin(a)), deg || 0))) }
  return pts
}
function pathOf(pts) { var s = "M " + r2(pts[0].x) + " " + r2(pts[0].y); for (var i = 1; i < pts.length; i++) s += " L " + r2(pts[i].x) + " " + r2(pts[i].y); return s + " Z" }
function ribbonPts(pts, ws) {
  var n = pts.length, l = [], r = [], i
  for (i = 0; i < n; i++) {
    var d = unit(sub(pts[Math.min(n - 1, i + 1)], pts[Math.max(0, i - 1)])), nn = perp(d), h = ws[i] / 2
    l.push(add(pts[i], mul(nn, h))); r.push(sub(pts[i], mul(nn, h)))
  }
  r.reverse()
  return l.concat(r)
}
function sigilParts(p, S, opt) {
  var o = opt || {}, px = 100 / Math.max(8, S)    // one device pixel in units
  var out = []
  if (p.archetype === "eyeball") return eyeball(p, S, o)
  var G = buildGeo(p), ir = G.iris, N = 9, up = [], lo = [], i, xs
  for (i = 0; i <= N; i++) { xs = G.I.x + G.W * i / N; up.push(pt(xs, G.yU(xs))); lo.push(pt(xs, G.yL(xs))) }
  if (o.paper !== false) out.push({ id: "sclera", role: "paper", a: 1, path: pathOf(up.concat(lo.slice().reverse())) })
  // the upper lid: a heavy tapered brush, at least 1.1 px at its heaviest
  var uw = Math.max(1.6 * px, p.archetype === "slit" ? 6 : 5.5)
  out.push({ id: "upper", role: "ink", a: 1, path: pathOf(ribbonPts(up, up.map(function(q, k) { return (0.2 + 0.8 * Math.sin(Math.PI * Math.min(1, (k / N) * 1.05 + 0.04))) * uw * (0.5 + 0.5 * k / N) }))) })
  // the lower lid: thin, broken (two runs)
  var lw = Math.max(1.0 * px, 1.4), a1 = lo.slice(0, 4), a2 = lo.slice(5)
  out.push({ id: "lower", role: "ink", a: 1, path: pathOf(ribbonPts(a1, a1.map(function() { return lw }))) + " " + pathOf(ribbonPts(a2, a2.map(function() { return lw }))) })
  // the iris: a solid disc clamped inside the opening (tucked under the upper lid)
  var disc = ellPath(pt(ir.x, ir.y), ir.rx, ir.ry, 14).map(function(q) { return pt(q.x, clamp(q.y, G.yU(q.x) + 0.2, G.yL(q.x) - 0.2)) })
  if (p.archetype === "poly") out.push({ id: "iris", role: "ink", a: 1, path: pathOf(disc) })
  else out.push({ id: "iris", role: "ink", a: 1, path: pathOf(disc) })
  var cs = Math.max(0.65 * px, 1.3)
  if (p.catchStyle !== "none" && p.pupilState !== "spiral" && p.archetype !== "lidless" && p.archetype !== "slit")
    out.push({ id: "pin", role: "paper", a: 1, path: pathOf(ellPath(pt(ir.x - ir.rx * 0.38, ir.y - ir.ry * 0.12), cs, cs, 6)) })
  else if (p.pupilState === "spiral") {
    var sp = [], k
    for (k = 0; k <= 14; k++) { var uu = k / 14, ang = 2 * Math.PI * 1.25 * uu; sp.push(pt(ir.x + Math.cos(ang) * ir.rx * (0.15 + 0.7 * uu), ir.y + Math.sin(ang) * ir.ry * (0.15 + 0.7 * uu))) }
    out.push({ id: "spiral", role: "paper", a: 1, path: pathOf(ribbonPts(sp, sp.map(function() { return Math.max(1.2, 0.8 * px) }))) })
  }
  if (p.tear) out.push({ id: "tear", role: "tear", a: 1, path: pathOf(ellPath(pt(G.I.x + 4, G.yL(G.I.x + 4) + 3.5), 2.4, 3.2, 7)) })
  return out
}
// A loose eyeball (lidless T0): a paper disc, a crescent on the shadow side, an iris ellipse baked OFF-centre by `yaw` (foreshortened),
// a paper pinpoint, sometimes a trailing nerve. Box 100 x 62; the disc is centred and 60 units across.
function eyeball(p, S, o) {
  var px = 100 / Math.max(8, S), c = pt(50, 31), R = 30, out = []
  var yaw = p.yaw === undefined ? 0 : p.yaw, ir = 0.42 * R, ix = c.x + Math.sin(yaw) * R * 0.62, iy = c.y + hs(p.seed | 0, RS.ball, 1, -4, 4)
  var cosy = Math.max(0.35, Math.cos(yaw) * 0.9)
  out.push({ id: "disc", role: "paper", a: 1, path: pathOf(ellPath(c, R, R, 16)) })
  // the crescent: the disc minus the disc shifted toward the light (the shadow side is lower right)
  var outer = ellPath(c, R, R, 16), inner = ellPath(pt(c.x - 6.5, c.y - 6.5), R * 0.98, R * 0.98, 16).reverse()
  var cres = []
  for (var i = 0; i <= 8; i++) { var a = (-0.35 + 1.5 * i / 8) * Math.PI; cres.push(pt(c.x + Math.cos(a) * R, c.y + Math.sin(a) * R)) }
  var cin = []
  for (i = 8; i >= 0; i--) { var b = (-0.35 + 1.5 * i / 8) * Math.PI; cin.push(pt(c.x - 6 + Math.cos(b) * (R - 0.5), c.y - 6 + Math.sin(b) * (R - 0.5))) }
  out.push({ id: "crescent", role: "ink", a: 1, path: pathOf(cres.concat(cin)) })
  var iw = Math.max(ir * cosy, 1.3 * px * 0.5)
  out.push({ id: "iris", role: "ink", a: 1, path: pathOf(ellPath(pt(ix, iy), iw, ir, 12)) })
  var cs = Math.max(0.7 * px, 1.3)
  if (p.catchStyle !== "none") out.push({ id: "pin", role: "paper", a: 1, path: pathOf(ellPath(pt(ix - iw * 0.3, iy - ir * 0.35), cs, cs, 6)) })
  if (p.nerve) {
    var nv = [pt(c.x + R * 0.75, c.y + R * 0.55), pt(c.x + R * 1.05, c.y + R * 0.78), pt(c.x + R * 1.3, c.y + R * 0.7)]
    out.push({ id: "nerve", role: "ink", a: 1, path: pathOf(ribbonPts(nv, [Math.max(1.6, 1.0 * px), 1.3, Math.max(0.9, 0.7 * px)])) })
  }
  return out
}
function eyeballParams(seed, yaw, over) {
  var p = { archetype: "eyeball", seed: seed | 0, yaw: yaw, catchStyle: hash(seed, RS.ball, 0) < 0.3 ? "none" : "paper", nerve: hash(seed, RS.ball, 2) < 0.4 }
  if (over) for (var k in over) p[k] = over[k]
  return p
}

// ---- the crest (E1): which archetype for which state -----------------------------------------------------------------------------------
// calm -> heavy, hot (`warn`) -> stare, the lore `critical` state -> spiral; an override from the `crestEye` setting wins when it names one
// What the crest changes in a face so it reads in a 68 px wide eye in the 28 px slot on a dark panel: the resting `heavy` eye is opened a little (aperture 0.8,
// the lid covering a quarter of the iris, outside the preset's 0.6-0.75 / 0.35-0.5) so a pale opening is left to read
var CREST = { heavy: { aperture: 0.8, lidCover: 0.25 }, stare: {}, spiral: {}, lidless: {}, weeping: {}, poly: {}, slit: { aperture: 0.3 } }
var CREST_PX = 68
function crestArchetype(state, override) {
  if (override && override !== "auto" && PRESET[override]) return override
  return state === "critical" ? "spiral" : (state === "hot" ? "stare" : "heavy")
}

// ---- the ichor (E2): which mark for which rank ------------------------------------------------------------------------------------------
// rank 0: one drowned eye (heavy calm, stare hot, spiral critical; a slit when the fitted size is < 24 px); rank 1-2: shut slits that
// open when the pointer is near; rank 3-6: loose eyeballs. No two visible slots share both archetype and seed variant; the eyeballs take
// one of three baked iris yaws and neighbouring ranks never the same one. -> { kind, archetype, seed, yawIdx, variant }
var YAWS = [-0.75, 0.0, 0.8]
function ichorMark(rank, seed, S, state) {
  if (rank === 0) {
    if (S < TIER.t1) return { kind: "slit", archetype: "slit", seed: seed, yawIdx: 0, variant: 0 }
    return { kind: "eye", archetype: crestArchetype(state), seed: seed, yawIdx: 0, variant: 0 }
  }
  if (rank <= 2) return { kind: "slit", archetype: "slit", seed: seed + 31 * rank, yawIdx: 0, variant: rank }
  var yi = (rank * 2 + (seed & 1)) % 3
  return { kind: "eyeball", archetype: "eyeball", seed: seed, yawIdx: yi, variant: rank, yaw: YAWS[yi] }
}

// ---- measurement helpers for the tests and the lab ----------------------------------------------------------------------------------------------
// the opening of the default eye of an archetype as a 0/1 grid on a 1-unit lattice (for the IoU of two archetypes)
function openingGrid(p) {
  var G = buildGeo(p), g = [], x, y
  for (y = 0; y < 62; y++) for (x = 0; x < 100; x++) g.push(G.open(x + 0.5, y + 0.5, 0) ? 1 : 0)
  return g
}
function iou(a, b) {
  var i = 0, u = 0, k
  for (k = 0; k < a.length; k++) { if (a[k] && b[k]) i++; if (a[k] || b[k]) u++ }
  return u ? i / u : 1
}
// the tone histogram of the opening and the socket: 8 bins of the sclera/iris tone, normalised
function toneHistogram(p) {
  var G = buildGeo(p), T = toneField(p, G), h = [0, 0, 0, 0, 0, 0, 0, 0], n = 0, x, y, t
  for (y = 0; y < 62; y += 1) for (x = 0; x < 100; x += 1) {
    if (G.open(x + 0.5, y + 0.5, 0)) t = G.inIris(x + 0.5, y + 0.5, 0) ? T.iris(x + 0.5, y + 0.5) : T.sclera(x + 0.5, y + 0.5)
    else t = T.skin(x + 0.5, y + 0.5)
    h[Math.min(7, Math.floor(t * 8))]++; n++
  }
  return h.map(function(v) { return v / n })
}

if (typeof module !== "undefined") module.exports = {
  BOX: BOX, HAIRLINE: HAIRLINE, MUD_PX: MUD_PX, TIER: TIER, CAP: CAP, ARCHETYPES: ARCHETYPES, REAL_INK: REAL_INK, RANGE: RANGE, PRESET: PRESET,
  realParams: realParams, realPair: realPair, buildGeo: buildGeo, toneField: toneField, tierFor: tierFor, tierConfig: tierConfig,
  realParts: realParts, realPlates: realPlates, PLATE_PMIN: PLATE_PMIN, clearCache: clearCache, sigilParts: sigilParts, eyeballParams: eyeballParams, crestArchetype: crestArchetype,
  ichorMark: ichorMark, flapShape: flapShape, FLAP: FLAP, CREST: CREST, CREST_PX: CREST_PX, YAWS: YAWS, openingGrid: openingGrid, iou: iou, toneHistogram: toneHistogram, hash: hash, hs: hs
}
