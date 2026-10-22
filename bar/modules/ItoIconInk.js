.pragma library
.import "ItoChart.js" as Chart

// Manga icons (icons-v2.md): every functional bar icon drawn as a small object found in a ruined place, inked by hand,
// with one wrong thing in it. Pure and seeded: iconParts() returns filled polygons in a 48-unit grid with a colour ROLE
// each (no colour is written here; roles() turns the shell's tokens into role colours by contrast, never by name).
//
//   iconParts(kind, state, sizePx, seed, opts) -> {
//     kind, master S|M|L, tier 0|1|2, size, k (grid units per device px),
//     parts:     [{ role, layer: under|level|over, polys: [[x,y,...]], clip: [x,y,...]|null, tag }]   painted in order
//     highlight: { role: "paper", polys }                    the one hard highlight (its own overlay, so hover can move it)
//     silhouette: [[x,y,...]]  levelPath: [x,y,...]|null      the outline (coverage, the level clip of ItoFillArt)
//     keyline:   { x, y, w, h, shape }                        the keyline box of §3.1
//     families:  [{ name, spacingPx, lines }]                 hatch families kept after the anti-mud rule
//     pens:      { thinPx, thickPx }                          the contour's G-pen in device px
//   }
// Roles: line (contour, hatch), mass (the solid ink: levels, voids drawn as ink), void (cut back to the ground), paper
// (the highlight), blood (meniscus stain, one bead), warn (critical only). Light from the upper left, shadow lower right.
//
// Pilot kinds (§7 M0): disk, cpu, mem, battery, network, notifications.

var GRID = 48
var MUD_PX = 2.0
var SHADOW = { x: Math.SQRT1_2, y: Math.SQRT1_2 }     // the shadow side faces lower right
var PEN = { S: { thin: 1.6, thick: 2.4, maru: 0 }, M: { thin: 1.2, thick: 3.0, maru: 1.0 }, L: { thin: 1.0, thick: 4.0, maru: 0.9 } }
var CAP = [6, 40, 160]                                // paths at T0, strokes at T1 and T2
var KINDS = ["disk", "cpu", "mem", "battery", "network", "notifications"]
var STATES = {
  disk: [{ value: 0 }, { value: 0.25 }, { value: 0.5 }, { value: 0.8 }, { value: 0.95, hot: true }, { error: true }],
  cpu: [{ value: 0.1 }, { value: 0.5 }, { value: 0.8 }, { value: 0.95 }],
  mem: [{ value: 0.1 }, { value: 0.5 }, { value: 0.8 }, { value: 1 }],
  battery: [{ level: 0 }, { level: 1 }, { level: 2 }, { level: 3 }, { level: 4 }, { level: 2, charging: true }, { level: 0, critical: true }],
  network: [{ band: 0 }, { band: 1 }, { band: 2 }, { band: 3 }, { off: true }, { wired: true }],
  notifications: [{ face: "idle" }, { face: "active" }, { face: "ring" }, { face: "error" }, { face: "muted" }, { face: "dnd" }, { face: "critical" }]
}
// the state each kind is judged on for the mass share and coverage (the datum half way, the icon at rest)
var NOMINAL = { disk: { value: 0.5 }, cpu: { value: 0.5 }, mem: { value: 0.5 }, battery: { level: 2 }, network: { band: 2 }, notifications: { face: "idle" } }

function clamp(v, lo, hi) { return v < lo ? lo : (v > hi ? hi : v) }
function lerp(a, b, t) { return a + (b - a) * t }

// ---------------------------------------------------------------------------------------------------- seeds
function rng(seed) {
  var a = seed >>> 0
  return function() {
    a = (a + 0x6D2B79F5) | 0
    var t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
function hash(s) {
  var h = 2166136261
  for (var i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) }
  return h >>> 0
}

// ---------------------------------------------------------------------------------------------------- tiers
// S <= 20 px, M 21-35, L >= 36; `prev` adds a 2 px hysteresis so a resize does not flip a tier back and forth.
function masterFor(px, prev) {
  var lo = 20, hi = 35
  if (prev === "S") lo += 2
  if (prev === "M") { lo -= 2; hi += 2 }
  if (prev === "L") hi -= 2
  return px <= lo ? "S" : (px <= hi ? "M" : "L")
}
function tierOf(master) { return master === "S" ? 0 : (master === "M" ? 1 : 2) }

// ---------------------------------------------------------------------------------------------------- geometry
function P(x, y) { return { x: x, y: y } }
function xform(pts, deg, cx, cy, dx, dy) {
  var a = deg * Math.PI / 180, c = Math.cos(a), s = Math.sin(a), out = []
  for (var i = 0; i < pts.length; i++) {
    var x = pts[i].x, y = pts[i].y
    out.push(P(cx + dx + x * c - y * s, cy + dy + x * s + y * c))
  }
  return out
}
function shift(pts, dx, dy) { var o = []; for (var i = 0; i < pts.length; i++) o.push(P(pts[i].x + dx, pts[i].y + dy)); return o }
function flat(pts) { var o = []; for (var i = 0; i < pts.length; i++) o.push(+pts[i].x.toFixed(3), +pts[i].y.toFixed(3)); return o }
function bbox(pts) {
  var b = { x0: 1e9, y0: 1e9, x1: -1e9, y1: -1e9 }
  for (var i = 0; i < pts.length; i++) {
    b.x0 = Math.min(b.x0, pts[i].x); b.y0 = Math.min(b.y0, pts[i].y); b.x1 = Math.max(b.x1, pts[i].x); b.y1 = Math.max(b.y1, pts[i].y)
  }
  return b
}
function centroid(pts) { var x = 0, y = 0; for (var i = 0; i < pts.length; i++) { x += pts[i].x; y += pts[i].y } return P(x / pts.length, y / pts.length) }
function inside(pts, x, y) {
  var c = false
  for (var i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    var a = pts[i], b = pts[j]
    if ((a.y > y) !== (b.y > y) && x < (b.x - a.x) * (y - a.y) / (b.y - a.y) + a.x) c = !c
  }
  return c
}
// A closed outline resampled every `step` units (so the pen's weight can change smoothly along it).
function resample(pts, step, closed) {
  var out = [], n = pts.length, last = closed ? n : n - 1
  for (var i = 0; i < last; i++) {
    var a = pts[i], b = pts[(i + 1) % n]
    var d = Math.hypot(b.x - a.x, b.y - a.y), m = Math.max(1, Math.ceil(d / step))
    for (var j = 0; j < m; j++) out.push(P(a.x + (b.x - a.x) * j / m, a.y + (b.y - a.y) * j / m))
  }
  if (!closed) out.push(P(pts[n - 1].x, pts[n - 1].y))
  return out
}
function normals(pts, closed) {
  var n = pts.length, out = []
  for (var i = 0; i < n; i++) {
    var a = pts[closed ? (i - 1 + n) % n : Math.max(0, i - 1)], b = pts[closed ? (i + 1) % n : Math.min(n - 1, i + 1)]
    var tx = b.x - a.x, ty = b.y - a.y, l = Math.hypot(tx, ty) || 1
    out.push(P(ty / l, -tx / l))
  }
  if (closed) {          // point them outward
    var c = centroid(pts), s = 0
    for (var k = 0; k < n; k++) s += out[k].x * (pts[k].x - c.x) + out[k].y * (pts[k].y - c.y)
    if (s < 0) for (var q = 0; q < n; q++) out[q] = P(-out[q].x, -out[q].y)
  }
  return out
}
// A hand's tremor: a slow random drift along the normal (seeded), `amp` units at most.
function wobble(pts, rand, amp, closed) {
  var nn = normals(pts, closed), out = [], d = 0
  for (var i = 0; i < pts.length; i++) {
    d = d * 0.82 + (rand() - 0.5) * amp * 0.6
    out.push(P(pts[i].x + nn[i].x * d, pts[i].y + nn[i].y * d))
  }
  return out
}
function ellipse(cx, cy, rx, ry, n, a0, a1) {
  var out = [], from = a0 === undefined ? 0 : a0, to = a1 === undefined ? Math.PI * 2 : a1
  var closed = a1 === undefined
  for (var i = 0; i < n + (closed ? 0 : 1); i++) {
    var a = from + (to - from) * i / n
    out.push(P(cx + Math.cos(a) * rx, cy + Math.sin(a) * ry))
  }
  return out
}
// A rough blob (a bead, a rivet, a head): `n` points with a seeded radius.
function blob(cx, cy, r, rand, n, rough) {
  var out = [], m = n || 9, j = rough === undefined ? 0.22 : rough
  for (var i = 0; i < m; i++) {
    var a = i / m * Math.PI * 2, rr = r * (1 - j / 2 + rand() * j)
    out.push(P(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr))
  }
  return out
}
// Sutherland-Hodgman against one half-plane: keeps y >= y0 (the part of a hole under a level). Works on concave outlines.
function clipBelow(pts, y0) {
  var out = []
  for (var i = 0; i < pts.length; i++) {
    var a = pts[i], b = pts[(i + 1) % pts.length], ia = a.y >= y0, ib = b.y >= y0
    if (ia) out.push(a)
    if (ia !== ib) { var t = (y0 - a.y) / (b.y - a.y); out.push(P(a.x + (b.x - a.x) * t, y0)) }
  }
  return out
}
function clipAbove(pts, y0) {
  var out = []
  for (var i = 0; i < pts.length; i++) {
    var a = pts[i], b = pts[(i + 1) % pts.length], ia = a.y <= y0, ib = b.y <= y0
    if (ia) out.push(a)
    if (ia !== ib) { var t = (y0 - a.y) / (b.y - a.y); out.push(P(a.x + (b.x - a.x) * t, y0)) }
  }
  return out
}
// The strip of an outline between two heights (a level's stain at T0, where nothing may be clipped).
function bandOf(pts, y0, y1) { return clipAbove(clipBelow(pts, y0), y1) }
function signedArea(p) {
  var s = 0, n = p.length / 2
  for (var i = 0, j = n - 1; i < n; j = i++) s += (p[2 * j] - p[2 * i]) * (p[2 * j + 1] + p[2 * i + 1])
  return s / 2
}
// every polygon wound the same way, so several in one path fill as a union under the nonzero rule
function orient(p) {
  if (signedArea(p) >= 0) return p
  var o = []
  for (var i = p.length - 2; i >= 0; i -= 2) o.push(p[i], p[i + 1])
  return o
}
function hull(pts) {
  var p = pts.slice().sort(function(a, b) { return a.x - b.x || a.y - b.y })
  function cr(o, a, b) { return (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x) }
  var lo = [], up = []
  for (var i = 0; i < p.length; i++) { while (lo.length >= 2 && cr(lo[lo.length - 2], lo[lo.length - 1], p[i]) <= 0) lo.pop(); lo.push(p[i]) }
  for (var j = p.length - 1; j >= 0; j--) { while (up.length >= 2 && cr(up[up.length - 2], up[up.length - 1], p[j]) <= 0) up.pop(); up.push(p[j]) }
  up.pop(); lo.pop()
  return lo.concat(up)
}
function polyArea(pts) {
  var s = 0
  for (var i = 0, j = pts.length - 1; i < pts.length; j = i++) s += (pts[j].x + pts[i].x) * (pts[j].y - pts[i].y)
  return Math.abs(s / 2)
}

// ---------------------------------------------------------------------------------------------------- pens
// An open stroke as a filled ribbon: `w` units wide in the middle, tapered at both ends (a maru or brush line).
function ribbon(pts, w, opts) {
  var o = opts || {}, n = pts.length
  if (n < 2) return []
  var nn = normals(pts, false), L = [], R = [], bias = o.bias === undefined ? 0.5 : o.bias
  var len = 0, acc = [0]
  for (var i = 1; i < n; i++) { len += Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y); acc.push(len) }
  for (var j = 0; j < n; j++) {
    var t = len > 0 ? acc[j] / len : 0
    var taper = o.taper === false ? 1 : Math.pow(Math.max(0.12, Math.sin(Math.PI * clamp(t, 0, 1))), o.taperPow || 0.45)
    var ww = (typeof w === "function" ? w(t, j) : w) * taper
    L.push(P(pts[j].x + nn[j].x * ww * bias, pts[j].y + nn[j].y * ww * bias))
    R.push(P(pts[j].x - nn[j].x * ww * (1 - bias), pts[j].y - nn[j].y * ww * (1 - bias)))
  }
  return flat(L.concat(R.reverse()))
}

