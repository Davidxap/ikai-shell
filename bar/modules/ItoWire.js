.pragma library

// Pure geometry of the Otherworld frame's wire and grating (ito-panel-presence/frame-styles.md section 6). No colour, no QML: the parts paint what
// this returns, once, on a size change. Every number leaves finite.

function fin(v, d) { v = Number(v); return isFinite(v) ? v : d }

// One strand of the barbed wire from x0 to x1 (relative to the wire's own centre line): y = sign * 1.1 k * sin(2 pi x / 9 k), sampled every 1.5 px.
// Returns [x, y, x, y, ...]. The two strands (sign +1 and -1) twist about each other.
function strand(x0, x1, k, sign) {
  x0 = fin(x0, 0); x1 = fin(x1, 0); k = Math.max(0.3, fin(k, 1))
  var out = []
  if (x1 <= x0) return out
  var n = Math.max(1, Math.ceil((x1 - x0) / 1.5)), step = (x1 - x0) / n
  for (var i = 0; i <= n; i++) {
    var x = x0 + i * step
    out.push(x, (sign < 0 ? -1 : 1) * 1.1 * k * Math.sin(2 * Math.PI * x / (9 * k)))
  }
  return out
}

// The barbs: every 26 k along the wire, two 5 k strokes crossing at +-60 degrees to the wire, centred on it. Returns [[xa, ya, xb, yb], ...]
// in the wire's coordinates; the first barb is 13 k from x0 so none sits on a cut end.
function barbs(x0, x1, k) {
  x0 = fin(x0, 0); x1 = fin(x1, 0); k = Math.max(0.3, fin(k, 1))
  var out = [], half = 2.5 * k, c = Math.cos(Math.PI / 3), s = Math.sin(Math.PI / 3)
  for (var x = x0 + 13 * k; x <= x1 - 2.5 * k; x += 26 * k) {
    out.push([x - half * c, -half * s, x + half * c, half * s])
    out.push([x - half * c, half * s, x + half * c, -half * s])
  }
  return out
}

// Liang-Barsky, as in ItoWorld.js
function clipSeg(x0, y0, x1, y1, w, h) {
  var dx = x1 - x0, dy = y1 - y0, t0 = 0, t1 = 1
  var p = [-dx, dx, -dy, dy], q = [x0, w - x0, y0, h - y0]
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

// The diamond mesh in a w x h box: lines at +-45 degrees, `pitch` apart (measured across the lines), as an SVG path "M x y L x y M ..."
function meshPath(w, h, pitch) {
  w = Math.max(0, fin(w, 0)); h = Math.max(0, fin(h, 0)); pitch = Math.max(2, fin(pitch, 6))
  if (w < 2 || h < 2) return ""
  var step = pitch * Math.SQRT2, d = [], k
  for (k = Math.floor(-h / step); k <= Math.ceil(w / step); k++) {          // x - y = c
    var c = k * step, a = clipSeg(c - 1000, -1000, c + 1000, 1000, w, h)
    if (a) d.push("M " + a[0].toFixed(2) + " " + a[1].toFixed(2) + " L " + a[2].toFixed(2) + " " + a[3].toFixed(2))
  }
  for (k = 0; k <= Math.ceil((w + h) / step); k++) {                        // x + y = c
    var e = k * step, b = clipSeg(e + 1000, -1000, e - 1000, 1000, w, h)
    if (b) d.push("M " + b[0].toFixed(2) + " " + b[1].toFixed(2) + " L " + b[2].toFixed(2) + " " + b[3].toFixed(2))
  }
  return d.join(" ")
}

// The rivets along one side of the rule: centres every 56 k from `from` to `to`, skipping a gap of `gap` px about `mid` (the emblem at the top
// centre, the memo at the bottom centre). Returns the positions along the side.
function rivets(from, to, k, mid, gap) {
  from = fin(from, 0); to = fin(to, 0); k = Math.max(0.3, fin(k, 1)); mid = fin(mid, -1e9); gap = fin(gap, 0)
  var out = []
  for (var x = from; x <= to + 1e-6; x += 56 * k) if (Math.abs(x - mid) >= gap / 2) out.push(x)
  return out
}

if (typeof module !== "undefined" && module.exports) module.exports = { strand: strand, barbs: barbs, meshPath: meshPath, rivets: rivets }
