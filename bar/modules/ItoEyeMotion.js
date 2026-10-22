// The motion of the real eye (eyes-animation.md, sections 1, 2 and 6.1): what a real eye does over time, as pure functions.
//
// No I/O, no QML types, no colours, no imports (the shape of ItoEyeModel.js): the same file loads in the shell, in the offscreen lab and in
// `node --test`. `ItoMotion.js` is a `.pragma library` and the eye modules allow no JS-to-JS import, so the bezier curves are mirrored here
// (CURVES) and a node test asserts that the two copies are equal.
//
// Time is in seconds (the eye's own clock), lengths are in the eye's units (the 100 x 62 box), angles in degrees.
// Everything is closed-form in (seed, t) except the two followers (the gaze and the pupil), which are integrated from `dt`. A tick is one
// call to `stepEye`; a test drives it with a fixed dt sequence, so it is deterministic.
//
// The pupil is a MULTIPLIER of the baked pupil (1 = what the eye was baked with), so at rest the eye is exactly the approved look. The
// design's R fractions (MOTION[arch].pupil) are turned into multipliers with `pupil0`, the baked pupil as a fraction of the iris radius.

var BOX = { w: 100, h: 62 }
var GAZE_UNITS = { x: 11, y: 3.5 }       // ItoEyeModel.GAZE: the ellipse `gazeToward` maps into (rescaled here to each archetype's box)
var TICK = { fast: 33, slow: 66, max: 2000 }

// ---- curves (mirrors of ItoMotion.js; test EM-T8) -------------------------------------------------------------------------------------
var CURVES = {
  decel: [0.05, 0.7, 0.1, 1, 1, 1],
  accel: [0.3, 0, 0.8, 0.15, 1, 1],
  standard: [0.2, 0, 0, 1, 1, 1],
  spring: [0.38, 1.21, 0.22, 1, 1, 1],
  soft: [0.34, 0.8, 0.34, 1, 1, 1]
}

// ---- small helpers (the same as ItoEyeModel.js) -------------------------------------------------------------------------------------
function clamp(v, lo, hi) { return v < lo ? lo : (v > hi ? hi : v) }
function lerp(a, b, t) { return a + (b - a) * t }
function hash(seed, salt, i) {
  var x = ((seed | 0) * 374761393 + salt * 668265263 + i * 362437) | 0
  x = Math.imul(x ^ (x >>> 13), 1274126177)
  x = x ^ (x >>> 16)
  return (x >>> 0) / 4294967296
}
function hs(seed, salt, i, lo, hi) { return lo + (hi - lo) * hash(seed, salt, i) }
function vnoise(seed, salt, x) {                // smooth value noise on an unbounded axis, in [-1, 1]
  var i = Math.floor(x), f = x - i
  var a = 2 * hash(seed, salt, i) - 1, b = 2 * hash(seed, salt, i + 1) - 1
  return a + (b - a) * f * f * (3 - 2 * f)
}

// salts (kept clear of ItoEyeReal's RS and ItoEyeModel's SALT)
var SL = { blink: 141, bPhase: 142, bJit: 143, bDbl: 144, bTri: 145, sag: 150, sagPh: 151, sagHold: 152, sagJit: 153, fix: 160, fixPh: 161, fixJit: 162,
           fixAng: 163, fixRad: 164, micro: 170, hip: 175, tear: 180, tearPh: 181, tearJit: 182, omen: 190, omenKind: 191, omenAt: 192, omenDir: 193 }

// ---- bezier(curve, x): the y of a cubic-bezier easing at x, Newton (8 iterations) with a bisection fallback ----------------------------
function bezier(curve, x) {
  if (x <= 0) return 0
  if (x >= 1) return 1
  var x1 = curve[0], y1 = curve[1], x2 = curve[2], y2 = curve[3]
  var cx = 3 * x1, bx = 3 * (x2 - x1) - cx, ax = 1 - cx - bx
  var cy = 3 * y1, by = 3 * (y2 - y1) - cy, ay = 1 - cy - by
  var s = x, i, d, e
  for (i = 0; i < 8; i++) {
    e = ((ax * s + bx) * s + cx) * s - x
    if (Math.abs(e) < 1e-5) return ((ay * s + by) * s + cy) * s
    d = (3 * ax * s + 2 * bx) * s + cx
    if (Math.abs(d) < 1e-6) break
    s -= e / d
  }
  var lo = 0, hi = 1
  s = x
  for (i = 0; i < 40; i++) {
    e = ((ax * s + bx) * s + cx) * s
    if (Math.abs(e - x) < 1e-5) break
    if (e < x) lo = s; else hi = s
    s = (lo + hi) / 2
  }
  return ((ay * s + by) * s + cy) * s
}