// The G-pen contour of a closed outline: heavy where it faces the shadow (lower right), thin and broken where it faces
// the light. `gaps` lit-side breaks (dry brush: the line frays to nothing), one overshoot tail at a break. `cavity`
// inverts the light (a hole's rim is heavy on its upper-left wall, where the cast shadow is). `twoWidths` quantises the
// weight to thin/thick (T0). Returns { polys, gaps } with polys as flat arrays.
function contour(outline, o) {
  var pts = resample(outline, 1.1, true), n = pts.length
  var nn = normals(pts, true), sgn = o.cavity ? -1 : 1, w = []
  for (var i = 0; i < n; i++) {
    var s = sgn * (nn[i].x * SHADOW.x + nn[i].y * SHADOW.y)
    var t = clamp((s + 0.3) / 1.3, 0, 1)
    t = t * t * (3 - 2 * t)
    if (o.twoWidths) t = t > 0.45 ? 1 : 0
    w.push(lerp(o.thin, o.thick, t))
  }
  // lit-side break candidates: the outline faces the light there
  var cand = []
  for (var c = 0; c < n; c++) {
    if (-sgn * (nn[c].x * SHADOW.x + nn[c].y * SHADOW.y) <= (o.litMin === undefined ? 0.45 : o.litMin)) continue
    // a break only where the outline runs straight (at a sharp turn the two ends would touch again)
    var a3 = nn[(c - 3 + n) % n], b3 = nn[(c + 3) % n]
    if (o.below !== undefined && pts[c].y < o.below) continue
    if (a3.x * b3.x + a3.y * b3.y > 0.85) cand.push(c)
  }
  if (cand.length === 0) for (var c2 = 0; c2 < n; c2++) if (-sgn * (nn[c2].x * SHADOW.x + nn[c2].y * SHADOW.y) > 0.2) cand.push(c2)
  var gaps = []
  var want = o.gaps === undefined ? 1 : o.gaps
  var gapPts = Math.max(1, Math.round((o.gapLen || 2.2) / 1.1))
  for (var g = 0; g < want && cand.length > 0; g++) {
    var pick = -1
    for (var tries = 0; tries < 12; tries++) {
      var at = cand[Math.floor(o.rand() * cand.length)], ok = true
      for (var q = 0; q < gaps.length; q++) { var dd = Math.abs(at - gaps[q]); if (Math.min(dd, n - dd) < gapPts * 4) ok = false }
      if (ok) { pick = at; break }
    }
    if (pick >= 0) gaps.push(pick)
  }
  var cut = []
  for (var z = 0; z < n; z++) cut.push(false)
  for (var gi = 0; gi < gaps.length; gi++) for (var m = -Math.floor(gapPts / 2); m <= Math.ceil(gapPts / 2); m++) cut[(gaps[gi] + m + n) % n] = true
  // walk the loop starting just after a break
  var start = 0
  for (var s0 = 0; s0 < n; s0++) if (cut[s0] && !cut[(s0 + 1) % n]) { start = (s0 + 1) % n; break }
  var polys = [], span = [], spanW = [], tailDone = false
  function flush() {
    if (span.length >= 3) {
      if (!tailDone && o.tail !== false && gaps.length > 0) {   // the overshoot tail where the pen came back to the join
        var a = span[span.length - 2], b = span[span.length - 1], l = Math.hypot(b.x - a.x, b.y - a.y) || 1
        var ext = o.tailLen || 1.6
        var tp = P(b.x + (b.x - a.x) / l * ext, b.y + (b.y - a.y) / l * ext); tp.nx = b.nx; tp.ny = b.ny
        span.push(tp); spanW.push(spanW[spanW.length - 1] * 0.5)
        tailDone = true
      }
      var ww = spanW.slice()
      var fray = Math.min(3, Math.floor(span.length / 3))
      for (var f = 0; f < fray; f++) {                            // dry brush at the ends: frays toward the break
        var k = (f + 1) / (fray + 1)
        ww[f] *= lerp(0.25, 1, k); ww[ww.length - 1 - f] *= lerp(0.35, 1, k)
      }
      var nl = normals(span, false), L = [], R = [], bias = o.bias === undefined ? 0.62 : o.bias
      var side = o.cavity ? -1 : 1
      for (var e = 0; e < span.length; e++) {
        // outward is the outline's own normal (open-span normals can flip): reuse the loop's
        L.push(P(span[e].x + span[e].nx * ww[e] * bias, span[e].y + span[e].ny * ww[e] * bias))
        R.push(P(span[e].x - span[e].nx * ww[e] * (1 - bias), span[e].y - span[e].ny * ww[e] * (1 - bias)))
      }
      void nl; void side
      polys.push(flat(L.concat(R.reverse())))
    }
    span = []; spanW = []
  }
  for (var step = 0; step < n; step++) {
    var idx = (start + step) % n
    if (cut[idx]) { flush(); continue }
    var p = P(pts[idx].x, pts[idx].y); p.nx = nn[idx].x; p.ny = nn[idx].y
    // the tail point inherits the last normal
    span.push(p); spanW.push(w[idx])
  }
  if (gaps.length === 0) {                                        // closed: a band (outer loop, inner loop reversed)
    var Lc = [], Rc = []
    var b2 = o.bias === undefined ? 0.62 : o.bias
    for (var e2 = 0; e2 < n; e2++) {
      Lc.push(P(pts[e2].x + nn[e2].x * w[e2] * b2, pts[e2].y + nn[e2].y * w[e2] * b2))
      Rc.push(P(pts[e2].x - nn[e2].x * w[e2] * (1 - b2), pts[e2].y - nn[e2].y * w[e2] * (1 - b2)))
    }
    return { polys: [flat(Lc), flat(Rc.reverse())], gaps: 0 }
  }
  flush()
  for (var t2 = 0; t2 < polys.length; t2++) void t2
  return { polys: polys, gaps: gaps.length }
}

// Where the line p0 + t*d is inside every `inc` outline and outside every `exc` outline: [[t0, t1], ...].
function hits(p0, d, poly) {
  var ts = []
  for (var i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    var a = poly[j], b = poly[i], ex = b.x - a.x, ey = b.y - a.y
    var den = d.x * ey - d.y * ex
    if (Math.abs(den) < 1e-9) continue
    var t = ((a.x - p0.x) * ey - (a.y - p0.y) * ex) / den
    var u = ((a.x - p0.x) * d.y - (a.y - p0.y) * d.x) / den
    if (u >= 0 && u < 1) ts.push(t)
  }
  ts.sort(function(x, y) { return x - y })
  var out = []
  for (var k = 0; k + 1 < ts.length; k += 2) out.push([ts[k], ts[k + 1]])
  return out
}
function intersectIv(a, b) {
  var out = []
  for (var i = 0; i < a.length; i++) for (var j = 0; j < b.length; j++) {
    var lo = Math.max(a[i][0], b[j][0]), hi = Math.min(a[i][1], b[j][1])
    if (hi > lo) out.push([lo, hi])
  }
  return out
}
function subtractIv(a, b) {
  var out = a
  for (var j = 0; j < b.length; j++) {
    var next = []
    for (var i = 0; i < out.length; i++) {
      var s = out[i]
      if (b[j][1] <= s[0] || b[j][0] >= s[1]) { next.push(s); continue }
      if (b[j][0] > s[0]) next.push([s[0], b[j][0]])
      if (b[j][1] < s[1]) next.push([b[j][1], s[1]])
    }
    out = next
  }
  return out
}
function lineIv(p0, d, inc, exc) {
  var iv = [[-1e6, 1e6]]
  for (var i = 0; i < inc.length; i++) iv = intersectIv(iv, hits(p0, d, inc[i]))
  for (var j = 0; j < (exc || []).length; j++) iv = subtractIv(iv, hits(p0, d, exc[j]))
  return iv
}

// One hatch family: parallel maru lines at 45 degrees down-right, starting at the `anchor` (the deepest shadow) and
// moving toward the light, `lines` at most, `spacingPx` apart in device px. The anti-mud rule: under MUD_PX the
// family is dropped (returns null) and its tone goes to the mass or the contour.
function hatch(c, inc, exc, o) {
  if (o.spacingPx < MUD_PX) return null
  // the lines cut across the shadow corner at 45 degrees and the family steps from that corner toward the light
  var d = { x: Math.SQRT1_2, y: -Math.SQRT1_2 }, nrm = { x: Math.SQRT1_2, y: Math.SQRT1_2 }
  if (o.dir === "down") { d = { x: Math.SQRT1_2, y: Math.SQRT1_2 }; nrm = { x: -Math.SQRT1_2, y: Math.SQRT1_2 } }
  var sp = o.spacingPx * c.k, w = o.widthPx * c.k, polys = [], kept = 0, a = o.anchor
  var sign = o.sign || 1
  for (var i = 0; i < 40 && kept < o.lines; i++) {
    var off = (o.start || 0.6) * sp + i * sp
    var p0 = P(a.x - nrm.x * off * sign, a.y - nrm.y * off * sign)
    var iv = lineIv(p0, d, inc, exc)
    var drew = false
    for (var j = 0; j < iv.length; j++) {
      var t0 = iv[j][0] + 0.5, t1 = iv[j][1] - 0.5
      if (o.maxLen && t1 - t0 > o.maxLen) t0 = t1 - o.maxLen
      if (t1 - t0 < (o.minLen || 2)) continue
      var jit = (c.rand() - 0.5) * 0.6
      var line = [P(p0.x + d.x * t0, p0.y + d.y * t0), P(p0.x + d.x * (t0 + t1) / 2 + nrm.x * jit, p0.y + d.y * (t0 + t1) / 2 + nrm.y * jit), P(p0.x + d.x * t1, p0.y + d.y * t1)]
      polys.push(ribbon(resample(line, 1.5, false), w, { taperPow: 0.6 }))
      drew = true
    }
    if (drew) kept++
  }
  if (kept < 2) return null
  return { polys: polys, family: { name: o.name || "hatch", spacingPx: o.spacingPx, lines: kept } }
}

// Stipple (rust, rock, fog): `n` small dots inside `inc`, outside `exc`, packed toward `bias` (a y the dots lean to).
function stipple(c, inc, exc, n, rPx, o) {
  var out = [], b = bbox(inc), tries = 0, r = rPx * c.k, opt = o || {}
  while (out.length < n && tries < n * 40) {
    tries++
    var x = lerp(b.x0, b.x1, c.rand()), yy = c.rand()
    if (opt.lean !== undefined) yy = opt.lean > 0 ? Math.sqrt(yy) : 1 - Math.sqrt(yy)
    var y = lerp(b.y0, b.y1, yy)
    if (!inside(inc, x, y)) continue
    var bad = false
    for (var e = 0; e < (exc || []).length; e++) if (inside(exc[e], x, y)) bad = true
    if (bad) continue
    out.push(flat(blob(x, y, r * (0.7 + c.rand() * 0.6), c.rand, 6, 0.4)))
  }
  return out
}

// A zig-zag crack: `segs` segments from `a` toward `b`, stopping `short` units before it.
function crack(c, a, b, segs, wPx, short) {
  var dx = b.x - a.x, dy = b.y - a.y, l = Math.hypot(dx, dy) || 1
  var end = Math.max(0.2, l - (short || 0))
  var ux = dx / l, uy = dy / l, pts = [P(a.x, a.y)]
  for (var i = 1; i <= segs; i++) {
    var t = end * i / segs, j = i === segs ? 0 : (i % 2 ? 1 : -1) * (1.1 + c.rand() * 0.9)
    pts.push(P(a.x + ux * t - uy * j, a.y + uy * t + ux * j))
  }
  return ribbon(pts, wPx * c.k, { taperPow: 0.35, bias: 0.5 })
}

// A level's surface: a ragged line across [x0, x1] at y with `peaks` small crests (ink pooling, not a ruler line).
function meniscus(c, x0, x1, y, peaks, ampPx) {
  var pts = [], n = 18, amp = ampPx * c.k
  var at = []
  for (var p = 0; p < peaks; p++) at.push(lerp(0.15, 0.85, (p + 0.3 + c.rand() * 0.4) / peaks))
  for (var i = 0; i <= n; i++) {
    var t = i / n, h = 0
    for (var q = 0; q < at.length; q++) h = Math.max(h, Math.max(0, 1 - Math.abs(t - at[q]) * 9) * amp * (0.7 + 0.3 * ((q * 7) % 3) / 2))
    pts.push(P(lerp(x0, x1, t), y - h + (c.rand() - 0.5) * 0.25 * c.k))
  }
  return pts
}
function levelPoly(surface, bottom) {
  var s = surface.slice()
  s.push(P(s[s.length - 1].x, bottom), P(s[0].x, bottom))
  return s
}

