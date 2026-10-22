// The eye of the ichor: the geometry of one inked eye (Junji Ito's: a heavy tapered upper lid, clumped lashes curling to the
// outer corner, a double-lid crease with hatch, a hatched shadow under the eye, a small iris with a 2.25-turn spiral, a wet
// gleam, bloodshot veins). Design: dev/openspec/changes/ito-system-panels/ichor-eyes.md, sections 1a-1e.
//
// Pure functions, no I/O, no QML types, no colours (a part only names the ink TOKEN it is drawn with): the same file loads
// in the shell, in the offscreen lab and in `node --test`. No `.pragma`, no JS-to-JS import (the shape of ItoIchor.js).
//
// Units: the eye is drawn in a box of 100 x 62 units and scaled to its size S px by `S / 100` (a transform). The inner
// corner is on the left; a mirrored eye is an x-scale of -1 about x 50. y grows downward. Every stroke of the drawing is a
// filled RIBBON or WEDGE (a polygon with a width profile), never a uniform stroke: that is what makes the weights vary.
//
// A part: { id, layer, role, under, a, path, rule?, grad? }
//   id     the slot it fills (SLOTS); a layer has a fixed list of slots, so the renderer never creates or removes a path
//   role   the ink token (ROLES) of its colour; `under` the token it sits on; `a` its strength: the colour is the one
//          under it mixed toward the token by `a` (opaque, as the liquid), except parts that say `alpha` (translucent)
//   path   SVG (M/L/C/Q/A/Z) in unit coordinates; `rule` "odd" for the flesh ring, otherwise nonzero; `grad` the gradient
// Layers: A sclera, veins; B iris group (origin at the iris centre); C flesh ring, crease, hatch, lower lid; D the lid.

var BOX = { w: 100, h: 62 }
var IRIS_C = { x: 50, y: 35 }
var IRIS_R = 14                       // the iris is smaller than the opening: sclera shows all round it (the stare)
var GAZE = { x: 11, y: 3.5 }          // the ellipse the iris centre may move in
var PUPIL = { open: 6.5, stare: 3.8 }
var INK_FINE = 56                     // px: from here the hand's extras (gaps, crosshatch, stipple, twigs, noise) are drawn
var HAIRLINE = 0.6                    // px: no stroke is drawn thinner, thinner reads fainter instead

// Level by rendered size: L3 S >= 28, L2 16 <= S < 28, L1 S < 16; down by one pixel less than the way up.
var LEVELS = { l3: 28, l2: 16, hyst: 1 }

// Colour factors of the eye tokens (read by ItoSealInk; no colour is written anywhere).
var EYE_INK = {
  sclera: { mix: 0.22, target: 2.0 },        // lightenTo(mix(highlight, fill, mix), fill, target); NEVER darkened (contrast comes from ink)
  pale: { below: 2.0 },                      // eyePale: the sclera reaches less than this against the liquid
  shade: { mix: 0.34 },                      // mix(sclera, clot, mix)
  line: { target: 4.5, vsSkin: 3.0, paleTarget: 7.0, paleVsSkin: 4.5 },   // darkenTo(clot, sclera), then on the flesh; the pale pair when pale
  keyline: { target: 3.0, paleTarget: 4.5 }, // darkenTo(eyeLine, fill, target): the cut from the liquid
  lidTone: { mix: 0.35, target: 2.2, alpha: 0.45, paleMul: 1.3, composite: 1.4 },  // darkenTo(mix(shade, clot, mix), sclera, target)
  bagTone: { mix: 0.22, vsSkin: 1.3 },       // mix(skin, clot, mix), darkened to vsSkin on the flesh
  iris: { mix: 0.35 }, irisRim: { mix: 0.70 },  // mix(fill, clot, mix)
  pupil: { target: 3.0 },                    // darkenTo(clot, iris0, target); the iris is then lifted until the pupil reads
  gleam: { target: 4.5 },                    // lightenTo(highlight, pupil, target)
  vein: { mix: 0.15, target: 1.8 },          // darkenTo(mix(fill, clot, mix), sclera, target); veinHot from `hot`
  skin: { mix: 0.24 },                       // mix(body, sclera, mix)
  caruncle: 0.45, discL1: 0.5, shadeEnd: 0.6 // mix(sclera, vein, .45); mix(irisRim, pupil, .5); mix(sclera, shade, .5)
}

// Depth: every colour of an eye is mixed toward the stratum's body by `fade`, in 6 steps from the surface to the floor.
var FADE = { surface: 0.12, floor: 0.55, steps: 6, gleamMul: 0.5 }

// ---- small vector helpers ---------------------------------------------------------------------------------------
function fmt(v) { return (Math.round(v * 100) / 100).toString() }
function pt(x, y) { return { x: x, y: y } }
function add(p, q) { return pt(p.x + q.x, p.y + q.y) }
function sub(p, q) { return pt(p.x - q.x, p.y - q.y) }
function mul(p, k) { return pt(p.x * k, p.y * k) }
function len(p) { return Math.sqrt(p.x * p.x + p.y * p.y) }
function unit(p) { var l = len(p); return l > 1e-9 ? pt(p.x / l, p.y / l) : pt(0, -1) }
function lerp(p, q, t) { return pt(p.x + (q.x - p.x) * t, p.y + (q.y - p.y) * t) }
function rot(d, deg) {
  var a = deg * Math.PI / 180, c = Math.cos(a), s = Math.sin(a)
  return pt(d.x * c - d.y * s, d.x * s + d.y * c)
}
// `d` turned by `deg` toward the outer corner (larger x) or the inner one (smaller x)
function turnToO(d, deg) { var a = rot(d, deg), b = rot(d, -deg); return a.x >= b.x ? a : b }
function turnToI(d, deg) { var a = rot(d, deg), b = rot(d, -deg); return a.x <= b.x ? a : b }
function perp(d) { return pt(d.y, -d.x) }   // for a direction running I -> O it points up (out of the eye)
function clamp(v, lo, hi) { return v < lo ? lo : (v > hi ? hi : v) }
function smoothstep(a, b, x) { var t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t) }

function bez3(p0, p1, p2, p3, t) {
  var u = 1 - t, a = u * u * u, b = 3 * u * u * t, c = 3 * u * t * t, d = t * t * t
  return pt(a * p0.x + b * p1.x + c * p2.x + d * p3.x, a * p0.y + b * p1.y + c * p2.y + d * p3.y)
}
function dbez3(p0, p1, p2, p3, t) {
  var u = 1 - t
  return pt(3 * u * u * (p1.x - p0.x) + 6 * u * t * (p2.x - p1.x) + 3 * t * t * (p3.x - p2.x),
            3 * u * u * (p1.y - p0.y) + 6 * u * t * (p2.y - p1.y) + 3 * t * t * (p3.y - p2.y))
}
function bez2(p0, p1, p2, t) {
  var u = 1 - t
  return pt(u * u * p0.x + 2 * u * t * p1.x + t * t * p2.x, u * u * p0.y + 2 * u * t * p1.y + t * t * p2.y)
}

// ---- 1b: the curves ---------------------------------------------------------------------------------------------
var I = pt(4, 39), O = pt(95, 34)
var UC = [I, pt(22, 14), pt(70, 10), O]          // upper lid margin, I -> O
var LC = [O, pt(78, 56), pt(30, 59), I]          // lower lid, O -> I
var CREASE = [pt(14, 22), pt(30, 3), pt(68, 1), pt(90, 20)]
var RING_A = [pt(0, 40), pt(18, 4), pt(76, 0), pt(100, 30)]
var RING_B = [pt(100, 30), pt(84, 66), pt(26, 68), pt(0, 40)]
var WING_TIP = pt(100.5, 28.2)

function U(t) { return bez3(UC[0], UC[1], UC[2], UC[3], t) }
function L(t) { return bez3(LC[0], LC[1], LC[2], LC[3], t) }
function Lr(t) { return L(1 - t) }
function nU(t) { return perp(unit(dbez3(UC[0], UC[1], UC[2], UC[3], t))) }
// the outward normal of the lower lid (down), t from O
function nL(t) { return perp(unit(dbez3(LC[0], LC[1], LC[2], LC[3], t))) }
// heavy at the outer corner, a hairline at the inner one
function lidW(t) { return 0.45 + 1.1 * t + 3.4 * Math.pow(Math.sin(Math.PI * Math.pow(t, 1.9)), 0.7) }

// ---- 1.1 deterministic hash and noise (identical in node and QML) -------------------------------------------------
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
// the same, periodic (for angles: no seam at 0 / 2PI)
function vloop(seed, salt, t, knots) {
  var x = (t - Math.floor(t)) * knots, i = Math.floor(x) % knots, f = x - Math.floor(x)
  var a = 2 * hash(seed, salt, i) - 1, b = 2 * hash(seed, salt, (i + 1) % knots) - 1
  return a + (b - a) * f * f * (3 - 2 * f)
}
var SALT = { lid: 1, crease: 2, lower: 3, key: 4, hCrease: 5, hShadow: 6, hBag: 7, corner: 8, stipple: 9,
             vein: 10, striae: 11, limbal: 12, pupil: 13, spiral: 14, gap: 15, bags: 16, window: 17, lash: 18, hCross: 19, rim: 20, tone: 21 }

function sample(fn, n) { var out = []; for (var i = 0; i <= n; i++) out.push(fn(i / n)); return out }

// ---- path builders ----------------------------------------------------------------------------------------------
function P(p) { return fmt(p.x) + " " + fmt(p.y) }
function moveTo(p) { return "M " + P(p) + " " }
function lineTo(p) { return "L " + P(p) + " " }
function cubicTo(a, b, c) { return "C " + P(a) + " " + P(b) + " " + P(c) + " " }
function quadTo(a, b) { return "Q " + P(a) + " " + P(b) + " " }
function polyline(pts) { var s = moveTo(pts[0]); for (var i = 1; i < pts.length; i++) s += lineTo(pts[i]); return s }
function polygon(pts) { return polyline(pts) + "Z " }

// A smooth curve through the points (Catmull-Rom as cubic segments), continuing from the current point (no M).
function smoothTo(pts) {
  var s = ""
  for (var i = 0; i + 1 < pts.length; i++) {
    var p0 = pts[Math.max(0, i - 1)], p1 = pts[i], p2 = pts[i + 1], p3 = pts[Math.min(pts.length - 1, i + 2)]
    s += cubicTo(add(p1, mul(sub(p2, p0), 1 / 6)), sub(p2, mul(sub(p3, p1), 1 / 6)), p2)
  }
  return s
}

function circle(c, r) {
  return "M " + fmt(c.x - r) + " " + fmt(c.y) + " A " + fmt(r) + " " + fmt(r) + " 0 1 0 " + fmt(c.x + r) + " " + fmt(c.y) +
         " A " + fmt(r) + " " + fmt(r) + " 0 1 0 " + fmt(c.x - r) + " " + fmt(c.y) + " Z "
}
function ellipse(c, rx, ry, deg, n) {
  var pts = [], k = n || 24
  for (var i = 0; i < k; i++) {
    var a = 2 * Math.PI * i / k
    pts.push(add(c, rot(pt(rx * Math.cos(a), ry * Math.sin(a)), deg)))
  }
  return polygon(pts)
}

// The hairline floor: a stroke of `w` units at size S px is at least HAIRLINE px wide; when it had to be widened its
// strength falls by the ratio, so a thinner line reads fainter, never as aliasing. -> { w (units), a }
function strokeFor(w, S, a) {
  var px = w * S / 100
  if (px >= HAIRLINE) return { w: w, a: a }
  return { w: HAIRLINE * 100 / S, a: a * (px / HAIRLINE) }
}

// A ribbon along a centreline: a filled polygon whose width is `wf(u)` (u 0..1 along the line), both edges smooth.
function ribbonPath(pts, wf, closeEnds) {
  var n = pts.length, left = [], right = []
  for (var i = 0; i < n; i++) {
    var d = unit(sub(pts[Math.min(n - 1, i + 1)], pts[Math.max(0, i - 1)]))
    var h = 0.5 * wf(n > 1 ? i / (n - 1) : 0), nn = perp(d)
    left.push(add(pts[i], mul(nn, h)))
    right.push(sub(pts[i], mul(nn, h)))
  }
  right.reverse()
  var s = moveTo(left[0]) + smoothTo(left) + lineTo(right[0]) + smoothTo(right)
  return s + (closeEnds === false ? "" : "Z ")
}
// the width profile of an inked stroke: thin at both ends, full in the middle (`pow` < 1: blunter), `bias` moves the peak
function bellProfile(w, pow, bias) {
  var b = bias === undefined ? 0.5 : bias
  return function(u) {
    var v = u < b ? u / b : (1 - u) / (1 - b)
    return w * Math.pow(Math.sin(Math.PI / 2 * clamp(v, 0, 1)), pow)
  }
}
function taperProfile(w) { return function(u) { return w * (1 - u) } }

// A hatch stroke: a wedge from `a` (width w) to `b` (a point).
function wedgePath(a, b, w) {
  var n = perp(unit(sub(b, a)))
  return polygon([add(a, mul(n, w / 2)), b, sub(a, mul(n, w / 2))])
}

