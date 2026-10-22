.pragma library

// One heart for the shell (eyes-animation.md section 5.2, P1): the lub-dub beat every living value can share. Pure: no I/O, no clock, no colours.
// `beat(t, bpm)` is 0..1 (two gaussians at 0 and 0.28 of the beat, peaks 1 and 0.6, sigma 0.05 beat) and `bpmFor(state, frac)` is the rate: 54 idle,
// 72 at the warn threshold, 110 critical. A host reads the bpm on each tick of a clock it already has, so the heart adds no clock.
// ItoEyeMotion.js (which may import nothing) carries the same numbers; scripts/qa/models.test.mjs (EM-T7) keeps the two copies equal.

var BEAT = { idle: 54, warn: 72, critical: 110, peak2: 0.28, sigma: 0.05, lub: 1, dub: 0.6 }

function clamp(v, lo, hi) { return v < lo ? lo : (v > hi ? hi : v) }
function lerp(a, b, t) { return a + (b - a) * t }

function beat(t, bpm) {
  var u = (Number(t) * Number(bpm) / 60) % 1
  if (!isFinite(u)) return 0
  if (u < 0) u += 1
  function g(c, h) {
    var d = Math.min(Math.abs(u - c), 1 - Math.abs(u - c)) / BEAT.sigma
    return h * Math.exp(-0.5 * d * d)
  }
  return Math.max(g(0, BEAT.lub), g(BEAT.peak2, BEAT.dub))
}
// state: "calm" | "hot" | "critical"; frac (0..1) is the reading's way toward the next step
function bpmFor(state, frac) {
  var f = clamp(Number(frac) || 0, 0, 1)
  if (state === "critical") return BEAT.critical
  if (state === "hot") return lerp(BEAT.warn, BEAT.critical, f * 0.5)
  return lerp(BEAT.idle, BEAT.warn, f)
}

if (typeof module !== "undefined" && module.exports) module.exports = { BEAT: BEAT, beat: beat, bpmFor: bpmFor }