// ---------------------------------------------------------------------------------------------------- the kit
function kit(kind, state, size, seed, opts) {
  var master = (opts && opts.master) || masterFor(size, opts && opts.prev)
  var tier = tierOf(master), k = GRID / size, pen = PEN[master]
  var pale = !!(opts && opts.pale)
  var thin = pen.thin, thick = pen.thick
  if (pale && master === "M") { thin += 1; thick += 1 }          // pale ground: the contour thickens, the hatch goes
  var c = {
    kind: kind, state: state || {}, size: size, master: master, tier: tier, k: k, pale: pale,
    rand: rng(hash(kind + "|" + JSON.stringify(state || {})) ^ ((seed || 1) * 2654435761)),
    thin: thin * k, thick: thick * k, thinPx: thin, thickPx: thick, maru: (pen.maru || 1) * k,
    parts: [], highlight: null, families: [], silhouette: [], levelPath: null, keyline: null
  }
  return c
}
function add(c, role, layer, polys, clip, tag) {
  if (!polys || polys.length === 0) return
  c.parts.push({ role: role, layer: layer, polys: polys, clip: clip ? flat(clip) : null, tag: tag || "" })
}
function addHatch(c, h, layer, clip) {
  if (!h || c.tier === 0 || c.pale) return false
  add(c, "line", layer || "under", h.polys, clip, "hatch")
  c.families.push(h.family)
  return true
}
function contourOpts(c, extra) {
  var o = { thin: c.thin, thick: c.thick, rand: c.rand, gaps: c.tier === 0 ? 1 : (c.tier === 1 ? 1 : 2),
            gapLen: c.tier === 0 ? 1.4 * c.k : 1.8 * c.k + 1.2, twoWidths: c.tier === 0, tailLen: 0.7 * c.k }
  for (var key in (extra || {})) o[key] = extra[key]
  return o
}

// The object's thickness: the body pushed toward the shadow is solid ink, the face over it is cut back to the ground,
// so a sliver of mass shows along the lower-right edges (a slab's side, a casing's depth). Returns the pushed outline.
function depthFace(c, body, d, tag) {
  var back = wobble(shift(body, d, d * 0.8), c.rand, 0.5, true)
  add(c, "line", "under", [flat(back)], null, tag || "depth")
  add(c, "void", "under", [flat(body)], null, (tag || "depth") + "-face")
  return back
}
// The shadow side of a round body: a crescent of solid ink on its lower right (the body minus itself moved toward the
// light), with a ragged inner edge.
function shadeCrescent(c, body, dx, dy, tag) {
  add(c, "line", "under", [flat(body)], null, tag || "shade")
  add(c, "void", "under", [flat(wobble(shift(body, -dx, -dy), c.rand, 0.9, true))], body, (tag || "shade") + "-cut")
}
// Scratchboard: short cuts back to the ground across a mass (45 degrees, up-right), so a solid area reads as wet,
// worked ink and not a flat fill. `n` cuts inside `region`, outside `exc`.
function scratch(c, region, n, lenU, exc, tag) {
  if (c.tier === 0 || n <= 0) return
  var out = [], b = bbox(region), tries = 0, w = Math.max(0.75, 0.8 * c.k)
  while (out.length < n && tries < n * 60) {
    tries++
    var x = lerp(b.x0, b.x1, c.rand()), y = lerp(b.y0, b.y1, c.rand())
    var l = lenU * (0.7 + c.rand() * 0.6), ex = x + l * 0.8, ey = y - l * 0.6
    if (!inside(region, x, y) || !inside(region, ex, ey)) continue
    var bad = false
    for (var e = 0; e < (exc || []).length; e++) if (inside(exc[e], x, y) || inside(exc[e], ex, ey)) bad = true
    if (bad) continue
    out.push(ribbon([P(x, y), P((x + ex) / 2 + 0.3, (y + ey) / 2 + 0.2), P(ex, ey)], w, { taperPow: 0.7 }))
  }
  add(c, "void", "level", out, region, tag || "scratch")
}
// Ink bleed: the contour swells into a blot at one corner (T1+: one).
function bleed(c, p, rPx) {
  if (c.tier === 0) return
  add(c, "line", "over", [flat(blob(p.x, p.y, rPx * c.k, c.rand, 9, 0.5))], null, "bleed")
}

// ---------------------------------------------------------------------------------------------------- disk (§3.7)
// A slab of stone with one human-shaped hole (Amigara). The hole fills with ink to the disk's level; full cracks the slab.
function drawDisk(c) {
  var st = c.state, v = clamp(Number(st.value) || 0, 0, 1), hot = !!st.hot || v > 0.9, error = !!st.error
  var CX = 23.2, CY = 23.6, ROT = 4
  var slabL = [P(-14.2, -19.6), P(-6, -20.4), P(3, -20.0), P(8.6, -20.6), P(10.4, -18.0), P(12.2, -19.2), P(14.4, -15.6),
               P(14.8, -6), P(13.6, -3.4), P(15.2, -1.6), P(15.6, 19.4), P(-6.8, 20.2), P(-8.4, 17.6), P(-10.6, 18.6), P(-11.6, 15.4),
               P(-13.6, 15.9), P(-15.4, 12.6), P(-14.6, 2), P(-15.2, -8)]
  slabL = slabL.map(function(p) { return P(p.x * 0.93, p.y * 0.95) })
  var slab = xform(wobble(resample(slabL, 1.4, true), c.rand, 0.8, true), ROT, CX, CY, 0, 0)
  var hl
  if (c.tier === 0) {
    // a keyhole of a body: a round head on a short neck, square shoulders, legs that end in a point
    hl = [P(0, -16.6), P(3.6, -15.4), P(5.0, -12.2), P(3.8, -9.0), P(2.6, -7.6), P(7.4, -6.2), P(8.0, -3), P(7.2, 4.6),
          P(4.4, 10.4), P(0.4, 16.4), P(-0.6, 16.4), P(-4.6, 10.4), P(-7.4, 4.6), P(-8.0, -3.4), P(-7.0, -6.4), P(-2.6, -7.6),
          P(-3.8, -9.0), P(-5.0, -12.2), P(-3.6, -15.4)]
  } else {
    hl = [P(0, -16.0), P(2.7, -15.3), P(3.7, -12.6), P(2.6, -9.8), P(1.5, -9.0), P(4.4, -8.0), P(6.1, -6.1), P(6.4, -1.6), P(6.1, 4.4),
          P(5.0, 5.2), P(4.4, 6.8), P(3.2, 10.6), P(1.4, 14.2), P(0.2, 16.6), P(-0.7, 15.2), P(-2.1, 11.0), P(-3.5, 7.0), P(-4.6, 5.5),
          P(-5.9, 4.8), P(-6.3, -1.2), P(-6.0, -5.8), P(-4.0, -7.8), P(-1.5, -9.0), P(-2.6, -9.8), P(-3.7, -12.6), P(-2.7, -15.3)]
  }
  var hs = c.tier === 0 ? 1.3 : (c.tier === 1 ? 1.25 : 1.1)
  hl = hl.map(function(p) { return P(p.x * hs, p.y * (c.tier === 0 ? 1.04 : 0.95)) })
  var hole = xform(wobble(resample(hl, 1.0, true), c.rand, 0.4, true), ROT, CX, CY, -1.4, 0.4)
  var hb = bbox(hole)
  c.keyline = { x: 7, y: 2, w: 34, h: 44, shape: "portrait" }
  c.levelPath = flat(hole)

  // the slab's thickness: its right and bottom sides in solid ink
  var back = c.tier > 0 ? depthFace(c, slab, Math.max(2.4, 1.5 * c.k), "side") : slab
  c.silhouette = [flat(slab), flat(back)]
  // under: the hole's cast shadow (a crescent of ink on its upper-left wall), the hatch on the slab's shadow quarter
  if (c.tier >= 1 && !error) {
    var d = Math.max(2.4, 2.0 * c.k)
    add(c, "mass", "under", [flat(hole)], null, "wall")
    add(c, "void", "under", [flat(wobble(shift(hole, d * 0.8, d), c.rand, 0.5, true))], hole, "wall-cut")
  }
  var holeBig = xform(resample(hl, 1.0, true).map(function(p) { return P(p.x * 1.15, p.y * 1.04) }), ROT, CX, CY, -1.4, 0.4)
  if (c.tier >= 1) {
    var quarter = xform([P(0.5, 2), P(17, 2), P(17, 22), P(0.5, 22)], ROT, CX, CY, 0, 0)
    addHatch(c, hatch(c, [slab, quarter], [holeBig], { anchor: xform([P(16, 21)], ROT, CX, CY, 0, 0)[0], spacingPx: c.tier === 1 ? 2.3 : 2.1,
      widthPx: c.tier === 1 ? 1.05 : 0.85, lines: c.tier === 1 ? 5 : 8, start: 0.9, minLen: 2.0 }))
    // the crack from the broken corner toward the hole, stopping 2 px short (hot: it reaches the hole)
    var from = xform([P(-12.6, 16.6)], ROT, CX, CY, 0, 0)[0], to = xform([P(-6.2, 5.8)], ROT, CX, CY, -1.4, 0.4)[0]
    add(c, "line", "under", [crack(c, from, to, 3, 1.1, hot ? 0 : 2 * c.k)], null, "crack")
  }
  if (c.tier === 2) {
    var a2 = xform([P(14.4, -11)], ROT, CX, CY, 0, 0)[0], b2 = xform([P(8.8, -5.4)], ROT, CX, CY, 0, 0)[0]
    add(c, "line", "under", [crack(c, a2, b2, 3, 0.8, 0)], null, "crack2")
    add(c, "line", "under", stipple(c, slab, [holeBig], 18, 0.55, { lean: 1 }), null, "rock")
    var tiny = []
    var spots = [[-9.8, -14.6, 0.19], [9.0, -13.8, 0.16], [-10.2, -4.5, 0.14]]
    for (var t = 0; t < spots.length; t++) {
      var tl = hl.map(function(p) { return P(p.x * spots[t][2] * 1.4, p.y * spots[t][2]) })
      tiny.push(flat(xform(tl, ROT + (t - 1) * 6, CX, CY, spots[t][0], spots[t][1])))
    }
    add(c, "mass", "under", tiny, null, "other-holes")
  }

  // level: the ink standing in the hole, its ragged surface, the stain and the bead
  if (!error && v > 0.004) {
    var yL = hb.y1 - v * (hb.y1 - hb.y0)
    if (c.tier === 0) {
      if (yL > hb.y0 + 8.5) add(c, "mass", "level", [flat(clipAbove(hole, hb.y0 + 9.0))], null, "head-shadow")
      add(c, "mass", "level", [flat(clipBelow(hole, yL))], null, "level")
      add(c, hot ? "warn" : "blood", "level", [flat(bandOf(hole, yL, yL + 1.0 * c.k))], null, "stain")
    } else {
      var surf = meniscus(c, hb.x0 - 1, hb.x1 + 1, yL, c.tier === 1 ? 3 : 4, 1.0)
      var lvl = levelPoly(surf, hb.y1 + 4)
      add(c, "mass", "level", [flat(lvl)], hole, "level")
      scratch(c, clipBelow(hole, yL + 1.5 * c.k), c.tier === 1 ? 2 : 4, 3.2, [], "level-cuts")
      add(c, hot ? "warn" : "blood", "level", [ribbon(surf, 1.4 * c.k, { taper: false, bias: 0.2 })], hole, "stain")
      var low = surf[0]
      for (var s = 1; s < surf.length; s++) if (surf[s].y > low.y && surf[s].x > hb.x0 + 2 && surf[s].x < hb.x1 - 2) low = surf[s]
      add(c, hot ? "warn" : "blood", "level", [flat(blob(low.x, low.y + 0.6 * c.k, 0.8 * c.k, c.rand, 7))], hole, "bead")
      var wallX = lerp(hb.x0, hb.x1, 0.84), wallY = yL - 1.4 * c.k
      if (v < 0.96) add(c, "mass", "level", [flat(blob(wallX, wallY, 0.65 * c.k, c.rand, 6))], hole, "creep")
      if (c.tier === 2) add(c, "void", "level", [ribbon([P(hb.x0 + 2.4, yL + 1.8), P(hb.x0 + 5, yL + 1.3)], 0.7 * c.k)], hole, "glint")
    }
  }

  // over: the slab's contour and the hole's rim (torn open when there is no disk)
  add(c, "line", "over", contour(slab, contourOpts(c, { litMin: 0.3 })).polys, null, "contour")
  if (error) {
    var torn = [], cc = centroid(hole)
    for (var e = 0; e < hole.length; e++) {
      var q = hole[e], j = e % 2 ? 1.3 : 0.96 + c.rand() * 0.12
      torn.push(P(cc.x + (q.x - cc.x) * j * 1.08, cc.y + (q.y - cc.y) * (0.98 + (j - 1) * 0.4)))
    }
    add(c, "line", "over", contour(torn, contourOpts(c, { cavity: true, gaps: 2, gapLen: 2.4 * c.k })).polys, null, "rim-torn")
  } else {
    add(c, "line", c.tier === 0 ? "under" : "over", contour(hole, contourOpts(c, { cavity: true, thin: c.tier === 0 ? c.thick : c.thin * 0.85, thick: c.thick, gaps: 1, bias: c.tier === 0 ? 0.35 : 0.7, tail: false, gapLen: 2.2 * c.k + 0.6, below: lerp(hb.y0, hb.y1, 0.45) })).polys, null, "rim")
  }
  bleed(c, xform([P(15.4, 19.6)], ROT, CX, CY, 0, 0)[0], 1.3)
  if (c.tier === 2) {   // fog swallowing the slab's lowest 4 units
    var fog = []
    for (var f = 0; f < 3; f++) {
      var fy = CY + 17.6 + f * 1.6, fx = CX - 18 + c.rand() * 3
      fog.push(ribbon([P(fx, fy), P(fx + 9 + c.rand() * 4, fy + 0.3)], 0.95, { taper: false }))
      fog.push(ribbon([P(fx + 15 + c.rand() * 3, fy + 0.2), P(fx + 32, fy - 0.2)], 0.95, { taper: false }))
    }
    add(c, "void", "over", fog, null, "fog")
    add(c, "line", "over", stipple(c, xform([P(-17, 17), P(19, 17), P(19, 23), P(-17, 23)], ROT, CX, CY, 0, 0), [hole], 10, 0.45, {}), null, "fog-stipple")
  }
  // the hard highlight: a paper notch cut into the slab's top-left edge
  var hp = xform([P(-12.0, -20.6), P(-6.6, -21.2), P(-6.9, -19.6), P(-11.8, -19.2)], ROT, CX, CY, 0, 0)
  if (c.tier === 0) hp = xform([P(-12.6, -21.4), P(-5.6, -21.9), P(-5.9, -18.9), P(-12.3, -18.6)], ROT, CX, CY, 0, 0)
  c.highlight = { role: "paper", polys: [flat(hp)] }
}