// ---- 1b/1c: the opening, the ring ------------------------------------------------------------------------------
function openingPath() {
  return moveTo(I) + cubicTo(UC[1], UC[2], UC[3]) + cubicTo(LC[1], LC[2], LC[3]) + "Z "
}
function ringOuterPath() {
  return moveTo(RING_A[0]) + cubicTo(RING_A[1], RING_A[2], RING_A[3]) + cubicTo(RING_B[1], RING_B[2], RING_B[3]) + "Z "
}
function outerPoints(n) {
  var a = [], i
  for (i = 0; i < n; i++) a.push(bez3(RING_A[0], RING_A[1], RING_A[2], RING_A[3], i / n))
  for (i = 0; i < n; i++) a.push(bez3(RING_B[0], RING_B[1], RING_B[2], RING_B[3], i / n))
  return a
}
function openingPoints(n) {
  var a = [], i
  for (i = 0; i < n; i++) a.push(U(i / n))
  for (i = 0; i < n; i++) a.push(L(i / n))
  return a
}

function detailFor(S, prev) {
  var up = S >= LEVELS.l3 ? 3 : (S >= LEVELS.l2 ? 2 : 1)
  if (prev === 3 && S >= LEVELS.l3 - LEVELS.hyst) return 3
  if (prev === 2 && S >= LEVELS.l2 - LEVELS.hyst && S < LEVELS.l3) return 2
  if (prev === 3 && S >= LEVELS.l2 - LEVELS.hyst) return 2
  if (prev === 2 && up === 1 && S >= LEVELS.l2 - LEVELS.hyst) return 2
  return up
}

// ---- 1.3 the pen profile, 1.4 dry-brush gaps ---------------------------------------------------------------------
function ss01(a, b, x) { return b <= a ? 1 : smoothstep(a, b, x) }
function inkProfile(o) {
  var e0 = o.e0 === undefined ? 0.1 : o.e0, e1 = o.e1 === undefined ? 0.1 : o.e1
  var dip = o.dip || 0, dipAt = o.dipAt === undefined ? 0.5 : o.dipAt, slope = o.slope || 0, nAmp = o.nAmp || 0
  var seed = o.seed === undefined ? 0 : o.seed, salt = o.salt === undefined ? 0 : o.salt
  return function(u) {
    var d = (u - dipAt) / 0.18
    var v = o.w * ss01(0, e0, u) * ss01(0, e1, 1 - u) * (1 - dip * Math.exp(-d * d)) * (1 + slope * (u - 0.5))
    if (nAmp) v *= 1 + nAmp * vnoise(seed, salt, u, 5)
    return Math.max(0, v)
  }
}
function polyLen(pts) { var l = 0; for (var i = 1; i < pts.length; i++) l += len(sub(pts[i], pts[i - 1])); return l }
// `gaps`: sorted [u0, u1] pairs; every run is its own closed ribbon, the brush lifts before a gap and lands heavy after it
function ribbonGapped(pts, wf, gaps) {
  if (!gaps || !gaps.length) return ribbonPath(pts, wf)
  var n = pts.length, edges = [0], k, s = ""
  for (k = 0; k < gaps.length; k++) { edges.push(gaps[k][0]); edges.push(gaps[k][1]) }
  edges.push(1)
  var at = function(u) { var x = clamp(u, 0, 1) * (n - 1), i = Math.min(n - 2, Math.floor(x)); return lerp(pts[i], pts[i + 1], x - i) }
  var runs = gaps.length + 1
  var run = function(ua, ub, lead, trail) {
    var m = Math.max(6, Math.round((ub - ua) * (n - 1)) + 1), rp = []
    for (var j = 0; j < m; j++) rp.push(at(ua + (ub - ua) * j / (m - 1)))
    return ribbonPath(rp, function(v) {
      var u = ua + (ub - ua) * v, w = wf(u)
      if (trail) w *= smoothstep(0, 1, (ub - u) / 0.06)
      if (lead) w *= 0.55 + 0.45 * smoothstep(0, 1, (u - ua) / 0.04)
      return w
    })
  }
  for (k = 0; k < runs; k++) s += run(edges[2 * k], edges[2 * k + 1], k > 0, k < runs - 1)
  return s
}
function gapAt(seed, k, lo, hi, lenLo, lenHi, total) {
  var c = hs(seed, SALT.gap + 100 * (k + 1), 0, lo, hi), g = hs(seed, SALT.gap + 100 * (k + 1), 1, lenLo, lenHi) / total
  return [c - g / 2, c + g / 2]
}

// ---- the opening as a polygon: signed distance (positive inside) -----------------------------------------------
var OPEN_PTS = null
function openDist(p) {
  if (!OPEN_PTS) OPEN_PTS = openingPoints(96)
  var poly = OPEN_PTS, inside = false, best = 1e9, i, j
  for (i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    var a = poly[i], b = poly[j]
    if ((a.y > p.y) !== (b.y > p.y) && p.x < (b.x - a.x) * (p.y - a.y) / (b.y - a.y) + a.x) inside = !inside
    var dx = a.x - b.x, dy = a.y - b.y, l2 = dx * dx + dy * dy
    var t = l2 ? clamp(((p.x - b.x) * dx + (p.y - b.y) * dy) / l2, 0, 1) : 0
    var ex = p.x - b.x - t * dx, ey = p.y - b.y - t * dy
    best = Math.min(best, Math.sqrt(ex * ex + ey * ey))
  }
  return inside ? best : -best
}
// pulled toward the iris until it is `margin` inside the opening
function pullInside(p, margin) {
  var q = p
  for (var i = 0; i < 80 && openDist(q) < margin; i++) q = lerp(q, IRIS_C, 0.04)
  return q
}

// ---- veins: the five anchors are the trunk roots of the generator ---------------------------------------------------
var VEINS = [
  { a: pt(9, 38), c: pt(17, 31), b: pt(31, 32), w: 1.0 },
  { a: pt(10, 42), c: pt(19, 46), b: pt(32, 42), w: 0.9 },
  { a: pt(13, 34), c: pt(19, 26), b: pt(26, 27), w: 0.7 },
  { a: pt(91, 34), c: pt(83, 28), b: pt(70, 30), w: 0.9 },
  { a: pt(90, 38), c: pt(82, 45), b: pt(69, 41), w: 1.0 }
]
function veinPoints(v) { return sample(function(t) { return bez2(v.a, v.c, v.b, t) }, 6) }
var HOT_VEINS = [
  { a: pt(60, 18), c: pt(58, 21), b: pt(55, 22), w: 0.9 },
  { a: pt(62, 52), c: pt(60, 49), b: pt(57, 47), w: 0.9 }
]

function polyAt(pts, u) {
  var x = clamp(u, 0, 1) * (pts.length - 1), i = Math.min(pts.length - 2, Math.floor(x))
  return { p: lerp(pts[i], pts[i + 1], x - i), d: unit(sub(pts[i + 1], pts[i])) }
}
// a wobbling polyline of n points from `from` along `d` for `length`
function branchPts(seed, salt, from, d, length, n, wobble) {
  var out = [], nn = perp(d)
  for (var i = 0; i < n; i++) {
    var t = i / (n - 1)
    out.push(pullInside(add(add(from, mul(d, length * t)), mul(nn, wobble * Math.sin(Math.PI * t) * vnoise(seed, salt, t, 3))), 0.8))
  }
  return out
}
// The 3-level vein network: [{ pts, w, lvl }]. `extra` adds the two hot trunks.
function veinNetwork(level, S, seed, extra) {
  var fine = level >= 3 && S >= INK_FINE, out = [], list = [], k
  if (level >= 3) list = VEINS.slice(); else if (level === 2) list = [VEINS[0], VEINS[4]]
  if (extra && fine) list = list.concat(HOT_VEINS)
  for (k = 0; k < list.length; k++) {
    var v = list[k], sl = 100 + k * 40
    var root = pt(v.a.x + hs(seed, SALT.vein, sl, -1.5, 1.5), v.a.y + hs(seed, SALT.vein, sl + 1, -1.5, 1.5))
    var end = pt(v.b.x + hs(seed, SALT.vein, sl + 2, -2, 2), v.b.y + hs(seed, SALT.vein, sl + 3, -2, 2))
    var w0 = hs(seed, SALT.vein, sl + 4, 0.9, 1.15) * (v.w / 1.0 > 0.95 ? 1 : 0.85)
    var tp = []
    for (var i = 0; i < 7; i++) {
      var t = i / 6, q = bez2(root, v.c, end, t)
      var dq = unit(sub(bez2(root, v.c, end, Math.min(1, t + 0.05)), bez2(root, v.c, end, Math.max(0, t - 0.05))))
      if (i > 0 && i < 6) q = add(q, mul(perp(dq), 0.6 * vnoise(seed, SALT.vein, t, 4 + k)))
      tp.push(pullInside(q, 0.8))
    }
    out.push({ pts: tp, w: w0, lvl: 1 })
    if (level < 3) continue
    var tl = polyLen(tp), nb = fine ? 2 : 1, ts = []
    for (i = 0; i < nb; i++) ts.push(hs(seed, SALT.vein, sl + 10 + i, 0.35, 0.75))
    ts.sort(function(a, b) { return a - b })
    var side = hash(seed, SALT.vein, sl + 9) < 0.5 ? 1 : -1
    for (i = 0; i < nb; i++, side = -side) {
      var tb = ts[i], pa = polyAt(tp, tb), ang = side * hs(seed, SALT.vein, sl + 14 + i, 25, 45)
      var bd = rot(pa.d, ang), bl = hs(seed, SALT.vein, sl + 18 + i, 0.45, 0.6) * tl * (1 - tb), bw = 0.6 * w0 * (1 - tb)
      var bp = branchPts(seed, SALT.vein + 100 * (k + 1) + i, sub(pa.p, mul(bd, 0.3)), bd, bl, 5, 0.4)
      out.push({ pts: bp, w: bw, lvl: 2 })
      if (!fine) continue
      var nt = hash(seed, SALT.vein, sl + 22 + i) < 0.5 ? 1 : 2, ts2 = [], s2 = hash(seed, SALT.vein, sl + 23 + i) < 0.5 ? 1 : -1
      for (var m = 0; m < nt; m++) ts2.push(hs(seed, SALT.vein, sl + 26 + i * 4 + m, 0.4, 0.8))
      ts2.sort(function(a, b) { return a - b })
      for (m = 0; m < nt; m++, s2 = -s2) {
        var pb = polyAt(bp, ts2[m]), td = rot(pb.d, s2 * hs(seed, SALT.vein, sl + 34 + i * 4 + m, 20, 40))
        var tlen = hs(seed, SALT.vein, sl + 42 + i * 4 + m, 0.4, 0.55) * bl
        out.push({ pts: branchPts(seed, SALT.vein + 200 * (k + 1) + i * 4 + m, sub(pb.p, mul(td, 0.3)), td, tlen, 4, 0.3), w: 0.6 * bw * (1 - ts2[m]), lvl: 3 })
      }
    }
  }
  return out
}
var VEIN_GAIN = 1.4
function veinWedges(net, S, mul2) {
  var s = ""
  for (var i = 0; i < net.length; i++) {
    var sk = strokeFor(net[i].w * mul2 * VEIN_GAIN, S, 1)
    s += ribbonPath(net[i].pts, taperProfile(sk.w))
  }
  return s
}

var CARUNCLE = { c: pt(9.2, 38.6), rx: 2.6, ry: 1.7 }

// ---- slots ------------------------------------------------------------------------------------------------------
var SLOTS = {
  A: ["sclera", "caruncle", "cornerHatch", "veins"],
  B: ["disc", "shade", "rim", "limbal", "striae", "spiral", "pupil", "gleam", "dot"],
  C: ["ring", "bagTone", "crease", "creaseHatch", "lower", "rim", "bags", "underHatch", "wet", "keyline"],
  D: ["lidSkin", "film", "band", "lidTone", "shadow"]
}

function part(id, layer, role, under, a, path, extra) {
  var p = { id: id, layer: layer, role: role, under: under, a: a, path: path }
  if (extra) for (var k in extra) p[k] = extra[k]
  return p
}

// ---- 1.5 hatch: jittered families ---------------------------------------------------------------------------------
// spec: { n, t0, t1, salt, at(t) -> { p, d }, len: [lo, hi], w: [lo, hi], lenMul(t)?, over?, wBase (the nominal width, for the floor) }
// -> { path, strokes: [{ a, b, w, base }] }
var HATCH_W = 1.35   // the pen presses harder than the table's widths: the hatch must read at 320 px
function hatchFamily(seed, S, sp) {
  var out = [], path = "", dt = (sp.t1 - sp.t0) / sp.n, f = strokeFor(sp.w[1] * HATCH_W, S, 1), k = f.w / sp.w[1]
  for (var i = 0; i < sp.n; i++) {
    var t = sp.t0 + (i + 0.5) * dt + (hash(seed, sp.salt, i * 8) - 0.5) * 0.45 * dt
    var b = sp.at(t), d = rot(b.d, hs(seed, sp.salt, i * 8 + 1, -6, 6))
    var ln = hs(seed, sp.salt, i * 8 + 2, sp.len[0], sp.len[1]) * (sp.lenMul ? sp.lenMul(t) : 1)
    var w = hs(seed, sp.salt, i * 8 + 3, sp.w[0], sp.w[1]) * k
    var a = sub(b.p, mul(d, sp.over ? hs(seed, sp.salt, i * 8 + 4, 0.3, 0.9) : 0))
    var tip = add(b.p, mul(d, ln))
    if (sp.inside) {   // shorten until the tip is inside the opening
      for (var q = 0; q < 6 && openDist(tip) < sp.inside; q++) { ln *= 0.8; tip = add(b.p, mul(d, ln)) }
      if (openDist(tip) < sp.inside || openDist(a) < sp.inside) continue
    }
    out.push({ a: a, b: tip, w: w, base: b.p })
    path += wedgePath(a, tip, w)
  }
  return { path: path, strokes: out }
}
function hexDot(c, r) {
  var pts = []
  for (var i = 0; i < 6; i++) { var a = Math.PI / 3 * i + 0.3; pts.push(pt(c.x + r * Math.cos(a), c.y + r * Math.sin(a))) }
  return polygon(pts)
}

