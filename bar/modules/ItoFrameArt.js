.pragma library

// The geometry of the manga frame v2 art (icons-v5.md section 2.5, frame-styles.md sections 2 and 4): the G-pen rule, two hatched torn
// corners, a screentone patch of dots, and the splatter that only an alert draws. Pure, seeded, no colour: ItoFrameMangaArt.qml
// paints it once in one Canvas. W, H are the card's size (the final size), `head`/`foot` the room the popup leaves above and below
// its content (ItoConfig.panelHeadroom / panelFootroom). Every number leaves finite.

function fin(v, d) { v = Number(v); return isFinite(v) ? v : d }
function clamp(v, lo, hi) { return v < lo ? lo : v > hi ? hi : v }
function rng(seed) {
  var s = (fin(seed, 1) | 0) >>> 0
  return function () {
    s = (s + 0x6D2B79F5) >>> 0
    var t = s
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function scale(W) { return clamp(fin(W, 380) / 380, 0.8, 1.15) }

// The rectangle no ornament above 0.15 opacity may enter: inset 14 from the sides, below headroom + 6, above H - footroom.
function keepOut(W, H, head, foot) {
  var x0 = 14, x1 = fin(W, 0) - 14, y0 = fin(head, 26) + 6, y1 = fin(H, 0) - fin(foot, 24)
  return { x0: x0, y0: y0, x1: x1, y1: y1 }
}
function inside(r, x, y) { return x > r.x0 && x < r.x1 && y > r.y0 && y < r.y1 }

// The outer rule as four strokes: 1 px on the lit upper-left, 2 px on the lower-right, and two breaks on the upper-left (a gap in the
// top edge at 27 % of the width, one in the left edge at 45 % of the height, 10 px each, clear of the emblem's top-centre gap and of
// the corner art). Segments are { x1, y1, x2, y2, w }.
function rule(W, H) {
  W = Math.max(40, fin(W, 380)); H = Math.max(40, fin(H, 260))
  var bx = Math.round(W * 0.27), by = Math.round(H * 0.45)
  return [
    { x1: 0, y1: 0.5, x2: bx - 5, y2: 0.5, w: 1 }, { x1: bx + 5, y1: 0.5, x2: W, y2: 0.5, w: 1 },
    { x1: 0.5, y1: 0, x2: 0.5, y2: by - 5, w: 1 }, { x1: 0.5, y1: by + 5, x2: 0.5, y2: H, w: 1 },
    { x1: 0, y1: H - 1, x2: W, y2: H - 1, w: 2 },
    { x1: W - 1, y1: 0, x2: W - 1, y2: H, w: 2 }
  ]
}

// A torn corner at the top-left (draw it rotated 180 degrees at the bottom-right): a wedge 36 x 43 (times k) with a ragged long edge,
// filled with two families of 45 degree hatch lines 3 px apart. `poly` is the clip, `hatch` the lines [x1, y1, x2, y2], `reach` the
// distance from the corner to the far edge (the tone goes 0.85 at the corner to 0.55 there).
function corner(W, seed) {
  var k = scale(W), a = 36 * k, b = 43 * k, r = rng(seed)
  var poly = [0, 0, a, 0]
  var n = 7, len = Math.sqrt(a * a + b * b), nx = b / len, ny = a / len     // the edge's unit normal, pointing away from the corner
  for (var i = 1; i < n; i++) {
    var t = i / n, jit = (r() - 0.5) * 2 * 2.2 * k
    poly.push(a * (1 - t) + nx * jit, b * t + ny * jit)
  }
  poly.push(0, b)
  var h2 = []
  for (var d = -b; d < a; d += 3) h2.push([d, 0, d + b, b])             // the other family, running the other way
  var h1 = []                                                           // one family runs along x + y = c
  for (var e = 3; e < a + b; e += 3) h1.push([e, 0, 0, e])
  return { poly: poly, hatch: h1.concat(h2), reach: len * 0.5 }
}
function toneAt(dist, reach) { return 0.85 + (0.55 - 0.85) * clamp(fin(dist, 0) / Math.max(1, fin(reach, 1)), 0, 1) }

// The screentone patch at the top-right, 64 x 73 (times k) with 6 px margins: dots on a 45 degree grid, pitch 3, radius 0.9 at the
// corner falling to 0.3 away from it. Dots over the content keep-out are capped at 0.14. [{ x, y, r, a }]
function tone(W, H, head, foot) {
  W = fin(W, 380); H = fin(H, 260)
  var k = scale(W), pw = 64 * k, ph = 73 * k
  var x0 = W - 6 - pw, y0 = 6, x1 = W - 6, y1 = 6 + ph, ko = keepOut(W, H, head, foot)
  var dmax = Math.sqrt(pw * pw + ph * ph), out = [], s = 3 / Math.SQRT2
  for (var u = -40; u <= 40; u++) for (var v = -40; v <= 40; v++) {
    var x = x1 - 2 + (u - v) * s, y = y0 + 2 + (u + v) * s
    if (x < x0 || x > x1 || y < y0 || y > y1) continue
    var d = Math.sqrt((x1 - x) * (x1 - x) + (y - y0) * (y - y0))
    out.push({ x: x, y: y, r: 0.9 - 0.6 * clamp(d / dmax, 0, 1), a: inside(ko, x, y) ? 0.14 : 0.34 })
  }
  return out
}

// The splatter at the bottom-left, drawn only with `alert` and only in a roomy card: 8 to 12 seeded drops, one big, the rest
// smaller and spread, a few with a short tail; none inside the content keep-out. [{ x, y, r, tx, ty }] (tx, ty: the tail's end or null)
function splatter(W, H, head, foot, seed) {
  W = fin(W, 380); H = fin(H, 260)
  var k = scale(W), r = rng(seed), ko = keepOut(W, H, head, foot), cx = 13 * k, cy = H - 13 * k
  var count = 8 + Math.floor(r() * 5), out = [], tries = 0
  out.push({ x: cx, y: cy, r: 2.2 * k, tx: cx + 5 * k, ty: cy - 4 * k })
  while (out.length < count && tries < 400) {
    tries++
    var ang = r() * Math.PI * 2, dist = (2 + r() * 16) * k
    var x = cx + Math.cos(ang) * dist, y = cy + Math.sin(ang) * dist * 0.8
    if (x < 3 || x > W - 3 || y < 3 || y > H - 3 || inside(ko, x, y)) continue
    var big = r() < 0.25
    out.push({ x: x, y: y, r: (big ? 1.4 : 0.5 + r() * 0.8) * k, tx: big ? x + Math.cos(ang) * 4 * k : null, ty: big ? y + Math.sin(ang) * 4 * k : null })
  }
  return out
}

if (typeof module !== "undefined") module.exports = { scale: scale, keepOut: keepOut, inside: inside, rule: rule, corner: corner, toneAt: toneAt, tone: tone, splatter: splatter }