// ---------------------------------------------------------------------------------------------------- cpu
// A die with rusted pins, two of them bent; an Uzumaki groove carved into it. The load is ink running into the groove
// from its outer end inward; a blood bead at the front; above 0.85 the centre fills solid warn.
function drawCpu(c) {
  var v = clamp(Number(c.state.value) || 0, 0, 1), CX = 24, CY = 24, ROT = 3
  var H = c.tier === 0 ? 15.5 : 15.5
  var dieL = [P(-H, -H), P(0, -H - 0.4), P(H, -H), P(H + 0.3, 0), P(H, H), P(-H + 4.2, H + 0.2), P(-H + 2.6, H - 1.4), P(-H + 1.2, H - 1.1), P(-H, H - 3.8), P(-H - 0.2, 0)]
  var die = xform(wobble(resample(dieL, 1.6, true), c.rand, 0.45, true), ROT, CX, CY, 0, 0)
  c.keyline = { x: 4, y: 4, w: 40, h: 40, shape: "square" }
  var npin = c.tier === 0 ? 2 : 3, plen = c.tier === 0 ? 5.2 : 5.4, pw = c.tier === 0 ? 2.0 * c.k : Math.max(2.2, 1.3 * c.k)
  var pins = [], sil = [flat(die)]
  var bent = [1, 7]
  var sides = [[0, -1], [1, 0], [0, 1], [-1, 0]]
  for (var s = 0; s < 4; s++) for (var i = 0; i < npin; i++) {
    var idx = s * npin + i
    var off = npin === 2 ? (i ? 6 : -6) : (i - 1) * 9
    var dx = sides[s][0], dy = sides[s][1]
    var bx = dx ? dx * H : off, by = dy ? dy * H : off
    if (s === 2 && i === 0 && npin === 3) continue        // the broken corner ate a pin
    var pl0 = plen * (0.8 + c.rand() * 0.4)
    if (idx === 4 && c.tier > 0) pl0 = plen * 0.45                // snapped off
    var line = [P(bx, by), P(bx + dx * pl0 * 0.55, by + dy * pl0 * 0.55)]
    if (bent.indexOf(idx) >= 0) line.push(P(bx + dx * pl0 * 0.9 + dy * 3.0, by + dy * pl0 * 0.9 + dx * 3.0))
    else line.push(P(bx + dx * pl0, by + dy * pl0))
    var pl = xform(line, ROT, CX, CY, 0, 0)
    pins.push(ribbon(resample(pl, 1, false), pw, { taperPow: 0.15, bias: 0.5 }))
    var a = pl[0], b = pl[pl.length - 1], nx = -(b.y - a.y), ny = b.x - a.x, l = Math.hypot(nx, ny) || 1
    nx = nx / l * pw * 0.6; ny = ny / l * pw * 0.6
    sil.push(flat([P(a.x + nx, a.y + ny), P(b.x + nx, b.y + ny), P(b.x - nx, b.y - ny), P(a.x - nx, a.y - ny)]))
  }
  var back = depthFace(c, die, Math.max(2.4, 1.4 * c.k), "depth")
  sil.push(flat(back))
  c.silhouette = sil
  c.levelPath = flat(die)

  // the groove: a spiral carved into the die; heavy on its lower-right wall
  var turns = c.tier === 0 ? 1.3 : (c.tier === 1 ? 2 : 2.5), R = c.tier === 0 ? 9.5 : 10.6, t0 = c.tier === 0 ? 0.16 : 0.1
  var SC = P(CX + 0.4, CY + 0.2)
  var sp = []
  for (var q = 0; q <= 120; q++) {
    var t = lerp(t0, 1, q / 120), ang = t * turns * Math.PI * 2 + 0.6
    sp.push(P(SC.x + Math.cos(ang) * R * t, SC.y + Math.sin(ang) * R * t))
  }
  sp = wobble(sp, c.rand, 0.35, false)
  var gThin = c.tier === 0 ? c.thin * 0.9 : Math.max(1.1 * c.k, c.thin), gThick = c.tier === 0 ? c.thin * 1.15 : c.thick * 0.85
  var nn = normals(sp, false)
  function gw(tt, j) {
    var dxr = sp[j].x - SC.x, dyr = sp[j].y - SC.y, l2 = Math.hypot(dxr, dyr) || 1
    var s2 = (dxr / l2) * SHADOW.x + (dyr / l2) * SHADOW.y
    return lerp(gThin, gThick, clamp((s2 + 0.4) / 1.4, 0, 1))
  }
  void nn
  add(c, "line", "under", [ribbon(sp, gw, { taperPow: 0.25 })], null, "groove")
  // hatch on the die's shadow corner, away from the spiral
  if (c.tier >= 1) {
    var disc = ellipse(SC.x, SC.y, R + 2.2, R + 2.2, 24)
    addHatch(c, hatch(c, [die], [disc], { anchor: xform([P(H, H)], ROT, CX, CY, 0, 0)[0], spacingPx: c.tier === 1 ? 2.3 : 2.1,
      widthPx: c.tier === 1 ? 1.0 : 0.8, lines: c.tier === 1 ? 4 : 6, start: 0.9, minLen: 1.8 }))
    var ca = xform([P(-H + 2, H - 2.4)], ROT, CX, CY, 0, 0)[0], cb = xform([P(-H + 6.5, H - 6)], ROT, CX, CY, 0, 0)[0]
    add(c, "line", "under", [crack(c, ca, cb, 2, 0.9, 0)], null, "crack")
  }
  if (c.tier === 2) {
    var rust = []
    for (var r = 0; r < sil.length; r++) if (r > 0 && r % 2 === 0) rust = rust.concat(stipple(c, xform(resample([P(-1, -1), P(1, -1), P(1, 1), P(-1, 1)], 1, true), 0, 0, 0, 0, 0), [], 0, 0.4))
    void rust
    var edge = xform([P(-H - 1, -H - 1), P(H + 1, -H - 1), P(H + 1, -H + 3), P(-H - 1, -H + 3)], ROT, CX, CY, 0, 0)
    add(c, "line", "under", stipple(c, edge, [], 10, 0.5, {}), null, "rust")
  }

  // level: ink in the groove from the outer end inward
  if (v > 0.004) {
    var n = sp.length - 1, from = Math.round(n * (1 - v))
    var fill = sp.slice(from)
    if (fill.length >= 2) {
      var fw = c.tier === 0 ? c.thick * 1.15 : (c.tier === 1 ? c.thick * 1.25 : c.thick * 1.05)
      add(c, "mass", "level", [ribbon(fill, fw, { taperPow: 0.1 })], null, "level")
      var front = fill[0]
      add(c, v > 0.85 ? "warn" : "blood", "level", [flat(blob(front.x, front.y, (c.tier === 0 ? 0.9 : 0.85) * c.k, c.rand, 7))], null, "bead")
      if (v > 0.85) add(c, "warn", "level", [flat(blob(SC.x, SC.y, c.tier === 0 ? 3.2 : 2.6, c.rand, 9))], null, "hot-core")
    }
  }
  add(c, "line", "over", contour(die, contourOpts(c, { litMin: 0.35 })).polys.concat(pins), null, "contour")
  var hp = xform([P(-H + 0.6, -H + 6), P(-H + 0.6, -H + 0.6), P(-H + 6.5, -H + 0.6), P(-H + 6.4, -H + 1.7), P(-H + 1.8, -H + 1.8), P(-H + 1.7, -H + 6)], ROT, CX, CY, 0, 0)
  if (c.tier === 0) hp = xform([P(-H - 0.6, -H + 6), P(-H - 0.6, -H - 0.6), P(-H + 6.5, -H - 0.6), P(-H + 6.4, -H + 1.6), P(-H + 1.6, -H + 1.6), P(-H + 1.6, -H + 6)], ROT, CX, CY, 0, 0)
  c.highlight = { role: "paper", polys: [flat(hp)] }
}

