.pragma library

// The popup's opening and closing as a pure timeline (ito-panel-presence/motion-spec.md section 1-2, icons-v5.md section 4,
// visual-systems.md section 2.6). No QML imports: node tests and the lab call the same functions.
//
// `phases(t, opts)` answers, for a clock `t` in ms, where every channel is. The channels:
//   pa      along the bar, 0..1          pb      away from the bar, 0..1 (peaks about 1.02 on the way in)
//   fill    the sheet's ink alpha, 0..1  reveal  the ornaments (rules, corners, crest), 0..1
//   sh      the A6 shoulders' scale      lu, ll  the A3 upper and lower lid, 0 shut .. 1 open (null with no lid)
//   c[i]    the content's opacity `o` and travel `d` in px (+ = away from the bar), i = min(index, 7)
// Every channel lerps from its value in `opts.from` (a snapshot of an earlier call, or the rest state) to its target over its own
// window, so an interrupted open or close is continuous. Times scale by S = min(amp, 1.0), distances by D = amp.
// Curves and role numbers are a mirror of ItoMotion.js (no JS-to-JS import); a node test asserts that they are equal.

var CURVES = {
  decel: [0.05, 0.7, 0.1, 1, 1, 1],
  accel: [0.3, 0, 0.8, 0.15, 1, 1],
  soft: [0.34, 0.8, 0.34, 1, 1, 1],
  morph: [0.32, 1.25, 0.4, 1, 1, 1],
  fastSpatial: [0.42, 1.67, 0.21, 0.90, 1, 1],
  slowSpatial: [0.39, 1.29, 0.35, 0.98, 1, 1]
}
// the roles this timeline uses (visual-systems section 2.6 rule 1)
var ROLES = {
  arrive:      { ms: 240, curve: "decel" },
  leave:       { ms: 160, curve: "accel" },
  morph:       { ms: 280, curve: "morph" },
  spatialFast: { ms: 280, curve: "fastSpatial" },
  spatialSlow: { ms: 340, curve: "slowSpatial" }
}

// the spiral/blot opening's own curve (anatomy, not a role). visual-v3 gave [0.22, 0.61, 0.36, 1], which puts the arm at 98 % of the card
// by 120 ms (the spec's own gate says 35-60 %): the sweep would be over in 70 ms and unreadable. This one is nearly linear with soft
// ends, so the arm is seen travelling: 23 % at 80 ms, 54 % at 120, 81 % at 160, 100 % at 240.
var UNWIND = [0.33, 0.3, 0.66, 0.7, 1, 1]
// Base totals at the reference opening speed (openDuration 340 ms = scale 1). Every "in" total is 340 so `openDuration` IS the length
// of the main reveal; the masked opening grew from 260 to 340 so its content fade (which ends at 330) is no longer cut by the end.
var TOTALS = { inPlain: 340, inLid: 340, outPlain: 220, outLid: 240, inSwitch: 340, inMask: 340, outMask: 170 }
// the user's opening speed (sidecar `openDuration`, ms): the reference length, the range and the default. The scale is k = openDuration / REF.
var OPEN = { ref: 340, min: 150, max: 2400, step: 50, dflt: 900, outFloor: 150 }
// thematic curves of the masked openings (same bezier form, no new clock): the blot is an ink bleed (slow start, fast spread, long tail), the
// spiral a slow wind-up that accelerates and settles
var BLEED = [0.55, 0, 0.2, 1, 1, 1]
var SPIRAL_EASE = [0.33, 0, 0.15, 1, 1, 1]
// the static opening (S14): a band of radio static sweeps the card in from the bar side, eased like a tube warming up
var STATIC_EASE = [0.4, 0, 0.2, 1, 1, 1]
var STAGGER = { start: 60, step: 16, dur: 160, max: 7, rise: 10, fall: 6 }
var OVERSHOOT_PX = 6

function clamp01(x) { return x < 0 ? 0 : x > 1 ? 1 : x }
function lerp(a, b, u) { return a + (b - a) * u }

// Cubic bezier through (0,0) and (1,1), control points c = [x1, y1, x2, y2, 1, 1]: y at x (bisection on the x(t) polynomial).
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

function S(amp) { return Math.min(Number(amp) || 0, 1) }

// the opening speed as a scale of the base windows: k = openDuration / 340, clamped to the range; absent or not a number = 1 (the base)
function openK(ms) {
  var v = Number(ms)
  if (!isFinite(v) || v <= 0) return 1
  return Math.max(OPEN.min, Math.min(OPEN.max, v)) / OPEN.ref
}
// the closing's scale: shorter than the opening (about 0.6 of it at the default) and never below the floor, so it stays brisk
function outK(k) { return 0.9 * k + 0.1 }
// `k` is the in-scale (openK(openDuration)); a missing k is 1
function kOf(dir, k) { var kk = isFinite(k) && k > 0 ? Number(k) : 1; return dir === "in" ? kk : outK(kk) }   // time never scales past 1.0 (motion speed rule); distances scale by amp