// ---- the table: one row per archetype (section 1.2) -------------------------------------------------------------------------------------
// blink:  every [lo, hi] s; close, hold, open s; dbl / tri the share of double and triple blinks; `fullOnly` blinks only at level 2
// sag:    heavy only: the lid sinks to `depth` over `down` s, holds `hold` s, lifts over `up` s, every `every` s
// gaze:   the half-extents of the ellipse the iris centre may move in; fix [lo, hi] s between fixations; micro the tremor (1 = 0.6 units max)
// pupil:  base, hover, hot as fractions of the iris radius; `min` is the pin the wake starts from; `react` false: it does not react to hover
// tauGlance: the glance's time constant; hippus: the pupil's breathing (fraction, +-)
var MOTION = {
  heavy:   { blink: { every: [6, 12], close: 0.14, hold: 0.06, open: 0.32, dbl: 0.10, tri: 0 },
             sag: { every: [15, 30], hold: [1.2, 2.4], depth: 0.35, down: 0.6, up: 0.9 },
             gaze: { x: 9, y: 1.5 }, fix: [1.5, 4], micro: 1, past: 2, tauGlance: 0.035, hippus: 0.025,
             pupil: { base: 0.70, hover: 0.74, hot: 0.30, react: true } },
  stare:   { blink: { every: [14, 24], close: 0.07, hold: 0.02, open: 0.12, dbl: 0.05, tri: 0 }, sag: null,
             gaze: { x: 6, y: 2.5 }, fix: [0.6, 1.5], micro: 1.5, past: 0, tauGlance: 0.03, hippus: 0.05,
             pupil: { base: 0.11, hover: 0.11, hot: 0.11, react: false } },
  lidless: { blink: null, sag: null,
             gaze: { x: 12, y: 4 }, fix: [3, 7], micro: 0, past: 0, tauGlance: 0.035, hippus: 0.025,
             pupil: { base: 0.42, hover: 0.42, hot: 0.42, react: false } },
  spiral:  { blink: { every: [25, 40], close: 0.3, hold: 0.4, open: 0.6, dbl: 0, tri: 0, fullOnly: true }, sag: null,
             gaze: { x: 0, y: 0 }, fix: [3, 7], micro: 0, past: 0, tauGlance: 0.035, hippus: 0,
             pupil: { base: 0, hover: 0, hot: 0, react: false } },
  weeping: { blink: { every: [2.5, 5], close: 0.11, hold: 0.08, open: 0.26, dbl: 0.35, tri: 0.10 }, sag: null,
             gaze: { x: 7, y: 2 }, fix: [1, 3], micro: 1, past: 0, tauGlance: 0.035, hippus: 0.025,
             pupil: { base: 0.5, hover: 0.55, hot: 0.35, react: true } },
  poly:    { blink: { every: [4, 9], close: 0.09, hold: 0.04, open: 0.20, dbl: 0.15, tri: 0 }, sag: null,
             gaze: { x: 8, y: 2 }, fix: [1, 3], micro: 1, past: 0, tauGlance: 0.035, hippus: 0.025,
             pupil: { base: 0.3, hover: 0.3, hot: 0.3, react: false } },
  slit:    { blink: { every: [8, 16], close: 0.06, hold: 0.03, open: 0.14, dbl: 0, tri: 0 }, sag: null,
             gaze: { x: 5, y: 0 }, fix: [2, 5], micro: 0, past: 0, tauGlance: 0.035, hippus: 0,
             pupil: { base: 0.42, hover: 0.42, hot: 0.42, react: false } },
  eyeball: { blink: null, sag: null,
             gaze: { x: 0, y: 0 }, fix: [3, 7], micro: 0, past: 0, tauGlance: 0.035, hippus: 0,
             pupil: { base: 0, hover: 0, hot: 0, react: false } }
}
var BLINK_GAP = 0.14                 // s between the blinks of a double or a triple
var PUPIL = { pin: 0.11, lo: 0.1, hi: 0.8, toPin: 0.3, wake: 0.7, back: 0.45 }
var GAZE = { glanceJump: 3, tauFollow: 0.18, still: 0.06, band: 0.7 }
var REVEAL = { wait: 0.18, open: 0.24, wakeEnd: 1.12, exit: 0.16, firstOmen: 1.2 }
var BEAT = { idle: 54, warn: 72, critical: 110, peak2: 0.28, sigma: 0.05, lub: 1, dub: 0.6 }
var SPIRAL = { subtle: 40, full: 24, breath: 0.015, breathHz: 0.25 }
var TEAR = { subtle: [14, 24], full: [7, 14], form: 1.2, run: 1.6, vanish: 0.3 }
var OMEN = { calm: 1 / 14, lively: 1 / 9, cooldown: 120, window: [1.6, 8] }
var FRAMES = { t1: [0, 0.35, 0.7, 1], t2: [0, 0.2, 0.45, 0.7, 0.9, 1] }

function box(arch) { return (MOTION[arch] || MOTION.heavy).gaze }
function row(arch) { return MOTION[arch] || MOTION.heavy }

// ---- levels (section 2.3) -----------------------------------------------------------------------------------------------------------------
// 0 off, 1 subtle, 2 full. `reduced` caps full to subtle (the shell reads no reduced-motion source: it is always false there).
function levelOf(eyeMotion, motionAmp, reduced) {
  if (!(motionAmp > 0) || eyeMotion === "off") return 0
  return eyeMotion === "full" && !reduced ? 2 : 1
}
function frameValues(tier) { return tier >= 2 ? FRAMES.t2 : FRAMES.t1 }
function frameOf(b, tier) {
  var v = frameValues(tier), best = 0, bd = 9, i, d
  for (i = 0; i < v.length; i++) { d = Math.abs(v[i] - b); if (d < bd) { bd = d; best = i } }
  return best
}
function shutFrame(tier) { return frameValues(tier).length - 1 }