// Layer A and C: everything that does not move after the eye is drawn at size S (S bucketed to whole px by the caller).
// `pale`: the sclera could not reach 2:1 on the liquid, so the ink is heavier (it is a weight switch, not a colour).
function staticParts(level, S, seed, pale) {
  seed = seed | 0
  var A = [], C = [], i, j, f, g, h
  var fine = level >= 3 && S >= INK_FINE
  var palM = pale ? 1 : 0

  // ---- A: sclera, caruncle, corner hatch, stipple, veins
  A.push(part("sclera", "A", "sclera", "sclera", 1, openingPath(), level >= 2 ? { grad: "sclera" } : null))
  if (level >= 3) A.push(part("caruncle", "A", "caruncle", "sclera", 1, ellipse(CARUNCLE.c, CARUNCLE.rx, CARUNCLE.ry, -8, fine ? 16 : 10)))
  var cornerStrokes = [], stipple = []
  if (level >= 3) {
    f = strokeFor(0.7, S, 0.6)
    var cn = fine ? 5 : 3, cp = "", groups = [
      { lid: "U", t0: 0.02, t1: 0.16 }, { lid: "U", t0: 0.84, t1: 0.98 }, { lid: "L", t0: 0.84, t1: 0.98 }, { lid: "L", t0: 0.02, t1: 0.16 }]
    for (i = 0; i < groups.length; i++) {
      var gr = groups[i]
      h = hatchFamily(seed, S, { n: cn, t0: gr.t0, t1: gr.t1, salt: SALT.corner * 10 + i, len: [1.4, 3.2], w: [0.45, 0.7], inside: 0.8,
        at: function(t) {
          var p0 = gr.lid === "U" ? U(t) : L(t), nin = gr.lid === "U" ? mul(nU(t), -1) : mul(nL(t), -1)
          var p = add(p0, mul(nin, 1.9)), d0 = unit(sub(IRIS_C, p)), a = rot(d0, 12), b = rot(d0, -12)
          var d = (a.x * nin.x + a.y * nin.y) > (b.x * nin.x + b.y * nin.y) ? a : b
          return { p: add(p, mul(d, -0.0)), d: d }
        } })
      // the start hangs 0.3-0.9 toward the lid: keep it 0.8 inside by moving the base in, not the start out
      cp += h.path; cornerStrokes = cornerStrokes.concat(h.strokes)
    }
    if (fine) {
      for (i = 0; i < 28; i++) {
        for (var tr = 0; tr < 4; tr++) {
          var sl = i * 8 + tr * 2, onU = hash(seed, SALT.stipple, sl) < 0.5, corner = hash(seed, SALT.stipple, sl + 1) < 0.5
          var tt = hs(seed, SALT.stipple, sl + 100, 0.0, 0.3)
          var pu = onU ? (corner ? tt : 1 - tt) : (corner ? 1 - tt : tt)   // U runs I->O, L runs O->I
          var base = onU ? U(pu) : L(pu), nin2 = onU ? mul(nU(pu), -1) : mul(nL(pu), -1)
          var dd = hs(seed, SALT.stipple, sl + 200, 0.9, 5), r = hs(seed, SALT.stipple, sl + 300, 0.22, 0.45)
          var c = add(base, mul(nin2, dd))
          if (!(c.x < 20 || c.x > 78)) continue
          if (hash(seed, SALT.stipple, sl + 400) > 1 - dd / 5) continue
          if (openDist(c) < 0.8 + r) continue
          stipple.push({ c: c, r: r }); break
        }
      }
      for (i = 0; i < stipple.length; i++) cp += hexDot(stipple[i].c, stipple[i].r)
    }
    A.push(part("cornerHatch", "A", "line", "sclera", f.a, cp, { strokes: cornerStrokes, dots: stipple }))
  }
  if (level >= 2) {
    var net = veinNetwork(level, S, seed, false)
    var mulN = level >= 3 ? 1 : 1.2, mulH = level >= 3 ? 1.4 : 1.7
    var hotNet = veinNetwork(level, S, seed, true)
    A.push(part("veins", "A", "vein", "sclera", 0.75, veinWedges(net, S, mulN), { hotPath: veinWedges(hotNet, S, mulH), net: net, hotNet: hotNet }))
  }

  // ---- C: the flesh ring (drawn above the iris: it is how the lids cut the iris without a clip)
  C.push(part("ring", "C", "skin", "skin", 1, ringOuterPath() + openingPath(), { rule: "odd" }))
  var CR = function(t) { return bez3(CREASE[0], CREASE[1], CREASE[2], CREASE[3], t) }
  if (level >= 3) {
    // bag tone: the shadowed pouch between the lower lid and the first wrinkle
    var ao = [], ai = [], nb = fine ? 16 : 10
    for (i = 0; i <= nb; i++) {
      var ub = 0.18 + 0.64 * i / nb, sv = Math.pow(Math.sin(Math.PI * i / nb), 0.8)
      ao.push(add(L(ub), mul(nL(ub), 2.0)))
      ai.push(add(L(ub), mul(nL(ub), 2.0 + 2.4 * sv)))
    }
    C.push(part("bagTone", "C", "bagTone", "skin", 0.55, polygon(ao.concat(ai.reverse()))))
  }
  if (level >= 2) {
    var crW = level >= 3 ? 1.9 * (1 + 0.1 * palM) : 1.4
    f = strokeFor(crW, S, level >= 3 ? 0.9 : 0.6)
    if (level >= 3) {
      var cpts = sample(function(u) { return CR(-0.04 + 1.10 * u) }, fine ? 40 : 14)
      var cwf = inkProfile({ w: f.w, e0: 0.10, e1: 0.14, dip: 0.45, dipAt: 0.48, slope: 0.4, nAmp: fine ? 0.12 : 0, seed: seed, salt: SALT.crease })
      C.push(part("crease", "C", "line", "skin", f.a, ribbonGapped(cpts, cwf, fine ? [gapAt(seed, 0, 0.42, 0.56, 1.4, 2.2, polyLen(cpts))] : null)))
    } else {
      C.push(part("crease", "C", "line", "skin", f.a, ribbonPath(sample(function(t) { return CR(t) }, 12), bellProfile(f.w, 0.7))))
    }
  }
  if (level >= 3) {
    f = strokeFor(1.0, S, 0.8)
    var at1 = function(t) { var n = nU(t); return { p: add(add(U(t), mul(n, lidW(t))), mul(n, 0.6)), d: turnToO(n, 18) } }
    h = hatchFamily(seed, S, { n: fine ? 26 : 16, t0: 0.12, t1: 0.90, salt: SALT.hCrease, at: at1, len: [3.0, 6.5], w: [0.6, 1.0], over: true,
      lenMul: function(t) { return 0.6 + 0.4 * Math.sin(Math.PI * t) } })
    var chp = h.path, chs = h.strokes
    if (fine) {
      var h2 = hatchFamily(seed, S, { n: 14, t0: 0.55, t1: 0.90, salt: SALT.hCross, len: [2.0, 4.2], w: [0.5, 0.8], over: true,
        at: function(t) { var a = at1(t); return { p: a.p, d: rot(a.d, -48) } } })
      chp += h2.path; chs = chs.concat(h2.strokes)
    }
    C.push(part("creaseHatch", "C", "line", "skin", f.a, chp, { strokes: chs }))
  }

  // lower lid
  var LL = function(t) { return L(t) }
  if (level >= 3) {
    var lw = 1.9 * (1 + 0.2 * palM)
    f = strokeFor(lw, S, 0.95)
    var lpts = sample(function(u) { return LL(-0.035 + 0.995 * u) }, fine ? 40 : 14)
    var lwf = inkProfile({ w: f.w, e0: 0.05, e1: 0.20, dip: 0.30, dipAt: 0.55, slope: -0.9, nAmp: fine ? 0.12 : 0, seed: seed, salt: SALT.lower })
    C.push(part("lower", "C", "line", "skin", f.a, ribbonGapped(lpts, lwf, fine ? [gapAt(seed, 1, 0.58, 0.72, 1.2, 1.8, polyLen(lpts))] : null)))
  } else if (level === 2) {
    f = strokeFor(1.4, S, 0.85)
    C.push(part("lower", "C", "line", "skin", f.a, ribbonPath(sample(function(u) { return LL(0.06 + 0.88 * u) }, 12),
      inkProfile({ w: f.w, e0: 0.1, e1: 0.2, slope: -0.6 }))))
  } else {
    f = strokeFor(pale ? Math.max(1.2, 0.8 * 100 / S) : 1.2, S, 0.7)
    C.push(part("lower", "C", "line", "skin", f.a, ribbonPath(sample(function(u) { return LL(0.06 + 0.88 * u) }, 12), bellProfile(f.w, 0.6, 0.45))))
  }
  if (level >= 3) {
    g = strokeFor(0.6, S, 0.5)
    C.push(part("rim", "C", "line", "skin", g.a, ribbonPath(sample(function(t) { var u = 0.2 + 0.6 * t; return add(L(u), mul(nL(u), 1.8)) }, fine ? 16 : 8),
      inkProfile({ w: g.w, e0: 0.2, e1: 0.2, dip: 0.5, dipAt: 0.5 }))))
    // bags
    f = strokeFor(1.3, S, 0.62); g = strokeFor(0.8, S, 0.5)
    var bp1 = sample(function(t) { var u = 0.2 + 0.6 * t; return add(L(u), mul(nL(u), 4.4)) }, fine ? 20 : 10)
    var bagP = ribbonGapped(bp1, inkProfile({ w: f.w, e0: 0.2, e1: 0.25, dip: 0.35, dipAt: 0.5 }), fine ? [gapAt(seed, 2, 0.35, 0.65, 1.6, 2.6, polyLen(bp1))] : null)
    bagP += ribbonPath(sample(function(t) { var u = 0.32 + 0.34 * t; return add(L(u), mul(nL(u), 6.2)) }, fine ? 14 : 7), bellProfile(g.w * 0.8, 0.9, 0.5))
    if (fine) bagP += ribbonPath(sample(function(t) { var u = 0.40 + 0.20 * t; return add(L(u), mul(nL(u), 7.6)) }, 10), bellProfile(strokeFor(0.6, S, 1).w, 0.9, 0.5))
    C.push(part("bags", "C", "line", "skin", f.a, bagP))
    // under-eye hatch
    f = strokeFor(0.9, S, 0.7)
    var ua = fine ? 16 : 10, uh
    var atU = function(off, turn) { return function(t) { var nl = nL(t); return { p: add(L(t), mul(nl, off)), d: turn(nl) } } }
    uh = hatchFamily(seed, S, { n: ua, t0: 0.26, t1: 0.74, salt: SALT.hBag, len: [2.0, 4.4], w: [0.6, 0.9], over: true,
      at: atU(2.4, function(n) { return turnToI(n, 25) }) })
    var up = uh.path, us = uh.strokes, ud = []
    if (fine) {
      var uh2 = hatchFamily(seed, S, { n: 10, t0: 0.35, t1: 0.65, salt: SALT.hCross, len: [1.6, 3.0], w: [0.5, 0.7], over: true,
        at: atU(3.0, function(n) { return turnToO(n, 35) }) })
      up += uh2.path; us = us.concat(uh2.strokes)
      for (i = 0; i < 14; i++) {
        var uu = hs(seed, SALT.stipple, 500 + i * 3, 0.25, 0.75), off = hs(seed, SALT.stipple, 501 + i * 3, 2.0, 6.8)
        var rr = hs(seed, SALT.stipple, 502 + i * 3, 0.25, 0.5), cc = add(L(uu), mul(nL(uu), off))
        ud.push({ c: cc, r: rr }); up += hexDot(cc, rr)
      }
    }
    C.push(part("underHatch", "C", "line", "skin", f.a, up, { strokes: us, dots: ud }))
    // wet glint on the lower lid's ink
    var wl = strokeFor(fine ? 0.45 : 0.5, S, 0.8), wp = ""
    var dashes = fine ? [[0.25, 0.40], [0.45, 0.58], [0.63, 0.75]] : [[0.35, 0.60]]
    for (i = 0; i < dashes.length; i++) {
      var d0 = dashes[i][0], d1 = dashes[i][1]
      wp += ribbonPath(sample(function(t) { var u = d0 + (d1 - d0) * t; return sub(L(u), mul(nL(u), 0.35)) }, fine ? 8 : 5), bellProfile(wl.w, 0.7))
    }
    C.push(part("wet", "C", "gleam", "line", wl.a, wp))
  }
  // keyline: the cut from the liquid, a closed ribbon pulled in by half its width
  if (level >= 2) {
    var base = outerPoints(fine ? 32 : 16), N = base.length, kp = [], kw = [], total
    var kf = strokeFor(level >= 3 ? 0.7 : 0.9, S, level >= 3 ? 1 : 0.8), kk = kf.w / (level >= 3 ? 0.7 : 0.9)
    for (i = 0; i <= N; i++) {
      var s = i / N, w
      if (level >= 3) {
        w = 0.7 + 1.2 * smoothstep(0.38, 0.62, s) * (1 - smoothstep(0.88, 1.0, s))
        if (fine) w *= 1 + 0.15 * vnoise(seed, SALT.key, s, 8)
        if (pale) w *= 1.35
        w *= kk
      } else w = kf.w
      kw.push(w)
    }
    for (i = 0; i <= N; i++) {
      var pp = base[i % N], pn = base[(i + 1) % N], pv = base[(i + N - 1) % N]
      var nrm = perp(unit(sub(pn, pv)))
      kp.push(sub(pp, mul(nrm, kw[i] / 2)))
    }
    total = polyLen(kp)
    var kgaps = null
    if (fine) {
      kgaps = [gapAt(seed, 3, 0.12 * 0.5 + 0.06, 0.22 * 0.5 + 0.06, 2, 4, total), gapAt(seed, 4, 0.30 * 0.5, 0.42 * 0.5, 2, 4, total)]
      // the spec's s is the position round the loop (top arc 0..0.5): centres in [0.12, 0.22] and [0.30, 0.42]
      kgaps = [gapAt(seed, 3, 0.12, 0.22, 2, 4, total), gapAt(seed, 4, 0.30, 0.42, 2, 4, total)]
    }
    var kwf = function(u) { var x = clamp(u, 0, 1) * N, i0 = Math.min(N - 1, Math.floor(x)); return kw[i0] + (kw[i0 + 1] - kw[i0]) * (x - i0) }
    C.push(part("keyline", "C", "keyline", "skin", kf.a, ribbonGapped(kp, kwf, kgaps)))
  }
  return { A: A, C: C }
}

