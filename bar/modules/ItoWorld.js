.pragma library
.import "ItoCanon.js" as Canon

// The Otherworld bar (decisions-b9 section 2): what `surfaceWorld` (fog | rust | flesh | cage) lays on the bar's plate. Pure: `plan` returns
// drawing operations in the plate's own pixels and canonical colours (ItoCanon.js); ItoPlate's `worldCanvas` paints them once and
// ItoThemeEffect moves them onto the theme, so nothing here knows a theme. The numbers of each variant are in ItoSurfaces.WORLDS.
//
// An operation is { k, c: {r,g,b}, a, ... } with k one of
//   rects  { s, pts: [x, y, ...] }        square cells of side s, top-left corners
//   lines  { w, pts: [x0, y0, x1, y1, ...] }   round-capped segments
//   disc   { x, y, r }                     ring { x, y, r, w }          fill { pts: [x, y, ...] }  (a closed polygon)
// Every number leaves here finite. Zones, per plate W x H: RIM is the top and bottom bands and the 10 px at each end (islandContentInsetX);
// FIELD is the rest, where the widgets sit and where the composite may differ from the bare plate by 0.03 in lightness at most.

var INSET = 10                                 // islandContentInsetX
var CLASS_M = { dark: 1.0, mid: 0.85, light: 0.7 }