// ---- blinks (closed form) -----------------------------------------------------------------------------------------------------------
function blinkSpec(arch, level) {
  var m = row(arch).blink
  if (!m || level < 1 || (m.fullOnly && level < 2)) return null
  return m
}
function blinkPeriod(seed, m, level) { return lerp(m.every[0], m.every[1], hash(seed, SL.blink, 0)) * (level === 1 ? 1.4 : 1) }
function blinkStart(seed, m, level, k) {
  var P = blinkPeriod(seed, m, level), phase = P * hash(seed, SL.bPhase, 0)
  return phase + k * P + (2 * hash(seed, SL.bJit, k) - 1) * 0.35 * P * 0.5
}
function blinkCount(seed, m, k) {
  var u = hash(seed, SL.bTri, k), v = hash(seed, SL.bDbl, k)
  if (m.tri > 0 && u < m.tri) return 3
  return v < m.dbl ? 2 : 1
}
function blinkLen(m) { return m.close + m.hold + m.open }
// one blink at tau s after its start -> { b, phase } (1 closing, 2 held, 3 opening)
function blinkShape(m, tau) {
  if (tau < 0 || tau >= blinkLen(m)) return { b: 0, phase: 0 }
  if (tau < m.close) return { b: bezier(CURVES.accel, tau / m.close), phase: 1 }
  if (tau < m.close + m.hold) return { b: 1, phase: 2 }
  return { b: 1 - bezier(CURVES.decel, (tau - m.close - m.hold) / m.open), phase: 3 }
}
function sagSpec(arch, level) { var s = row(arch).sag; return level >= 1 ? s : null }
function sagPeriod(seed, s, level) { return lerp(s.every[0], s.every[1], hash(seed, SL.sag, 0)) * (level === 1 ? 1.4 : 1) }
function sagStart(seed, s, level, k) {
  var P = sagPeriod(seed, s, level), phase = P * hash(seed, SL.sagPh, 0)
  return phase + k * P + (2 * hash(seed, SL.sagJit, k) - 1) * 0.3 * P * 0.5
}
function sagShape(seed, s, k, tau) {
  var hold = lerp(s.hold[0], s.hold[1], hash(seed, SL.sagHold, k))
  if (tau < 0 || tau >= s.down + hold + s.up) return { b: 0, phase: 0 }
  if (tau < s.down) return { b: s.depth * bezier(CURVES.standard, tau / s.down), phase: 4 }
  if (tau < s.down + hold) return { b: s.depth, phase: 4 }
  return { b: s.depth * (1 - bezier(CURVES.standard, (tau - s.down - hold) / s.up)), phase: 4 }
}
// the lid at time t -> { b, phase }: 0 open .. 1 shut; phase 0 none, 1 closing, 2 held, 3 opening, 4 sag
function blinkReal(seed, t, arch, level, amp) {
  var best = { b: 0, phase: 0 }, m = blinkSpec(arch, level), s = sagSpec(arch, level), k, i, r, k0
  if (m) {
    var P = blinkPeriod(seed, m, level), ph = P * hash(seed, SL.bPhase, 0), len = blinkLen(m)
    k0 = Math.floor((t - ph) / P)
    for (k = k0 - 1; k <= k0 + 1; k++) {
      var st = blinkStart(seed, m, level, k), n = blinkCount(seed, m, k)
      for (i = 0; i < n; i++) {
        r = blinkShape(m, t - st - i * (len + BLINK_GAP))
        if (r.b > best.b || (best.phase === 0 && r.phase > 0)) best = r
      }
    }
  }
  if (s) {
    var Ps = sagPeriod(seed, s, level), ps = Ps * hash(seed, SL.sagPh, 0)
    k0 = Math.floor((t - ps) / Ps)
    for (k = k0 - 1; k <= k0 + 1; k++) {
      r = sagShape(seed, s, k, t - sagStart(seed, s, level, k))
      if (r.b > best.b) best = r
    }
  }
  return best
}
// the first event of a closed-form schedule that starts after t (s from now), for the event-driven sleep
function nextBlinkIn(seed, t, arch, level) {
  var m = blinkSpec(arch, level), s = sagSpec(arch, level), out = Infinity, k, d, P, ph, k0
  if (m) {
    P = blinkPeriod(seed, m, level); ph = P * hash(seed, SL.bPhase, 0); k0 = Math.floor((t - ph) / P)
    for (k = k0 - 1; k <= k0 + 2; k++) { d = blinkStart(seed, m, level, k) - t; if (d > 0 && d < out) out = d }
  }
  if (s) {
    P = sagPeriod(seed, s, level); ph = P * hash(seed, SL.sagPh, 0); k0 = Math.floor((t - ph) / P)
    for (k = k0 - 1; k <= k0 + 2; k++) { d = sagStart(seed, s, level, k) - t; if (d > 0 && d < out) out = d }
  }
  return out
}

// ---- fixations (the idle gaze), micro-saccades ----------------------------------------------------------------------------------------------
// subtle stretches the fixations by 1.25 (the table's range alone would wake a calm eye 0.57 times a second, over the 0.5 budget)
function fixPeriod(seed, arch, amp, level) { return lerp(row(arch).fix[0], row(arch).fix[1], hash(seed, SL.fix, 0)) * (level === 1 ? 1.25 : 1) / Math.min(Math.max(amp, 0.001), 1.3) }
function fixStart(seed, arch, amp, level, k) {
  var P = fixPeriod(seed, arch, amp, level)
  return P * hash(seed, SL.fixPh, 0) + k * P + hash(seed, SL.fixJit, k) * 0.3 * P
}
// -> { x, y, since }: the current fixation's point (inside the archetype's gaze ellipse) and how long it has lasted
function fixationAt(seed, t, arch, level, amp) {
  var b = box(arch)
  if (level < 1 || (b.x === 0 && b.y === 0)) return { x: 0, y: 0, since: t }
  var P = fixPeriod(seed, arch, amp, level), k = Math.floor((t - P * hash(seed, SL.fixPh, 0)) / P)
  if (t < fixStart(seed, arch, amp, level, k)) k--
  var a = 2 * Math.PI * hash(seed, SL.fixAng, k), r = Math.sqrt(hash(seed, SL.fixRad, k))
  return { x: b.x * r * Math.cos(a), y: b.y * r * Math.sin(a), since: t - fixStart(seed, arch, amp, level, k) }
}
function nextFixIn(seed, t, arch, level, amp) {
  var b = box(arch)
  if (level < 1 || (b.x === 0 && b.y === 0)) return Infinity
  var P = fixPeriod(seed, arch, amp, level), k0 = Math.floor((t - P * hash(seed, SL.fixPh, 0)) / P), k, d
  for (k = k0 - 1; k <= k0 + 2; k++) { d = fixStart(seed, arch, amp, level, k) - t; if (d > 0) return d }
  return Infinity
}
// level 2 only: smooth sub-unit jitter at a fixation, at most 0.6 units (stare x1.5, kept inside the same cap times 1.5)
function microAt(seed, t, arch) {
  var m = row(arch).micro
  if (!(m > 0)) return { x: 0, y: 0 }
  var a = 0.4 * m
  return { x: a * vnoise(seed, SL.micro, t * 7), y: a * 0.6 * vnoise(seed, SL.micro + 1, t * 7) }
}