// ---- layer B: the iris, drawn around (0, 0) and moved by the gaze --------------------------------------------------
function ringPath(r, w, topBias, n) {
  var outer = [], inner = []
  for (var i = 0; i < n; i++) {
    var th = 2 * Math.PI * i / n
    var h = 0.5 * w * (1 + topBias * -Math.sin(th))
    outer.push(pt((r + h) * Math.cos(th), (r + h) * Math.sin(th)))
    inner.push(pt((r - h) * Math.cos(th), (r - h) * Math.sin(th)))
  }
  return polygon(outer) + polygon(inner)
}
function pupilOutline(seed, pr) {
  var out = []
  for (var i = 0; i < 40; i++) {
    var th = 2 * Math.PI * i / 40, r = pr * (1 + 0.035 * vloop(seed, SALT.pupil, i / 40, 7))
    out.push(pt(r * Math.cos(th), r * Math.sin(th)))
  }
  return out
}
// the four panes of a window reflected in the cornea (a cross): corners warped, rotated, moved
function windowPanes(seed) {
  var xs = [[-2.6, -0.25], [0.25, 2.6]], ys = [[-2.1, -0.25], [0.25, 2.1]], panes = []
  var warp = function(x, y) {
    var xw = x * (1 + 0.07 * y) * (1 + 0.02 * y * y), a = -12 * Math.PI / 180
    return pt(xw * Math.cos(a) - y * Math.sin(a) - 5.4, xw * Math.sin(a) + y * Math.cos(a) - 5.6)
  }
  for (var xi = 0; xi < 2; xi++) for (var yi = 0; yi < 2; yi++) {
    var x0 = xs[xi][0], x1 = xs[xi][1], y0 = ys[yi][0], y1 = ys[yi][1]
    if (xi === 1 && yi === 1) {   // the curtain: the bottom-right pane shrinks toward the mullion corner
      var k = hs(seed, SALT.window, 0, 0.75, 0.95)
      x1 = 0.25 + (x1 - 0.25) * k; y1 = 0.25 + (y1 - 0.25) * k
    }
    var cs = [[x0, y0], [x1, y0], [x1, y1], [x0, y1]], pts = []
    for (var e = 0; e < 4; e++) {
      var a = cs[e], b = cs[(e + 1) % 4], mx = (a[0] + b[0]) / 2, my = (a[1] + b[1]) / 2
      var ox = (a[1] === b[1]) ? 0 : (a[0] < (x0 + x1) / 2 ? -1 : 1) * 0.25, oy = (a[0] === b[0]) ? 0 : (a[1] < (y0 + y1) / 2 ? -1 : 1) * 0.25
      pts.push(warp(a[0], a[1])); pts.push(warp(mx + ox, my + oy))
    }
    panes.push(pts)
  }
  return panes
}

function irisParts(level, S, seed, pupil) {
  seed = seed | 0
  var B = [], i, f, fine = level >= 3 && S >= INK_FINE
  var pr = pupil === undefined ? PUPIL.open : pupil
  var o = pt(0, 0)
  if (level === 1) {
    B.push(part("disc", "B", "disc1", "sclera", 1, circle(o, 13)))
    if (S >= 12) B.push(part("dot", "B", "gleam", "disc1", 1, circle(pt(-4, -4), 2.4)))
    return B
  }
  var R = IRIS_R
  B.push(part("disc", "B", "iris", "sclera", 1, circle(o, R), level >= 3 ? { grad: "iris" } : null))
  if (level >= 3) {
    var cr = [], nq = fine ? 24 : 12
    for (i = 0; i <= nq; i++) { var th = Math.PI * (1 + i / nq); cr.push(pt(R * Math.cos(th), R * Math.sin(th))) }
    for (i = nq; i >= 0; i--) { var th2 = Math.PI * (1 + i / nq); cr.push(pt((R - 0.5) * Math.cos(th2), 4.6 + (R - 0.5) * Math.sin(th2) * 0.92)) }
    B.push(part("shade", "B", "irisRim", "iris", 0.6, polygon(cr)))
    // the lower crescent is inked, not lit: short pen ticks hanging inward from the lower limbus (they replace the old pale
    // wet-rim crescent, which read as a mint lobed shape against the ink)
    f = strokeFor(0.9, S, 0.55)
    var rk = f.w / 0.9, rt = "", nr = fine ? 22 : 8
    for (i = 0; i < nr; i++) {
      var tq = (28 + 124 * (i + 0.5 + (hash(seed, SALT.rim, i * 4) - 0.5) * 0.5) / nr) * Math.PI / 180
      var rq = R - 0.4, ln = hs(seed, SALT.rim, i * 4 + 1, 1.8, 4.2) * (0.6 + 0.4 * Math.sin(Math.PI * (i + 0.5) / nr))
      var wq = hs(seed, SALT.rim, i * 4 + 2, 0.6, 1.1) * HATCH_W * rk
      var dq = pt(-Math.cos(tq + 0.12), -Math.sin(tq + 0.12))
      var aq = pt(rq * Math.cos(tq), rq * Math.sin(tq))
      rt += wedgePath(aq, add(aq, mul(dq, ln)), wq)
    }
    B.push(part("rim", "B", "pupil", "iris", f.a, rt))
  }
  if (level >= 3) {
    // limbal band: clean outer edge at R, an irregular inner edge (teeth bleed into the iris when fine)
    f = strokeFor(1.7, S, 0.95)
    var nS = fine ? 96 : 48, outer = [], inner = [], kw = f.w / 1.7
    for (i = 0; i < nS; i++) {
      var ta = 2 * Math.PI * i / nS
      var wl = (1.7 * (1 + 0.5 * -Math.sin(ta)) + 0.5 * vloop(seed, SALT.limbal, i / nS, 11)) * kw
      if (fine && i % 3 === 0) wl += hs(seed, SALT.limbal, 100 + i, 0.3, 1.2)
      outer.push(pt(R * Math.cos(ta), R * Math.sin(ta)))
      inner.push(pt((R - wl) * Math.cos(ta), (R - wl) * Math.sin(ta)))
    }
    B.push(part("limbal", "B", "pupil", "iris", f.a, polygon(outer) + polygon(inner), { rule: "odd" }))
  } else {
    f = strokeFor(1.8, S, 0.95)
    B.push(part("limbal", "B", "line", "iris", f.a, ringPath(R - 0.4, f.w, 0.2, 40), { rule: "odd" }))
  }
  if (level >= 3) {
    f = strokeFor(0.55, S, 0.55)
    var kS = f.w / 0.55, nst = fine ? 48 : 28, st = "", strokes = []
    for (i = 0; i < nst; i++) {
      var tha = (360 * i / nst + hs(seed, SALT.striae, i * 4, -2.5, 2.5)) * Math.PI / 180
      var r2 = hs(seed, SALT.striae, i * 4 + 1, 10.6, 13.3), r1 = hs(seed, SALT.striae, i * 4 + 2, 6.6, 8.8)
      var w = hs(seed, SALT.striae, i * 4 + 3, 0.45, 0.95) * kS
      if (fine && i % 6 === 0) { w *= 1.6; r1 -= 1.0 }
      var tt = tha + 4 * Math.PI / 180
      var a = pt(r2 * Math.cos(tha), r2 * Math.sin(tha)), b = pt(r1 * Math.cos(tt), r1 * Math.sin(tt))
      st += wedgePath(a, b, w); strokes.push({ a: a, b: b, w: w })
    }
    if (fine) {   // collarette: a jagged closed ring
      var co = [], ci = []
      for (i = 0; i < 48; i++) {
        var tc = 2 * Math.PI * i / 48
        var rc = 7.6 + 0.6 * vloop(seed, SALT.striae + 1, i / 48, 9) + hs(seed, SALT.striae + 2, i, -0.25, 0.25), hw = 0.225 * kS
        co.push(pt((rc + hw) * Math.cos(tc), (rc + hw) * Math.sin(tc)))
        ci.push(pt((rc - hw) * Math.cos(tc), (rc - hw) * Math.sin(tc)))
      }
      st += polygon(co) + polygon(ci.reverse())
    }
    B.push(part("striae", "B", "pupil", "iris", f.a, st, { strokes: strokes }))
    f = strokeFor(1.9, S, 1)
    var sp = spiralPoints(seed, pr - 0.3)
    if (!fine) sp = sp.filter(function(q, k) { return k % 2 === 0 || k === sp.length - 1 })
    B.push(part("spiral", "B", "pupil", "iris", f.a, ribbonPath(sp,
      inkProfile({ w: f.w, e0: 0.05, e1: 0.2, slope: -0.5, dip: 0.15, dipAt: 0.6, nAmp: fine ? 0.1 : 0, seed: seed, salt: SALT.spiral }))))
  }
  if (fine) {
    var pp = polygon(pupilOutline(seed, pr))
    for (i = 0; i < 6; i++) {
      var tp = hs(seed, SALT.pupil, 50 + i * 3, 0, 2 * Math.PI), rl2 = hs(seed, SALT.pupil, 51 + i * 3, 0.8, 2.2)
      var dd = pt(Math.cos(tp), Math.sin(tp)), e = mul(dd, pr - 0.2)
      pp += wedgePath(e, add(mul(dd, pr), mul(dd, rl2)), 0.9)
    }
    B.push(part("pupil", "B", "pupil", "iris", 1, pp))
  } else {
    B.push(part("pupil", "B", "pupil", "iris", 1, circle(o, pr)))
  }
  if (fine) {
    var gp = ""
    var panes = windowPanes(seed)
    for (i = 0; i < panes.length; i++) gp += polygon(panes[i])
    B.push(part("gleam", "B", "gleam", "pupil", 1, gp, { panes: panes }))
    B.push(part("dot", "B", "gleam", "iris", 0.75, circle(pt(4.6, 5.0), 0.75)))
  } else if (level >= 3) {
    B.push(part("gleam", "B", "gleam", "pupil", 1, ellipse(pt(-5.6, -6.2), 3, 2, -25, 20)))
    B.push(part("dot", "B", "gleam", "iris", 0.7, circle(pt(4.8, 5.4), 0.9)))
  } else {
    B.push(part("gleam", "B", "gleam", "pupil", 1, ellipse(pt(-5.6, -6.2), 3.4, 2.4, -25, 20)))
  }
  return B
}

// Archimedean spiral r0 -> 12.6, 2.25 turns, a point every 14 degrees, clockwise (angle grows with y down).
var SPIRAL = { r0: 7, r1: 12.6, turns: 2.25, stepDeg: 14 }
function spiralPoints(seed, r0) {
  var n = Math.round(SPIRAL.turns * 360 / SPIRAL.stepDeg), start = ((seed === undefined ? 0 : seed) % 1000) / 1000 * 2 * Math.PI
  var a0 = r0 === undefined ? SPIRAL.r0 : r0, out = []
  for (var i = 0; i <= n; i++) {
    var u = i / n, th = start + SPIRAL.turns * 2 * Math.PI * u, r = a0 + (SPIRAL.r1 - a0) * u
    out.push(pt(r * Math.cos(th), r * Math.sin(th)))
  }
  return out
}