// ---------------------------------------------------------------------------------------------------- mem
// A memory module with torn gold-finger teeth; its three chips are three shut eyes (heavy lids). The fill opens them,
// left to right, from slit to heavy; the last one bloodshot when full.
// (The eyes-v2 sigil arrives through ItoEyeSigil once that file is stable; until then the lid shape is drawn here.)
function drawMem(c) {
  var v = clamp(Number(c.state.value) || 0, 0, 1), CX = 23.4, CY = 22.4, ROT = -3
  var W = 21.2, Ht = c.tier === 0 ? -13.4 : -12.4, Hb = c.tier === 0 ? 10.0 : 9.0
  var top = [P(-W, Ht + 0.6), P(-9, Ht - 0.2), P(4, Ht + 0.3), P(W - 4.6, Ht - 0.2), P(W - 2.6, Ht + 2.0), P(W - 1.0, Ht + 1.2), P(W + 0.2, Ht + 3.8), P(W, Hb)]
  // the bottom: rotten teeth (irregular, two torn off, one bent), and the key notch
  var bottom = [], tw = c.tier === 0 ? 3.8 : 2.8, gap = c.tier === 0 ? 2.8 : 1.7, x = W - 1.0
  var notchAt = 4.0, teeth = 0
  while (x - tw > -W + 1) {
    var len = c.tier === 0 ? 3.6 : 3.0 + c.rand() * 1.6
    if (teeth === 2 || teeth === 6) len = 0.8                   // torn off
    if (Math.abs(x - tw / 2 - notchAt) < 2.4) {
      bottom.push(P(x, Hb), P(x - 0.3, Hb - 1.8), P(x - tw + 0.3, Hb - 2.1), P(x - tw, Hb))
    } else {
      var lean = teeth === 4 ? 1.4 : 0                           // a bent tooth
      bottom.push(P(x, Hb), P(x - 0.2 + lean, Hb + len), P(x - tw + 0.3 + lean, Hb + len + (c.rand() - 0.5) * 0.6), P(x - tw, Hb))
    }
    x -= tw + gap; teeth++
  }
  bottom.push(P(-W, Hb))
  var body = xform(wobble(resample(top.concat(bottom), 1.1, true), c.rand, 0.4, true), ROT, CX, CY, 0, 0)
  c.keyline = { x: 2, y: 7, w: 44, h: 34, shape: "landscape" }
  c.levelPath = flat(body)
  var back = c.tier > 0 ? depthFace(c, body, Math.max(2.2, 1.35 * c.k), "depth") : body
  c.silhouette = [flat(body), flat(back)]

  // the chips: three swollen lids, solid ink, each with an eye cut into it
  var chips = [], cw = c.tier === 0 ? 5.6 : (c.tier === 1 ? 5.3 : 4.7), chH = c.tier === 0 ? 6.6 : (c.tier === 1 ? 5.5 : 4.8), cy0 = -2.4
  var xs = [-13.6, 0.0, 13.6]
  for (var i = 0; i < 3; i++) {
    var ch = []
    for (var a = 0; a < 16; a++) {                               // a soft rectangle, swollen on its sides
      var an = a / 16 * Math.PI * 2, ca = Math.cos(an), sa = Math.sin(an)
      var px = Math.sign(ca) * Math.pow(Math.abs(ca), 0.55) * cw, py = Math.sign(sa) * Math.pow(Math.abs(sa), 0.55) * chH
      ch.push(P(px, py))
    }
    chips.push(xform(wobble(resample(ch, 1.1, true), c.rand, 0.55, true), ROT + (i === 1 ? 5 : (i === 2 ? -2 : 0)), CX, CY, xs[i] + (c.rand() - 0.5) * 0.8, cy0 + (i === 1 ? 0.6 : 0)))
  }
  if (c.tier >= 1) {
    var hz = xform([P(-W - 2, 2), P(W + 2, 2), P(W + 2, Hb + 4), P(-W - 2, Hb + 4)], ROT, CX, CY, 0, 0)
    var big = chips.map(function(ch) { var cc = centroid(ch); return ch.map(function(p) { return P(cc.x + (p.x - cc.x) * 1.22, cc.y + (p.y - cc.y) * 1.18) }) })
    addHatch(c, hatch(c, [body, hz], big, { anchor: xform([P(W, Hb)], ROT, CX, CY, 0, 0)[0], spacingPx: c.tier === 1 ? 2.3 : 2.1,
      widthPx: c.tier === 1 ? 1.0 : 0.8, lines: c.tier === 1 ? 5 : 7, start: 0.8, minLen: 1.4, maxLen: 5 }))
    var ca2 = xform([P(W - 1.2, Ht + 2.6)], ROT, CX, CY, 0, 0)[0], cb2 = xform([P(W - 6.4, Ht + 7.4)], ROT, CX, CY, 0, 0)[0]
    add(c, "line", "under", [crack(c, ca2, cb2, 2, 0.95, 0)], null, "crack")
  }
  if (c.tier === 2) add(c, "line", "under", stipple(c, body, chips, 16, 0.45, { lean: 1 }), null, "mould")
  add(c, "mass", "under", chips.map(flat), null, "chips")
  if (c.tier === 2) for (var sc = 0; sc < 3; sc++) scratch(c, chips[sc], 2, 2.4, [], "chip-cuts")

  // the eyes: cuts back to the ground in each chip; they open left to right with the fill
  var cuts = [], pupils = [], bloods = []
  for (var e = 0; e < 3; e++) {
    var o = Math.round(clamp(v * 3 - e, 0, 1) * 8) / 8
    var cc = centroid(chips[e]), ew = cw * 0.9, eh = lerp(Math.max(0.7, 0.55 * c.k), cw * 1.1, o)
    var lid = []
    // upper lid a heavy arc, lower lid flatter; the outer corner droops (Tomie's heavy lids)
    for (var a2 = 0; a2 <= 12; a2++) { var tt = a2 / 12; lid.push(P(lerp(-ew, ew, tt), -Math.sin(Math.PI * tt) * eh * 0.55 + tt * 0.9)) }
    for (var b = 12; b >= 0; b--) { var t2 = b / 12; lid.push(P(lerp(-ew, ew, t2), Math.sin(Math.PI * t2) * eh * 0.45 + t2 * 0.9 + (o < 0.15 ? 0.5 * c.k : 0))) }
    cuts.push(flat(xform(lid, ROT + (e === 1 ? 5 : 0), cc.x, cc.y, 0, -0.2)))
    if (o >= 0.5) {
      var pr = eh * 0.36
      var pp = flat(blob(cc.x + 0.5, cc.y + 0.3, pr, c.rand, 9, 0.15))
      if (e === 2 && v >= 0.92) bloods.push(pp); else pupils.push(pp)
    } else if (o < 0.15 && c.tier >= 1) {                        // shut: lashes hanging under the lid line
      for (var l = 0; l < 3; l++) {
        var lx = cc.x - ew * 0.55 + l * ew * 0.55, ly = cc.y + 0.4 + 0.55 * c.k + l * 0.2
        cuts.push(ribbon([P(lx, ly), P(lx - 0.5 + l * 0.4, ly + 1.8 * Math.max(1, c.k * 0.7))], 0.8 * c.k, { taperPow: 0.4 }))
      }
    }
  }
  add(c, "void", "level", cuts, null, "eyes")
  add(c, "mass", "level", pupils, null, "pupils")
  if (bloods.length) {
    add(c, "blood", "level", bloods, null, "bloodshot")
    var cc3 = centroid(chips[2])
    if (c.tier >= 1) add(c, "blood", "level", [ribbon([P(cc3.x - cw * 0.85, cc3.y + 0.4), P(cc3.x - cw * 0.4, cc3.y + 1.0)], 0.6 * c.k)], null, "vein")
  }
  add(c, "line", "over", contour(body, contourOpts(c, { litMin: 0.4 })).polys, null, "contour")
  bleed(c, xform([P(W - 0.2, Hb - 0.2)], ROT, CX, CY, 0, 0)[0], 1.2)
  var hp = xform([P(-W + 1, Ht - 0.1), P(-W + 8, Ht - 0.6), P(-W + 7.8, Ht + 0.9), P(-W + 1.2, Ht + 1.4)], ROT, CX, CY, 0, 0)
  if (c.tier === 0) hp = xform([P(-W + 0.4, Ht - 0.8), P(-W + 8.5, Ht - 1.3), P(-W + 8.3, Ht + 1.6), P(-W + 0.6, Ht + 2.0)], ROT, CX, CY, 0, 0)
  c.highlight = { role: "paper", polys: [flat(hp)] }
}

// ---------------------------------------------------------------------------------------------------- battery
// A riveted iron cell from the otherworld; the charge is ink standing inside, with a stained meniscus and one paper glint.
// Charging: a crack bolt splits the casing. Critical (warn): one drip hanging from the terminal.
function drawBattery(c) {
  var st = c.state, lv = clamp(Number(st.level) || 0, 0, 4), v = lv / 4, CX = 22.6, CY = 24.4, ROT = -3
  var X0 = c.tier === 0 ? -20 : -19, X1 = c.tier === 0 ? 18 : 17, Y0 = c.tier === 0 ? -13 : -12.2, Y1 = c.tier === 0 ? 13 : 12.2
  // swollen: the casing bulges top and bottom like a bloated thing
  var cellL = [P(X0 + 3.4, Y0), P(-9, Y0 - 1.5), P(3, Y0 - 1.9), P(X1, Y0), P(X1 + 0.2, -5.5), P(X1 + 4.6, -5.6), P(X1 + 5, -4.4), P(X1 + 4.8, 5.4), P(X1 + 0.2, 5.6),
               P(X1, Y1), P(4, Y1 + 1.8), P(-9, Y1 + 1.4), P(X0 + 2.6, Y1 + 0.2), P(X0 + 1.2, Y1 - 1.6), P(X0 - 0.2, Y1 - 2.4), P(X0, Y0 + 3), P(X0 + 1.4, Y0 + 1.2)]
  var cell = xform(wobble(resample(cellL, 1.5, true), c.rand, 0.4, true), ROT, CX, CY, 0, 0)
  var wall = c.tier === 0 ? 4.6 : (c.tier === 1 ? 2.4 + 0.9 * c.k : 4.2)
  var cavL = [P(X0 + wall, Y0 + wall), P(X1 - wall, Y0 + wall), P(X1 - wall, Y1 - wall), P(X0 + wall, Y1 - wall)]
  var cav = xform(wobble(resample(cavL, 1.4, true), c.rand, 0.3, true), ROT, CX, CY, 0, 0)
  var cb = bbox(cav)
  c.keyline = { x: 2, y: 7, w: 44, h: 34, shape: "landscape" }
  c.levelPath = flat(cav)
  var back = c.tier > 0 ? depthFace(c, cell, Math.max(2.2, 1.35 * c.k), "depth") : cell
  c.silhouette = [flat(cell), flat(back)]

  if (c.tier >= 1) {
    add(c, "line", "under", contour(cav, contourOpts(c, { cavity: true, thin: c.maru * 0.8, thick: c.maru * 1.3, gaps: 1, tail: false })).polys, null, "inner-wall")
    var rv = [], spots = c.tier === 1 ? [[-14, Y0 + 1.4], [8, Y0 + 1.4], [-6, Y1 - 1.3]] : [[-14, Y0 + 1.4], [-3, Y0 + 1.4], [8, Y0 + 1.4], [-14, Y1 - 1.3], [-3, Y1 - 1.3], [8, Y1 - 1.3]]
    for (var i = 0; i < spots.length; i++) { var p = xform([P(spots[i][0], spots[i][1])], ROT, CX, CY, 0, 0)[0]; rv.push(flat(blob(p.x, p.y, 0.62 * c.k, c.rand, 7))) }
    add(c, "line", "under", rv, null, "rivets")
    var ca = xform([P(X1 - 1, Y0 + 0.5)], ROT, CX, CY, 0, 0)[0], cb2 = xform([P(X1 - 5.5, Y0 + 4.6)], ROT, CX, CY, 0, 0)[0]
    add(c, "line", "under", [crack(c, ca, cb2, 2, 0.9, 0)], null, "crack")
  }
  if (c.tier === 2) add(c, "line", "under", stipple(c, cell, [cav], 16, 0.45, { lean: 1 }), null, "rust")

  // level: ink standing in the cell; a crust remains when it is empty
  var yL = cb.y1 - v * (cb.y1 - cb.y0)
  var surf = null
  if (v > 0) {
    if (c.tier === 0) add(c, "mass", "level", [flat(clipBelow(cav, yL))], null, "level")
    else {
      surf = meniscus(c, cb.x0 - 1, cb.x1 + 1, yL, 3, 0.75)
      add(c, "mass", "level", [flat(levelPoly(surf, cb.y1 + 4))], cav, "level")
      scratch(c, clipBelow(cav, yL + 1.6 * c.k), c.tier === 1 ? 3 : 6, 3.4, [], "level-cuts")
      add(c, "blood", "level", [ribbon(surf, 1.3 * c.k, { taper: false, bias: 0.15 })], cav, "stain")
      if (c.tier === 2 && v < 1) add(c, "blood", "level", [flat(blob(cb.x0 + 4, yL + 1.6 * c.k, 0.7 * c.k, c.rand, 7))], cav, "bead")
    }
    if (c.tier === 0) add(c, "blood", "level", [flat(bandOf(cav, yL, yL + 0.9 * c.k))], null, "stain")
  } else {
    var crust = meniscus(c, cb.x0 - 1, cb.x1 + 1, cb.y1 - 1.6 * Math.max(1, c.k * 0.6), 4, 0.5)
    if (c.tier === 0) add(c, "mass", "level", [flat(clipBelow(cav, cb.y1 - 1.0 * c.k))], null, "crust")
    else add(c, "mass", "level", [flat(levelPoly(crust, cb.y1 + 4))], cav, "crust")
  }
  // hatch on the casing's shadow side (the bottom-right band, outside the cavity)
  if (c.tier >= 1) {
    var band = xform([P(0, 4), P(X1 + 6, 4), P(X1 + 6, Y1 + 3), P(0, Y1 + 3)], ROT, CX, CY, 0, 0)
    addHatch(c, hatch(c, [cell, band], [cav], { anchor: xform([P(X1, Y1)], ROT, CX, CY, 0, 0)[0], spacingPx: c.tier === 1 ? 2.3 : 2.1,
      widthPx: c.tier === 1 ? 0.95 : 0.8, lines: c.tier === 1 ? 4 : 6, start: 0.7, minLen: 1.4, maxLen: 6 }))
  }
  if (st.charging) {        // the crack bolt: a jagged cut through casing and ink, ground showing through
    var bolt = xform([P(-1, Y0 - 2), P(-4.4, -2), P(1.4, 0.6), P(-2.6, Y1 + 2)], ROT, CX, CY, 0, 0)
    add(c, "line", "level", [ribbon(resample(bolt, 1, false), 2.6 * c.k, { taperPow: 0.5 })], null, "bolt-edge")
    add(c, "void", "level", [ribbon(resample(bolt, 1, false), 1.3 * c.k, { taperPow: 0.5 })], null, "bolt")
  }
  add(c, "line", "over", contour(cell, contourOpts(c, { litMin: 0.4 })).polys, null, "contour")
  if (c.tier >= 1) {        // the terminal eaten by rust: a pitted lump of ink
    var tc = xform([P(X1 + 4.4, -2.6)], ROT, CX, CY, 0, 0)[0]
    add(c, "mass", "over", [flat(blob(tc.x, tc.y, 1.15 * Math.max(1, c.k * 0.75), c.rand, 8, 0.7))], null, "rust-lump")
  }
  bleed(c, xform([P(X1 - 0.4, Y1 - 0.4)], ROT, CX, CY, 0, 0)[0], 1.2)
  if (st.critical) {        // one warn drip from the terminal
    var tp = xform([P(X1 + 3.4, 5.6)], ROT, CX, CY, 0, 0)[0], dr = 1.25 * c.k
    var drip = [P(tp.x - dr * 0.55, tp.y), P(tp.x + dr * 0.55, tp.y), P(tp.x + dr, tp.y + dr * 2.4), P(tp.x, tp.y + dr * 3.3), P(tp.x - dr, tp.y + dr * 2.4)]
    add(c, "warn", "over", [flat(drip)], null, "drip")
  }
  // the highlight: a glint on the meniscus when there is ink, else a notch on the casing's top-left edge
  var hp
  if (surf && v < 1) {
    var g0 = surf[3], g1 = surf[6]
    hp = [P(g0.x, g0.y + 0.6 * c.k), P(g1.x, g1.y + 0.5 * c.k), P(g1.x - 0.3, g1.y + 1.2 * c.k), P(g0.x + 0.3, g0.y + 1.3 * c.k)]
  } else hp = xform([P(X0 + 4, Y0 - 0.8), P(X0 + 11, Y0 - 1.1), P(X0 + 10.8, Y0 + 0.4 * c.k), P(X0 + 4.2, Y0 + 0.6 * c.k)], ROT, CX, CY, 0, 0)
  c.highlight = { role: "paper", polys: [flat(hp)] }
}

