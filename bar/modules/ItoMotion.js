.pragma library

// How the shell moves.
//
// Caelestia is the reference for feel: nothing snaps, nothing is linear, and arrivals are quick then settle
// (long deceleration tails) while departures are brisk. That comes from a few bezier curves and three
// durations used everywhere, not from every widget picking its own numbers. A component takes a curve
// with `easing.type: Easing.BezierSpline; easing.bezierCurve: Motion.decel`.
//
// Curves are cubic-bezier control points [x1, y1, x2, y2, 1, 1], the form QML's BezierSpline takes.

var fast = 140          // hover, press, a mark lighting
var normal = 220        // a card, a page, a value settling
var slow = 300          // a panel arriving, a plate changing shape

var decel = [0.05, 0.7, 0.1, 1, 1, 1]              // arrivals: quick out of the gate, a long soft landing
var accel = [0.3, 0, 0.8, 0.15, 1, 1]              // departures: they leave briskly
var standard = [0.2, 0, 0, 1, 1, 1]                // state changes that stay in place
var spring = [0.38, 1.21, 0.22, 1, 1, 1]           // spatial moves that overshoot a hair and settle
var soft = [0.34, 0.8, 0.34, 1, 1, 1]              // effects: opacity, colour

// ---- Motion clock and typed roles (visual-systems.md section 2.1) ------------------------------------------
// A call site names a ROLE (what happens), not a duration and a curve. `dur` scales a time by the shell's motion amplitude
// (`ItoConfig.motionAmp`: 0 off, 1 calm, 1.7 lively), capped per scope so the bar stays calmer than a panel. `functional` times
// (Timer intervals, cleanup, dwell) are never scaled and never 0. Pure functions: the same file runs in node for the tests.

var morph = [0.32, 1.25, 0.4, 1, 1, 1]               // a sheet growing out of its icon (presence)
var fastSpatial = [0.42, 1.67, 0.21, 0.90, 1, 1]     // short spatial travel
var slowSpatial = [0.39, 1.29, 0.35, 0.98, 1, 1]     // long spatial travel
var linear = [0, 0, 1, 1, 1, 1]

var CURVES = { decel: decel, accel: accel, standard: standard, spring: spring, soft: soft,
               morph: morph, fastSpatial: fastSpatial, slowSpatial: slowSpatial, linear: linear }

var ROLES = {
  snap:        { ms: 90,   curve: "standard",    scope: "bar" },
  mark:        { ms: 140,  curve: "soft",        scope: "bar" },
  color:       { ms: 160,  curve: "soft",        scope: "bar" },
  settle:      { ms: 200,  curve: "standard",    scope: "panel" },
  arrive:      { ms: 240,  curve: "decel",       scope: "panel" },
  leave:       { ms: 160,  curve: "accel",       scope: "panel" },
  bleed:       { ms: 260,  curve: "decel",       scope: "bar" },
  spatialFast: { ms: 280,  curve: "fastSpatial", scope: "panel" },
  morph:       { ms: 280,  curve: "morph",       scope: "panel" },
  spatial:     { ms: 300,  curve: "spring",      scope: "panel" },
  spatialSlow: { ms: 340,  curve: "slowSpatial", scope: "panel" },
  reveal:      { ms: 220,  curve: "decel",       scope: "bar", out: { ms: 160, curve: "accel" } },
  world:       { ms: 2400, curve: "standard",    scope: "bar" }
}

// Motion speed rule (lock-theme-sync.md section 9): `lively` raises travel and overshoot (`travel`, pixels) but NEVER the duration,
// so every scope is capped at a time scale of 1.0.
var CAP = { bar: 1, panel: 1, eye: 1 }
var reduced = false                                  // set once at start (decision 3); until then `motion: off` is the master switch
function setReduced(v) { reduced = v === true }

function S(amp, scope) {
  var cap = CAP[scope]
  if (cap === undefined) cap = CAP.panel
  return Math.min(Number(amp) || 0, cap)
}
function dur(ms, amp, scope) {
  if (!(amp > 0) || reduced) return 0
  return Math.round(ms * S(amp, scope))
}
function travel(px, amp) { return px * (Number(amp) || 0) }
function functional(ms) { return ms }

// { duration, curve (bezier points), name }. An unknown role resolves to `settle`, so a typo is never a QML error.
function role(name, amp, leaving) {
  var r = ROLES[name] || ROLES.settle
  var ms = r.ms, curve = r.curve
  if (leaving && r.out) { ms = r.out.ms; curve = r.out.curve }
  return { duration: dur(ms, amp, r.scope), curve: CURVES[curve], name: ROLES[name] ? name : "settle" }
}

// Cubic bezier through (0,0) and (1,1) with control points c = [x1, y1, x2, y2, 1, 1]: y at x, by bisection on the x(t) polynomial.
function bezier(c, x) {
  if (x <= 0) return 0
  if (x >= 1) return 1
  var lo = 0, hi = 1, t = x
  for (var i = 0; i < 40; i++) {
    t = (lo + hi) / 2
    var u = 1 - t
    var bx = 3 * u * u * t * c[0] + 3 * u * t * t * c[2] + t * t * t
    if (bx < x) lo = t; else hi = t
  }
  var v = 1 - t
  return 3 * v * v * t * c[1] + 3 * v * t * t * c[3] + t * t * t
}

// The cleanup timer of a dropped drag must outlast the drop animation (functional, never below today's 240).
function cleanupMs(dropMs) { return Math.max(240, dropMs + 20) }

if (typeof module !== "undefined") module.exports = { CURVES: CURVES, ROLES: ROLES, CAP: CAP, S: S, dur: dur, travel: travel, functional: functional,
  role: role, bezier: bezier, cleanupMs: cleanupMs, setReduced: setReduced, fast: fast, normal: normal, slow: slow }