// ---- 1d: the lid layer, a function of the blink b (0 open .. 1 shut) -----------------------------------------------
function lidEdge(t, b) {
  var e = add(U(t), mul(sub(Lr(t), U(t)), b))
  e = add(e, pt(0, 1.5 * 4 * b * (1 - b) * Math.sin(Math.PI * t)))
  return pt(e.x, e.y - 0.6 * b * b * b)
}
function lidN(level, S) { return level >= 3 ? (S >= INK_FINE ? 24 : 16) : (level === 2 ? 12 : 8) }
function lidEdges(b, N) {
  var E = [], i
  for (i = 0; i <= N; i++) E.push(lidEdge(i / N, b))
  var nE = []
  for (i = 0; i <= N; i++) nE.push(perp(unit(sub(E[Math.min(N, i + 1)], E[Math.max(0, i - 1)]))))
  return { E: E, n: nE, N: N }
}
function atT(arr, t) {
  var x = clamp(t, 0, 1) * (arr.length - 1), i = Math.min(arr.length - 2, Math.floor(x)), f = x - i
  return lerp(arr[i], arr[i + 1], f)
}
function lashSpec(level) {
  if (level >= 3) return {
    t: [0.30, 0.35, 0.40, 0.47, 0.52, 0.57, 0.64, 0.69, 0.74, 0.81, 0.86, 0.91],
    len: [5, 6.5, 5.5, 8, 9.5, 8.5, 11, 12.5, 11, 12, 11.5, 9.5], jit: [5, 0, -5, 5, 0, -5, 5, 0, -5, 5, 0, -5], hw: 1.25 }
  if (level === 2) return { t: [0.45, 0.58, 0.70, 0.80, 0.88], len: [7, 8.5, 10, 10, 8.5], hw: 1.2 }
  return { t: [], len: [], hw: 0 }
}
function lashPath(B, d, ln, hw, curl) {
  var sd = turnToO(d, 90), tipDir = turnToO(d, curl === undefined ? 26 : curl)
  var tip = add(B, mul(tipDir, ln))
  var ctl = add(add(B, mul(d, 0.55 * ln)), mul(sd, 0.3 * ln))
  var pp = mul(perp(d), hw)
  var bl = add(B, pp), br = sub(B, pp)
  return moveTo(bl) + quadTo(add(ctl, mul(pp, 0.6)), tip) + quadTo(sub(ctl, mul(pp, 0.6)), br) + "Z "
}
function lowerLashes(S) {
  var s = ""
  for (var i = 0; i < 4; i++) {
    var t = 0.10 + 0.08 * i, nl = nL(t)
    var B0 = add(L(t), mul(nl, 0.3)), d = turnToO(nl, 20), ln = 2.6 + 0.8 * i / 3
    var pp = mul(perp(d), 0.5)
    s += polygon([add(B0, pp), add(B0, mul(d, ln)), sub(B0, pp)])
  }
  return s
}

// The lid's points (everything lidShape draws is derived from this, and the tests read it).
function lidGeometry(b, level, S, seed) {
  seed = seed | 0
  var fine = level >= 3 && S >= INK_FINE
  var ed = lidEdges(b, lidN(level, S)), E = ed.E, nE = ed.n, N = ed.N, i
  var minW = level === 1 ? 1.2 * 100 / S : 0
  var wAt = function(i2) {
    var t = i2 / N, w = lidW(t)
    if (fine) w *= 1 + 0.08 * vnoise(seed, SALT.lid, t, 6)
    return Math.max(w, minW)
  }
  var top = [], topE = []
  for (i = 0; i <= N; i++) { top.push(add(U(i / N), mul(nU(i / N), wAt(i)))); topE.push(add(E[i], mul(nE[i], wAt(i)))) }
  var spec = lashSpec(level), lashes = [], nl = spec.t.length
  for (i = 0; i < nl; i++) {
    var t = spec.t[i], frac = nl > 1 ? i / (nl - 1) : 0
    var base = atT(topE, t), ln = spec.len[i], hw = spec.hw, curl = 26
    if (fine) {
      if (i !== 0 && i !== nl - 1) ln *= hs(seed, SALT.lash, i * 3, 0.85, 1.15)
      hw *= hs(seed, SALT.lash, i * 3 + 1, 0.8, 1.2)
      curl = 26 + hs(seed, SALT.lash, i * 3 + 2, -6, 8)
    }
    var d = turnToO(unit(atT(nE, t)), 8 + 34 * frac + (spec.jit ? spec.jit[i] : 0))
    d = turnToO(d, 140 * b)
    base = add(base, mul(d, -0.4))
    lashes.push({ base: base, d: d, len: ln, hw: hw, curl: curl, tip: add(base, mul(turnToO(d, curl), ln)) })
  }
  var film = []
  if (level >= 3) for (i = 0; i < 8; i++) {
    var tk = 0.18 + 0.09 * i
    film.push([lerp(atT(top, tk), atT(topE, tk), 0.15), lerp(atT(top, tk + 0.03), atT(topE, tk + 0.03), 0.85)])
  }
  return { E: E, nE: nE, N: N, top: top, topE: topE, wAt: wAt, lashes: lashes, film: film, lower: level >= 3 ? 4 : 0 }
}

function lidShape(b, level, S, seed, pale) {
  seed = seed | 0
  var g = lidGeometry(b, level, S, seed), E = g.E, nE = g.nE, N = g.N, top = g.top, topE = g.topE, i, D = [], fine = level >= 3 && S >= INK_FINE
  var tr = topE.slice().reverse()
  var skin = moveTo(top[0]) + smoothTo(top) + lineTo(WING_TIP) + lineTo(tr[0]) + smoothTo(tr) + "Z "
  D.push(part("lidSkin", "D", "skin", "skin", 1, skin))
  var rE = E.slice().reverse()
  var band = moveTo(topE[0]) + smoothTo(topE) + lineTo(E[N]) + smoothTo(rE) + "Z "
  var wb = g.wAt(N), wn = nE[N]
  band += polygon([add(E[N], mul(wn, wb + 1.8)), WING_TIP, add(E[N], mul(wn, 0.2))])
  for (i = 0; i < g.lashes.length; i++) band += lashPath(g.lashes[i].base, g.lashes[i].d, g.lashes[i].len, g.lashes[i].hw, g.lashes[i].curl)
  if (g.lower) band += lowerLashes(S)
  var fa = 0.5 * smoothstep(0.25, 0.6, b)
  if (g.film.length && b >= 0.25 && fa > 0) {
    var f = strokeFor(0.6, S, fa), fs = ""
    for (i = 0; i < g.film.length; i++) fs += wedgePath(g.film[i][0], g.film[i][1], f.w)
    D.push(part("film", "D", "line", "skin", f.a, fs))
  }
  D.push(part("band", "D", "line", "line", 1, band))
  if (level >= 3) {
    // the tinted shade of the lid on the sclera: a crescent from the edge inward
    var ta = EYE_INK.lidTone.alpha * (1 - b) * (pale ? EYE_INK.lidTone.paleMul : 1)
    if (ta > 0.01) {
      var c1 = [], c2 = []
      for (i = 0; i <= N; i++) {
        var t = i / N
        c1.push(E[i]); c2.push(sub(E[i], mul(nE[i], 2.8 * Math.pow(Math.sin(Math.PI * t), 0.6))))
      }
      D.push(part("lidTone", "D", "lidTone", "sclera", ta, polygon(c1.concat(c2.reverse())), { alpha: true }))
    }
    var sh = strokeFor(0.75, S, 0.5 * (1 - b)), sw = sh.w / 0.75
    if (sh.a > 0.01) {
      var inwardAt = function(t) { var ne = unit(atT(nE, t)); return turnToO(mul(ne, -1), -8) }
      var mk = function(n, t0, t1, salt, len, w, over, turn, off) {
        return hatchFamily(seed, S, { n: n, t0: t0, t1: t1, salt: salt, len: len, w: w, over: over,
          at: function(t) { var d0 = turn(t); return { p: add(atT(E, t), mul(unit(mul(unit(atT(nE, t)), -1)), off)), d: d0 } } })
      }
      var sh1 = mk(fine ? 22 : 14, 0.12, 0.88, SALT.hShadow, [2.4, 4.6], [0.5, 0.75], true, inwardAt, 1.0)
      var ssp = sh1.path, sst = sh1.strokes
      if (fine) {
        var sh2 = mk(12, 0.30, 0.80, SALT.hShadow + 100, [1.6, 3.2], [0.45, 0.65], true, function(t) { return turnToI(unit(mul(unit(atT(nE, t)), -1)), 47) }, 1.0)
        ssp += sh2.path; sst = sst.concat(sh2.strokes)
      }
      D.push(part("shadow", "D", "line", "sclera", sh.a, ssp, { alpha: true, strokes: sst }))
    }
  }
  return D
}

function quantBlink(b) { return Math.round(clamp(b, 0, 1) / 0.02) * 0.02 }

// ---- depth fade -----------------------------------------------------------------------------------------------------
function fadeFor(depthFrac) {
  var u = clamp(depthFrac, 0, 1), s = FADE.steps
  return FADE.surface + (FADE.floor - FADE.surface) * Math.round(u * (s - 1)) / (s - 1)
}

// ================================================================================================================================
// Timing of the eye's own motion (blink, gaze, stare). The liquid's eyes (behaviour, layouts, the wheel, eyeRows) were removed in S14.
// ================================================================================================================================
var EYES = {
  blinkEvery: [9, 22], blinkJitter: 0.35, blinkClose: 0.22, blinkHold: 0.12, blinkOpen: 0.38, blinkDouble: 0.15, blinkGap: 0.9,
  tauIdle: 1.2, tauPointer: 0.6, tauSaccade: 0.06, idleGaze: [4, 9],
  stare: 8, stareTilt: 0.4, stareLook: 0.15, stareRelease: 0.6
}

function lerpR(range, h) { return range[0] + (range[1] - range[0]) * h }


// ---- blink: closed-form from a seeded schedule ----------------------------------------------------------------------------
function easeIn(x) { return x * x }
function easeOut(x) { return 1 - (1 - x) * (1 - x) }
// one blink at tau seconds after its start: 0 open .. 1 shut (close .22 s ease in, hold .12, open .38 ease out: .72 s in all)
function blinkShape(tau) {
  var c = EYES.blinkClose, h = EYES.blinkHold, o = EYES.blinkOpen
  if (tau < 0 || tau >= c + h + o) return 0
  if (tau < c) return easeIn(tau / c)
  if (tau < c + h) return 1
  return 1 - easeOut((tau - c - h) / o)
}
var BLINK_LEN = EYES.blinkClose + EYES.blinkHold + EYES.blinkOpen
// The schedule of one seed, kept while its period index does not change (three blinks around `t` are enough: a blink and its
// double last 1.62 s, the shortest gap between two is 5.8 s).
var SCHED = {}
function schedOf(seed, t) {
  var sc = SCHED[seed]
  if (!sc) { var P = lerpR(EYES.blinkEvery, hash(seed, 41, 0)); sc = SCHED[seed] = { P: P, phase: P * hash(seed, 42, 0), k0: -1e9, st: [0, 0, 0], dbl: [false, false, false] } }
  var k0 = Math.floor((t - sc.phase) / sc.P)
  if (k0 !== sc.k0) {
    sc.k0 = k0
    for (var i = 0; i < 3; i++) {
      var k = k0 - 1 + i
      sc.st[i] = sc.phase + k * sc.P + (2 * hash(seed, 43, k) - 1) * EYES.blinkJitter * sc.P * 0.5
      sc.dbl[i] = hash(seed, 44, k) < EYES.blinkDouble
    }
  }
  return sc
}
function blinkPeriod(seed) { return lerpR(EYES.blinkEvery, hash(seed, 41, 0)) }
function blinkStart(seed, k) {
  var P = blinkPeriod(seed), phase = P * hash(seed, 42, 0)
  return phase + k * P + (2 * hash(seed, 43, k) - 1) * EYES.blinkJitter * P * 0.5
}
// The lid at time t: b0 (the droop, 0 for the biggest eye) .. 1. A blink is double in 15 % of the cases.
function blinkAt(seed, t, b0) {
  var sc = schedOf(seed, t), best = 0
  for (var i = 0; i < 3; i++) {
    var tau = t - sc.st[i]
    if (tau < 0 || tau >= BLINK_LEN + EYES.blinkGap + BLINK_LEN) continue
    var v = blinkShape(tau)
    if (sc.dbl[i]) v = Math.max(v, blinkShape(tau - EYES.blinkGap))
    if (v > best) best = v
  }
  var base = b0 || 0
  return base + (1 - base) * best
}
// is a blink running at t (the component uses it to know when the clock may slow down)
function blinkingAt(seed, t) {
  var sc = schedOf(seed, t)
  for (var i = 0; i < 3; i++) {
    var tau = t - sc.st[i]
    if (tau >= 0 && tau < BLINK_LEN) return true
    if (sc.dbl[i] && tau - EYES.blinkGap >= 0 && tau - EYES.blinkGap < BLINK_LEN) return true
  }
  return false
}

// ---- gaze ---------------------------------------------------------------------------------------------------------------
// the point of the ellipse (gx, gy) is pulled into
function clampGaze(gx, gy) {
  var e = Math.sqrt((gx * gx) / (GAZE.x * GAZE.x) + (gy * gy) / (GAZE.y * GAZE.y))
  return e > 1 ? { x: gx / e, y: gy / e } : { x: gx, y: gy }
}
// exponential follow: no overshoot at any dt
function gazeStep(g, target, tau, dt) {
  var a = 1 - Math.exp(-Math.max(0, dt) / Math.max(1e-6, tau))
  return clampGaze(g.x + (target.x - g.x) * a, g.y + (target.y - g.y) * a)
}
// where the eye looks when nothing is there: a new point of the ellipse every 4..9 s, by seed
function idleGaze(seed, t) {
  var P = lerpR(EYES.idleGaze, hash(seed, 45, 0)), k = Math.floor(t / P)
  var a = 2 * Math.PI * hash(seed, 46, k), r = Math.sqrt(hash(seed, 47, k))
  return { x: GAZE.x * r * Math.cos(a), y: GAZE.y * r * Math.sin(a) }
}
// the pointer's vector from the eye (px, in the vessel's frame) as a gaze target: the iris goes `clamp(dist / 2S, 0, 1)` of the
// way to the edge of the ellipse; the vector is turned back by the eye's rotation, and flipped for a mirrored eye
function gazeToward(dx, dy, S, rotDeg, mirror) {
  var d = Math.sqrt(dx * dx + dy * dy)
  if (d < 1e-6) return { x: 0, y: 0 }
  var a = -rotDeg * Math.PI / 180, c = Math.cos(a), sn = Math.sin(a)
  var vx = (dx * c - dy * sn) / d, vy = (dx * sn + dy * c) / d, m = clamp(d / (2 * S), 0, 1)
  return { x: (mirror ? -vx : vx) * m * GAZE.x, y: vy * m * GAZE.y }
}