// ---------------------------------------------------------------------------------------------------- network
// A pocket radio's grille, and the signal as broken static dashes rising from it (longer dashes outward). Unlit bands
// are dotted ghosts. Off: the arcs torn away, a blood scratch. Wired: a rusted cable coiled once, a stitched plug.
function drawNetwork(c) {
  var st = c.state
  c.keyline = { x: 2, y: 7, w: 44, h: 34, shape: "landscape" }
  if (st.wired) return drawWired(c)
  var band = clamp(Math.round(Number(st.band) || 0), 0, 3), off = !!st.off
  var G = P(24, 35.0), A0 = -152, A1 = -28, RAD = [11.6, 20.4, 29.2]
  var gs = c.tier === 0 ? 1.15 : (c.tier === 1 ? 1.0 : 0.82)
  var grL = [P(-8.6, -4.4), P(-2, -4.9), P(8.0, -4.6), P(8.8, 4.6), P(1, 5.3), P(-8.2, 5.0)].map(function(p) { return P(p.x * gs, p.y * gs) })
  var grille = xform(wobble(resample(grL, 1.1, true), c.rand, 0.35, true), -4, G.x, G.y + 0.4, 0, 0)
  // the silhouette: the fan of the outer band and the grille
  var fan = [P(G.x, G.y)]
  for (var a = 0; a <= 24; a++) { var an = (A0 + (A1 - A0) * a / 24) * Math.PI / 180; fan.push(P(G.x + Math.cos(an) * (RAD[2] + 1.4), G.y + Math.sin(an) * (RAD[2] + 1.4))) }
  c.silhouette = [flat(fan), flat(grille)]

  var dashPx = c.tier === 0 ? [4.6, 7.0, 9.4] : [2.0, 3.0, 4.4], gapPx = c.tier === 0 ? 1.4 : 1.35
  var lines = [], ghosts = [], torn = []
  for (var b = 0; b < 3; b++) {
    var r = RAD[b], lit = !off && b < band
    var arcLen = r * (A1 - A0) * Math.PI / 180
    var pts = function(a0, a1) {
      var o = [], n = Math.max(2, Math.ceil(Math.abs(a1 - a0) * r * Math.PI / 180 / 1.0))
      for (var i = 0; i <= n; i++) { var aa = (a0 + (a1 - a0) * i / n) * Math.PI / 180; o.push(P(G.x + Math.cos(aa) * r, G.y + Math.sin(aa) * r)) }
      return o
    }
    if (off) {               // torn stubs at both ends, ragged
      var stub = 14 + b * 3
      var ends = [[A0, A0 + stub / (r * Math.PI / 180) * 1.0], [A1 - stub / (r * Math.PI / 180) * 0.8, A1]]
      for (var e = 0; e < 2; e++) {
        var s = pts(ends[e][0], ends[e][1])
        var w = function(tt) { return lerp(c.thin, c.thick, 0.5) }
        torn.push(ribbon(wobble(s, c.rand, 0.5, false), w, { taperPow: e === 0 ? 0.25 : 0.25 }))
        var tip = e === 0 ? s[s.length - 1] : s[0]
        torn.push(flat(blob(tip.x, tip.y, c.thick * 0.55, c.rand, 6, 0.8)))
      }
      continue
    }
    if (lit) {
      var dl = dashPx[b] * c.k, gl = gapPx * c.k, at = (c.rand() * 0.5) * gl
      while (at < arcLen - 0.5) {
        var e1 = Math.min(arcLen, at + dl * (0.8 + c.rand() * 0.45))
        var a0 = A0 + (A1 - A0) * at / arcLen, a1 = A0 + (A1 - A0) * e1 / arcLen
        var seg = pts(a0, a1)
        var jr = (c.rand() - 0.5) * 1.3                       // static: each dash a little off its band
        seg = seg.map(function(p) { return P(G.x + (p.x - G.x) * (1 + jr / r), G.y + (p.y - G.y) * (1 + jr / r)) })
        var mid = (a0 + a1) / 2 * Math.PI / 180
        var s2 = Math.cos(mid) * SHADOW.x + Math.sin(mid) * SHADOW.y
        var ww = lerp(Math.max(c.thin, c.thick * 0.55), c.thick, clamp((s2 + 0.9) / 1.6, 0, 1))
        lines.push(ribbon(wobble(seg, c.rand, 0.3, false), ww, { taperPow: 0.35 }))
        at = e1 + gl * (0.75 + c.rand() * 0.5)
      }
    } else {                 // a ghost: dots along the band
      // a ghost: specks of static dust where the band would be, uneven and sparse
      var step = (c.tier === 0 ? 4.6 : 2.6) * c.k, dr = (c.tier === 0 ? 0.85 : 0.55) * c.k
      for (var q = step * (0.3 + c.rand() * 0.5); q < arcLen; q += step * (0.8 + c.rand() * 1.1)) {
        var aq = (A0 + (A1 - A0) * q / arcLen) * Math.PI / 180, rq = r + (c.rand() - 0.5) * 1.6
        ghosts.push(flat(blob(G.x + Math.cos(aq) * rq, G.y + Math.sin(aq) * rq, dr * (0.8 + c.rand() * 0.5), c.rand, 6, 0.5)))
      }
    }
  }
  if (c.tier >= 1) {         // a short shadow under the grille, hatched
    var shade = [P(G.x - 2, G.y + 4.6), P(G.x + 12, G.y + 3.6), P(G.x + 12, G.y + 8.6), P(G.x - 2, G.y + 8.6)]
    addHatch(c, hatch(c, [shade], [grille], { anchor: P(G.x + 11, G.y + 8.5), spacingPx: c.tier === 1 ? 2.3 : 2.1,
      widthPx: c.tier === 1 ? 0.95 : 0.8, lines: c.tier === 1 ? 3 : 4, start: 0.5, minLen: 1.2, dir: "down" }))
  }
  add(c, "line", "under", lines.concat(torn), null, "arcs")
  add(c, "line", "under", ghosts, null, "ghosts")
  if (off) {
    var sc = [P(17, 15.5), P(23, 20.2), P(30.5, 24.6)]
    add(c, "blood", "under", [ribbon(wobble(resample(sc, 1, false), c.rand, 0.5, false), 1.5 * c.k, { taperPow: 0.6 })], null, "scratch")
    if (c.tier >= 1) {       // the torn edge: a ragged ink line where the arcs were ripped away
      var tear = []
      for (var t = 0; t <= 9; t++) tear.push(P(lerp(12, 36, t / 9), 13 + (t % 2 ? 2.2 : -0.6) + c.rand() * 1.2 + Math.abs(t - 4.5) * 1.1))
      add(c, "line", "under", [ribbon(tear, c.maru * 0.9, { taperPow: 0.5 })], null, "tear")
    }
  }
  if (c.tier === 2 && !off && band === 3) {   // static spilling off the outer band
    var specks = []
    for (var z = 0; z < 6; z++) { var az = (A0 + 10 + c.rand() * (A1 - A0 - 20)) * Math.PI / 180, rz = RAD[2] + 3 + c.rand() * 2.5; specks.push(ribbon([P(G.x + Math.cos(az) * rz, G.y + Math.sin(az) * rz), P(G.x + Math.cos(az) * rz + 1.4, G.y + Math.sin(az) * rz - 0.3)], 0.7)) }
    add(c, "line", "under", specks, null, "static")
  }
  // the grille: one solid mass with its slits cut back to the ground
  var gback = wobble(shift(grille, 1.8, 1.5), c.rand, 0.4, true)
  if (c.tier > 0) {
    add(c, "line", "level", [flat(gback)], null, "grille-depth")
    add(c, "void", "level", [flat(grille)], null, "grille-face")
  }
  add(c, "mass", "level", [flat(grille)], null, "grille")
  c.silhouette.push(flat(gback))
  var slits = []
  var ns = c.tier === 0 ? 1 : (c.tier === 1 ? 2 : 3)
  for (var sl = 0; sl < ns; sl++) {
    var yy = ns === 1 ? 0.4 : lerp(-1.3, 1.9, sl / (ns - 1))
    var sw = c.tier === 0 ? 1.0 * c.k : 0.85 * c.k
    slits.push(ribbon(xform([P(-5.4, yy), P(5.6, yy - 0.4)], -4, G.x, G.y + 0.4, 0, 0), sw, { taperPow: 0.3 }))
  }
  add(c, "void", "level", slits, null, "slits")
  add(c, "line", "over", contour(grille, contourOpts(c, { thin: c.thin * 0.8, thick: c.thick * 0.9, litMin: 0.4, tail: false })).polys, null, "contour")
  var hp = xform([P(-7.8, -5.8), P(-2.4, -6.2), P(-2.5, -4.6), P(-7.6, -4.3)], -4, G.x, G.y + 0.4, 0, 0)
  if (c.tier === 0) hp = xform([P(-8.4, -7.0), P(-1.6, -7.4), P(-1.7, -4.3), P(-8.2, -4.0)], -4, G.x, G.y + 0.4, 0, 0)
  c.highlight = { role: "paper", polys: [flat(hp)] }
}
function drawWired(c) {
  // the cable: from the lower left, one coil (an Uzumaki loop), up to the plug at the upper right
  // it trails in along the floor from the right, coils once, and rises to the plug
  var path = [P(44.5, 40.2), P(36, 41.4), P(26, 40.6), P(17, 40.8), P(9.5, 38.6), P(5.2, 33), P(7.5, 26.4), P(14.5, 24.2), P(19.6, 28.4), P(18.4, 35),
              P(12.6, 36.4), P(9.6, 31.6), P(12.8, 26.2), P(19, 22.6), P(25.5, 19.2)]
  var cable = wobble(resample(path, 1, false), c.rand, 0.4, false)
  var cw = c.tier === 0 ? 1.7 * c.k : Math.max(3.0, 1.7 * c.k)
  var ps = c.tier === 0 ? 1.3 : 1.1, PY = c.tier === 0 ? 18.4 : 17
  var plugL = [P(-6.6, -5.4), P(6.4, -6.0), P(7.0, 6.2), P(-6.2, 6.6)].map(function(p) { return P(p.x * ps, p.y * ps) })
  var plug = xform(wobble(resample(plugL, 1.2, true), c.rand, 0.35, true), -38, 32, PY, 0, 0)
  var sil = [P(4, 45), P(4, 33), P(10, 26), P(27, 4), P(46, 9), P(44, 26), P(30, 26), P(23, 41), P(10, 45)]
  c.silhouette = [flat(sil)]
  c.hullSilhouette = true
  add(c, "line", "under", [ribbon(cable, function(t) { return cw * (0.85 + 0.3 * t) }, { taperPow: 0.08 })], null, "cable")
  if (c.tier >= 1) {
    var st = []                                                  // stitches across the cable where it meets the plug
    for (var i = 0; i < 3; i++) {
      var p = cable[cable.length - 4 - i * 3], q = cable[cable.length - 3 - i * 3]
      var dx = q.x - p.x, dy = q.y - p.y, l = Math.hypot(dx, dy) || 1, nx = -dy / l * 2.4, ny = dx / l * 2.4
      st.push(ribbon([P(p.x - nx, p.y - ny), P(p.x + nx, p.y + ny)], 0.75 * c.k, { taperPow: 0.3 }))
    }
    add(c, "void", "under", st, null, "stitches")
    add(c, "line", "under", st.map(function(s) { return s }), null, "stitch-ink")
    addHatch(c, hatch(c, [[P(14, 34), P(26, 30), P(26, 43), P(14, 43)]], [], { anchor: P(26, 43), spacingPx: 2.3, widthPx: 0.95, lines: 3, start: 0.5, minLen: 1.2 }))
  }
  if (c.tier === 2) add(c, "line", "under", stipple(c, sil, [plug], 14, 0.45, {}), null, "rust")
  add(c, "mass", "level", [flat(plug)], null, "plug")
  var prongs = []
  var pr = [[-2.6, -6], [2.6, -6]]
  for (var j = 0; j < 2; j++) {
    var pl = xform([P(pr[j][0], pr[j][1]), P(pr[j][0] + (j ? 0.4 : -0.2), pr[j][1] - 5.4)], -38, 32, PY, 0, 0)
    prongs.push(ribbon(pl, Math.max(1.8, 1.2 * c.k), { taperPow: 0.1 }))
  }
  add(c, "line", "over", prongs, null, "prongs")
  add(c, "void", "level", [ribbon(xform([P(-4, 1.6), P(4.2, 1.2)], -38, 32, PY, 0, 0), 0.9 * c.k)], null, "seam")
  add(c, "line", "over", contour(plug, contourOpts(c, { litMin: 0.4, tail: false })).polys, null, "contour")
  c.highlight = { role: "paper", polys: [flat(xform([P(-5.8, -6.6), P(-0.6, -6.9), P(-0.7, -5.1), P(-5.6, -4.8)], -38, 32, PY, 0, 0))] }
}

