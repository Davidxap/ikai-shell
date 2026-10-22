.pragma library

// Drawing primitives for the Ito-verse instrument glyphs.
//
// The icon sheet is 64px art shrunk into the bar, and the small utility icons in it
// are crude. So the data glyphs are drawn instead, in one coherent hand: bone-coloured
// ink with a slight tremor, blood only where the thing is alive. Every stroke goes
// through inkPath(), and the tremor is seeded, so a glyph repaints identically instead
// of shimmering.

function rng(seed) {
  var a = seed >>> 0
  return function() {
    a = (a + 0x6D2B79F5) | 0
    var t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function withAlpha(color, alpha) {
  return Qt.rgba(color.r, color.g, color.b, alpha)
}

// ---- point generators ------------------------------------------------------

function arcPts(cx, cy, r, a0, a1, n) {
  var pts = []
  for (var i = 0; i <= n; i++) {
    var a = a0 + (a1 - a0) * (i / n)
    pts.push({ x: cx + Math.cos(a) * r, y: cy + Math.sin(a) * r })
  }
  return pts
}

function quadPts(p0, c, p1, n) {
  var pts = []
  for (var i = 0; i <= n; i++) {
    var t = i / n, u = 1 - t
    pts.push({
      x: u * u * p0.x + 2 * u * t * c.x + t * t * p1.x,
      y: u * u * p0.y + 2 * u * t * c.y + t * t * p1.y
    })
  }
  return pts
}

function spiralPts(cx, cy, r, turns, n, from, to) {
  var pts = []
  var a = from === undefined ? 0 : from
  var b = to === undefined ? 1 : to
  for (var i = 0; i <= n; i++) {
    var t = a + (b - a) * (i / n)
    var ang = t * turns * Math.PI * 2
    var rad = r * t
    pts.push({ x: cx + Math.cos(ang) * rad, y: cy + Math.sin(ang) * rad })
  }
  return pts
}

// ---- the stroke ------------------------------------------------------------

// A polyline drawn as a pen would: low-frequency wobble across the line, plus a thin
// second pass beside it, the way a line gets gone over twice.
function inkPath(ctx, pts, color, width, seed, amp, echo) {
  if (!pts || pts.length < 2) return
  var rand = rng(seed || 1)
  var wob = amp === undefined ? 0.3 : amp

  function pass(offset, w, alpha, scale) {
    var drift = 0
    ctx.beginPath()
    for (var i = 0; i < pts.length; i++) {
      var p = pts[i]
      var q = pts[Math.min(i + 1, pts.length - 1)]
      var o = pts[Math.max(i - 1, 0)]
      var dx = q.x - o.x, dy = q.y - o.y
      var len = Math.sqrt(dx * dx + dy * dy) || 1
      drift = drift * 0.72 + (rand() - 0.5) * wob * scale
      var nx = -dy / len, ny = dx / len
      var x = p.x + nx * (drift + offset)
      var y = p.y + ny * (drift + offset)
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y)
    }
    ctx.strokeStyle = withAlpha(color, alpha)
    ctx.lineWidth = w
    ctx.lineCap = "round"
    ctx.lineJoin = "round"
    ctx.stroke()
  }

  pass(0, width, color.a === undefined ? 1 : color.a, 1)
  if (echo !== false) pass(width * 0.42, width * 0.5, 0.42, 1.4)
}

// A dot with a rough edge, for pupils, seeds and the like.
function inkDot(ctx, x, y, r, color, seed) {
  var rand = rng(seed || 7)
  ctx.beginPath()
  var n = 14
  for (var i = 0; i <= n; i++) {
    var a = (i / n) * Math.PI * 2
    var rr = r * (0.92 + rand() * 0.16)
    var px = x + Math.cos(a) * rr, py = y + Math.sin(a) * rr
    if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py)
  }
  ctx.closePath()
  ctx.fillStyle = color
  ctx.fill()
}

function mix(a, b, t) {
  return Qt.rgba(a.r + (b.r - a.r) * t, a.g + (b.g - a.g) * t,
                 a.b + (b.b - a.b) * t, a.a + (b.a - a.a) * t)
}