// ---- the gaze follower: a glance (tau 30-40 ms) when the jump is larger than 3 units, else a follow (tau 180 ms); no overshoot ------------
function clampBox(x, y, arch) {
  var b = box(arch)
  if (b.x <= 0 || b.y < 0) return { x: 0, y: 0 }
  if (b.y === 0) return { x: clamp(x, -b.x, b.x), y: 0 }
  var e = Math.sqrt((x * x) / (b.x * b.x) + (y * y) / (b.y * b.y))
  return e > 1 ? { x: x / e, y: y / e } : { x: x, y: y }
}
// g: { x, y, gl } (gl: a glance is running; it is latched until the iris has arrived, so it does not slow into a follow half way)
function gazeNext(g, target, dt, arch) {
  var dx = target.x - g.x, dy = target.y - g.y, d = Math.sqrt(dx * dx + dy * dy)
  var gl = !!g.gl
  if (!gl && d > GAZE.glanceJump) gl = true
  if (gl && d < GAZE.still) gl = false
  var tau = gl ? row(arch).tauGlance : GAZE.tauFollow
  var a = 1 - Math.exp(-Math.max(0, dt) / tau)
  var p = clampBox(g.x + dx * a, g.y + dy * a, arch)
  return { x: p.x, y: p.y, gl: gl, moving: d > GAZE.still }
}
// the pointer (px from the eye's centre, in the host's frame) as a target inside the archetype's box (ItoEyeModel.gazeToward, rescaled)
function lookTarget(look, S, rotDeg, mirror, arch, amp) {
  var b = box(arch)
  if (!look || (b.x === 0 && b.y === 0)) return { x: 0, y: 0 }
  var dx = look.dx, dy = look.dy, d = Math.sqrt(dx * dx + dy * dy)
  if (d < 1e-6) return { x: 0, y: 0 }
  var a = -(rotDeg || 0) * Math.PI / 180, c = Math.cos(a), sn = Math.sin(a)
  var vx = (dx * c - dy * sn) / d, vy = (dx * sn + dy * c) / d, m = clamp(d / (2 * S), 0, 1)
  var k = Math.min(Math.max(amp, 0), 1.2)
  var x = (mirror ? -vx : vx) * m * b.x * k, y = vy * m * b.y * k
  var past = row(arch).past
  if (past > 0 && x !== 0) x += (x > 0 ? past : -past)
  return clampBox(x, y, arch)
}

// ---- the pupil ----------------------------------------------------------------------------------------------------------------------------
// the multiplier the pupil should have in a mood: wake (just woke into the light: pinned), base, hover, hot
function pupilTarget(arch, mood, pupil0, amp) {
  var r = row(arch).pupil
  if (!(pupil0 > 0) || !(r.base > 0)) return 1
  var v
  if (mood === "wake") v = PUPIL.pin
  else if (mood === "hot") v = r.hot
  else if (mood === "hover") v = r.react ? r.hover : r.base
  else v = r.base
  // the swing is scaled by amp (to 1.3), then the radius is held inside [0.1 R, 0.8 R] (the baked pupil, when it is smaller than 0.1, is its own floor)
  var swing = (v - r.base) * Math.min(Math.max(amp, 0), 1.3), rad = r.base + swing
  if (mood === "wake") rad = Math.min(v, pupil0)
  var lo = Math.min(PUPIL.lo, pupil0), hi = Math.max(PUPIL.hi, pupil0)
  return clamp(rad, lo, hi) / pupil0
}
// the time constant of the ease for a mood (the design's `standard` curve over 300 ms to pin, 700 ms waking dilate, 450 ms back to base, as a
// first-order ease that is monotone at any dt: tau = duration / 3)
function pupilTau(mood, pk, target) {
  if (mood === "dilate") return PUPIL.wake / 3
  if (mood === "hot" || target < pk) return PUPIL.toPin / 3
  return PUPIL.back / 3
}
// pk: the multiplier now -> the multiplier after dt (no overshoot); hippus (level 2) is added by the caller, not integrated.
// moods: wake (pinned), dilate (base, at the pace of waking), base, hover, hot
function pupilNext(pk, mood, dt, arch, t, level, pupil0, amp) {
  var target = pupilTarget(arch, mood === "dilate" ? "base" : mood, pupil0 === undefined ? row(arch).pupil.base : pupil0, amp === undefined ? 1 : amp)
  if (level < 1) return target
  var a = 1 - Math.exp(-Math.max(0, dt) / pupilTau(mood, pk, target))
  return pk + (target - pk) * a
}
function hippusAt(seed, t, arch, level) {
  var r = row(arch)
  if (level < 2 || !(r.hippus > 0)) return 0
  return r.hippus * Math.sin(2 * Math.PI * 0.3 * t + 6.28 * hash(seed, SL.hip, 0))
}

// ---- the heartbeat (lub-dub): two gaussians at 0 and 0.28 of the beat, peaks 1 and 0.6, sigma 0.05 beat --------------------------------------
function beat(t, bpm) {
  var u = (t * bpm / 60) % 1
  if (u < 0) u += 1
  function g(c, h) {
    var d = Math.min(Math.abs(u - c), 1 - Math.abs(u - c)) / BEAT.sigma
    return h * Math.exp(-0.5 * d * d)
  }
  return Math.max(g(0, BEAT.lub), g(BEAT.peak2, BEAT.dub))
}
// bpm for a state: 54 at idle, 72 at the warn threshold, 110 critical; `frac` (0..1) is the reading's way toward the next step
function bpmFor(state, frac) {
  var f = clamp(frac === undefined ? 0 : frac, 0, 1)
  if (state === "critical") return BEAT.critical
  if (state === "hot") return lerp(BEAT.warn, BEAT.critical, f * 0.5)
  return lerp(BEAT.idle, BEAT.warn, f)
}