// total time in ms of one direction. opts: { lid: bool, sw: bool, mask: "spiral" | "blot" | "static" | null } (a switch never masks)
function total(dir, amp, opts) {
  if (!(amp > 0)) return 0
  var o = opts || {}
  var mk = !!o.mask && !o.sw
  var base = dir === "in" ? (o.sw ? TOTALS.inSwitch : mk ? TOTALS.inMask : o.lid ? TOTALS.inLid : TOTALS.inPlain)
                          : (o.sw ? 0 : mk ? TOTALS.outMask : o.lid ? TOTALS.outLid : TOTALS.outPlain)
  var ms = Math.round(base * S(amp) * kOf(dir, o.k))
  return dir === "out" && base > 0 ? Math.max(OPEN.outFloor, ms) : ms
}

// The A3 lid's two-step parting (icons-v5 section 4.3): x is the 100-320 window's progress, 0..1. A brisk first slit (12 %), a held
// beat, then a long soft landing. Anatomy, not UI: it keeps its own shape and is not a role.
function lidOpen(x) {
  x = clamp01(x)
  if (x < 0.25) return 0.12 * bezier(CURVES.decel, x / 0.25)
  if (x < 0.40) return 0.12
  return 0.12 + 0.88 * bezier(CURVES.decel, (x - 0.40) / 0.60)
}

function restState(open, lid) {
  var c = []
  for (var i = 0; i <= STAGGER.max; i++) c.push({ o: open ? 1 : 0, d: 0 })
  return { pa: open ? 1 : 0, pb: open ? 1 : 0, fill: open ? 1 : 0, reveal: open ? 1 : 0, sh: open ? 1 : 0,
           lu: lid ? (open ? 1 : 0) : null, ll: lid ? (open ? 1 : 0) : null, mk: null, c: c, done: true }
}

// One channel: from `a` to `b` over [start, start + dur] (base ms) on a bezier curve.
function chan(tt, a, b, start, dur, curve) {
  return lerp(a, b, bezier(curve, clamp01((tt - start) / dur)))
}
function role(name) { return ROLES[name] }

// Every channel finite: a non-number (a NaN from a bad snapshot, an undefined field) is replaced by its end value, so nothing
// non-finite can ever reach an Item property (Qt 6.12 lets opacity NaN through, and the scene graph crashes on it:
// presence-crash.md). Pure; returns the same object.
function sane(o, dir) {
  var end = dir === "in" ? 1 : 0
  var keys = ["pa", "pb", "fill", "reveal", "sh"]
  for (var k = 0; k < keys.length; k++) if (!isFinite(o[keys[k]])) o[keys[k]] = end
  if (o.mk !== null && o.mk !== undefined && !isFinite(o.mk)) o.mk = end
  if (o.lu !== null && !isFinite(o.lu)) o.lu = end
  if (o.ll !== null && !isFinite(o.ll)) o.ll = end
  for (var i = 0; i < o.c.length; i++) {
    if (!isFinite(o.c[i].o)) o.c[i].o = end
    if (!isFinite(o.c[i].d)) o.c[i].d = 0
  }
  return o
}