// ---- the stare (the reading is past the warn threshold): eight seconds, every eye at once ----------------------------------
// -> { active, mix (0..1: tilt to 0, lids open, no blinks), pupil (units), look (the gaze is held at (0, 0)) } at `elapsed` seconds
function stareState(elapsed) {
  if (!(elapsed >= 0) || elapsed >= EYES.stare) return { active: false, mix: 0, pupil: PUPIL.open, look: false }
  var up = smoothstep(0, EYES.stareTilt, elapsed), down = 1 - smoothstep(EYES.stare - EYES.stareRelease, EYES.stare, elapsed)
  var pm = smoothstep(0, EYES.stareLook, elapsed) * down
  return { active: true, mix: up * down, pupil: PUPIL.open + (PUPIL.stare - PUPIL.open) * pm, look: elapsed < EYES.stare - EYES.stareRelease }
}

// ---- depth: the colour of the liquid at an eye's depth, and how much of it the eye takes -----------------------------------
// `depth` 0 (surface) .. 1 (floor) in whole steps of the fade table
function fadeStep(depth) { return Math.round(clamp(depth, 0, 1) * (FADE.steps - 1)) }

// ---- C1 gekiga (options.md section C; ichor-eyes-ink-pass.md) ---------------------------------------------------------------
// The gekiga eye is a LIST OF STROKES in the same 100 x 62 box, drawn once into a Canvas (a bake) and never again until its
// inputs change. Every stroke is a filled polygon (flat [x0, y0, x1, y1, ...] in unit coordinates) with a role (the token it is
// drawn with: the host maps a role to a colour) and an opacity; nothing here is a colour. Same seed, same list.
//   { id, layer, role, a, poly, poly2?, clip?, m? }
//   role   paper | ink | irisTint | skin | vein | gleam      (vein: `m` is the mix toward the hot vein colour, 0..1)
//   poly2  a second sub-path wound the other way (a ring: the hole)
//   clip   the stroke is drawn inside `clip` (the opening), which is how the lid covers the iris
// Below GK.minPx the style is not drawn (the host falls back to the ink style: hatch would turn to mud there).
var GK = { minPx: 28, finePx: 56 }
var GS = { shape: 30, pupil: 31, scl: 40, scl2: 41, scl3: 42, lashU: 43, lashL: 44, shadow: 45, crow: 47, bag: 48, brow: 49, fibre: 50,
           coll: 51, limb: 52, spec: 53, cap: 54, lidm: 55, gap: 56, torn: 57, veil: 58, cre: 59, pair: 60, notch: 61 }
var GK_PUPILS = ["pin", "calm", "dilated", "torn", "spiral"]
var GK_RANGE = { aperture: [0.62, 1.18], droop: [0, 5], tilt: [-4, 4], irisR: [9.5, 16.5], lidCover: [0, 0.38], lowerGap: [0, 4], bloodshot: [0, 1] }

function gkPupilState(seed, i) {
  var u = hash(seed, GS.pupil, i)   // spiral is the lore critical state: it is only ever asked for, never rolled
  return u < 0.15 ? "pin" : (u < 0.62 ? "calm" : (u < 0.84 ? "dilated" : "torn"))
}
// The parameters of one eye, rolled from the seed inside the "uneasy" envelope; `over` replaces any of them.
function gekigaParams(seed, over) {
  var p = {
    aperture: hs(seed, GS.shape, 0, GK_RANGE.aperture[0], GK_RANGE.aperture[1]),
    droop: hs(seed, GS.shape, 1, GK_RANGE.droop[0], GK_RANGE.droop[1]),
    tilt: hs(seed, GS.shape, 2, GK_RANGE.tilt[0], GK_RANGE.tilt[1]),
    irisR: hs(seed, GS.shape, 3, GK_RANGE.irisR[0], GK_RANGE.irisR[1]),
    lidCover: hs(seed, GS.shape, 4, GK_RANGE.lidCover[0], GK_RANGE.lidCover[1]),
    lowerGap: hs(seed, GS.shape, 5, GK_RANGE.lowerGap[0], GK_RANGE.lowerGap[1]),
    pupilState: gkPupilState(seed, 0),
    bloodshot: hs(seed, GS.shape, 6, 0, 0.6),
    bulge: 1,          // the lid bulges over the iris; 0 for an eye that moves (no per-gaze rebuild)
    gazeX: 0,          // the iris centre's offset in units (the crest is static, so it is baked in)
    veil: 0            // 0..1: the fraction of the eye (from the inner corner) hidden behind crosshatch darkness
  }
  if (over) for (var k in over) p[k] = over[k]
  return p
}
// The second eye of a pair: never a copy. aperture x 0.85-0.95, droop + 1.5, irisR +- 1.5, and another pupil state most of the time.
function gekigaPair(p, seed) {
  var q = {}, k
  for (k in p) q[k] = p[k]
  q.aperture = clamp(p.aperture * hs(seed, GS.pair, 0, 0.85, 0.95), GK_RANGE.aperture[0], GK_RANGE.aperture[1])
  q.droop = p.droop + 1.5
  q.irisR = clamp(p.irisR + (hash(seed, GS.pair, 1) < 0.5 ? -1.5 : 1.5), GK_RANGE.irisR[0], GK_RANGE.irisR[1])
  if (hash(seed, GS.pair, 2) < 0.6) {
    var at = Math.max(0, GK_PUPILS.indexOf(p.pupilState)), alt = (at + 1 + Math.floor(hash(seed, GS.pair, 3) * 3)) % 4
    q.pupilState = GK_PUPILS[alt]
  }
  return q
}

// the eye's own transform of a point: aperture about y 36, droop of the outer corner, then the tilt of the axis
function gkXf(p) {
  var a = p.tilt * Math.PI / 180, c = Math.cos(a), s = Math.sin(a)
  return function(q) {
    var y = 36 + (q.y - 36) * p.aperture, k = clamp((q.x - 4) / 91, 0, 1)
    y += p.droop * k * k
    var dx = q.x - 50, dy = y - 36
    return pt(50 + dx * c - dy * s, 36 + dx * s + dy * c)
  }
}
function gkIrisX(p) { return IRIS_C.x + p.gazeX }
// the upper lid with its bulge over the iris (outward, up): the opening is never smaller than the plain one
function gkU(t, p) {
  var q = U(t), b = (p.bulge || 0) * 1.4 * Math.exp(-Math.pow((q.x - gkIrisX(p)) / 14, 2))
  return add(q, mul(nU(t), b))
}
function gkTAt(fn, x) {   // t where the (monotone in x) curve reaches x
  var lo = 0, hi = 1
  for (var i = 0; i < 24; i++) { var m = (lo + hi) / 2; if (fn(m).x < x) lo = m; else hi = m }
  return (lo + hi) / 2
}
// the iris: centre, radius, pupil radius. lidCover is the fraction of the iris diameter the upper lid hides; at 0 the iris floats
// (sclera all round: sanpaku) and lowerGap moves it up from the middle.
function gekigaIris(p) {
  var R = p.irisR, ix = gkIrisX(p)
  var uy = gkU(gkTAt(U, ix), p).y, ly = Lr(gkTAt(Lr, ix)).y, free = (ly - uy) - 2 * R, top
  if (p.lidCover > 0.001) top = uy - 2 * R * p.lidCover
  else top = uy + Math.max(0.6, 0.5 * free - 0.5 * p.lowerGap)
  var cy = top + R
  if (cy + R > ly - 0.4) cy = ly - 0.4 - R
  var pr = p.pupilState === "pin" ? 1.4 : (p.pupilState === "dilated" ? 0.78 * R : (p.pupilState === "spiral" ? 1.2 : 0.42 * R))
  if (p.pupilState === "torn") pr = 0.5 * R
  return { x: ix, y: cy, r: R, pupil: pr, state: p.pupilState }
}

function gkSigned(poly, p) {   // signed distance to a polygon of points, positive inside
  var inside = false, best = 1e9, i, j
  for (i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    var a = poly[i], b = poly[j]
    if ((a.y > p.y) !== (b.y > p.y) && p.x < (b.x - a.x) * (p.y - a.y) / (b.y - a.y) + a.x) inside = !inside
    var dx = a.x - b.x, dy = a.y - b.y, l2 = dx * dx + dy * dy
    var t = l2 ? clamp(((p.x - b.x) * dx + (p.y - b.y) * dy) / l2, 0, 1) : 0
    var ex = p.x - b.x - t * dx, ey = p.y - b.y - t * dy
    best = Math.min(best, Math.sqrt(ex * ex + ey * ey))
  }
  return inside ? best : -best
}
// The two distance fields (to the opening, to the ring's edge) are the cost of the bake when asked polygon by polygon, so each is
// sampled once on a 2-unit grid (the first time an eye is baked) and read back by bilinear interpolation. The field
// is 1-Lipschitz, so the interpolation is off by a quarter of a unit at most; a caller that needs `m` asks for m + 0.3.
var GK_FIELDS = null
function gkField(poly, cell) {
  var w = Math.ceil(BOX.w / cell) + 2, h = Math.ceil(BOX.h / cell) + 2, a = new Array(w * h), x, y
  for (y = 0; y < h; y++) for (x = 0; x < w; x++) a[y * w + x] = gkSigned(poly, pt(x * cell, y * cell))
  return { w: w, h: h, c: cell, a: a }
}
function gkRead(f, q) {
  if (q.x < 0 || q.y < 0 || q.x > BOX.w || q.y > BOX.h) return -1
  var gx = q.x / f.c, gy = q.y / f.c, x0 = Math.floor(gx), y0 = Math.floor(gy), fx = gx - x0, fy = gy - y0, i = y0 * f.w + x0
  return (f.a[i] * (1 - fx) + f.a[i + 1] * fx) * (1 - fy) + (f.a[i + f.w] * (1 - fx) + f.a[i + f.w + 1] * fx) * fy
}
function gkFields() {
  if (!GK_FIELDS) GK_FIELDS = { open: gkField(openingPoints(40), 2), ring: gkField(outerPoints(24), 2) }
  return GK_FIELDS
}
function gkOpenOk(q, m) { return gkRead(gkFields().open, q) >= m + 0.3 }
function ringDist(q) { return gkRead(gkFields().ring, q) }

// a filled ribbon along a polyline: flat coordinates, width wf(u)
function ribbonPoly(pts, wf) {
  var n = pts.length, left = [], right = [], out = [], i
  for (i = 0; i < n; i++) {
    var d = unit(sub(pts[Math.min(n - 1, i + 1)], pts[Math.max(0, i - 1)])), h = 0.5 * wf(n > 1 ? i / (n - 1) : 0), nn = perp(d)
    left.push(add(pts[i], mul(nn, h)))
    right.push(sub(pts[i], mul(nn, h)))
  }
  for (i = 0; i < n; i++) out.push(left[i].x, left[i].y)
  for (i = n - 1; i >= 0; i--) out.push(right[i].x, right[i].y)
  return out
}
// the pen: width w, pressure rising over the first e0 of the stroke and falling over the last e1
function penFn(w, e0, e1) { return function(u) { return w * ss01(0, e0, u) * ss01(0, e1, 1 - u) } }
// a ribbon in runs between gaps ([u0, u1] pairs): each run its own polygon, the brush lands heavy after a gap
function ribbonRuns(pts, wf, gaps) {
  var n = pts.length, edges = [0], k, out = []
  for (k = 0; k < gaps.length; k++) { edges.push(gaps[k][0]); edges.push(gaps[k][1]) }
  edges.push(1)
  var at = function(u) { var x = clamp(u, 0, 1) * (n - 1), i = Math.min(n - 2, Math.floor(x)); return lerp(pts[i], pts[i + 1], x - i) }
  for (k = 0; k <= gaps.length; k++) {
    var ua = edges[2 * k], ub = edges[2 * k + 1], m = Math.max(5, Math.round((ub - ua) * (n - 1)) + 1), rp = []
    for (var j = 0; j < m; j++) rp.push(at(ua + (ub - ua) * j / (m - 1)))
    out.push(ribbonPoly(rp, (function(a, b, lead, trail) { return function(v) {
      var u = a + (b - a) * v, w = wf(u)
      if (trail) w *= smoothstep(0, 1, (b - u) / 0.06)
      if (lead) w *= 0.55 + 0.45 * smoothstep(0, 1, (u - a) / 0.04)
      return w
    } })(ua, ub, k > 0, k < gaps.length)))
  }
  return out
}
function circlePts(c, r, n, noise, seed, salt) {
  var out = []
  for (var i = 0; i < n; i++) {
    var a = 2 * Math.PI * i / n, rr = r + (noise ? noise * vloop(seed, salt, i / n, 7) : 0)
    out.push(pt(c.x + Math.cos(a) * rr, c.y + Math.sin(a) * rr))
  }
  return out
}
function flat(pts) { var o = []; for (var i = 0; i < pts.length; i++) o.push(pts[i].x, pts[i].y); return o }
function flatRev(pts) { var o = []; for (var i = pts.length - 1; i >= 0; i--) o.push(pts[i].x, pts[i].y); return o }

