.pragma library

// The ink bleed (visual-systems.md section 2.5): pure geometry, shared by ItoStateLayer.qml and the node tests (SL-T1, SL-T2).

var BLOT_R = 40            // the blot is built once at this radius and scaled
var START = 0.15           // the scale it starts from
var POINTS = 24

// Reach: the distance from the press point (px, py) to the farthest corner of the widget rect (w x h) after the rect is inset by
// r * (1 - 1/sqrt 2), r being the widget's corner radius. The blot therefore never crosses a rounded corner.
function endR(px, py, w, h, r) {
  var d = Math.max(0, r) * (1 - Math.SQRT1_2)
  var x0 = d, y0 = d, x1 = w - d, y1 = h - d
  var best = 0
  var xs = [x0, x1], ys = [y0, y1]
  for (var i = 0; i < 2; i++) for (var j = 0; j < 2; j++) {
    var dx = px - xs[i], dy = py - ys[j]
    best = Math.max(best, Math.sqrt(dx * dx + dy * dy))
  }
  return best
}

// Scale of the blot at progress p (0..1): START up to endR / BLOT_R.
function scaleAt(p, reach) {
  var end = Math.max(START, reach / BLOT_R)
  return START + (end - START) * Math.max(0, Math.min(1, p))
}

// rho: the blot's current radius over its reach (0 at the press, 1 at the edge).
function rhoAt(p, reach) { return reach > 0 ? Math.min(1, scaleAt(p, reach) * BLOT_R / reach) : 1 }

// alpha = base * (1 - rho)^1.5: nothing left exactly at the edge.
function alphaAt(base, p, reach) { return base * Math.pow(1 - rhoAt(p, reach), 1.5) }

// One seeded blot outline: 24 points, radius noise within 12 %, three notches. Built once per size bucket.
function blotPath(radius, seed) {
  var s = (seed >>> 0) || 1
  function rnd() { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296 }
  var notch = [Math.floor(rnd() * 8), 8 + Math.floor(rnd() * 8), 16 + Math.floor(rnd() * 8)]
  var out = [], pt = typeof Qt !== "undefined" && Qt.point ? Qt.point : function(x, y) { return { x: x, y: y } }
  for (var i = 0; i < POINTS; i++) {
    var k = 1 + (rnd() * 2 - 1) * 0.12
    if (notch.indexOf(i) >= 0) k *= 0.88
    var a = i / POINTS * Math.PI * 2
    out.push(pt(radius + Math.cos(a) * radius * k, radius + Math.sin(a) * radius * k))
  }
  return out
}

if (typeof module !== "undefined") module.exports = { BLOT_R: BLOT_R, START: START, endR: endR, scaleAt: scaleAt, rhoAt: rhoAt, alphaAt: alphaAt, blotPath: blotPath }
