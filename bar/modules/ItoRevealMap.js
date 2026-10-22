.pragma library

// The popup opening's time map (visual-v3.md section 1.3). Pure: no QML imports, so the node tests and the lab call the same functions.
//
// A card W x H opens from an origin O (the "eye" of the spiral, just inside the bar-facing edge, under the icon). Every point p of the card
// has a reveal time T(p) in [0, 1]; at progress u the revealed set is { T <= u }. `spiral`: T = 0.72 d + 0.28 theta (d = distance from O
// over the farthest corner's distance, theta = the clockwise turn from the direction pointing away from the bar). `blot`: T = d times a
// noisy radius, plus a few satellite droplets. ItoPresenceMask.qml bakes the alpha A = 1 - T once per open.

var SPIRAL = { radial: 0.72, turn: 0.28 }
var BLOT = { amp: 0.18, drops: 6, seed: 41 }

function clamp(x, a, b) { return x < a ? a : x > b ? b : x }

// O in card coordinates; (cx, cy) is the icon's centre in the card (null: the card's middle).
function origin(side, W, H, cx, cy) {
  var mx = cx === null || cx === undefined || !isFinite(cx) ? W / 2 : cx
  var my = cy === null || cy === undefined || !isFinite(cy) ? H / 2 : cy
  if (side === "bottom") return { x: clamp(mx, 0.12 * W, 0.88 * W), y: 0.90 * H }
  if (side === "left") return { x: 0.10 * W, y: clamp(my, 0.12 * H, 0.88 * H) }
  if (side === "right") return { x: 0.90 * W, y: clamp(my, 0.12 * H, 0.88 * H) }
  return { x: clamp(mx, 0.12 * W, 0.88 * W), y: 0.10 * H }
}

// distance from O to the farthest corner
function dmax(O, W, H) {
  var fx = Math.max(O.x, W - O.x), fy = Math.max(O.y, H - O.y)
  return Math.sqrt(fx * fx + fy * fy)
}

// the screen angle (atan2 on y-down coordinates: clockwise on screen) of the direction pointing away from the bar
function awayAngle(side) {
  return side === "bottom" ? -Math.PI / 2 : side === "left" ? 0 : side === "right" ? Math.PI : Math.PI / 2
}

// theta': the angle of p - O measured clockwise on screen from the away-from-the-bar direction, in [0, 1)
function thetaPrime(side, O, x, y) {
  if (Math.abs(x - O.x) < 1e-9 && Math.abs(y - O.y) < 1e-9) return 0
  var a = Math.atan2(y - O.y, x - O.x) - awayAngle(side)
  var tau = 2 * Math.PI
  a = a - Math.floor(a / tau) * tau
  var u = a / tau
  return u >= 1 ? 0 : u
}

// the blot's radial noise, in [-1, 1]
function blotNoise(phi) {
  return (Math.sin(5 * phi + 1.3) + 0.6 * Math.sin(9 * phi + 0.4) + 0.35 * Math.sin(13 * phi + 2.1)) / 1.95
}
// the blot's radius scale at a plain angle phi (the distance, over dmax, at which T reaches 1)
function blotRadius(phi) { return 1.18 / (1 + BLOT.amp * blotNoise(phi)) }

// deterministic 0..1 sequence
function rng(seed) {
  var s = seed >>> 0
  return function() { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296 }
}

// the blot's satellite droplets: centre (card coordinates), radius px and the T of their centre
function droplets(side, O, W, H) {
  var dm = dmax(O, W, H), r = rng(BLOT.seed), out = []
  var base = awayAngle(side)
  for (var i = 0; i < BLOT.drops; i++) {
    // spread over the half plane that faces into the card, so they land on it
    var ang = base + (r() - 0.5) * Math.PI * 1.4
    var dh = 0.15 + r() * 0.30
    var rad = 6 + r() * 8
    var x = O.x + Math.cos(ang) * dh * dm, y = O.y + Math.sin(ang) * dh * dm
    out.push({ x: x, y: y, r: rad, t: blotT(O, dm, x, y) - 0.05 })
  }
  return out
}

function blotT(O, dm, x, y) {
  var dx = x - O.x, dy = y - O.y
  var d = Math.sqrt(dx * dx + dy * dy) / dm
  return clamp(d / blotRadius(Math.atan2(dy, dx)), 0, 1)
}

// T at card point (x, y). kind: "spiral" | "blot"
function T(kind, side, O, W, H, x, y) {
  var dm = dmax(O, W, H)
  if (kind === "blot") return blotT(O, dm, x, y)
  if (kind === "static") {      // a straight sweep away from the bar
    var f = side === "left" ? x / W : side === "right" ? 1 - x / W : side === "bottom" ? 1 - y / H : y / H
    return clamp(f, 0, 1)
  }
  var dx = x - O.x, dy = y - O.y
  var d = Math.sqrt(dx * dx + dy * dy) / dm
  return clamp(SPIRAL.radial * d + SPIRAL.turn * thetaPrime(side, O, x, y), 0, 1)
}

// the inked edge's width in T units (a 2.5 px G-pen line for the spiral, 3.5 px for the blot)
// the static's band is 22 px along the sweep (`len` the card's size on that axis)
function edgeDelta(kind, dm, len) { return kind === "static" ? 22 / Math.max(1, len || dm) : kind === "blot" ? 3.5 / dm : 2.5 * SPIRAL.radial / dm }
// the edge's colour alpha (the static's tint is only a wash under its snow)
function edgeAlpha(kind) { return kind === "static" ? 0.10 : kind === "blot" ? 0.55 : 0.85 }

// The mask thresholds for a progress mk in [0, 1] (the mask spreads are centred on a threshold, so progress is shifted by half a
// spread at both ends: at 0 nothing is revealed, at 1 every pixel is). Returns the revealed-set threshold and the edge band.
var SPREAD = 0.08
function level(mk) {
  var m = isFinite(mk) ? clamp(mk, 0, 1) : 1
  return -0.5 * SPREAD - 0.005 + m * (1 + SPREAD + 0.01)
}

if (typeof module !== "undefined") module.exports = { SPIRAL: SPIRAL, BLOT: BLOT, SPREAD: SPREAD, origin: origin, dmax: dmax, awayAngle: awayAngle,
  thetaPrime: thetaPrime, blotNoise: blotNoise, blotRadius: blotRadius, droplets: droplets, T: T, edgeDelta: edgeDelta, edgeAlpha: edgeAlpha, level: level, rng: rng }