// The strokes of one gekiga eye at S px. -> null below GK.minPx, else { clip, strokes, fine, count, iris, xf } in the eye's own units
// (the aperture, droop and tilt are already applied; the host only scales by S / 100 and mirrors).
function gekigaParts(p, S, seed) {
  if (S < GK.minPx) return null
  var fine = S >= GK.finePx, K = fine ? 1 : 0.5
  var xf = gkXf(p), iris = gekigaIris(p), ic = pt(iris.x, iris.y), R = iris.r
  var strokes = [], n
  function put(id, layer, role, a, poly, extra) {
    var s = { id: id, layer: layer, role: role, a: a, poly: poly }
    if (extra) for (var k in extra) s[k] = extra[k]
    strokes.push(s)
  }
  // a hatch stroke along `pts`, with the hairline floor (a thinner line reads fainter, not aliased)
  function hatch(id, layer, role, a, pts, w, extra) {
    var f = strokeFor(w, S, a)
    put(id, layer, role, f.a, ribbonPoly(pts, penFn(f.w, 0.15, 0.25)), extra)
  }
  var openN = 48, op = [], t, i, j, k
  for (i = 0; i < openN; i++) op.push(gkU(i / openN, p))
  for (i = 0; i <= openN; i++) op.push(L(i / openN))
  var inOpen = gkOpenOk
  var contour = function(tt, v) { return lerp(gkU(tt, p), Lr(tt), v) }

  // -- paper: the sclera, one fill ---------------------------------------------------------------------------------------
  put("sclera", "sclera", "paper", 1, flat(op))

  // -- sclera: contour hatch wrapping the globe; three layers, near-solid where they meet in the corners ---------------------
  var nScl = Math.round((220 + 200 * hash(seed, GS.scl, 0)) * K), done = 0, tries = 0
  var windowR = R * 1.12
  while (done < nScl && tries < nScl * 8) {
    tries++
    var r1 = hash(seed, GS.scl, 10 + tries * 3), r2 = hash(seed, GS.scl, 11 + tries * 3), r3 = hash(seed, GS.scl, 12 + tries * 3)
    var inner = hash(seed, GS.scl, 13 + tries * 3) < 0.5
    var tt = Math.pow(r1, 1.7) * 0.5, v = 0.1 + 0.8 * r2
    if (!inner) tt = 1 - tt
    var p0 = contour(tt, v), dI = len(sub(p0, ic))
    if (dI < windowR || r3 > smoothstep(windowR, windowR + R * 2.4, dI) * 0.85 + 0.15) continue
    var sp = hs(seed, GS.scl, 14 + tries * 3, 3, 8), dt = (inner ? 1 : -1) * sp / 95
    var pts = [], ok = true
    for (k = 0; k < 4; k++) {
      var q = contour(clamp(tt + dt * k / 3, 0, 1), v + 0.01 * k * (r3 - 0.5))
      q = add(q, pt(0, 0.25 * vnoise(seed, GS.scl2, (tries + k) / 97, 6)))
      if (!inOpen(q, 0.8) || len(sub(q, ic)) < windowR) { ok = false; break }
      pts.push(q)
    }
    if (!ok) continue
    hatch("scl" + done, "sclera", "ink", 0.5 + 0.4 * (1 - smoothstep(windowR, windowR + R * 3, dI)), pts, hs(seed, GS.scl, 15 + tries * 3, 0.22, 0.5) * (1.4 - 0.5 * smoothstep(0, 1, dI / 40)))
    done++
    // layer 2 crosses at +38 degrees in the corners; layer 3 at -52 in the outer corner only
    var corner = tt < 0.3 || tt > 0.7
    if (corner && hash(seed, GS.scl2, tries) < 0.55) {
      var d2 = rot(unit(sub(pts[3], pts[0])), 38), l2 = hs(seed, GS.scl2, 100 + tries, 2.5, 5)
      var e2 = add(pts[0], mul(d2, l2))
      if (inOpen(e2, 0.8) && len(sub(e2, ic)) > windowR) hatch("sx" + done, "sclera", "ink", 0.6, [pts[0], lerp(pts[0], e2, 0.5), e2], 0.3)
    }
    if (tt > 0.7 && hash(seed, GS.scl3, tries) < 0.45) {
      var d3 = rot(unit(sub(pts[3], pts[0])), -52), l3 = hs(seed, GS.scl3, 100 + tries, 2.5, 5)
      var e3 = add(pts[0], mul(d3, l3))
      if (inOpen(e3, 0.8) && len(sub(e3, ic)) > windowR) hatch("sy" + done, "sclera", "ink", 0.6, [pts[0], lerp(pts[0], e3, 0.5), e3], 0.3)
    }
  }

  // -- capillaries: ink walks from the corners toward the iris (the mix toward the vein colour grows with `bloodshot`) ----------
  var bs = clamp(p.bloodshot, 0, 1), trunks = 2 + Math.round(5 * bs), mVein = 0.25 + 0.6 * bs
  for (i = 0; i < trunks; i++) {
    var outer = i % 2 === 1, root = outer ? pt(91 + hs(seed, GS.cap, i, -2, 1), 35 + hs(seed, GS.cap, 20 + i, -4, 4))
      : pt(8 + hs(seed, GS.cap, i, -1, 2), 38 + hs(seed, GS.cap, 20 + i, -4, 4))
    root = pullInside(root, 1.0)
    var branches = [{ p: root, h: Math.atan2(ic.y - root.y, ic.x - root.x), steps: Math.round(hs(seed, GS.cap, 40 + i, 14, 24)), w: 0.55 }]
    var forks = 2 + Math.floor(hash(seed, GS.cap, 60 + i) * 2)
    for (var b = 0; b < branches.length; b++) {
      var br = branches[b], cur = br.p, hd = br.h, walk = [cur]
      for (j = 0; j < br.steps; j++) {
        hd += (hash(seed, GS.cap, 100 + 97 * i + 13 * b + j) - 0.5) * 2 * 28 * Math.PI / 180 * 0.5
        hd += 0.04 * Math.atan2(ic.y - cur.y, ic.x - cur.x) - 0.04 * hd   // drawn gently toward the iris
        var nx = pt(cur.x + 1.2 * Math.cos(hd), cur.y + 1.2 * Math.sin(hd))
        if (!inOpen(nx, 0.8) || len(sub(nx, ic)) < R * 0.9) break
        walk.push(nx); cur = nx
        if (b === 0 && forks > 0 && j > 3 && j % 5 === 0 && branches.length <= forks) {
          branches.push({ p: cur, h: hd + (hash(seed, GS.cap, 300 + 17 * i + j) < 0.5 ? -1 : 1) * 30 * Math.PI / 180, steps: Math.round(br.steps * 0.45), w: 0.4 })
        }
      }
      if (walk.length > 2) {
        var cw = br.w
        put("cap" + i + "_" + b, "sclera", "vein", 0.9, ribbonPoly(walk, function(u) { return Math.max(0.12, cw * (1 - u) + 0.12 * u) }), { m: mVein })
      }
    }
  }

  // -- the iris: paper tinted, then fibres and a collarette, a heavy limbus, a solid pupil -----------------------------------
  var irisClip = { clip: true }
  put("iris", "iris", "irisTint", 1, flat(circlePts(ic, R, 40, 0, seed, 0)), irisClip)
  var pr = iris.pupil, nF = Math.round(hs(seed, GS.fibre, 0, 70, 110) * K)
  for (i = 0; i < nF; i++) {
    var th = 2 * Math.PI * (i + hash(seed, GS.fibre, 10 + i) * 0.8) / nF
    var r0 = pr + 0.3, r1e = 0.92 * R, runl = (r1e - r0) * hs(seed, GS.fibre, 200 + i, 0.45, 1)
    var wob = (hash(seed, GS.fibre, 400 + i) - 0.5) * 0.06
    var fp = []
    for (k = 0; k <= 3; k++) { var rr = r0 + runl * k / 3, ang = th + wob * k; fp.push(pt(ic.x + Math.cos(ang) * rr, ic.y + Math.sin(ang) * rr)) }
    var fw = strokeFor(hs(seed, GS.fibre, 600 + i, 0.18, 0.55), S, 0.85)
    put("fib" + i, "iris", "ink", fw.a, ribbonPoly(fp, penFn(fw.w, 0.25, 0.5)), irisClip)
  }
  for (i = 0; i < 12; i++) {   // the collarette at 0.55 R, drawn as dashes
    if (hash(seed, GS.coll, i) < 0.35) continue
    var ca = 2 * Math.PI * (i + hash(seed, GS.coll, 20 + i) * 0.5) / 12, span = hs(seed, GS.coll, 40 + i, 12, 24) * Math.PI / 180, cp = []
    for (k = 0; k <= 4; k++) { var cr = 0.55 * R + 0.25 * vnoise(seed, GS.coll, (i * 5 + k) / 61, 8); cp.push(pt(ic.x + Math.cos(ca + span * k / 4) * cr, ic.y + Math.sin(ca + span * k / 4) * cr)) }
    var cw2 = strokeFor(0.5, S, 0.85)
    put("col" + i, "iris", "ink", cw2.a, ribbonPoly(cp, penFn(cw2.w, 0.2, 0.3)), irisClip)
  }
  var lw = hs(seed, GS.limb, 0, 1.6, 2.6), outerR = [], innerR = []
  for (i = 0; i < 48; i++) {
    var la = 2 * Math.PI * i / 48, top = Math.max(0, -Math.sin(la)), wl = lw * (0.8 + 0.55 * top) + 0.35 * vloop(seed, GS.limb, i / 48, 9)
    outerR.push(pt(ic.x + Math.cos(la) * R, ic.y + Math.sin(la) * R))
    innerR.push(pt(ic.x + Math.cos(la) * (R - wl), ic.y + Math.sin(la) * (R - wl)))
  }
  put("limbus", "iris", "ink", 1, flat(outerR), { poly2: flatRev(innerR), clip: true })
  // the pupil
  if (iris.state === "torn") {
    var tp = [], notches = [hs(seed, GS.torn, 0, 0, 2.1), hs(seed, GS.torn, 1, 2.1, 4.2), hs(seed, GS.torn, 2, 4.2, 6.2)]
    for (i = 0; i < 36; i++) {
      var ta = 2 * Math.PI * i / 36, depth = 0
      for (k = 0; k < 3; k++) { var da = Math.abs(Math.atan2(Math.sin(ta - notches[k]), Math.cos(ta - notches[k]))); depth = Math.max(depth, 0.5 * Math.max(0, 1 - da / 0.28)) }
      var rr2 = pr * (1 + 0.1 * vloop(seed, GS.torn, i / 36, 6)) * (1 - depth)
      tp.push(pt(ic.x + Math.cos(ta) * rr2, ic.y + Math.sin(ta) * rr2))
    }
    put("pupil", "iris", "ink", 1, flat(tp), irisClip)
  } else if (iris.state === "spiral") {
    put("pupil", "iris", "ink", 1, flat(circlePts(ic, 1.2, 12, 0, seed, 0)), irisClip)
    var sp2 = [], turns = 2.25, steps = Math.round(turns * 360 / 14), st = hs(seed, GS.pupil, 90, 0, 6.28)
    for (i = 0; i <= steps; i++) { var u = i / steps, th2 = st + turns * 2 * Math.PI * u, rs = 1.2 + (0.8 * R - 1.2) * u; sp2.push(pt(ic.x + Math.cos(th2) * rs, ic.y + Math.sin(th2) * rs)) }
    put("spiral", "iris", "ink", 1, ribbonPoly(sp2, penFn(1.1, 0.05, 0.2)), irisClip)
  } else {
    put("pupil", "iris", "ink", 1, flat(circlePts(ic, pr, 28, pr * 0.03, seed, GS.pupil)), irisClip)
  }

  // -- the lid's cast shadow: dense hatch under the lash line, over the iris top ------------------------------------------------
  var depthD = Math.min(14, 2.5 + 9 / p.aperture), nSh = Math.round(hs(seed, GS.shadow, 0, 60, 110) * K)
  for (i = 0, tries = 0; i < nSh && tries < nSh * 6; tries++) {
    var st2 = 0.04 + 0.92 * hash(seed, GS.shadow, 10 + tries * 3), off = 0.7 + depthD * Math.pow(hash(seed, GS.shadow, 11 + tries * 3), 1.6)
    var ln2 = hs(seed, GS.shadow, 12 + tries * 3, 3, 9) / 95, sp3 = []
    var okS = true
    for (k = 0; k < 4; k++) {
      var q2 = add(gkU(clamp(st2 + ln2 * k / 3, 0, 1), p), pt(0, off))
      if (!inOpen(q2, 0.5)) { okS = false; break }
      sp3.push(q2)
    }
    if (!okS) continue
    hatch("sh" + i, "shadow", "ink", 0.95 - 0.65 * off / depthD, sp3, hs(seed, GS.shadow, 13 + tries * 3, 0.35, 0.8), { clip: true })
    i++
  }

  // -- lids ---------------------------------------------------------------------------------------------------------------------
  var UP = []
  for (i = 0; i <= 28; i++) UP.push(gkU(i / 28, p))
  put("lash", "lid", "ink", 1, ribbonPoly(UP, function(u) { return lidW(u) * 1.25 * ss01(0, 0.02, u) * (0.35 + 0.65 * ss01(0, 0.18, 1 - u)) }))
  put("flick", "lid", "ink", 1, ribbonPoly([UP[28], add(UP[28], pt(2.6, -1.1)), add(UP[28], pt(5.2, -2.6))], penFn(1.0, 0.01, 0.9)))
  var mpts = [], mo = hs(seed, GS.lidm, 0, 1.0, 1.6)
  for (i = 0; i <= 24; i++) mpts.push(add(gkU(0.04 + 0.92 * i / 24, p), mul(nU(0.04 + 0.92 * i / 24), mo)))
  var mg = [gapAt(seed, 0, 0.22, 0.4, 3, 6, 95), gapAt(seed, 1, 0.6, 0.85, 3, 6, 95)]
  var mruns = ribbonRuns(mpts, penFn(hs(seed, GS.lidm, 1, 0.5, 0.9), 0.2, 0.25), mg)
  for (i = 0; i < mruns.length; i++) put("lm" + i, "lid", "ink", 0.9, mruns[i])
  var LO = [], WL = [], RIM = []
  for (i = 0; i <= 24; i++) {
    var tl = i / 24, lb = L(tl), nl = nL(tl)
    LO.push(lb)
    WL.push(sub(lb, mul(nl, hs(seed, GS.lidm, 10, 0.9, 1.3))))
    RIM.push(sub(lb, mul(nl, hs(seed, GS.lidm, 11, 2.0, 2.5))))
  }
  put("lower", "lid", "ink", 1, ribbonPoly(LO, function(u) { return 1.3 * (1 - 0.85 * u) * ss01(0, 0.05, u) }))
  put("water", "lid", "paper", 1, ribbonPoly(WL.slice(2, 23), penFn(1.0, 0.25, 0.25)))
  var rruns = ribbonRuns(RIM, penFn(0.45, 0.2, 0.2), [gapAt(seed, 2, 0.25, 0.4, 4, 8, 95), gapAt(seed, 3, 0.6, 0.8, 4, 8, 95)])
  for (i = 0; i < rruns.length; i++) put("rim" + i, "lid", "ink", 0.85, rruns[i])

  // -- lashes -------------------------------------------------------------------------------------------------------------------
  function lash(id, root, dir, length, curlDeg, w0, a) {
    var pts = [root], d = dir, stp = 6
    for (var q = 1; q <= stp; q++) { d = turnToO(d, curlDeg / stp); pts.push(add(pts[q - 1], mul(d, length / stp))) }
    put(id, "lash", "ink", a, ribbonPoly(pts, function(u) { return w0 * (1 - u) * ss01(0, 0.04, u) }))
  }
  for (i = 0; i < 4; i++) {
    var tc = 0.3 + 0.17 * i + hs(seed, GS.lashU, i, -0.03, 0.03), hairs = 2 + Math.floor(hash(seed, GS.lashU, 10 + i) * 3)
    for (j = 0; j < hairs; j++) {
      var tj = clamp(tc + (j - hairs / 2) * 0.014, 0.29, 0.99), dir = turnToO(nU(tj), hs(seed, GS.lashU, 20 + i * 5 + j, 10, 26))
      var cl = hs(seed, GS.lashU, 40 + i * 5 + j, 18, 34)
      if (hash(seed, GS.lashU, 60 + i * 5 + j) < 0.15) cl = -cl * 0.8     // 15 % cross a neighbour: they curl back
      lash("lu" + i + "_" + j, gkU(tj, p), dir, hs(seed, GS.lashU, 80 + i * 5 + j, 6, 13), cl, 0.9, 0.95)
    }
  }
  var nLow = 5 + Math.floor(hash(seed, GS.lashL, 0) * 3)
  for (i = 0; i < nLow; i++) {
    if (hash(seed, GS.lashL, 10 + i) < 0.3) continue
    var tl2 = 0.2 + 0.65 * (i + 0.5) / nLow, dl = rot(pt(0, 1), (tl2 - 0.5) * 36 + hs(seed, GS.lashL, 20 + i, -5, 5))
    lash("ll" + i, L(1 - tl2), dl, hs(seed, GS.lashL, 30 + i, 1.8, 3.6), hs(seed, GS.lashL, 40 + i, -4, 4), 0.55, 0.85)
  }

  // -- skin: crease, crow's feet, the bag, the brow-bone shadow (it fades to nothing at the ring's edge) ---------------------------
  function skinA(q, a) { return a * smoothstep(0, 6, ringDist(q)) }
  var CRE = sample(function(u) { return bez3(CREASE[0], CREASE[1], CREASE[2], CREASE[3], u) }, 20), CRE2 = []
  for (i = 0; i < CRE.length; i++) CRE2.push(add(CRE[i], pt(0, -2.5)))
  put("crease", "skin", "ink", 0.9, ribbonPoly(CRE, inkProfile({ w: 1.3, e0: 0.25, e1: 0.3 })))
  var c2 = ribbonRuns(CRE2.slice(2, 19), penFn(0.6, 0.2, 0.2), [gapAt(seed, 4, 0.2, 0.4, 3, 6, 70), gapAt(seed, 5, 0.6, 0.8, 3, 6, 70)])
  for (i = 0; i < c2.length; i++) put("cr2_" + i, "skin", "ink", 0.7, c2[i])
  var nCrow = 2 + Math.floor(hash(seed, GS.crow, 0) * 3)
  for (i = 0, tries = 0; i < nCrow && tries < 30; tries++) {
    var ang = hs(seed, GS.crow, 10 + tries, -50, 50), dirc = rot(pt(1, 0), ang), r00 = hs(seed, GS.crow, 40 + tries, 3, 5)
    var s0 = add(O, mul(dirc, r00)), ln3 = hs(seed, GS.crow, 70 + tries, 4, 9), e = add(s0, mul(rot(dirc, hs(seed, GS.crow, 90 + tries, -8, 8)), ln3))
    if (gkRead(gkFields().open, s0) > -1 || ringDist(e) < 0.8 || ringDist(s0) < 0.8) continue
    put("crow" + i, "skin", "ink", 0.75, ribbonPoly([s0, lerp(s0, e, 0.5), e], penFn(0.5, 0.15, 0.7)))
    i++
  }
  var BAG1 = [], BAG2 = []
  for (i = 0; i <= 14; i++) { var tb = 0.2 + 0.6 * i / 14; BAG1.push(add(Lr(tb), pt(0, 3.5))); BAG2.push(add(Lr(tb), pt(0, 5.7))) }
  put("bag1", "skin", "ink", 0.8, ribbonPoly(BAG1, penFn(0.7, 0.3, 0.3)))
  put("bag2", "skin", "ink", 0.6, ribbonPoly(BAG2, penFn(0.5, 0.3, 0.3)))
  var nBag = Math.round(hs(seed, GS.bag, 0, 22, 40) * K)
  for (i = 0, tries = 0; i < nBag && tries < nBag * 4; tries++) {
    var tb2 = 0.22 + 0.56 * hash(seed, GS.bag, 10 + tries), b0 = add(Lr(tb2), pt(0, 3.6 + 0.2 * hash(seed, GS.bag, 500 + tries)))
    var b1 = add(Lr(clamp(tb2 + hs(seed, GS.bag, 700 + tries, 0.005, 0.02), 0, 1)), pt(0, 5.5))
    if (ringDist(b0) < 0.8 || ringDist(b1) < 0.8) continue
    hatch("bg" + i, "skin", "ink", skinA(b0, 0.65), [b0, lerp(b0, b1, 0.5), b1], 0.3)
    i++
  }
  var nBrow = Math.round(hs(seed, GS.brow, 0, 60, 120) * K)
  for (i = 0, tries = 0; i < nBrow && tries < nBrow * 6; tries++) {
    var cb = bez3(CREASE[0], CREASE[1], CREASE[2], CREASE[3], 0.05 + 0.9 * hash(seed, GS.brow, 10 + tries))
    var up = hs(seed, GS.brow, 11 + tries, 1, 10), bp = add(cb, pt(0, -up))
    var cross = hash(seed, GS.brow, 12 + tries) < 0.5, dd = rot(pt(1, 0), cross ? -45 : 35 + hs(seed, GS.brow, 13 + tries, -6, 6))
    var be = add(bp, mul(dd, hs(seed, GS.brow, 14 + tries, 3, 6)))
    if (ringDist(bp) < 1 || ringDist(be) < 1 || gkRead(gkFields().open, bp) > -0.5 || gkRead(gkFields().open, be) > -0.5) continue
    hatch("br" + i, "skin", "ink", skinA(bp, 0.8 * (1 - up / 11)), [bp, lerp(bp, be, 0.5), be], 0.35)
    i++
  }

  // -- the specular, last: one hard blob on the pupil edge at the upper left, a pinpoint, a wet streak on the lower waterline --------
  var sa = 35 * Math.PI / 180, br2 = hs(seed, GS.spec, 0, 2.2, 3.4), ov = hs(seed, GS.spec, 1, 0.3, 0.6)
  var sd = Math.max(pr + br2 * (1 - 2 * ov), br2 * 0.4), sc = pt(ic.x - Math.sin(sa) * sd, ic.y - Math.cos(sa) * sd), nb = 7 + Math.floor(hash(seed, GS.spec, 2) * 3)
  var blob = []
  for (i = 0; i < nb; i++) { var ba = 2 * Math.PI * i / nb, brr = br2 * (0.8 + 0.4 * hash(seed, GS.spec, 10 + i)); blob.push(pt(sc.x + Math.cos(ba) * brr, sc.y + Math.sin(ba) * brr)) }
  put("spec", "spec", "gleam", 1, flat(blob), irisClip)
  var pin = pt(ic.x + R * 0.32, ic.y + R * 0.38)
  put("pin", "spec", "gleam", 1, flat(circlePts(pin, hs(seed, GS.spec, 30, 0.5, 0.8), 8, 0, seed, 0)), irisClip)
  var streak = []
  for (i = 0; i <= 8; i++) { var tw = 0.3 + 0.3 * i / 8; streak.push(sub(L(1 - tw), mul(nL(1 - tw), 0.2))) }
  put("wet", "spec", "gleam", 0.9, ribbonPoly(streak, penFn(0.35, 0.3, 0.4)))

  // -- the veil: crosshatch darkness over the inner part of a hidden eye ------------------------------------------------------------
  if (p.veil > 0) {
    var edge = 100 * clamp(p.veil, 0, 1), nVeil = Math.round(420 * clamp(p.veil, 0, 1) * K)
    for (i = 0, tries = 0; i < nVeil && tries < nVeil * 4; tries++) {
      var vx = edge * Math.pow(hash(seed, GS.veil, 10 + tries * 3), 0.8), vy = 62 * hash(seed, GS.veil, 11 + tries * 3)
      var vp = pt(vx, vy), fam = i % 3, vd = rot(pt(1, 0), fam === 0 ? 28 : (fam === 1 ? -42 : 76)), ve = add(vp, mul(vd, hs(seed, GS.veil, 12 + tries * 3, 4, 8)))
      var rd = Math.min(ringDist(vp), ringDist(ve))
      if (rd < 0.8) continue
      hatch("vl" + i, "veil", "ink", Math.min(1, 1.05 * (1 - vx / edge) * smoothstep(0, 5, rd)), [vp, lerp(vp, ve, 0.5), ve], 0.55)
      i++
    }
  }

  // -- through the eye's transform ---------------------------------------------------------------------------------------------------
  var apply = function(a) {
    var o = new Array(a.length)
    for (var z = 0; z < a.length; z += 2) { var m = xf(pt(a[z], a[z + 1])); o[z] = Math.round(m.x * 100) / 100; o[z + 1] = Math.round(m.y * 100) / 100 }
    return o
  }
  for (i = 0; i < strokes.length; i++) {
    strokes[i].poly = apply(strokes[i].poly)
    if (strokes[i].poly2) strokes[i].poly2 = apply(strokes[i].poly2)
  }
  return { clip: apply(flat(op)), ring: flat(outerPoints(24)), strokes: strokes, fine: fine, count: strokes.length, iris: iris, xf: xf }
}