function fin(v, d) { v = Number(v); return isFinite(v) ? v : d }
function clamp(v, lo, hi) { return v < lo ? lo : v > hi ? hi : v }
function rng(seed) {                         // mulberry32
  var s = (fin(seed, 1) | 0) >>> 0
  return function () {
    s = (s + 0x6D2B79F5) >>> 0
    var t = s
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
function smooth(a, b, x) { var t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t) }

function hash(ix, iy, seed) {
  var h = Math.imul(ix | 0, 374761393) ^ Math.imul(iy | 0, 668265263) ^ Math.imul((seed | 0) + 1013904223, 1274126177)
  h = Math.imul(h ^ (h >>> 13), 1274126177)
  h ^= h >>> 16
  return (h >>> 0) / 4294967296
}
// 2-D value noise in 0..1 with smoothstep interpolation
function vnoise(x, y, seed) {
  var ix = Math.floor(x), iy = Math.floor(y), fx = x - ix, fy = y - iy
  var ux = fx * fx * (3 - 2 * fx), uy = fy * fy * (3 - 2 * fy)
  var a = hash(ix, iy, seed), b = hash(ix + 1, iy, seed), c = hash(ix, iy + 1, seed), d = hash(ix + 1, iy + 1, seed)
  return a + (b - a) * ux + (c - a) * uy + (a - b - c + d) * ux * uy
}

// the seed of a plate: its size, so the same bar paints the same pixels again
function seedOf(W, H) { return (Math.round(W) * 131 + Math.round(H) * 17) | 0 }
function bandOf(H) { return Math.max(5, Math.round(0.18 * H)) }
function isRim(x, y, W, H) { var band = bandOf(H); return x < INSET || x > W - INSET || y < band || y > H - band }
// end emphasis: 1 at the ends, 0 in the middle
function endE(x, W) { var endW = Math.min(80, 0.18 * W); return 1 - smooth(0, endW, Math.min(x, W - x) - INSET) }

// The value-noise lattice of one octave over the left half of the plate (the right half samples it mirrored): hashed once, so a cell costs
// one bilinear read per octave and not four hashes (QML's JS engine is several times slower than node's).
function lattice(W, H, scale, seed) {
  var nx = Math.ceil(W / 2 / scale) + 2, ny = Math.ceil(H / scale) + 2, v = new Array(nx * ny)
  for (var j = 0; j < ny; j++) for (var i = 0; i < nx; i++) v[j * nx + i] = hash(i, j, seed)
  return { v: v, nx: nx, ny: ny, k: 1 / scale }
}
function sample(L, x, y) {
  var gx = x * L.k, gy = y * L.k, ix = Math.floor(gx), iy = Math.floor(gy), fx = gx - ix, fy = gy - iy
  var ux = fx * fx * (3 - 2 * fx), uy = fy * fy * (3 - 2 * fy), o = iy * L.nx + ix
  var a = L.v[o], b = L.v[o + 1], c = L.v[o + L.nx], d = L.v[o + L.nx + 1]
  return a + (b - a) * ux + (c - a) * uy + (a - b - c + d) * ux * uy
}
// The rust field n(x, y) = 0.55 N(x/22, y/22) + 0.30 N(x/9, y/9) + 0.15 N(x/4, y/4); the right end samples x' = W - x with only the finest
// octave reseeded (S + 1): statistically equal ends, no visible mirror. `fields(W, H, S)` bakes the lattices once per plan.
function fields(W, H, S) {
  return { l1: lattice(W, H, 22, S), l2: lattice(W, H, 9, S + 101), l3: lattice(W, H, 4, S + 211), l3r: lattice(W, H, 4, S + 1) }
}
// n at (x, y), or a value that is certainly below `floor` (without the finest octave) when the first two octaves cannot reach it
function rustN(F, x, y, W, floor) {
  var right = x > W / 2, xe = right ? W - x : x
  var n12 = 0.55 * sample(F.l1, xe, y) + 0.30 * sample(F.l2, xe, y)
  if (n12 + 0.15 < floor) return n12
  return n12 + 0.15 * sample(right ? F.l3r : F.l3, xe, y)
}

// Liang-Barsky: the part of a segment inside the rectangle, or null
function clipSeg(x0, y0, x1, y1, rx, ry, rw, rh) {
  var dx = x1 - x0, dy = y1 - y0, t0 = 0, t1 = 1
  var p = [-dx, dx, -dy, dy], q = [x0 - rx, rx + rw - x0, y0 - ry, ry + rh - y0]
  for (var i = 0; i < 4; i++) {
    if (p[i] === 0) { if (q[i] < 0) return null }
    else {
      var t = q[i] / p[i]
      if (p[i] < 0) { if (t > t1) return null; if (t > t0) t0 = t }
      else { if (t < t0) return null; if (t < t1) t1 = t }
    }
  }
  return [x0 + t0 * dx, y0 + t0 * dy, x0 + t1 * dx, y0 + t1 * dy]
}
// the diamond mesh inside one rectangle: two families of 45 degree lines, 6 px apart (perpendicular), on one global grid so rectangles join
function meshInto(rect, pts) {
  var step = 6 * Math.SQRT2, rx = rect[0], ry = rect[1], rw = rect[2], rh = rect[3]
  if (rw <= 0 || rh <= 0) return
  var c0 = Math.floor((rx - (ry + rh)) / step), c1 = Math.ceil((rx + rw - ry) / step)
  for (var k = c0; k <= c1; k++) {                                  // x - y = c
    var c = k * step, s = clipSeg(c - 1000, -1000, c + 1000, 1000, rx, ry, rw, rh)
    if (s) pts.push(s[0], s[1], s[2], s[3])
  }
  var d0 = Math.floor(rx + ry) / step, d1 = (rx + rw + ry + rh) / step
  for (var j = Math.floor(d0); j <= Math.ceil(d1); j++) {            // x + y = c
    var e = j * step, t = clipSeg(e + 1000, -1000, e - 1000, 1000, rx, ry, rw, rh)
    if (t) pts.push(t[0], t[1], t[2], t[3])
  }
}

// The plan for a plate. p: one row of ItoSurfaces.WORLDS (R: [rim, field], G: [rim, field], T, V); klass: dark | mid | light;
// o: { cell: 2 | 3 to force the rust cell size (else by area), radius: the plate's corner radius }.
function plan(p, W, H, klass, o) {
  o = o || {}
  W = clamp(fin(W, 0), 0, 6000); H = clamp(fin(H, 0), 0, 400)
  if (!p || W < 40 || H < 12) return []
  var m = CLASS_M[klass] || 1, light = klass === "light", mid = klass === "mid"
  // 2 px cells; 3 px on a plate over 48000 px^2 (about 1040 x 46), where the 2 px bake would pass the 16 ms budget in QML's JS engine
  var cs = o.cell === 2 || o.cell === 3 ? o.cell : (W * H > 48000 ? 3 : 2), S = seedOf(W, H), band = bandOf(H)
  var BONE = Canon.rgb(Canon.BONE), INK = Canon.rgb(Canon.INK), BLOOD = Canon.rgb(Canon.BLOOD)
  var rustCol = light ? Canon.stain : Canon.rustC
  // fieldK (ItoSurfaces.worldFieldK): the scale of every FIELD alpha so a light palette's wide ink-to-paper span cannot push the composite past
  // |dL| 0.03 over the bare plate. 1 on dark and mid (nothing changes there). The RIM keeps its full alpha.
  var fk = clamp(fin(o.fieldK, 1), 0, 1)
  var ops = []

  // 1. rust: blotches on cs px cells, grouped by (colour, quantised alpha) so the canvas fills a few paths
  if (p.R[0] > 0 || p.R[1] > 0) {
    var groups = {}
    var add = function (col, tag, a, x, y) {
      var q = Math.floor(a * 48)                      // floor: a quantised alpha never exceeds the designed one
      if (q < 1) return
      var key = tag + q
      var g = groups[key]
      if (!g) { g = groups[key] = { k: "rects", c: col, a: q / 48, s: cs, pts: [] } ; ops.push(g) }
      g.pts.push(x, y)
    }
    // Per column, once: the end emphasis, the threshold, the alpha of a RIM and of a FIELD cell, and for each octave the lattice cell and its
    // smoothstep weight. Per row, once per octave: the lattice rows interpolated in y. A cell is then one lerp per octave and no call
    // (QML's JS engine takes about 3 us for a call; the bar re-bakes on a resize, so this has to stay under 16 ms at 1800 x 46).
    var cols = Math.ceil(W / cs), rowsN = Math.ceil(H / cs), endW = Math.min(80, 0.18 * W), half = W / 2, halfCol = Math.floor((half - cs / 2) / cs) + 1
    var F = fields(W, H, S), sc = [22, 9, 4]
    var eT = new Array(cols), thrT = new Array(cols), aRim = new Array(cols), aFld = new Array(cols), cRim = new Array(cols)
    var ix = [new Array(cols), new Array(cols), new Array(cols)], ux = [new Array(cols), new Array(cols), new Array(cols)]
    for (var ci = 0; ci < cols; ci++) {
      var cx = ci * cs + cs / 2, ee = 1 - smooth(0, endW, Math.min(cx, W - cx) - INSET), xe = cx > half ? W - cx : cx
      eT[ci] = ee; thrT[ci] = 0.70 - 0.12 * ee
      aRim[ci] = m * p.R[0] * (0.45 + 0.55 * ee); aFld[ci] = fk * m * p.R[1] * (0.3 + 0.7 * ee)
      cRim[ci] = cx < INSET || cx > W - INSET
      for (var o3 = 0; o3 < 3; o3++) {
        var gx = xe / sc[o3], fl = Math.floor(gx), fr = gx - fl
        ix[o3][ci] = fl; ux[o3][ci] = fr * fr * (3 - 2 * fr)
      }
    }
    var ix0 = ix[0], ix1 = ix[1], ix2 = ix[2], ux0 = ux[0], ux1 = ux[1], ux2 = ux[2], l3v = F.l3.v, l3rv = F.l3r.v
    var lats = [F.l1, F.l2]
    var rowv = [[], []]
    for (var j = 0; j < rowsN; j++) {
      var y = j * cs + cs / 2, rimRow = y < band || y > H - band
      for (var li = 0; li < 2; li++) {                                   // the two big octaves interpolated in y for this row
        var L = lats[li], gy = y / sc[li], iy = Math.floor(gy), fy = gy - iy, uy = fy * fy * (3 - 2 * fy), base = iy * L.nx, rv = rowv[li]
        for (var k = 0; k < L.nx - 1; k++) { var v0 = L.v[base + k]; rv[k] = v0 + (L.v[base + L.nx + k] - v0) * uy }
        rv[L.nx - 1] = rv[L.nx - 2]
      }
      var r1 = rowv[0], r2 = rowv[1]
      var g3 = y / 4, i3 = Math.floor(g3), f3 = g3 - i3, uy3 = f3 * f3 * (3 - 2 * f3), b3 = i3 * F.l3.nx, nx3 = F.l3.nx
      for (var i = 0; i < cols; i++) {
        var A0 = (rimRow || cRim[i]) ? aRim[i] : aFld[i]
        if (A0 <= 0.004) continue
        var thr = thrT[i], f0 = ix0[i]
        var q0 = r1[f0], n = 0.55 * (q0 + (r1[f0 + 1] - q0) * ux0[i])
        if (n + 0.45 < thr - 0.025) continue                              // even a full 2nd and 3rd octave could not bring it to the pits
        var f1 = ix1[i], q1 = r2[f1]
        n += 0.30 * (q1 + (r2[f1 + 1] - q1) * ux1[i])
        if (n + 0.15 < thr - 0.025) continue
        var v3 = i >= halfCol ? l3rv : l3v, o3 = b3 + ix2[i]          // the finest octave only for the few cells that got this far
        var a3 = v3[o3] + (v3[o3 + nx3] - v3[o3]) * uy3, c3 = v3[o3 + 1] + (v3[o3 + nx3 + 1] - v3[o3 + 1]) * uy3
        n += 0.15 * (a3 + (c3 - a3) * ux2[i])
        if (n >= thr) add(rustCol, "r", A0 * smooth(thr, thr + 0.12, n), i * cs, j * cs)
        else if (n >= thr - 0.025 && hash(i, j, S + 5) < 0.35) add(INK, "f", 0.5 * A0, i * cs, j * cs)   // chipped pits
      }
    }
  }

  // 2. grating: the mesh in the RIM (and over the FIELD for cage). One op per rectangle, each painted clipped to its rectangle, so the line
  // ends (round caps, antialiasing) never bleed across the RIM / FIELD border by even a fraction of a pixel.
  if (p.G[0] > 0 || p.G[1] > 0) {
    var rects = []
    if (p.G[0] > 0) rects.push([0, 0, INSET, H, p.G[0]], [W - INSET, 0, INSET, H, p.G[0]], [INSET, 0, W - 2 * INSET, band, p.G[0]], [INSET, H - band, W - 2 * INSET, band, p.G[0]])
    if (p.G[1] > 0 && fk > 0) rects.push([INSET, band, W - 2 * INSET, H - 2 * band, fk * p.G[1]])
    for (var ri = 0; ri < rects.length; ri++) {
      var rc = rects[ri], pts = []
      meshInto(rc, pts)
      if (pts.length) ops.push({ k: "lines", c: BONE, a: m * rc[4], w: 0.8, clip: [rc[0], rc[1], rc[2], rc[3]], pts: pts })
    }
  }

  // 3. rot: drips from the top edge
  if (p.T > 0) {
    var rnd = rng(S + 7), n = clamp(Math.round(W / 200), 2, 9), minGap = 0.6 * W / n, xs = []
    // the drips keep out of the two end zones (the ends carry the rust, which is equal on both; a single drip near one end would tip the
    // 1.3x end-balance rule), so x runs over [max(12, endW), W - max(12, endW)]
    var lo = Math.max(12, Math.min(80, 0.18 * W)), span = Math.max(1, W - 2 * lo)
    for (var di = 0; di < n; di++) {
      var dx = lo + (di + 0.5) * span / n
      for (var tries = 0; tries < 24; tries++) {
        var cand = lo + rnd() * span, okc = true
        for (var q = 0; q < xs.length; q++) if (Math.abs(xs[q] - cand) < minGap) okc = false
        if (okc) { dx = cand; break }
      }
      xs.push(dx)
    }
    xs.sort(function (a, b) { return a - b })
    for (var d = 0; d < xs.length; d++) {
      var len = band + (0.10 + 0.14 * rnd()) * H, w0 = 1.8 + 0.6 * rnd(), top = m * p.T
      var aAt = function (yy) {                          // alpha along the shaft: m T at the top to 0.18 m T at the tip, 0.10 at most in FIELD
        var al = top * (1 - 0.82 * clamp(yy / len, 0, 1))
        return yy >= band ? Math.min(al, 0.10 * fk) : al
      }
      for (var y0 = 0; y0 < len; y0 += 2) {
        var y1 = Math.min(len, y0 + 2), t0 = y0 / len, t1 = y1 / len
        var wa = (w0 + (0.5 - w0) * t0) / 2, wb = (w0 + (0.5 - w0) * t1) / 2
        var a = aAt((y0 + y1) / 2)
        if (a > 0.004) ops.push({ k: "fill", c: light ? Canon.stain : BLOOD, a: a, pts: [xs[d] - wa, y0, xs[d] + wa, y0, xs[d] + wb, y1, xs[d] - wb, y1] })
      }
      var br = Math.min(1.5, 0.55 * w0 + 0.3)
      ops.push({ k: "disc", c: BLOOD, a: light ? 1 : Math.min(aAt(len), 0.10 * fk), x: xs[d], y: len, r: br })
    }
  }

  // 4. rivets along both bands
  if (p.V > 0) {
    var edge = Math.max(14, fin(o.radius, 0)), V = m * p.V
    var rows = [band / 2, H - band / 2]
    for (var r = 0; r < rows.length; r++) for (var side = -1; side <= 1; side += 2) for (var jj = 0; jj < 200; jj++) {
      var rx = W / 2 + side * (28 + 56 * jj)
      if (rx < edge || rx > W - edge) break
      var yy = rows[r]
      if (!light) ops.push({ k: "ring", c: Canon.rustC, a: 0.25 * V, x: rx, y: yy, r: 2.6, w: 0.8 })
      ops.push({ k: "disc", c: Canon.iron, a: V, x: rx, y: yy, r: 1.5 })
      ops.push({ k: "disc", c: BONE, a: 0.5 * V, x: rx - 0.5, y: yy - 0.5, r: 0.6 })
    }
  }
  return ops
}

// Finite and inside the plate: the NaN lesson (a non-finite number must never reach a property)
function finite(ops, W, H) {
  for (var i = 0; i < ops.length; i++) {
    var op = ops[i], v = [op.a, op.c.r, op.c.g, op.c.b]
    if (op.pts) v = v.concat(op.pts)
    if (op.k === "disc" || op.k === "ring") v.push(op.x, op.y, op.r)
    for (var j = 0; j < v.length; j++) if (!isFinite(v[j])) return false
    if (op.a < 0 || op.a > 1) return false
    if (op.pts) for (var m = 0; m + 1 < op.pts.length; m += 2) if (op.pts[m] < -0.01 || op.pts[m] > W + 3 || op.pts[m + 1] < -0.01 || op.pts[m + 1] > H + 0.01) return false
  }
  return true
}

if (typeof module !== "undefined" && module.exports) module.exports = { plan: plan, finite: finite, isRim: isRim, bandOf: bandOf, endE: endE, seedOf: seedOf, fields: fields, rustN: rustN, smooth: smooth, CLASS_M: CLASS_M, INSET: INSET }