// ---- the tear: one every 7-14 s (full) or 14-24 s (subtle); form 1.2 s (decel), run 1.6 s (accel), vanish 0.3 s ------------------------------------
function tearPeriod(seed, level) { var r = level >= 2 ? TEAR.full : TEAR.subtle; return lerp(r[0], r[1], hash(seed, SL.tear, 0)) }
function tearStart(seed, level, k) {
  var P = tearPeriod(seed, level)
  return P * hash(seed, SL.tearPh, 0) + k * P + hash(seed, SL.tearJit, k) * 0.25 * P
}
// -> { u, k, on }: the bead's place along the baked trail (0 at the corner .. 1), its scale (0..1) and whether it is shown
function tearAt(seed, t, level) {
  if (level < 1) return { u: 0, k: 0, on: false }
  var P = tearPeriod(seed, level), k0 = Math.floor((t - P * hash(seed, SL.tearPh, 0)) / P), k, tau
  for (k = k0 - 1; k <= k0 + 1; k++) {
    tau = t - tearStart(seed, level, k)
    if (tau < 0 || tau >= TEAR.form + TEAR.run + TEAR.vanish) continue
    if (tau < TEAR.form) return { u: 0, k: bezier(CURVES.decel, tau / TEAR.form), on: true }
    if (tau < TEAR.form + TEAR.run) return { u: bezier(CURVES.accel, (tau - TEAR.form) / TEAR.run), k: 1, on: true }
    return { u: 1, k: 1 - bezier(CURVES.soft, (tau - TEAR.form - TEAR.run) / TEAR.vanish), on: true }
  }
  return { u: 0, k: 0, on: false }
}
function nextTearIn(seed, t, level) {
  if (level < 1) return Infinity
  var P = tearPeriod(seed, level), k0 = Math.floor((t - P * hash(seed, SL.tearPh, 0)) / P), k, d
  for (k = k0 - 1; k <= k0 + 2; k++) { d = tearStart(seed, level, k) - t; if (d > 0) return d }
  return Infinity
}

// ---- the spiral: one revolution in 40 s (subtle) or 24 s (full), inward hand; a 1.5 % breath at 0.25 Hz in full ------------------------------------
// -> { deg, breath } (breath: a scale around 1)
function spiralAngle(t, level, amp) {
  if (level < 1) return { deg: 0, breath: 1 }
  var T = (level >= 2 ? SPIRAL.full : SPIRAL.subtle) / Math.min(Math.max(amp, 0.001), 1.4)
  return { deg: -360 * ((t / T) % 1), breath: level >= 2 ? 1 + SPIRAL.breath * Math.sin(2 * Math.PI * SPIRAL.breathHz * t) : 1 }
}

// ---- the lid on the presence clock (section 1.3): opens on `reveal` (180 ms wait, 240 ms decel), shuts in 160 ms (accel) -------------------------
// ms since the edge; dir "open" or "exit"; -> b (0 open .. 1 shut). S = min(amp, 1.4), the same as presence.
function revealLid(ms, dir, amp) {
  var S = Math.min(Math.max(amp, 0.001), 1.4), s = ms / 1000
  if (dir === "exit") return bezier(CURVES.accel, s / (REVEAL.exit * S))
  var w = REVEAL.wait * S, d = REVEAL.open * S
  if (s <= w) return 1
  return 1 - bezier(CURVES.decel, (s - w) / d)
}

// ---- the core seal's sigil (EM4): a blink as a transform and a glance toward the busiest core ---------------------------------------------------------
// The sigil is 12 px: its blink is its height scaled about the lid line, 1 -> SIGIL.shut -> 1 (close 90 ms ease in, hold 40, open 160 ease out), every 14-30 s
// (seeded, closed form); its glance moves the iris item by at most SIGIL.glance px toward the hottest core's ray (a compass angle, 0 = 12 o'clock, clockwise).
var SIGIL = { every: [14, 30], close: 0.09, hold: 0.04, open: 0.16, shut: 0.12, glance: 1.2, tau: 0.09, minLoad: 0.15, still: 0.02 }
function sigilPeriod(seed) { return lerp(SIGIL.every[0], SIGIL.every[1], hash(seed, 195, 0)) }
function sigilStart(seed, k) { var P = sigilPeriod(seed); return P * hash(seed, 196, 0) + k * P + (hash(seed, 197, k) - 0.5) * 0.3 * P }
// -> the height scale 1 .. SIGIL.shut; 1 at level 0
function sigilBlinkAt(seed, t, level) {
  if (!(level >= 1) || !isFinite(t)) return 1
  var P = sigilPeriod(seed), k0 = Math.floor((t - P * hash(seed, 196, 0)) / P), k, tau, b
  for (k = k0 - 1; k <= k0 + 1; k++) {
    tau = t - sigilStart(seed, k)
    if (tau < 0 || tau >= SIGIL.close + SIGIL.hold + SIGIL.open) continue
    if (tau < SIGIL.close) b = (tau / SIGIL.close) * (tau / SIGIL.close)
    else if (tau < SIGIL.close + SIGIL.hold) b = 1
    else { var u = (tau - SIGIL.close - SIGIL.hold) / SIGIL.open; b = 1 - (1 - (1 - u) * (1 - u)) }
    return 1 - (1 - SIGIL.shut) * b
  }
  return 1
}
// ms until the next blink starts or the running one ends (Infinity at level 0): a host that sleeps between events can use it
function sigilNextIn(seed, t, level) {
  if (!(level >= 1)) return Infinity
  var P = sigilPeriod(seed), k0 = Math.floor((t - P * hash(seed, 196, 0)) / P), k, d
  for (k = k0 - 1; k <= k0 + 2; k++) { d = sigilStart(seed, k) - t; if (d > 0) return d * 1000 }
  return Infinity
}
// the index of the busiest core of `loads` (the first of equals), or -1 when none reaches SIGIL.minLoad
function hottestCore(loads) {
  var best = -1, bl = SIGIL.minLoad - 1e-9
  for (var i = 0; loads && i < loads.length; i++) { var v = Number(loads[i]); if (isFinite(v) && v > bl) { best = i; bl = v } }
  return best
}
// the glance target in px for a ray at compass `angle` (full only): { x, y }, length SIGIL.glance; null / NaN angle = the middle
function sigilGlanceTarget(angle, level) {
  var a = Number(angle)
  if (!(level >= 2) || !isFinite(a)) return { x: 0, y: 0 }
  var r = a * Math.PI / 180
  return { x: SIGIL.glance * Math.sin(r), y: -SIGIL.glance * Math.cos(r) }
}
// the follower: exponential toward the target (tau SIGIL.tau), no overshoot -> { x, y, moving }
function sigilGlanceNext(g, target, dt) {
  var a = 1 - Math.exp(-Math.max(0, dt) / SIGIL.tau), x = g.x + (target.x - g.x) * a, y = g.y + (target.y - g.y) * a
  var moving = Math.abs(target.x - x) > SIGIL.still || Math.abs(target.y - y) > SIGIL.still
  if (!moving) { x = target.x; y = target.y }
  return { x: x, y: y, moving: moving }
}