if (typeof module !== "undefined") module.exports = {
  IRIS_R: IRIS_R, INK_FINE: INK_FINE,
  BOX: BOX, IRIS_C: IRIS_C, GAZE: GAZE, PUPIL: PUPIL, HAIRLINE: HAIRLINE, LEVELS: LEVELS, EYE_INK: EYE_INK, FADE: FADE,
  SLOTS: SLOTS, VEINS: VEINS, HOT_VEINS: HOT_VEINS, CARUNCLE: CARUNCLE, SPIRAL: SPIRAL, I: I, O: O, SALT: SALT,
  U: U, L: L, Lr: Lr, nU: nU, nL: nL, lidW: lidW, lidEdge: lidEdge, lidEdges: lidEdges,
  openingPath: openingPath, ringOuterPath: ringOuterPath, outerPoints: outerPoints, openingPoints: openingPoints,
  veinPoints: veinPoints, veinNetwork: veinNetwork, spiralPoints: spiralPoints, pupilOutline: pupilOutline, windowPanes: windowPanes,
  hash: hash, hs: hs, vnoise: vnoise, vloop: vloop, inkProfile: inkProfile, ribbonGapped: ribbonGapped, ribbonPath: ribbonPath, openDist: openDist,
  detailFor: detailFor, strokeFor: strokeFor, staticParts: staticParts, irisParts: irisParts, lidShape: lidShape,
  quantBlink: quantBlink, EYES: EYES, blinkShape: blinkShape, blinkStart: blinkStart, blinkAt: blinkAt, blinkingAt: blinkingAt, BLINK_LEN: BLINK_LEN,
  clampGaze: clampGaze, gazeStep: gazeStep, idleGaze: idleGaze, gazeToward: gazeToward, stareState: stareState, fadeStep: fadeStep, lidGeometry: lidGeometry, lowerLashCount: 4, fadeFor: fadeFor, lashSpec: lashSpec,
  GK: GK, GK_PUPILS: GK_PUPILS, GK_RANGE: GK_RANGE, gekigaParams: gekigaParams, gekigaPair: gekigaPair, gekigaIris: gekigaIris, gekigaParts: gekigaParts, gkXf: gkXf, gkU: gkU
}