// ---------------------------------------------------------------------------------------------------- notifications
// Hanging Balloons: a bell whose crown is a balloon knot on a cord; the clapper is a small hanging head (a solid mass
// with one paper eye-glint). The bell silhouette stays dominant.
function drawBell(c) {
  var face = String(c.state.face || "idle")
  var swing = face === "active" ? 4.5 : (face === "ring" ? -4.5 : (face === "muted" ? 2.5 : 0))
  var drop = face === "muted" ? 0.6 : 0
  var PIV = P(24, 6.2)
  c.keyline = { x: 7, y: 2, w: 34, h: 44, shape: "portrait" }
  // the bell's right half (x from the axis), from the crown to the lip; the left is the same, a little lower
  var prof = [[7.8, 7.2], [12.8, 9.4], [15.2, 12.8], [15.8, 17.8], [15.0, 23], [15.6, 28], [16.9, 31.6], [18.0, 34.2], [18.2, 35.6]]
  var bl = []
  for (var i = 0; i < prof.length; i++) bl.push(P(prof[i][0], prof[i][1]))
  bl.push(P(14, 36.9), P(6, 37.7), P(0, 37.9), P(-6, 37.8), P(-14, 37.1))
  for (var j = prof.length - 1; j >= 0; j--) bl.push(P(-prof[j][0] * (j > 5 ? 1.02 : 0.98), prof[j][1] + (j > 1 ? 0.35 : 0)))
  // the lip's right corner is chipped
  bl.splice(prof.length, 0, P(16.6, 36.0), P(15.6, 35.7))
  var T = function(pts) { return xform(pts, swing, PIV.x, PIV.y + drop, 0, 0) }
  var local = shift(bl, 0, -PIV.y)
  var bell = T(wobble(resample(local, 1.3, true), c.rand, 0.4, true))
  // the mouth: the dark inside under the lip; the head hanging in front of it
  var mouth = T(shift(ellipse(0, 36.4, 15.6, c.tier === 0 ? 2.4 : 2.1, 22), 0, -PIV.y))
  var headR = c.tier === 0 ? 4.4 : (c.tier === 1 ? 4.2 : 3.6), faceOn = face === "critical"
  if (faceOn) headR += 0.7
  // the clapper swings further than the bell when a notification has just arrived (the head turns on its cord)
  var hx = face === "active" ? 2.6 : (face === "ring" ? -2.6 : -0.6)
  var hc = T([P(hx, 41.4 + (c.tier === 0 ? 0.2 : 0) - PIV.y)])[0]
  var head = blob(hc.x, hc.y, headR, c.rand, 10, 0.12)
  var halo = blob(hc.x, hc.y, headR + Math.max(0.9, 0.75 * c.k), c.rand, 10, 0.08)
  var knotC = T([P(0, 6.4 - PIV.y)])[0]
  var knot = blob(knotC.x, knotC.y, c.tier === 0 ? 2.6 : 2.2, c.rand, 8, 0.3)
  c.silhouette = [flat(bell), flat(mouth), flat(blob(hc.x, hc.y + headR * 0.3, headR * 1.45, c.rand, 10, 0.05)), flat(knot)]

  // the cord: from the top of the box down to the knot (cut and torn when muted)
  var cord = face === "muted"
    ? [P(25.5, 0.6), P(24.8, 2.2), P(25.4, 3.3)]
    : [P(25.6, 0.4), P(24.2, 2.4), P(25.0, 4.2), P(knotC.x, knotC.y - 1.2)]
  var cw = c.tier === 0 ? c.thin : Math.max(c.maru * 1.1, 1.2)
  var under = [ribbon(resample(cord, 0.8, false), cw, { taperPow: 0.2 })]
  if (face === "muted") under.push(ribbon([P(knotC.x - 0.4, knotC.y - 1.2), P(knotC.x + 0.6, knotC.y - 2.8), P(knotC.x - 0.2, knotC.y - 3.6)], cw, { taperPow: 0.3 }))
  add(c, "line", "under", under, null, "cord")
  if (c.tier >= 1) {        // the bell's shadow side: a crescent of ink, scratched
    var sdx = 4.6, sdy = 1.0
    shadeCrescent(c, bell, sdx, sdy, "shade")
    scratch(c, bell, c.tier === 1 ? 2 : 5, 3.0, [shift(bell, -sdx - 0.6, -sdy), mouth], "shade-cuts")
  }
  if (c.tier >= 1) {
    var right = T(shift([P(3, 14), P(20, 14), P(20, 35), P(3, 35)], 0, -PIV.y))
    addHatch(c, hatch(c, [bell, right], [mouth], { anchor: T([P(17, 34.5 - PIV.y)])[0], spacingPx: c.tier === 1 ? 2.3 : 2.1,
      widthPx: c.tier === 1 ? 0.95 : 0.8, lines: c.tier === 1 ? 5 : 7, start: 1.0, minLen: 2, maxLen: 11 }))
  }
  if (c.tier === 2) add(c, "line", "under", stipple(c, bell, [mouth], 14, 0.45, { lean: 1 }), null, "mould")
  if (face === "error") {
    var ca = T([P(15.2, 35.4 - PIV.y)])[0], cb = T([P(9.6, 26 - PIV.y)])[0]
    add(c, "line", "under", [crack(c, ca, cb, 3, 1.0, 0)], null, "crack")
  } else if (c.tier >= 1) {
    var ca2 = T([P(-13.4, 33.6 - PIV.y)])[0], cb2 = T([P(-10.2, 28.4 - PIV.y)])[0]
    add(c, "line", "under", [crack(c, ca2, cb2, 2, 0.85, 0)], null, "crack")
  }
  add(c, "line", "over", contour(bell, contourOpts(c, { litMin: 0.35, gaps: c.tier === 2 ? 2 : 1 })).polys, null, "contour")
  add(c, "mass", "over", [flat(mouth)], null, "mouth")
  add(c, "mass", "over", [flat(knot)], null, "knot")
  // the head: cut free of the mouth by a ring of ground, hanging on a short neck cord
  add(c, "void", "over", [flat(halo)], null, "head-halo")
  var neck = [T([P(-0.4, 36.4 - PIV.y)])[0], P(hc.x, hc.y - headR * 0.8)]
  add(c, "line", "over", [ribbon(neck, Math.max(0.9, 0.7 * c.k), { taper: false })], null, "neck")
  add(c, face === "critical" ? "warn" : "mass", "over", [flat(head)], null, "head")
  if (c.tier >= 1) {        // long wet hair hanging from the head (Hanging Balloons)
    var hair = [], hw = c.tier === 1 ? Math.max(1.6, 1.1 * c.k) : Math.max(0.9, 0.75 * c.k)
    var strands = c.tier === 1 ? [[-1, 1.3], [1, 1.1]] : [[-1, 1.5], [-0.5, 1.8], [0.6, 1.6], [1, 1.25]]
    for (var hs2 = 0; hs2 < strands.length; hs2++) {
      var sd = strands[hs2][0], ln = strands[hs2][1] * headR
      var h0 = P(hc.x + sd * headR * 0.55, hc.y - headR * 0.75)
      hair.push(ribbon([h0, P(hc.x + sd * headR * 1.15, hc.y + 0.2), P(hc.x + sd * headR * (1.0 + c.rand() * 0.3), hc.y + ln)], hw, { taperPow: 0.5, bias: 0.5 }))
    }
    add(c, "line", "over", hair, null, "hair")
  }
  var marks = []
  if (faceOn) {             // the head turned face-on: two eye holes
    marks.push(flat(blob(hc.x - headR * 0.38, hc.y - 0.2, Math.max(0.55 * c.k, 0.7), c.rand, 6, 0.2)))
    marks.push(flat(blob(hc.x + headR * 0.38, hc.y - 0.2, Math.max(0.55 * c.k, 0.7), c.rand, 6, 0.2)))
  }
  if (face === "dnd") {     // stitched shut: at L the head's eyes, at M and S three stitches across the mouth
    var sw = 0.8 * c.k, sts = []
    if (c.tier === 2) {
      for (var e = -1; e <= 1; e += 2) {
        var ex = hc.x + e * headR * 0.4
        sts.push(ribbon([P(ex - 0.9, hc.y - 0.8), P(ex + 0.9, hc.y + 0.8)], 0.6, { taper: false }), ribbon([P(ex - 0.9, hc.y + 0.8), P(ex + 0.9, hc.y - 0.8)], 0.6, { taper: false }))
      }
    }
    var mc = T([P(0, 36.6 - PIV.y)])[0], n = 3
    for (var s = 0; s < n; s++) {
      var mx = mc.x - 8.6 + s * 8.6, my = mc.y - (s === 1 ? 0.2 : 0)
      var h = c.tier === 0 ? 3.4 : 2.8
      sts.push(ribbon([P(mx - h * 0.7, my - h), P(mx + h * 0.7, my + h)], sw, { taperPow: 0.2 }))
      sts.push(ribbon([P(mx - h * 0.7, my + h), P(mx + h * 0.7, my - h)], sw, { taperPow: 0.2 }))
    }
    add(c, "void", "over", sts.map(function(p) { return p }), null, "stitch-cut")
    marks = marks.concat(sts)
    add(c, "line", "over", sts.slice(c.tier === 2 ? 4 : 0).map(function(p) { return p }), null, "stitch")
  }
  if (face === "active" || face === "critical") {
    var bead = blob(knotC.x + 2.6, knotC.y + 1.4, (c.tier === 0 ? 1.5 : 1.15) * Math.max(1, c.k * 0.6), c.rand, 8)
    add(c, face === "critical" ? "warn" : "blood", "over", [flat(bead)], null, "bead")
  }
  if (faceOn) add(c, "void", "over", marks.slice(0, 2), null, "eyes")
  if (face === "error") {
    var lp = T([P(10.5, 37.4 - PIV.y)])[0], dr = 1.0 * c.k
    add(c, "blood", "over", [flat([P(lp.x - dr * 0.5, lp.y), P(lp.x + dr * 0.5, lp.y), P(lp.x + dr * 0.9, lp.y + dr * 2.2), P(lp.x, lp.y + dr * 3), P(lp.x - dr * 0.9, lp.y + dr * 2.2)])], null, "drip")
  }
  if (face === "ring" || face === "active") {   // ink tremor lines either side: it is ringing
    var tr = [], nm = face === "ring" && c.tier >= 1 ? 2 : 1
    for (var side = -1; side <= 1; side += 2) for (var m = 0; m < nm; m++) {
      var x0 = 24 + side * (19.6 + m * 2.8), pts = []
      for (var z = 0; z <= 6; z++) pts.push(P(x0 + Math.sin(z * 1.7 + m) * 0.7, 14 + m * 3 + z * 2.2))
      tr.push(ribbon(pts, Math.max(c.thin * 0.8, c.maru * (1.1 - m * 0.2)), { taperPow: 0.5 }))
    }
    add(c, "line", "over", tr, null, "tremor")
  }
  // the eye-glint on the hanging head: the one highlight
  var gr = Math.max(0.55 * c.k, 0.9)
  c.highlight = { role: "paper", polys: [flat(blob(hc.x - headR * 0.42, hc.y - headR * 0.36, gr, c.rand, 6, 0.15))] }
}