// ---- omens (section 1.4): rare, seeded, level 2 only ----------------------------------------------------------------------------------------------
var OMEN_KINDS = {
  crest: ["noticed", "doubletake", "extrapupil"]      // "wrongblink" needs the veiled second eye: the real crest is one eye, so it is not offered
}                                                      // (S14: the vessel's omens, ichor0 / eyeball / slit / whirl, went with the eyes in the liquid)
var OMEN_DUR = { noticed: 1.6, doubletake: 1.4, wrongblink: 0.4, extrapupil: 0.066 }
// a unit random from two integers (the host's pick among the surfaces that exist)
function hashUnit(i, salt) { return hash(i | 0, salt | 0, 0) }
function omenChance(amp) { return lerp(OMEN.calm, OMEN.lively, clamp((amp - 1) / 0.7, 0, 1)) }
// -> null or { kind, at, dur } (`at`: seconds after the reveal ends). At most one per open; none in the cooldown (lastAt: the shell-wide time of the
// last omen, in the same clock as `now`), none below level 2.
function omenPlan(seed, openIndex, level, amp, lastAt, now, surface) {
  if (level < 2 || !(amp > 0)) return null
  if (lastAt !== undefined && lastAt !== null && now - lastAt < OMEN.cooldown) return null
  if (hash(seed, SL.omen, openIndex) >= omenChance(amp)) return null
  var kinds = OMEN_KINDS[surface || "crest"] || OMEN_KINDS.crest
  var kind = kinds[Math.floor(hash(seed, SL.omenKind, openIndex) * kinds.length) % kinds.length]
  return { kind: kind, at: lerp(OMEN.window[0], OMEN.window[1], hash(seed, SL.omenAt, openIndex)), dur: OMEN_DUR[kind] }
}
// the overrides at `tau` s after the omen began -> { active, look, memo, pupil, noBlink, b, extra, phase }
//   look   "pointer" (turn straight at it), "memo" (where the pointer was when the omen began), "away" (follow the pointer out) or null
//   pupil  a multiplier override for the pupil (pin), or null; extra: the second pupil is shown; b: a lid override (the slow release blink), or -1
function omenState(plan, tau) {
  var none = { active: false, look: null, pupil: null, noBlink: false, b: -1, extra: false, phase: 0 }
  if (!plan || tau < 0 || tau >= plan.dur) return none
  var o = { active: true, look: null, pupil: null, noBlink: false, b: -1, extra: false, phase: tau / plan.dur }
  switch (plan.kind) {
    case "noticed":      // it stops, turns at the pointer, pins and does not blink; the release is one slow blink
      if (tau < 1.2) { o.look = "pointer"; o.pupil = PUPIL.pin; o.noBlink = true }
      else { var m = { close: 0.3, hold: 0.1, open: 0.2 }, r = blinkShape(m, tau - 1.2); o.look = "pointer"; o.b = r.b }
      break
    case "doubletake":   // it follows the pointer out, 500 ms later glances back to where it was, holds 700 ms, resumes
      if (tau < 0.5) o.look = "away"
      else if (tau < 1.2) o.look = "memo"
      break
    case "extrapupil": o.extra = true; break
    case "wrongblink": break
  }
  return o
}

// ---- the whole eye ------------------------------------------------------------------------------------------------------------------------------
// A state is a plain object, copied by every step. `newEye` makes one.
//   opt: { tier, pupil0 (the baked pupil as a fraction of the iris radius), S (px), openIndex }
function newEye(seed, arch, opt) {
  var o = opt || {}
  return { seed: seed | 0, arch: arch, shown: arch, tier: o.tier === undefined ? 2 : o.tier, pupil0: o.pupil0 > 0 ? o.pupil0 : row(arch).pupil.base, S: o.S || 68,
           t: 0, g: { x: 0, y: 0, gl: false }, pk: 1, swap: null, omen: null, omenT0: 0, omenMemo: { x: 0, y: 0 }, pinnedAt: null, started: false,
           out: restOut(arch, o.tier === undefined ? 2 : o.tier), busy: 0, next: TICK.max }
}
function restOut(arch, tier) {
  return { frame: 0, b: 0, gazeX: 0, gazeY: 0, pupilK: 1, irisRot: 0, veinK: 1, tearU: 0, tearK: 0, omenPupil: 0, arch: arch }
}
function copyState(s) {
  var o = {}, k
  for (k in s) o[k] = s[k]
  o.g = { x: s.g.x, y: s.g.y, gl: s.g.gl }
  o.omenMemo = { x: s.omenMemo.x, y: s.omenMemo.y }
  return o
}