// opts: { dir: "in"|"out", amp, k (openK of the user's openDuration, default 1), lid: bool, sw: bool, mask: "spiral"|"blot"|null, from: a snapshot (the shape this returns) or null }
function phases(t, opts) { return sane(phasesRaw(t, opts), opts && opts.dir === "in" ? "in" : "out") }
function phasesRaw(t, opts) {
  var dir = opts.dir, amp = Number(opts.amp) || 0, lid = opts.lid === true, sw = opts.sw === true
  var mask = !sw && (opts.mask === "spiral" || opts.mask === "blot" || opts.mask === "static") ? opts.mask : null
  if (mask) lid = false
  var from = opts.from || restState(dir === "out", lid && dir === "out")
  var tot = total(dir, amp, { lid: lid, sw: sw, mask: mask, k: opts.k })
  // amp 0: everything sits at its end state, now
  if (!(amp > 0) || tot === 0) return restState(dir === "in", false)
  var s = S(amp), D = amp
  // every window below is in base ms: one divisor stretches the whole timeline (time by the motion amp, by the opening speed)
  var tt = t / (s * kOf(dir, opts.k)), done = t >= tot
  var o = { pa: 0, pb: 0, fill: 0, reveal: 0, sh: 0, lu: null, ll: null, mk: null, c: [], done: done }
  var fc = from.c || []
  var arrive = role("arrive"), leave = role("leave"), morph = role("morph"), fast = role("spatialFast"), slow = role("spatialSlow")
  var i, f, start
  if (mask) return maskPhases(tt, o, from, fc, dir, D, mask)
  if (dir === "in") {
    if (sw) {
      // a switch: the sheet is already inked and grows from the previous card's rect on the long spatial role
      o.fill = chan(tt, from.fill, 1, 0, 70, CURVES.soft)
      o.pa = chan(tt, from.pa, 1, 0, slow.ms, CURVES[slow.curve])
      o.pb = chan(tt, from.pb, 1, 0, slow.ms, CURVES[slow.curve])
    } else {
      o.fill = chan(tt, from.fill, 1, 0, 70, CURVES.soft)
      o.pa = chan(tt, from.pa, 1, 0, arrive.ms, CURVES[arrive.curve])
      o.pb = chan(tt, from.pb, 1, 30, morph.ms, CURVES[morph.curve])
    }
    o.reveal = chan(tt, from.reveal, 1, 90, 220, CURVES.decel)
    o.sh = chan(tt, from.sh, 1, 30, fast.ms, CURVES[fast.curve])
    if (lid && !sw) {
      var fu = from.lu === null || from.lu === undefined ? 0 : from.lu, fl = from.ll === null || from.ll === undefined ? 0 : from.ll
      o.lu = lerp(fu, 1, lidOpen((tt - 100) / 220))
      o.ll = lerp(fl, 1, lidOpen((tt - 120) / 220))
    }
    for (i = 0; i <= STAGGER.max; i++) {
      f = fc[i] || { o: 0, d: STAGGER.rise * D }
      start = STAGGER.start + STAGGER.step * i
      o.c.push({ o: chan(tt, f.o, 1, start, STAGGER.dur, CURVES.decel), d: chan(tt, f.d, 0, start, STAGGER.dur, CURVES.decel) })
    }
    return o
  }
  // out
  if (sw) return restState(false, false)
  var pStart = lid ? 80 : 40, fStart = lid ? 150 : 150
  o.pa = chan(tt, from.pa, 0, pStart, leave.ms, CURVES[leave.curve])
  o.pb = chan(tt, from.pb, 0, pStart, leave.ms, CURVES[leave.curve])
  o.fill = chan(tt, from.fill, 0, fStart, 70, CURVES.accel)
  o.reveal = chan(tt, from.reveal, 0, 0, 90, CURVES.accel)
  o.sh = chan(tt, from.sh, 0, pStart, leave.ms, CURVES[leave.curve])
  if (lid) {
    var gu = from.lu === null || from.lu === undefined ? 1 : from.lu, gl = from.ll === null || from.ll === undefined ? 1 : from.ll
    // the upper lid leads, the lower one lags 40 ms
    o.lu = chan(tt, gu, 0, 0, 160, CURVES.accel)
    o.ll = chan(tt, gl, 0, 40, 160, CURVES.accel)
  }
  for (i = 0; i <= STAGGER.max; i++) {
    f = fc[i] || { o: 1, d: 0 }
    o.c.push({ o: chan(tt, f.o, 0, 0, 90, CURVES.accel), d: chan(tt, f.d, -STAGGER.fall * D, 0, 90, CURVES.accel) })
  }
  return o
}

// The spiral/blot opening (visual-v3.md section 1.5). The sheet sits on the card's rect from t 0 (no icon morph: the time map already
// starts at the icon); `mk` is the map's progress. The base window is 340 ms in / 170 out (scaled by the opening speed), content and ornaments as in the plain run.
function maskPhases(tt, o, from, fc, dir, D, kind) {
  var i, f, start
  var fm = from.mk === null || from.mk === undefined ? (dir === "in" ? 0 : 1) : from.mk
  o.pa = 1; o.pb = 1
  if (dir === "in") {
    o.fill = 1
    // the mask takes the first 70 % of the run on its thematic curve; the content fades in over the last 40 % (from 60 %), then the ornaments
    o.mk = tt >= 240 ? 1 : lerp(fm, 1, bezier(kind === "blot" ? BLEED : kind === "static" ? STATIC_EASE : SPIRAL_EASE, clamp01(tt / 240)))
    o.reveal = chan(tt, from.reveal, 1, 150, 190, CURVES.decel)
    o.sh = chan(tt, from.sh, 1, 30, ROLES.spatialFast.ms, CURVES[ROLES.spatialFast.curve])
    for (i = 0; i <= STAGGER.max; i++) {
      f = fc[i] || { o: 0, d: STAGGER.rise * D }
      start = 130 + 10 * i
      o.c.push({ o: chan(tt, f.o, 1, start, 130, CURVES.decel), d: chan(tt, f.d, 0, start, 130, CURVES.decel) })
    }
    return o
  }
  o.mk = tt >= 150 ? 0 : lerp(fm, 0, bezier(CURVES.accel, clamp01(tt / 150)))
  o.fill = chan(tt, from.fill, 0, 150, 20, CURVES.accel)
  o.reveal = chan(tt, from.reveal, 0, 0, 90, CURVES.accel)
  o.sh = chan(tt, from.sh, 0, 0, 120, CURVES.accel)
  for (i = 0; i <= STAGGER.max; i++) {
    f = fc[i] || { o: 1, d: 0 }
    o.c.push({ o: chan(tt, f.o, 0, 0, 90, CURVES.accel), d: chan(tt, f.d, -STAGGER.fall * D, 0, 90, CURVES.accel) })
  }
  return o
}