var DRAW = { disk: drawDisk, cpu: drawCpu, mem: drawMem, battery: drawBattery, network: drawNetwork, notifications: drawBell }

function iconParts(kind, state, sizePx, seed, opts) {
  var draw = DRAW[kind]
  if (!draw) return null
  var c = kit(kind, state, Math.max(8, Number(sizePx) || 29), seed, opts)
  draw(c)
  if (c.hullSilhouette) {                                       // a cable has no body: its outline is the hull of its ink
    var all = []
    for (var hi = 0; hi < c.parts.length; hi++) if (c.parts[hi].role !== "void") for (var hp2 = 0; hp2 < c.parts[hi].polys.length; hp2++) {
      var pp = c.parts[hi].polys[hp2]
      for (var hq = 0; hq < pp.length; hq += 2) all.push(P(pp[hq], pp[hq + 1]))
    }
    c.silhouette = [flat(hull(all))]
  }
  var ORDER = { under: 0, level: 1, over: 2 }
  for (var o = 0; o < c.parts.length; o++) { c.parts[o].polys = c.parts[o].polys.map(orient); c.parts[o].n = o }
  c.parts.sort(function(a, b) { return ORDER[a.layer] - ORDER[b.layer] || a.n - b.n })
  for (var o2 = 0; o2 < c.parts.length; o2++) delete c.parts[o2].n
  if (c.highlight) c.highlight.polys = c.highlight.polys.map(orient)
  var strokes = 0
  for (var i = 0; i < c.parts.length; i++) strokes += c.parts[i].polys.length
  var res = {
    kind: kind, state: c.state, size: c.size, master: c.master, tier: c.tier, k: c.k, pale: c.pale,
    parts: c.parts, highlight: c.highlight, silhouette: c.silhouette, levelPath: c.levelPath, keyline: c.keyline,
    families: c.families, pens: { thinPx: c.thinPx, thickPx: c.thickPx }, paths: 0, strokes: strokes
  }
  res.paths = (c.tier === 0 ? mergeT0(res).length : c.parts.length) + (c.highlight ? 1 : 0)
  return res
}

// An SVG path of a part's polygons (for ItoIconSigil and ItoIconHighlight), in 48-unit space.
function svg(polys) {
  var s = ""
  for (var i = 0; i < polys.length; i++) {
    var p = polys[i]
    if (p.length < 6) continue
    s += "M" + p[0].toFixed(2) + " " + p[1].toFixed(2)
    for (var j = 2; j < p.length; j += 2) s += "L" + p[j].toFixed(2) + " " + p[j + 1].toFixed(2)
    s += "Z"
  }
  return s
}

// Consecutive parts of one colour become one path (line and mass are the same ink). Clipped parts never merge.
function group(role) { return role === "mass" ? "line" : role }
function mergeT0(ip) {
  var out = []
  for (var i = 0; i < ip.parts.length; i++) {
    var p = ip.parts[i], last = out[out.length - 1]
    if (last && !last.clip && !p.clip && group(last.role) === group(p.role)) last.polys = last.polys.concat(p.polys)
    else out.push({ role: group(p.role), polys: p.polys.slice(), clip: p.clip })
  }
  return out
}
// A role colour as a "#rrggbb" string, for the Shapes (a Canvas takes the same string).
function css(c) {
  function h(v) { var n = Math.max(0, Math.min(255, Math.round(v * 255))); return (n < 16 ? "0" : "") + n.toString(16) }
  return "#" + h(c.r) + h(c.g) + h(c.b)
}
// T0 sigil: at most 6 paths, no clip (the level is already cut to the hole). Returns [{ role, path }].
function sigilParts(kind, state, sizePx, seed, opts) {
  var ip = iconParts(kind, state, sizePx, seed, opts)
  if (!ip) return []
  return mergeT0(ip).map(function(p) { return { role: p.role, path: svg(p.polys) } })
}

// ---------------------------------------------------------------------------------------------------- roles
// The role colours from the shell's tokens ({ blood, lit, bone, ink, warn }) over `ground`, by contrast and luminance,
// never by name: a light bar gets ink lines and a paper highlight brighter than its ground (never a dark spot).
// Plain {r,g,b,a} objects; `report` holds the three contrast rows of icons-v2 section 3.5.
function roles(tok, ground, opts) {
  var ro = roles0(tok, ground)
  if (!ro) return null
  ro.tone = opts && opts.tone === "theme" ? "theme" : "ink"
  // the v6 tone (icons-v6-tone.md): every role a theme colour with an alpha, `void` a cut; computed against the icon's REAL surface
  if (opts && opts.surface) ro.theme = themeRoles(tok, opts.surface, ro)
  return ro
}
function sat(c) { var mx = Math.max(c.r, c.g, c.b), mn = Math.min(c.r, c.g, c.b), l = (mx + mn) / 2; return mx === mn ? 0 : (mx - mn) / (1 - Math.abs(2 * l - 1)) }
// The tone classes of section 3. `S` is the surface colour behind the icon; `fg` the theme's foreground (bone). Returns
//   { cls: "dark"|"light"|"mid", coloured, surface, line: {c, a}, wash: {c, a}, paper: {c, a, cut}, blood: {c, a}, warn: {c, a}, ratio }
// dark: fg, alpha 1, a 12 % wash. light: the foreground eased toward S until it holds at most 7:1 (and never under 4.5:1), alpha 0.8, a 10 % wash.
// mid: the foreground pushed out to 4.5:1, alpha 1, no wash, no highlight. The line and the wash always come from fg, never the accent.
var TONE = { lightMax: 7, floor: 4.5, lightAlpha: 0.8, darkWash: 0.12, lightWash: 0.10 }
function themeRoles(tok, S0, legacy) {
  var S = Chart.rgba(S0.r, S0.g, S0.b, 1), fg = Chart.rgba(tok.bone.r, tok.bone.g, tok.bone.b, 1)
  var lS = Chart.luminance(S), cFg = Chart.contrast(fg, S), brighter = Chart.luminance(fg) > lS
  var cls = (cFg < TONE.floor || (lS > 0.18 && lS < 0.45)) ? "mid" : (brighter ? "dark" : "light")
  var line = fg, la = 1, wash = 0, washC = fg
  if (cls === "dark") wash = TONE.darkWash
  else if (cls === "light") {
    // the smallest easing of fg toward S that holds <= 7:1 (unchanged when it already does)
    var t = 0
    while (t < 1 && Chart.contrast(Chart.mix(fg, S, t), S) > TONE.lightMax) t += 0.01
    line = Chart.mix(fg, S, Math.min(t, 1)); la = TONE.lightAlpha; wash = TONE.lightWash; washC = line
    if (Chart.contrast(line, S) < TONE.floor) { var upL = Chart.contrast(Chart.rgba(1, 1, 1, 1), S) >= Chart.contrast(Chart.rgba(0, 0, 0, 1), S)
      for (var q2 = 0; q2 < 12 && Chart.contrast(line, S) < TONE.floor; q2++) line = (upL ? Chart.lightenTo : Chart.darkenTo)(line, S, TONE.floor) }
    washC = line
  } else { line = fg; var up = Chart.contrast(Chart.rgba(1, 1, 1, 1), S) >= Chart.contrast(Chart.rgba(0, 0, 0, 1), S)
    for (var q = 0; q < 12 && Chart.contrast(line, S) < TONE.floor; q++) line = (up ? Chart.lightenTo : Chart.darkenTo)(line, S, TONE.floor) }
  // the highlight: the paper tone, cut on a light bar, and wherever it would not stand out from the line (< 1.2:1)
  var paper = legacy.paper
  var pcut = cls === "light" || Chart.contrast(paper, line) < 1.2 || Chart.luminance(paper) <= Chart.luminance(S) + 0.004
  var blood = Chart.ensureContrast(Chart.rgba(tok.blood.r, tok.blood.g, tok.blood.b, 1), S, 3)
  if (Chart.contrast(blood, line) < 1.7) {
    var sep = cls === "light" ? Chart.lightenTo(blood, line, 1.7) : Chart.darkenTo(blood, line, 1.7)
    if (Chart.contrast(sep, S) >= 3) blood = sep
  }
  var warn = Chart.ensureContrast(Chart.rgba(tok.warn.r, tok.warn.g, tok.warn.b, 1), S, 3)
  return { cls: cls, lineLight: Chart.luminance(line) > Chart.luminance(S), coloured: sat(S) > 0.25, surface: S, ratio: Chart.contrast(line, S),
           line: { c: line, a: la }, wash: { c: washC, a: wash }, paper: { c: paper, a: 1, cut: pcut },
           blood: { c: blood, a: 1 }, warn: { c: warn, a: 1 } }
}
// An alpha colour as "rgba(r, g, b, a)" for the bake's Canvas (css() above drops the alpha).
function cssa(c, a) {
  function h(v) { return Math.max(0, Math.min(255, Math.round(v * 255))) }
  return "rgba(" + h(c.r) + "," + h(c.g) + "," + h(c.b) + "," + (a === undefined ? 1 : Math.max(0, Math.min(1, a))) + ")"
}
function roles0(tok, ground) {
  if (!tok || !ground) return null
  var g = Chart.rgba(ground.r, ground.g, ground.b, 1)
  var bone = Chart.rgba(tok.bone.r, tok.bone.g, tok.bone.b, 1), ink = Chart.rgba(tok.ink.r, tok.ink.g, tok.ink.b, 1)
  var cb = Chart.contrast(bone, g), ci = Chart.contrast(ink, g)
  var line = cb >= ci ? bone : ink
  var cl = Math.max(cb, ci)
  var dark = Chart.luminance(g) < Chart.luminance(line)
  var paper = Chart.brightest(bone, g)
  if (Chart.contrast(paper, line) < 1.5) paper = Chart.lightenTo(paper, line, 1.5)
  // a near-white line on a dark ground leaves no room above it: the highlight becomes a cut back to the ground
  if (Chart.contrast(paper, line) < 1.5 && dark) paper = g
  if (!dark && Chart.luminance(paper) <= Chart.luminance(g)) paper = Chart.lightenTo(g, g, 1.06)
  var blood = Chart.ensureContrast(Chart.rgba(tok.blood.r, tok.blood.g, tok.blood.b, 1), g, 3)
  // an accent close to the line colour (tokyo-night: blue on blue-white) would vanish in a level drawn over line marks:
  // its lightness moves away from the line (hue kept) as long as it still holds 3:1 on the ground
  if (Chart.contrast(blood, line) < 1.7) {
    var sep = dark ? Chart.darkenTo(blood, line, 1.7) : Chart.lightenTo(blood, line, 1.7)
    if (Chart.contrast(sep, g) >= 3) blood = sep
  }
  var warn = Chart.ensureContrast(Chart.rgba(tok.warn.r, tok.warn.g, tok.warn.b, 1), g, 3)
  var lit = Chart.rgba(tok.lit.r, tok.lit.g, tok.lit.b, 1)
  return {
    line: line, mass: line, "void": g, paper: paper, blood: blood, warn: warn, lit: lit, pale: cl < 4.5, lineLight: dark,
    report: [
      { token: "iconLine", ratio: cl, need: 4.5, ok: cl >= 4.5 },
      { token: "iconBlood", ratio: Chart.contrast(blood, g), need: 3, ok: Chart.contrast(blood, g) >= 3 },
      { token: "iconPaper", ratio: Chart.contrast(paper, line), need: 1.5, ok: Chart.contrast(paper, line) >= 1.5 }
    ]
  }
}

// the pen and geometry kit, shared with ItoIconReal.js (icons-v3); a top-level var so a QML .import sees it
var geo = { P: P, xform: xform, shift: shift, flat: flat, bbox: bbox, centroid: centroid, inside: inside, resample: resample, normals: normals,
         wobble: wobble, ellipse: ellipse, blob: blob, clipBelow: clipBelow, clipAbove: clipAbove, bandOf: bandOf, ribbon: ribbon,
         contour: contour, lineIv: lineIv, stipple: stipple, crack: crack, meniscus: meniscus, levelPoly: levelPoly, hull: hull,
         orient: orient, clamp: clamp, lerp: lerp, polyArea: polyArea }

if (typeof module !== "undefined") module.exports = {
  GRID: GRID, MUD_PX: MUD_PX, PEN: PEN, CAP: CAP, KINDS: KINDS, STATES: STATES, NOMINAL: NOMINAL,
  masterFor: masterFor, tierOf: tierOf, iconParts: iconParts, sigilParts: sigilParts, svg: svg, roles: roles, css: css, mergeT0: mergeT0,
  rng: rng, hash: hash, polyArea: polyArea,
  geo: geo, themeRoles: themeRoles, cssa: cssa, TONE: TONE
}