// One tick. t: the eye's clock (s), dt: since the last tick (s). input:
//   level, amp         from levelOf and the host
//   arch               the archetype the eye should wear (a change is swapped behind a blink)
//   ready              the plates of the displayed archetype are baked (the shut and the open frame), so the lids may open
//   hover, look{dx,dy} the pointer over the head / vessel, and its vector from the eye's centre in px (null: no pointer)
//   S, rot, mirror     the eye's size in px, its rotation (deg), whether it is mirrored (for the pointer vector)
//   hot, critical      the state (pupil mood, pulse)
//   revealMs, exitMs   ms since the open edge (null once the wake is over) / since the exit began (null when not leaving)
//   bloodshot, pulse   veins: the eye's bloodshot (0..1) and whether the heart may beat ("hot" at level 1, "always" at level 2 above 0.6)
//   bpm                beats per minute for the pulse
//   plan, planT0       the omen plan and the clock at which its `at` is counted from (null: none)
// -> a new state with `.out` (the ItoEyeLive inputs: frame, gazeX, gazeY, pupilK, irisRot, veinK, tearU, tearK, omenPupil, arch), `.busy`
//    (0 still, 1 slow things only, 2 a transition), and `.next` (ms until anything changes: the host sleeps that long).
function stepEye(st, t, dt, inp) {
  var s = copyState(st), arch = inp.arch || st.shown, level = inp.level | 0, amp = inp.amp === undefined ? 1 : inp.amp
  s.t = t
  if (inp.tier !== undefined && inp.tier !== null) s.tier = inp.tier
  // level 0: the eye is open, still, at its baked pupil; a new archetype is simply worn (the bake changes with no blink)
  if (level < 1) {
    s.shown = arch; s.swap = null; s.g = { x: 0, y: 0, gl: false }; s.pk = 1; s.omen = null
    s.out = restOut(arch, s.tier); s.busy = 0; s.next = Infinity
    return s
  }
  var tier = s.tier, shut = shutFrame(tier), b = 0, phase = 0, busy = 0
  var rowA = row(s.shown)

  // ---- a state edge: the lids close, the new face is worn under the shut frame, the lids open ----------------------------------------------------
  if (s.swap === null && arch !== s.shown) s.swap = { t0: t, ph: "close", at: 0 }
  var swapB = -1
  if (s.swap) {
    var sw = s.swap, mc = blinkSpec("stare", 2), cl = mc.close, op = blinkSpec("heavy", 2).open
    if (sw.ph === "close") {
      var u = (t - sw.t0) / cl
      swapB = bezier(CURVES.accel, u)
      if (u >= 1) { s.shown = arch; sw.ph = "hold"; sw.at = t; swapB = 1; s.pk = 1; s.g = { x: 0, y: 0, gl: false }; rowA = row(s.shown) }
    } else if (sw.ph === "hold") {
      swapB = 1
      if (inp.ready !== false && t - sw.at >= 0.05) { sw.ph = "open"; sw.at = t }
    } else {
      var uo = (t - sw.at) / op
      swapB = 1 - bezier(CURVES.decel, uo)
      if (uo >= 1) { s.swap = null; swapB = -1 }
    }
    busy = 2
  }
  arch = s.shown

  // ---- the lids ----------------------------------------------------------------------------------------------------------------------------------
  var plan = level >= 2 && !s.swap ? (inp.plan || null) : null, om = plan && inp.planT0 !== null && inp.planT0 !== undefined ? omenState(plan, t - inp.planT0 - plan.at) : omenState(null, 0)
  var rv = 0, revealing = inp.revealMs !== null && inp.revealMs !== undefined, leaving = inp.exitMs !== null && inp.exitMs !== undefined
  if (revealing) { rv = revealLid(inp.revealMs, "open", amp); if (rv > 0 || inp.revealMs < (REVEAL.wakeEnd * 1000 * Math.min(amp, 1.4))) busy = 2 }
  if (leaving) { rv = Math.max(rv, revealLid(inp.exitMs, "exit", amp)); busy = 2 }
  var bl = blinkReal(s.seed, t, arch, level, amp)
  b = om.noBlink ? 0 : bl.b
  phase = bl.phase
  if (om.b >= 0) b = Math.max(b, om.b)
  if (swapB >= 0) b = Math.max(b, swapB)
  b = Math.max(b, rv)
  if (phase >= 1 && phase <= 3) busy = 2
  if (phase === 4) busy = Math.max(busy, rowA.sag && Math.abs(bl.b - rowA.sag.depth) < 1e-3 ? 1 : 2)   // a sag's hold is slow, its sink and lift are a transition

  // ---- the gaze ----------------------------------------------------------------------------------------------------------------------------------
  var target, pointer = lookTarget(inp.look, inp.S || s.S, inp.rot, inp.mirror, arch, amp)
  var idle = fixationAt(s.seed, t, arch, level, amp)
  var gk = Math.min(Math.max(amp, 0), 1.2)
  target = { x: idle.x * gk, y: idle.y * gk }
  if (level >= 2) { var mc2 = microAt(s.seed, t, arch); target.x += mc2.x; target.y += mc2.y }
  if (inp.look) target = pointer
  else if (inp.hover) target = pointer
  // an omen turns the eye straight at the pointer (or at the card centre: 0, 0), or where it was
  if (om.active && om.look === "pointer") target = inp.look ? lookTarget(inp.look, inp.S || s.S, inp.rot, inp.mirror, arch, 1.2) : { x: 0, y: 0 }
  if (om.active && om.look === "away") { target = pointer }
  if (om.active && om.look === "memo") { target = s.omenMemo }
  else if (om.active && om.look === "away") s.omenMemo = { x: pointer.x, y: pointer.y }
  if (revealing && inp.revealMs < REVEAL.wait * 1000) target = { x: 0, y: 0 }
  target = clampBox(target.x, target.y, arch)
  var gb = box(arch)
  if (s.swap && s.swap.ph !== "open") { s.g = { x: 0, y: 0, gl: false } }
  else {
    var gn = gazeNext(s.g, target, dt, arch)
    s.g = { x: gn.x, y: gn.y, gl: gn.gl }
    if (gn.moving) busy = 2
  }
  // the upper lid follows the eye down (level 2, the full tiers): a frame pick, not a new bake. A lidless eye (and a loose eyeball) has no lid to follow it.
  if (level >= 2 && tier >= 2 && rowA.blink && gb.y > 0 && s.g.y > GAZE.band * gb.y) b = Math.max(b, 0.35)

  // ---- the pupil -----------------------------------------------------------------------------------------------------------------------------------
  var mood = "base", S1 = Math.min(Math.max(amp, 0.001), 1.4)
  if (inp.hot) mood = "hot"
  else if (revealing && inp.revealMs < (REVEAL.wait + REVEAL.open) * 1000 * S1) mood = "wake"
  else if (revealing && inp.revealMs < REVEAL.wakeEnd * 1000 * S1) mood = "dilate"
  else if (inp.hover || om.active) mood = "hover"
  s.pupil0 = inp.pupil0 > 0 ? inp.pupil0 : s.pupil0
  var pk0 = s.pk
  if (om.pupil !== null && om.pupil !== undefined) {
    var pinT = pupilTarget(arch, "wake", s.pupil0, amp)
    s.pk = pk0 + (pinT - pk0) * (1 - Math.exp(-dt / (PUPIL.toPin / 3)))
  } else if (mood === "wake") {
    s.pk = pupilTarget(arch, "wake", s.pupil0, amp)          // pinned until the lids are open
  } else {
    s.pk = pupilNext(pk0, mood === "hover" && !rowA.pupil.react ? "base" : mood, dt, arch, t, level, s.pupil0, amp)
  }
  var tgtP = pupilTarget(arch, mood === "dilate" ? "base" : mood, s.pupil0, amp)
  if (Math.abs(s.pk - tgtP) > 0.002 && rowA.pupil.base > 0) busy = Math.max(busy, 2)
  if (om.pupil !== null && om.pupil !== undefined) busy = 2
  var hip = hippusAt(s.seed, t, arch, level)
  var pk = s.pk * (1 + hip)

  // ---- the specials --------------------------------------------------------------------------------------------------------------------------------
  var irisRot = 0, tearU = 0, tearK = 0, veinK = 1
  if (arch === "spiral") {
    var sa = spiralAngle(t, level, amp)
    irisRot = sa.deg; pk = sa.breath
    busy = Math.max(busy, 1)
  }
  if (arch === "weeping") {
    var te = tearAt(s.seed, t, level)
    if (te.on) { tearU = te.u; tearK = te.k; busy = Math.max(busy, 2) }
  }
  var vOn = inp.pulse === true || (inp.pulse === "hot" && (inp.hot || inp.critical)) || (inp.pulse === "always" && (inp.bloodshot || 0) >= 0.6)
  if (vOn) { veinK = 0.72 + 0.28 * beat(t, inp.bpm || BEAT.idle); busy = Math.max(busy, 1) }
  if (level >= 2 && (hip !== 0 || rowA.micro > 0)) busy = Math.max(busy, 1)

  s.out = { frame: frameOf(b, tier), b: b, gazeX: s.g.x, gazeY: s.g.y, pupilK: pk, irisRot: irisRot, veinK: veinK, tearU: tearU, tearK: tearK,
            omenPupil: om.extra ? 1 : 0, arch: s.shown }
  if (om.active) busy = 2
  s.busy = busy
  // ---- how long the host may sleep ---------------------------------------------------------------------------------------------------------------
  if (busy === 2) s.next = TICK.fast
  else if (busy === 1) s.next = TICK.slow
  else {
    var n = Math.min(nextBlinkIn(s.seed, t, arch, level), nextFixIn(s.seed, t, arch, level, amp), arch === "weeping" ? nextTearIn(s.seed, t, level) : Infinity)
    if (plan && inp.planT0 !== null && inp.planT0 !== undefined) { var dOm = inp.planT0 + plan.at - t; if (dOm > 0) n = Math.min(n, dOm) }
    s.next = clamp(Math.ceil(n * 1000) + 2, 16, TICK.max)   // wake just after the event, never before it
  }
  return s
}
// ms until anything changes (the host sleeps that long); Infinity at level 0
function nextEventIn(st, t) {
  if (st.busy === 2) return TICK.fast
  if (st.busy === 1) return TICK.slow
  return st.next
}