// A snapshot with a defined lid shape, for the next call's `from`.
function snapshot(ph) { return JSON.parse(JSON.stringify(ph)) }

// The sheet's rectangle in card coordinates. I: where it starts (the icon rect, the strip, or the previous card), C: the card.
// side: the bar's side ("top" | "bottom" | "left" | "right"). pa moves along the bar, pb away from it. Where pb passes 1 the extra
// growth is capped at 6 px, away from the bar, so the bar-facing edge never passes the card's edge.
function rect(ph, I, C, side, radiusEnd) {
  var horiz = side === "top" || side === "bottom"
  var ua = Math.min(ph.pa, 1), uw = Math.min(ph.pb, 1)          // pa: along the bar, pb: away from it
  var x = lerp(I.x, C.x, horiz ? ua : uw), w = lerp(I.w, C.w, horiz ? ua : uw)
  var y = lerp(I.y, C.y, horiz ? uw : ua), h = lerp(I.h, C.h, horiz ? uw : ua)
  var ex = Math.max(0, ph.pb - 1)
  if (ex > 0) {
    var span = horiz ? (C.h - I.h) : (C.w - I.w)
    var grow = Math.min(OVERSHOOT_PX, Math.abs(span) * ex)
    if (horiz) { if (side === "bottom") y -= grow; h += grow }
    else { if (side === "right") x -= grow; w += grow }
  }
  var r0 = Math.min(I.w, I.h) / 2
  var r = lerp(r0, radiusEnd === undefined ? 3 : radiusEnd, Math.max(0, Math.min(1, ph.pb)))
  return { x: x, y: y, w: w, h: h, r: Math.max(0, r) }
}

// The icon rect of a KeyboardPanel host in card coordinates (motion-spec section 3), inflated by 2 px. h: the host's geometry numbers.
function iconRect(h) {
  var x = h.ax, y = h.ay
  if (h.barPos === "bottom") y = h.screenH - h.barH + h.ay
  if (h.barPos === "right") x = h.screenW - h.barW + h.ax
  return { x: x - h.ox - 2, y: y - h.oy - 2, w: h.aw + 4, h: h.ah + 4 }
}

// The contained hosts' 56 x 6 strip, flush with the card's bar-facing edge, centred on `cx` along the bar (card centre when null).
function stripRect(side, C, cx) {
  var long = 56, thin = 6
  if (side === "top" || side === "bottom") {
    var mid = cx === null || cx === undefined ? C.w / 2 : cx
    return { x: C.x + mid - long / 2, y: side === "top" ? C.y : C.y + C.h - thin, w: long, h: thin }
  }
  var midY = cx === null || cx === undefined ? C.h / 2 : cx
  return { x: side === "left" ? C.x : C.x + C.w - thin, y: C.y + midY - long / 2, w: thin, h: long }
}

// The previous card's rect, in this card's coordinates, for a switch (both windows are full-screen on the same screen).
function toCard(rectScreen, origin) {
  return { x: rectScreen.x - origin.x, y: rectScreen.y - origin.y, w: rectScreen.w, h: rectScreen.h }
}

// Lid anatomy numbers (icons-v5 section 4.3), for a card W x H: where the two lids meet and how far each travels open.
function lidGeometry(W, H) {
  var meet = 0.62 * H, a = 0.10 * H
  return { meet: meet, a: a, upperH: meet + a, lowerH: 0.38 * H + a, upperClosedY: 0, upperOpenY: -(meet + a) - 12,
           lowerClosedY: meet - a, lowerOpenY: meet - a + (0.38 * H + a) + 12 }
}

if (typeof module !== "undefined") module.exports = { CURVES: CURVES, UNWIND: UNWIND, BLEED: BLEED, SPIRAL_EASE: SPIRAL_EASE, STATIC_EASE: STATIC_EASE, OPEN: OPEN, openK: openK, outK: outK, ROLES: ROLES, TOTALS: TOTALS, STAGGER: STAGGER, OVERSHOOT_PX: OVERSHOOT_PX,
  bezier: bezier, total: total, phases: phases, sane: sane, restState: restState, snapshot: snapshot, lidOpen: lidOpen, rect: rect, iconRect: iconRect,
  stripRect: stripRect, toCard: toCard, lidGeometry: lidGeometry, S: S }