if (typeof module !== "undefined") module.exports = {
  BOX: BOX, TICK: TICK, CURVES: CURVES, MOTION: MOTION, PUPIL: PUPIL, GAZE: GAZE, REVEAL: REVEAL, BEAT: BEAT, SIGIL: SIGIL, sigilBlinkAt: sigilBlinkAt, sigilNextIn: sigilNextIn, hottestCore: hottestCore, sigilGlanceTarget: sigilGlanceTarget, sigilGlanceNext: sigilGlanceNext, SPIRAL: SPIRAL, TEAR: TEAR, OMEN: OMEN, FRAMES: FRAMES,
  OMEN_KINDS: OMEN_KINDS, OMEN_DUR: OMEN_DUR, BLINK_GAP: BLINK_GAP,
  bezier: bezier, levelOf: levelOf, frameValues: frameValues, frameOf: frameOf, shutFrame: shutFrame, blinkReal: blinkReal, blinkSpec: blinkSpec, blinkLen: blinkLen,
  blinkShape: blinkShape, blinkStart: blinkStart, blinkCount: blinkCount, fixationAt: fixationAt, microAt: microAt, gazeNext: gazeNext, lookTarget: lookTarget,
  clampBox: clampBox, pupilNext: pupilNext, pupilTarget: pupilTarget, hippusAt: hippusAt, beat: beat, bpmFor: bpmFor, tearAt: tearAt, spiralAngle: spiralAngle,
  revealLid: revealLid, omenPlan: omenPlan, hashUnit: hashUnit, OMEN_KINDS: OMEN_KINDS, OMEN_DUR: OMEN_DUR, omenState: omenState, omenChance: omenChance, newEye: newEye,
  stepEye: stepEye, nextEventIn: nextEventIn, hash: hash
}
