.pragma library

// The motion of the manga icons (icons-v3.md section 5): what each icon does on an edge (hover, press, a state change, the
// first draw, a rare omen), as pure functions. The same organic, unsettling hand as the real eyes (ItoEyeMotion.js): quick,
// uneven departures, long soft landings, a second small twitch after the first, nothing perfectly periodic.
//
// No I/O, no QML types, no colours, no imports. Closed form in (seed, n, t): `n` is the event's serial number, so two hovers in
// a row are not the same gesture, and a test replays any one of them exactly. The bezier curves are mirrored from ItoMotion.js
// (CURVES; a node test asserts the copies match).
//
//   phase(kind, event, tMs, amp, seed, ctx) -> pose
//     ctx: { rig, size, n, px, py, which, hold }   rig: iconParts().rig (each moving group's origin in the 48-unit grid);
//          px, py: the pointer over the icon (-1..1, 0 = centre); which: the part an edge concerns (mem: the eye that opened)
//     pose: { root: T, groups: { name: T }, layers: { under, level, over, hl }, glintDx }   T: { dx, dy, rot, sx, sy, ox, oy, op }
//   duration(kind, event, amp)   ms; 0 when there is nothing to play (amp 0, or no such gesture for this kind)
//   edge(kind, prev, next)       the event a state change plays ("" for none)
//   omenDue(kind, seed, nowMs, lastMs, on, amp)   the rare omen: p = 1/240 per data update minute, >= 20 min since the last one
//
// Rules (v2 section 6): `amp` (motionAmp 0 / 1 / 1.7) multiplies time and distance; amp 0 is the rest pose at every t (the state
// still changes, instantly). At t >= duration every event returns the rest pose EXACTLY (`hover` holds the pointer follow, which
// is zero with the pointer centred). Lengths are 48-grid units, angles degrees. A host plays one event at a time.

var CURVES = {
  decel: [0.05, 0.7, 0.1, 1, 1, 1],
  accel: [0.3, 0, 0.8, 0.15, 1, 1],
  standard: [0.2, 0, 0, 1, 1, 1],
  spring: [0.38, 1.21, 0.22, 1, 1, 1],
  soft: [0.34, 0.8, 0.34, 1, 1, 1]
}
var OMEN = { p: 1 / 240, cooldownMs: 20 * 60 * 1000 }
// the last omen anywhere in the shell (a .pragma library is one instance per engine); hosts read and write `last`
var shared = { last: -1e15 }

function clamp(v, lo, hi) { return v < lo ? lo : (v > hi ? hi : v) }
function lerp(a, b, t) { return a + (b - a) * t }
function hash(seed, salt, i) {
  var x = ((seed | 0) * 374761393 + salt * 668265263 + i * 362437) | 0
  x = Math.imul(x ^ (x >>> 13), 1274126177)
  x = x ^ (x >>> 16)
  return (x >>> 0) / 4294967296
}
function hs(seed, salt, i, lo, hi) { return lo + (hi - lo) * hash(seed, salt, i) }
function strHash(s) { var h = 7; for (var i = 0; i < s.length; i++) h = (Math.imul(h, 31) + s.charCodeAt(i)) | 0; return h }

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
function ez(name, x) { return bezier(CURVES[name], clamp(x, 0, 1)) }

// ---- shapes of time (x in 0..1 over the event; each is 0 at x = 0 and x = 1) -------------------------------------------------------
// a twitch: a brisk departure, a long landing, and a second smaller twitch (k2 of the first) part way down (the organic hiccup)
function twitch(x, at2, k2) {
  if (x <= 0 || x >= 1) return 0
  var up = 0.18, a = x < up ? ez("decel", x / up) : 1 - ez("soft", (x - up) / (1 - up))
  var w = 0.16, b = Math.abs(x - at2) < w ? Math.sin(Math.PI * (x - at2 + w) / (2 * w)) * k2 : 0
  return a + b * (1 - x)
}
// a damped swing (a bell on its crown, a fluid in a glass): sin with an uneven decay, `turns` half-periods
function swing(x, turns, decay) {
  if (x <= 0 || x >= 1) return 0
  return Math.sin(Math.PI * turns * x) * Math.pow(1 - x, decay)
}
// a pulse: up with the spring (a hair of overshoot), back with soft; peak at `at`
function pulse(x, at) {
  if (x <= 0 || x >= 1) return 0
  return x < at ? ez("spring", x / at) : 1 - ez("soft", (x - at) / (1 - at))
}
// the eye's blink (ItoEyeMotion heavy: close fast, hold, open slow), as 1 = shut; the parts are shares of the event
function blink(x, close, hold) {
  if (x <= 0 || x >= 1) return 0
  if (x < close) return ez("accel", x / close)
  if (x < close + hold) return 1
  return 1 - ez("decel", (x - close - hold) / (1 - close - hold))
}
// stepped frames (a flicker, static): `vals` held in equal slices, the last slice always 0 (rest)
function frames(x, vals) {
  if (x <= 0 || x >= 1) return 0
  return vals[Math.min(vals.length - 1, Math.floor(x * (vals.length + 1)))] || 0
}

// ---- poses --------------------------------------------------------------------------------------------------------------------------
function T() { return { dx: 0, dy: 0, rot: 0, sx: 1, sy: 1, ox: 24, oy: 24, op: 1 } }
function rest() { return { root: T(), groups: {}, layers: { under: 1, level: 1, over: 1, hl: 1 }, glintDx: 0 } }
function G(pose, ctx, name) {           // the pose of one group, created on first use at the rig's origin
  if (!pose.groups[name]) {
    var g = T(), r = ctx && ctx.rig ? ctx.rig[name] : null
    if (r) { g.ox = r.ox; g.oy = r.oy; if (r.hidden) g.op = 0 }
    pose.groups[name] = g
  }
  return pose.groups[name]
}
function hasGroup(ctx, name) { return !!(ctx && ctx.rig && ctx.rig[name]) }
function ux(ctx) { return 48 / Math.max(8, (ctx && ctx.size) || 29) }       // one device px in 48-grid units

// durations at amp 1 (ms); `amp` multiplies them
var DUR = {
  disk: { hover: 560, leave: 260, press: 460, write: 620, hot: 760, omen: 640, draw: 520 },
  cpu: { hover: 980, leave: 260, press: 300, load: 450, hot: 520, omen: 560, draw: 520 },
  mem: { hover: 340, leave: 300, press: 380, use: 360, full: 520, omen: 1500, draw: 520 },
  battery: { hover: 640, leave: 220, press: 300, charge: 280, low: 640, omen: 1300, draw: 520 },
  network: { hover: 520, press: 180, drop: 420, connect: 460, omen: 760, draw: 520 },
  notifications: { hover: 760, leave: 220, press: 300, arrive: 760, dnd: 440, omen: 700, draw: 520 },
  audio: { hover: 820, press: 300, louder: 520, mute: 460, omen: 1400, draw: 520 },
  display: { hover: 900, leave: 260, press: 340, brighter: 520, omen: 1200, draw: 520 },
  bluetooth: { press: 260, link: 620, omen: 700, draw: 520 },
  chevron: { hover: 520, press: 240, omen: 900, draw: 520 },
  // the AI forms (icons-v4.md section 1): the host passes the per-picture key "ai:<form>"
  "ind:coffee": { hover: 520, press: 260, on: 520, off: 260, omen: 1200, draw: 520 },
  "ind:radio": { hover: 520, press: 260, on: 520, off: 260, omen: 1200, draw: 520 },
  "ind:flashlight": { hover: 520, press: 260, on: 520, off: 260, omen: 1200, draw: 520 },
  "ind:moon": { hover: 520, press: 260, on: 520, off: 260, omen: 1200, draw: 520 },
  "ind:fog": { hover: 520, press: 260, on: 520, off: 260, omen: 1200, draw: 520 },
  "ind:eye": { hover: 520, press: 260, on: 520, off: 260, omen: 1200, draw: 520 },
  "ind:tape": { hover: 520, press: 260, on: 520, off: 260, omen: 1200, draw: 520 },
  "sky:sun": { hover: 700, press: 260, arrive: 520, omen: 1400, draw: 520 },
  "sky:moon": { hover: 700, press: 260, omen: 1400, draw: 520 },
  "sky:cloud": { hover: 700, press: 260, arrive: 520, omen: 1400, draw: 520 },
  "sky:suncloud": { hover: 700, press: 260, arrive: 520, omen: 1400, draw: 520 },
  "sky:rain": { hover: 700, press: 260, arrive: 520, omen: 1400, draw: 520 },
  "sky:storm": { hover: 700, press: 260, arrive: 520, omen: 1400, draw: 520 },
  "sky:snow": { hover: 700, press: 260, arrive: 520, omen: 1400, draw: 520 },
  "sky:fog": { hover: 700, press: 260, arrive: 520, omen: 1400, draw: 520 },
  media: { hover: 420, leave: 220, press: 300, play: 420, toggle: 520, omen: 900, draw: 520 },
  "ai:brain": { hover: 900, leave: 260, press: 380, soak: 520, full: 760, drain: 560, omen: 1400, draw: 520 },
  "ai:classic": { hover: 900, leave: 260, press: 380, soak: 520, full: 760, drain: 560, omen: 1400, draw: 520 },
  "ai:hemispheres": { hover: 820, leave: 260, press: 380, soak: 520, full: 760, drain: 560, omen: 1500, draw: 520 },
  "ai:neurons": { hover: 760, leave: 300, press: 560, soak: 480, full: 700, drain: 560, omen: 1500, draw: 520 },
  "ai:eye": { hover: 340, leave: 300, press: 380, soak: 420, full: 620, drain: 560, omen: 1500, draw: 520 },
  "ai:spiral": { hover: 980, leave: 260, press: 300, soak: 450, full: 520, drain: 560, omen: 900, draw: 520 }
}
// the picture key's base kind ("ai:eye" -> "ai"), for the lookups that are per kind
function baseOf(kind) { var i = String(kind).indexOf(":"); return i < 0 ? kind : String(kind).slice(0, i) }
function duration(kind, event, amp) {
  if (!(amp > 0)) return 0
  var d = DUR[kind] || DUR[baseOf(kind)] || DUR.disk, ms = d[event]
  return ms ? Math.round(ms * Math.min(amp, 1.7)) : 0
}

// the event a state change plays
function edge(kind, prev, next) {
  var a = prev || {}, b = next || {}
  if (baseOf(kind) === "sky") return String(a.sky) !== String(b.sky) && b.sky !== undefined && a.sky !== undefined ? "arrive" : ""
  if (baseOf(kind) === "ind") return b.on && !a.on ? "on" : (!b.on && a.on ? "off" : "")
  if (kind === "media") {            // the pause face appears (it plays): the seam wells up; a shuffle or repeat setting changes: the toggle
    if (String(b.face) === "pause" && String(a.face) !== "pause") return "play"
    if (String(b.face) === String(a.face) && ((b.face === "shuffle" && !!b.on !== !!a.on) || (b.face === "repeat" && String(b.loop) !== String(a.loop)))) return "toggle"
    return ""
  }
  if (baseOf(kind) === "ai") {       // the quota: it crossed full, rose, fell (the window reset), or the form changed (the draw-on)
    var va = Number(a.value) || 0, vb = Number(b.value) || 0
    if (a.form !== undefined && b.form !== undefined && String(a.form) !== String(b.form)) return "draw"
    if (vb >= 0.9 && !(va >= 0.9)) return "full"
    if (vb - va >= 0.05) return "soak"
    if (va - vb >= 0.25) return "drain"
    return ""
  }
  if (kind === "disk") {
    if (!!b.hot && !a.hot) return "hot"
    if (Number(b.value) - Number(a.value) >= 1 / 48 - 1e-9) return "write"
    return ""
  }
  if (kind === "cpu") {
    if (Number(b.value) > 0.85 && !(Number(a.value) > 0.85)) return "hot"
    if (Number(b.value) - Number(a.value) >= 0.1) return "load"
    return ""
  }
  if (kind === "mem") {
    var ea = Math.round(clamp(Number(a.value) * 3, 0, 3) * 8), eb = Math.round(clamp(Number(b.value) * 3, 0, 3) * 8)
    if (Number(b.value) >= 0.92 && !(Number(a.value) >= 0.92)) return "full"
    return eb > ea ? "use" : ""
  }
  if (kind === "battery") {
    if (!!b.charging && !a.charging) return "charge"
    var la = Number(a.level), lb = Number(b.level)
    if ((!!b.critical && !a.critical) || (lb <= 1 && la > 1)) return "low"
    return ""
  }
  if (kind === "network") {
    var offA = !!a.off || (!a.wired && !(Number(a.band) > 0)), offB = !!b.off || (!b.wired && !(Number(b.band) > 0))
    if (!!b.off && !a.off) return "drop"
    if (offA && !offB && !b.wired) return "connect"
    return ""
  }
  if (kind === "audio") {
    if (!!b.mute && !a.mute) return "mute"
    if (!b.mute && Number(b.level) > Number(a.level || 0)) return "louder"
    return ""
  }
  if (kind === "display") return Number(b.level) > Number(a.level || 0) ? "brighter" : ""
  if (kind === "bluetooth") return String(b.mode) === "linked" && String(a.mode) !== "linked" ? "link" : ""
  if (kind === "notifications") {
    var fa = String(a.face || "idle"), fb = String(b.face || "idle")
    if (fb === "dnd" && fa !== "dnd") return "dnd"
    if ((fb === "active" || fb === "ring" || fb === "critical") && fa !== fb) return "arrive"
    return ""
  }
  return ""
}

// the rare omen, piggybacked on a data update (never a timer): the seeded hash of (kind, minute) passes p, and the last omen
// anywhere was >= 20 minutes ago. Never with iconOmens off or with motion off.
function omenDue(kind, seed, nowMs, lastMs, on, amp) {
  if (!on || !(amp > 0)) return false
  if (nowMs - lastMs < OMEN.cooldownMs) return false
  return hash(seed, 900 + (strHash(kind) & 1023), Math.floor(nowMs / 60000)) < OMEN.p
}

// ---- the draw-on: the plate inks itself in (the under layer, the level, the contour, the highlight) --------------------------------
function drawOn(pose, x, ctx) {
  var d = hs((ctx && ctx.seed) || 1, 41, (ctx && ctx.n) || 0, 0, 0.08)     // an uneven start, so a row of icons does not ink in step
  pose.layers.under = ez("decel", (x - d) / 0.42)
  pose.layers.level = ez("decel", (x - d - 0.24) / 0.38)
  pose.layers.over = ez("soft", (x - d - 0.36) / 0.46)
  pose.layers.hl = ez("decel", (x - 0.84) / 0.16)
  // the pen lands: the icon settles from a hair above
  pose.root.dy = -0.8 * (1 - ez("decel", x))
}

// ---- per kind ---------------------------------------------------------------------------------------------------------------------
var KIND = {}

KIND.disk = function(pose, ev, x, a, s, ctx) {
  var n = ctx.n || 0
  if (ev === "hover" || ev === "leave") {
    if (ev === "hover" && hasGroup(ctx, "finger")) G(pose, ctx, "finger").rot = -hs(s, 1, n, 4.5, 6.5) * a * twitch(x, hs(s, 2, n, 0.45, 0.7), 0.45)
    pose.glintDx = follow(ev, x, a) * clamp(ctx.px || 0, -1, 1) * 1.6
  } else if (ev === "press") {
    pose.root.dy = ux(ctx) * a * pulse(x, 0.2)
    if (hasGroup(ctx, "bead")) {      // one bead slides down the groove, toward the hub, and the next one wells up in its place
      var b = G(pose, ctx, "bead"), r = ctx.rig.bead, v = P2(r.tx - r.ox, r.ty - r.oy, 2.4 * a)
      var go = x < 0.75 ? ez("accel", x / 0.75) : 0
      b.dx = v.x * go; b.dy = v.y * go
      b.op = x < 0.75 ? 1 - 0.6 * go : ez("decel", (x - 0.75) / 0.25)
      b.sx = b.sy = x < 0.75 ? 1 - 0.3 * go : lerp(0.2, 1, ez("spring", (x - 0.75) / 0.25))
    }
  } else if (ev === "write") {
    if (hasGroup(ctx, "bead")) { var w = G(pose, ctx, "bead"); w.sx = w.sy = 1 + 0.65 * a * pulse(x, 0.35) }
  } else if (ev === "hot") {
    if (hasGroup(ctx, "weep")) { var h = G(pose, ctx, "weep"); h.sy = 1 + 0.7 * a * pulse(x, 0.45); h.sx = 1 + 0.25 * a * pulse(x, 0.45) }
  } else if (ev === "omen") {        // the finger taps the platter twice, like a nail on glass
    if (hasGroup(ctx, "finger")) {
      var tap = function(u, at) { var d = Math.abs(u - at); return d < 0.12 ? Math.cos(Math.PI * d / 0.24) : 0 }
      G(pose, ctx, "finger").rot = -8 * a * (tap(x, 0.22) + 0.85 * tap(x, 0.5))
    }
  }
}
KIND.cpu = function(pose, ev, x, a, s, ctx) {
  var n = ctx.n || 0
  if (ev === "hover") {               // the spiral is wound a quarter of a notch and let go: it creeps back unevenly
    if (hasGroup(ctx, "spiral")) G(pose, ctx, "spiral").rot = -hs(s, 3, n, 18, 26) * a * twitch(x, hs(s, 4, n, 0.5, 0.75), 0.3)
    pose.glintDx = follow(ev, x, a) * clamp(ctx.px || 0, -1, 1) * 0.8
  } else if (ev === "leave") {
    pose.glintDx = follow(ev, x, a) * clamp(ctx.px || 0, -1, 1) * 0.8
  } else if (ev === "press") {        // the lid presses into its bevel
    pose.root.sx = pose.root.sy = 1 - 0.035 * a * pulse(x, 0.3)
  } else if (ev === "load") {         // ink surges along the groove, past where it settles
    if (hasGroup(ctx, "spiral")) { var g = G(pose, ctx, "spiral"); g.rot = -9 * a * pulse(x, 0.3); g.sx = g.sy = 1 + 0.05 * a * pulse(x, 0.3) }
  } else if (ev === "hot") {
    if (hasGroup(ctx, "core")) { var c = G(pose, ctx, "core"); c.sx = c.sy = 1 + 0.45 * a * pulse(x, 0.3) }
  } else if (ev === "omen") {         // one notch the wrong way, a held breath, and back
    if (hasGroup(ctx, "spiral")) G(pose, ctx, "spiral").rot = 14 * a * (x < 0.15 ? ez("decel", x / 0.15) : (x < 0.55 ? 1 : 1 - ez("soft", (x - 0.55) / 0.45)))
  }
}
KIND.mem = function(pose, ev, x, a, s, ctx) {
  var n = ctx.n || 0, i
  if (ev === "hover" || ev === "leave") {     // the eyes find the pointer, each a little late and not quite together
    var f = follow(ev, x, a)
    for (i = 0; i < 3; i++) if (hasGroup(ctx, "iris" + i)) {
      var g = G(pose, ctx, "iris" + i), lag = i === 2 ? 0.72 : (i === 1 ? 0.92 : 1)
      g.dx = f * lag * clamp(ctx.px || 0, -1, 1) * 1.0 + f * Math.abs(clamp(ctx.px || 0, -1, 1)) * hs(s, 10 + i, 0, -0.18, 0.18)
      g.dy = f * lag * clamp(ctx.py || 0, -1, 1) * 0.4
    }
    pose.glintDx = f * clamp(ctx.px || 0, -1, 1) * 0.6
  } else if (ev === "press") {                // all three blink, one after the other by a hair
    for (i = 0; i < 3; i++) { var d = hs(s, 20 + i, n, 0, 0.14), b = blink((x - d) / (1 - d), 0.2, 0.1); shut(pose, ctx, i, 1 - 0.9 * b) }
  } else if (ev === "use") {                  // the eye that opened a notch opens from further shut
    var w = clamp(ctx.which === undefined ? 0 : ctx.which, 0, 2)
    shut(pose, ctx, w, lerp(0.45, 1, ez("decel", x)))
  } else if (ev === "full") {                 // the bloodshot eye: the pupil swells once
    if (hasGroup(ctx, "iris2")) { var p = G(pose, ctx, "iris2"); p.sx = p.sy = 1 + 0.22 * a * pulse(x, 0.35) }
  } else if (ev === "omen") {                 // two shut and stay shut, the middle one keeps watching, turns, and then they open
    var held = x < 0.12 ? ez("accel", x / 0.12) : (x < 0.78 ? 1 : 1 - ez("decel", (x - 0.78) / 0.22))
    shut(pose, ctx, 0, 1 - 0.92 * held)
    shut(pose, ctx, 2, 1 - 0.92 * held)
    if (hasGroup(ctx, "iris1")) G(pose, ctx, "iris1").dx = (hash(s, 30, n) < 0.5 ? -1 : 1) * 1.1 * a * (x < 0.3 ? 0 : held)
  }
}
function shut(pose, ctx, i, sy) {           // scale an eye (and its iris) shut toward its centre line
  if (hasGroup(ctx, "eye" + i)) G(pose, ctx, "eye" + i).sy = sy
  if (hasGroup(ctx, "iris" + i)) G(pose, ctx, "iris" + i).sy = sy
}
KIND.battery = function(pose, ev, x, a, s, ctx) {
  var n = ctx.n || 0
  if (ev === "hover") {                       // the fluid sloshes once against the glass, the front rising and falling back
    if (hasGroup(ctx, "fluid")) { var f = G(pose, ctx, "fluid"); f.sx = 1 + 0.06 * a * swing(x, 2.2, 1.3) * hs(s, 5, n, 0.8, 1.15) }
    pose.glintDx = follow(ev, x, a) * clamp(ctx.px || 0, -1, 1) * 1.2
  } else if (ev === "leave") {
    pose.glintDx = follow(ev, x, a) * clamp(ctx.px || 0, -1, 1) * 1.2
  } else if (ev === "press") {                // the casing dents
    pose.root.sy = 1 - 0.03 * a * pulse(x, 0.3)
    pose.root.sx = 1 + 0.012 * a * pulse(x, 0.3)
  } else if (ev === "charge") {               // the bolt flickers, three frames
    if (hasGroup(ctx, "bolt")) G(pose, ctx, "bolt").op = 1 - frames(x, [0.85, 0.1, 0.7])
  } else if (ev === "low") {                  // one drip forms, swells, falls; a new one wells up at the terminal
    if (hasGroup(ctx, "tdrip")) {
      var d = G(pose, ctx, "tdrip")
      if (x < 0.35) { d.sy = 1 + 0.5 * ez("soft", x / 0.35); d.sx = 1 + 0.15 * ez("soft", x / 0.35) }
      else if (x < 0.75) { var u = (x - 0.35) / 0.4; d.dy = 5 * a * ez("accel", u); d.op = 1 - ez("accel", u); d.sy = 1.5 - 0.3 * u }
      else { var r = (x - 0.75) / 0.25; d.sx = d.sy = ez("spring", r); d.op = ez("decel", r) }
    }
  } else if (ev === "omen") {                 // a bubble rises through the fluid
    if (hasGroup(ctx, "bubble")) {
      var b = G(pose, ctx, "bubble"), rb = ctx.rig.bubble
      b.op = x < 0.15 ? ez("decel", x / 0.15) : (x < 0.8 ? 1 : 1 - ez("accel", (x - 0.8) / 0.2))
      b.dy = -(rb.rise || 6) * ez("soft", x)
      b.dx = Math.sin(x * Math.PI * 2.3) * 0.5
    }
  }
}
KIND.network = function(pose, ev, x, a, s, ctx) {
  var n = ctx.n || 0
  if (ev === "hover") {                       // the iron bands flex outward and settle
    if (hasGroup(ctx, "bands")) { var b = G(pose, ctx, "bands"); b.sx = b.sy = 1 + 0.06 * a * pulse(x, 0.28) }
  } else if (ev === "press") {                // static rattles the icon, three frames
    pose.root.dx = frames(x, [0.7, -0.6, 0.35]) * a * hs(s, 6, n, 0.8, 1.2)
  } else if (ev === "drop") {                 // the bands tear and wind into the spiral
    if (hasGroup(ctx, "spiral")) {
      var g = G(pose, ctx, "spiral"), u = ez("decel", x)
      g.rot = 150 * a * (1 - u); g.sx = g.sy = lerp(1.3, 1, u); g.op = lerp(0.2, 1, ez("decel", x / 0.6))
    }
  } else if (ev === "connect") {              // the spiral unwinds into bands
    if (hasGroup(ctx, "bands")) {
      var c = G(pose, ctx, "bands"), v = ez("spring", x)
      c.sx = c.sy = lerp(0.55, 1, v); c.rot = -14 * a * (1 - ez("decel", x)); c.op = lerp(0.3, 1, ez("decel", x / 0.5))
    }
  } else if (ev === "omen") {                 // the drip at the nail falls, and forms again
    if (hasGroup(ctx, "ndrip")) {
      var d = G(pose, ctx, "ndrip")
      if (x < 0.55) { var u2 = x / 0.55; d.dy = 5.5 * ez("accel", u2); d.op = 1 - ez("accel", u2); d.sy = 1 + 0.4 * u2 }
      else { var r = (x - 0.55) / 0.45; d.sx = d.sy = ez("spring", r); d.op = ez("decel", r) }
    }
  }
}
KIND.notifications = function(pose, ev, x, a, s, ctx) {
  var n = ctx.n || 0
  if (ev === "hover") {                       // the bell swings on its crown, unevenly
    pose.root.rot = 3.2 * a * swing(x, 3.3, 1.5) * hs(s, 7, n, 0.85, 1.15)
    bellPivot(pose, ctx)
    eyeTo(pose, ctx, follow(ev, x, a) * clamp(ctx.px || 0, -1, 1) * 0.9)
  } else if (ev === "leave") {
    eyeTo(pose, ctx, follow(ev, x, a) * clamp(ctx.px || 0, -1, 1) * 0.9)
  } else if (ev === "press") {                // the clapper eye strikes the lip and blinks
    if (hasGroup(ctx, "eye")) {
      var e = G(pose, ctx, "eye"), k = pulse(x, 0.25)
      e.dy = -1.5 * a * k
      e.sy = 1 - 0.85 * blink(x, 0.2, 0.15)
      if (hasGroup(ctx, "iris")) { var ir = G(pose, ctx, "iris"); ir.dy = e.dy; ir.sy = e.sy; ir.oy = e.oy }
    }
  } else if (ev === "arrive") {               // something arrived: the bell swings hard, the eye turns to the pointer
    pose.root.rot = 7.5 * a * swing(x, 3.6, 1.35)
    bellPivot(pose, ctx)
    eyeTo(pose, ctx, (ctx.px ? clamp(ctx.px, -1, 1) : (hash(s, 8, n) < 0.5 ? -1 : 1)) * 0.9 * pulse(x, 0.3))
  } else if (ev === "dnd") {                  // the bandages wind around the bell
    if (hasGroup(ctx, "bandage")) { var g = G(pose, ctx, "bandage"), u = ez("decel", x); g.sx = lerp(0.06, 1, u); g.op = ez("decel", x / 0.4) }
  } else if (ev === "omen") {                 // the eye looks at the pointer, holds, and looks away
    var side = ctx.px ? (ctx.px < 0 ? -1 : 1) : (hash(s, 9, n) < 0.5 ? -1 : 1)
    eyeTo(pose, ctx, side * 1.2 * a * (x < 0.2 ? ez("decel", x / 0.2) : (x < 0.6 ? 1 : 1 - ez("soft", (x - 0.6) / 0.4))))
  }
}
// the mouths: each throat (throat0..6, the slit and what stands in it) opens wider by sx; the ripple runs out from the centre
KIND.audio = function(pose, ev, x, a, s, ctx) {
  var n = ctx.n || 0, k = 0, i
  for (i = 0; i < 8; i++) if (hasGroup(ctx, "throat" + i)) k = i + 1
  var mid = (k - 1) / 2
  if (ev === "hover" || ev === "louder") {    // they speak: each opens and closes, the centre first, the outer ones late
    for (i = 0; i < k; i++) {
      var d = Math.abs(i - mid) / Math.max(1, mid) * 0.32 + hs(s, 60 + i, n, 0, 0.06)
      var amt = (ev === "louder" ? 0.9 : 0.6) * hs(s, 70 + i, n, 0.7, 1.15)
      G(pose, ctx, "throat" + i).sx = 1 + amt * a * pulse(clamp((x - d) / (1 - d), 0, 1), 0.35) * 0.9
    }
  } else if (ev === "press") {                // all shut at once, as if struck
    for (i = 0; i < k; i++) G(pose, ctx, "throat" + i).sx = 1 - 0.85 * blink(x, 0.18, 0.2)
  } else if (ev === "mute") {                 // the thread is pulled through, left to right
    if (hasGroup(ctx, "stitches")) { var g = G(pose, ctx, "stitches"), u = ez("decel", x); g.sx = lerp(0.05, 1, u); g.op = ez("decel", x / 0.3) }
  } else if (ev === "omen") {                 // all shut but one, an outer one, which keeps whispering
    var w = hash(s, 80, n) < 0.5 ? 0 : k - 1
    var held = x < 0.12 ? ez("accel", x / 0.12) : (x < 0.82 ? 1 : 1 - ez("decel", (x - 0.82) / 0.18))
    for (i = 0; i < k; i++) {
      var t = G(pose, ctx, "throat" + i)
      t.sx = i === w ? 1 + 0.5 * a * Math.abs(Math.sin(x * Math.PI * 4)) * held : 1 - 0.9 * held
    }
  }
}
// the monitor: the eye on its screen glances, blinks, swells with the light; the omen: it trembles in place, staring (its size is
// the brightness, so an omen never scales it)
KIND.display = function(pose, ev, x, a, s, ctx) {
  if (!hasGroup(ctx, "eye")) { if (ev === "press") pose.root.sy = 1 - 0.03 * a * pulse(x, 0.3); return }
  var e = G(pose, ctx, "eye")
  if (ev === "hover" || ev === "leave") e.dx = follow(ev, x, a) * clamp(ctx.px || 0, -1, 1) * 1.6
  else if (ev === "press") e.sy = 1 - 0.9 * blink(x, 0.2, 0.15)
  else if (ev === "brighter") e.sx = e.sy = 1 + 0.25 * a * pulse(x, 0.3)
  else if (ev === "omen") { var h = x < 0.15 ? ez("decel", x / 0.15) : (x < 0.75 ? 1 : 1 - ez("soft", (x - 0.75) / 0.25)); e.dx = Math.sin(x * 23) * 0.35 * a * h; e.dy = Math.sin(x * 17 + 1) * 0.2 * a * h }
}
// the scar: it flinches when touched; linked, the nails are driven in; the omen: the skin twitches
KIND.bluetooth = function(pose, ev, x, a, s, ctx) {
  if (ev === "press") { pose.root.sx = 1 - 0.04 * a * pulse(x, 0.25); pose.root.sy = 1 + 0.02 * a * pulse(x, 0.25) }
  else if (ev === "link") { if (hasGroup(ctx, "nails")) { var g = G(pose, ctx, "nails"); g.sx = 1 + 0.12 * a * (1 - ez("decel", x)); g.op = ez("decel", x / 0.4) } else pose.root.sy = 1 - 0.03 * pulse(x, 0.3) }
  else if (ev === "omen") pose.root.rot = 2.5 * a * swing(x, 5, 1.8)
}
// the claw: it beckons (a curl toward its point) and snaps back; the omen: it curls twice, slowly
KIND.chevron = function(pose, ev, x, a, s, ctx) {
  pose.root.ox = 16; pose.root.oy = 24
  if (ev === "hover") { pose.root.sx = 1 - 0.09 * a * twitch(x, 0.6, 0.4); pose.root.dx = -0.9 * a * twitch(x, 0.6, 0.4) }
  else if (ev === "press") pose.root.sx = pose.root.sy = 1 - 0.06 * a * pulse(x, 0.3)
  else if (ev === "omen") { pose.root.sx = 1 - 0.12 * a * (pulse(x * 2, 0.5) + (x > 0.5 ? pulse(x * 2 - 1, 0.5) : 0)) }
}


// the cast-iron buttons of the dead deck (icons-v4.md section 2.3): the button gives under the finger, the seam wells up when it plays
KIND.media = function(pose, ev, x, a, s, ctx) {
  var n = ctx.n || 0, face = String(ctx.face || "")
  if (ev === "hover" || ev === "leave") {
    if (ev === "hover") pose.root.dy = 0.5 * a * pulse(x, 0.3)
    pose.glintDx = follow(ev, x, a) * clamp(ctx.px || 0, -1, 1) * 1.0
  } else if (ev === "press") {                // it sinks a device pixel; prev / next lurch their symbol in their direction
    pose.root.dy = ux(ctx) * a * pulse(x, 0.25)
    pose.root.sx = pose.root.sy = 1 - 0.04 * a * pulse(x, 0.25)
    if ((face === "prev" || face === "next") && hasGroup(ctx, "sym")) G(pose, ctx, "sym").dx = (face === "prev" ? -1 : 1) * 1.2 * a * twitch(x, 0.6, 0.35)
  } else if (ev === "play") {                 // the seam wells up; the bead swells (the reverse edge is instant: the dry plate)
    if (hasGroup(ctx, "seep")) G(pose, ctx, "seep").op = ez("decel", x / 0.5)
    if (hasGroup(ctx, "bead")) { var b = G(pose, ctx, "bead"); b.sx = b.sy = 1 + 0.5 * a * pulse(x, 0.6); b.op = ez("decel", x / 0.5) }
  } else if (ev === "toggle") {               // the rods turn against each other and settle; the nail is driven in
    var k = 1 - ez("spring", x)
    if (hasGroup(ctx, "rodA")) G(pose, ctx, "rodA").rot = 6 * a * k
    if (hasGroup(ctx, "rodB")) G(pose, ctx, "rodB").rot = -6 * a * k
    if (hasGroup(ctx, "nail")) G(pose, ctx, "nail").sx = 1 + 0.12 * a * (1 - ez("decel", x))
  } else if (ev === "omen") {                 // one drop runs out of a seam two units and stops
    if (hasGroup(ctx, "drop")) {
      var d = G(pose, ctx, "drop")
      d.op = x < 0.3 ? ez("decel", x / 0.3) : (x < 0.7 ? 1 : 1 - ez("accel", (x - 0.7) / 0.3))
      d.dy = 2 * a * ez("soft", x)
    }
  }
}

// ---- the indicators (icons-v4.md section 3): "on" is the state, so the gestures live on the edges ---------------------------------
function opOf(pose, ctx, name, v) { if (hasGroup(ctx, name)) G(pose, ctx, name).op = v }
function soften(pose, ev, x, a, ctx) {          // an indicator turning off, or pressed, settles a hair: nothing else of it moves
  if (ev === "off") pose.root.dy = 0.5 * a * pulse(x, 0.3)
  else if (ev === "press") { pose.root.sx = pose.root.sy = 1 - 0.03 * a * pulse(x, 0.3) }
}
KIND["ind:coffee"] = function(pose, ev, x, a, s, ctx) {
  if (ev === "hover") { if (hasGroup(ctx, "steam")) G(pose, ctx, "steam").rot = 2 * a * twitch(x, 0.5, 0.4) }
  else if (ev === "on") {                      // the coffee rises, the steam draws on
    if (hasGroup(ctx, "fluid")) G(pose, ctx, "fluid").dy = 2 * a * (1 - ez("decel", x))
    if (hasGroup(ctx, "steam")) G(pose, ctx, "steam").sy = ez("decel", x)
  } else if (ev === "omen") {                  // a ring spreads once on the surface
    if (hasGroup(ctx, "ripple")) { var r = G(pose, ctx, "ripple"); r.sx = lerp(0.3, 1, ez("decel", x)); r.op = 1 - x }
  } else soften(pose, ev, x, a, ctx)
}
KIND["ind:radio"] = function(pose, ev, x, a, s, ctx) {
  var hid = !!(ctx.rig && ctx.rig.static && ctx.rig.static.hidden)
  var burst = function(vals) { var v = frames(x, vals); return hid ? v : 1 - v }
  if (ev === "hover") opOf(pose, ctx, "static", burst([1, 0]))
  else if (ev === "on") {                      // three frames of static and the antenna twitches
    opOf(pose, ctx, "static", burst([1, 0.2, 0.8]))
    if (hasGroup(ctx, "antenna")) G(pose, ctx, "antenna").rot = 3 * a * swing(x, 3, 1.5)
  } else if (ev === "omen") opOf(pose, ctx, "static", burst([1, 0.2, 0.8]))    // the radio hears something, even when off
  else soften(pose, ev, x, a, ctx)
}
KIND["ind:flashlight"] = function(pose, ev, x, a, s, ctx) {
  if (ev === "hover") pose.glintDx = follow(ev, x, a) * clamp(ctx.px || 0, -1, 1) * 1.0 + 0.4 * a * pulse(x, 0.3)
  else if (ev === "on") opOf(pose, ctx, "beam", 1 - frames(x, [0.2, 0.9, 0.3]))   // the beam flickers three frames, then holds
  else if (ev === "omen") opOf(pose, ctx, "beam", 1 - frames(x, [1, 0.1, 1]))      // it stutters off for two frames
  else soften(pose, ev, x, a, ctx)
}
KIND["ind:moon"] = function(pose, ev, x, a, s, ctx) {
  if (ev === "hover") { pose.root.rot = 2.2 * a * swing(x, 2.2, 1.3); pose.root.ox = 22; pose.root.oy = 26 }
  else if (ev === "on") opOf(pose, ctx, "level", ez("soft", x))                    // the blood fills the craters
  else if (ev === "omen") { if (hasGroup(ctx, "crease")) G(pose, ctx, "crease").sy = 1 - 0.08 * a * twitch(x, 0.5, 0.4) }
  else soften(pose, ev, x, a, ctx)
}
KIND["ind:fog"] = function(pose, ev, x, a, s, ctx) {
  if (ev === "hover") {                        // the bands drift in opposite directions and return
    var d = 1.2 * a * pulse(x, 0.45)
    if (hasGroup(ctx, "bandA")) G(pose, ctx, "bandA").dx = d
    if (hasGroup(ctx, "bandB")) G(pose, ctx, "bandB").dx = -d
    if (hasGroup(ctx, "bandC")) G(pose, ctx, "bandC").dx = d
  } else if (ev === "on") { if (hasGroup(ctx, "sun")) G(pose, ctx, "sun").dy = 1.5 * a * (1 - ez("decel", x)) }   // the sun rises behind the band
  else if (ev === "omen") opOf(pose, ctx, "figure", 0.6 * Math.sin(Math.PI * x))   // a figure in the fog, there and gone
  else soften(pose, ev, x, a, ctx)
}
KIND["ind:eye"] = function(pose, ev, x, a, s, ctx) {
  var n = ctx.n || 0
  if (ev === "hover" || ev === "leave") {
    if (hasGroup(ctx, "iris")) { var f = follow(ev, x, a); G(pose, ctx, "iris").dx = f * clamp(ctx.px || 0, -1, 1) * 1.0; G(pose, ctx, "iris").dy = f * clamp(ctx.py || 0, -1, 1) * 0.4 }
    else if (hasGroup(ctx, "lid") && ev === "hover") G(pose, ctx, "lid").sy = 1 - 0.04 * a * frames(x, [1, 0.5, 0.8])   // the closed lid tremors
  } else if (ev === "on") { if (hasGroup(ctx, "eye")) G(pose, ctx, "eye").sy = x < 0.77 ? lerp(0.1, 1, ez("decel", x / 0.77)) : 1 }   // the lids snap open
  else if (ev === "omen") { if (hasGroup(ctx, "lid")) G(pose, ctx, "lid").sy = 1 + 0.6 * a * blink(x, 0.25, 0.15) }                      // the lid opens a slit and closes
  else if (ev === "press") { var b = 1 - 0.9 * blink(x, 0.2, 0.15); if (hasGroup(ctx, "eye")) G(pose, ctx, "eye").sy = b; else if (hasGroup(ctx, "lid")) G(pose, ctx, "lid").sy = 1 - 0.1 * (1 - b) }
  else if (ev === "off") { if (hasGroup(ctx, "lid")) G(pose, ctx, "lid").sy = 1 + 0.6 * a * (1 - ez("decel", x)) }
}
KIND["ind:tape"] = function(pose, ev, x, a, s, ctx) {
  var set = function(rot) { if (hasGroup(ctx, "reelL")) G(pose, ctx, "reelL").rot = rot; if (hasGroup(ctx, "reelR")) G(pose, ctx, "reelR").rot = rot * 0.9 }
  if (ev === "hover") set(20 * a * twitch(x, 0.6, 0.35))
  else if (ev === "on") { set(360 * ez("standard", x)); if (hasGroup(ctx, "rec")) { var r = G(pose, ctx, "rec"); r.sx = r.sy = ez("spring", x) } }
  else if (ev === "omen") set(-30 * a * wrongNotch(x))
  else soften(pose, ev, x, a, ctx)
}

// ---- the weather skies (icons-v4.md section 4): a sky settles when it arrives; ItoArt's crossfade still runs, `arrive` adds the gesture ----
function flash(x, vals) { return x >= 0.8 ? 1 : vals[Math.min(vals.length - 1, Math.floor(x / 0.8 * vals.length))] }
function skyPress(pose, x, a) { pose.root.sx = pose.root.sy = 1 - 0.03 * a * pulse(x, 0.3) }
KIND["sky:sun"] = function(pose, ev, x, a, s, ctx) {
  var R = hasGroup(ctx, "rays") ? G(pose, ctx, "rays") : null
  if (ev === "hover") { if (R) R.rot = 3 * a * twitch(x, 0.55, 0.4) * (hash(s, 95, ctx.n || 0) < 0.5 ? -1 : 1) }
  else if (ev === "arrive") { if (R) R.sx = R.sy = lerp(0.92, 1, ez("spring", x)) }
  else if (ev === "omen") { if (R) R.sx = R.sy = 1 - 0.12 * a * (x < 0.15 ? ez("decel", x / 0.15) : (x < 0.6 ? 1 : 1 - ez("soft", (x - 0.6) / 0.4))) }
  else skyPress(pose, x, a)
}
KIND["sky:moon"] = function(pose, ev, x, a, s, ctx) {
  if (ev === "hover" || ev === "omen") { if (hasGroup(ctx, "crease")) G(pose, ctx, "crease").sy = 1 - 0.08 * a * twitch(x, 0.5, 0.4) }
  else skyPress(pose, x, a)
}
function cloudSky(pose, ev, x, a, s, ctx) {
  if (ev === "hover" || ev === "arrive") { if (hasGroup(ctx, "cloud")) G(pose, ctx, "cloud").dx = 1.0 * a * pulse(x, 0.45) }    // the cloud drifts a unit and back
  else if (ev === "omen") {
    if (hasGroup(ctx, "drip")) {                  // the drip falls and re-forms
      var d = G(pose, ctx, "drip")
      if (x < 0.55) { var u = x / 0.55; d.dy = 5 * ez("accel", u); d.op = 1 - ez("accel", u); d.sy = 1 + 0.4 * u }
      else { var r = (x - 0.55) / 0.45; d.sx = d.sy = ez("spring", r); d.op = ez("decel", r) }
    } else if (hasGroup(ctx, "cloud")) G(pose, ctx, "cloud").dx = -0.8 * a * pulse(x, 0.4)
  } else skyPress(pose, x, a)
}
KIND["sky:cloud"] = cloudSky
KIND["sky:suncloud"] = cloudSky
KIND["sky:rain"] = function(pose, ev, x, a, s, ctx) {
  var S = hasGroup(ctx, "scratches") ? G(pose, ctx, "scratches") : null
  if (ev === "hover" || ev === "arrive") { if (S) S.dy = 1.5 * a * frames(x, [0.5, 1, 0]) }                                       // the scratches step down
  else if (ev === "omen") { if (S) { S.dy = x < 0.7 ? 5 * a * ez("accel", x / 0.7) : 0; S.op = x < 0.7 ? 1 - x / 0.7 : ez("decel", (x - 0.7) / 0.3) } }   // one bead falls past the box edge
  else skyPress(pose, x, a)
}
KIND["sky:storm"] = function(pose, ev, x, a, s, ctx) {
  var C = hasGroup(ctx, "crack") ? G(pose, ctx, "crack") : null
  if (ev === "hover") { if (C) C.op = flash(x, [0.3, 1, 0.5]) }
  else if (ev === "arrive") { if (C) { C.op = flash(x, [0.1, 1, 0.2]); C.sx = 1 + 0.1 * a * pulse(x, 0.3) } }           // the crack flashes once, harder
  else if (ev === "omen") { if (C) C.sx = 1 + 0.15 * a * pulse(x, 0.4) }                                                  // it widens and closes
  else skyPress(pose, x, a)
}
KIND["sky:snow"] = function(pose, ev, x, a, s, ctx) {
  var F = hasGroup(ctx, "flecks") ? G(pose, ctx, "flecks") : null
  if (ev === "hover" || ev === "arrive") { if (F) { F.dx = 1.0 * a * pulse(x, 0.45); F.dy = 1.0 * a * pulse(x, 0.45) } }  // the flecks drift down and to the right
  else if (ev === "omen") { if (F) F.dy = -1.6 * a * pulse(x, 0.4) }                                                        // one rises instead of falling
  else skyPress(pose, x, a)
}
KIND["sky:fog"] = function(pose, ev, x, a, s, ctx) {
  if (ev === "hover" || ev === "arrive") {
    var d = 1.2 * a * pulse(x, 0.45)
    if (hasGroup(ctx, "bandA")) G(pose, ctx, "bandA").dx = d
    if (hasGroup(ctx, "bandB")) G(pose, ctx, "bandB").dx = -d
    if (hasGroup(ctx, "bandC")) G(pose, ctx, "bandC").dx = d
  } else if (ev === "omen") opOf(pose, ctx, "figure", 0.6 * Math.sin(Math.PI * x))
  else skyPress(pose, x, a)
}

// ---- the AI forms (icons-v4.md section 1): flesh moves like an organ (it swells and settles, never wobbles), eyes never in step -----
// the quota's heartbeat: lub-dub, a big beat and a smaller one right after
function lubdub(x) { return pulse(x / 0.45, 0.3) + 0.6 * pulse((x - 0.45) / 0.55, 0.3) }
function wrongNotch(x) { return x < 0.15 ? ez("decel", x / 0.15) : (x < 0.6 ? 1 : 1 - ez("soft", (x - 0.6) / 0.4)) }
KIND["ai:brain"] = function(pose, ev, x, a, s, ctx) {
  var n = ctx.n || 0, sp = hasGroup(ctx, "spiral") ? G(pose, ctx, "spiral") : null
  if (ev === "hover" || ev === "leave") {
    if (ev === "hover") { pose.root.sx = pose.root.sy = 1 + 0.025 * a * pulse(x, 0.3); if (sp) sp.rot = -10 * a * twitch(x, 0.6, 0.35) }
    pose.glintDx = follow(ev, x, a) * clamp(ctx.px || 0, -1, 1) * 1.2
  } else if (ev === "press") {        // it flinches
    pose.root.sx = pose.root.sy = 1 - 0.04 * a * pulse(x, 0.22)
    pose.root.dx = 0.4 * a * frames(x, [1, -0.75, 0.4])
  } else if (ev === "soak") {         // the meniscus drinks
    if (sp) sp.rot = -6 * a * pulse(x, 0.3)
    pose.root.sy = 1 + 0.015 * a * pulse(x, 0.3)
  } else if (ev === "full") {         // a heartbeat
    pose.root.sx = pose.root.sy = 1 + 0.035 * a * lubdub(x)
  } else if (ev === "drain") {        // it exhales
    var u = 1 - ez("soft", x)
    pose.root.sy = 1 + 0.03 * a * u; pose.root.sx = 1 - 0.01 * a * u
  } else if (ev === "omen") {         // the spiral fold turns one notch the wrong way, holds, creeps back
    if (sp) sp.rot = 12 * a * wrongNotch(x)
  }
}
KIND["ai:classic"] = KIND["ai:brain"]       // same organ, same events (it has the spiral group)
KIND["ai:hemispheres"] = function(pose, ev, x, a, s, ctx) {
  var n = ctx.n || 0, L = hasGroup(ctx, "lobeL") ? G(pose, ctx, "lobeL") : null, R = hasGroup(ctx, "lobeR") ? G(pose, ctx, "lobeR") : null
  var xr = function(d) { return clamp((x - d) / (1 - d), 0, 1) }
  if (ev === "hover" || ev === "leave") {
    if (ev === "hover") { if (L) L.dx = -0.5 * a * twitch(x, 0.55, 0.4); if (R) R.dx = 0.5 * a * twitch(xr(0.08), 0.55, 0.4) }
    pose.glintDx = follow(ev, x, a) * clamp(ctx.px || 0, -1, 1) * 1.2
  } else if (ev === "press") {        // they clench
    if (L) L.dx = 0.4 * a * pulse(x, 0.25); if (R) R.dx = -0.4 * a * pulse(x, 0.25)
  } else if (ev === "soak") {         // the lobes part a little and settle
    if (L) L.dx = -0.3 * a * pulse(x, 0.3); if (R) R.dx = 0.3 * a * pulse(x, 0.3)
  } else if (ev === "full") {         // lub-dub on both lobes, the right one 60 ms late
    if (L) L.sx = L.sy = 1 + 0.035 * a * lubdub(x)
    if (R) R.sx = R.sy = 1 + 0.035 * a * lubdub(xr(0.08))
  } else if (ev === "drain") {
    var u = 1 - ez("soft", x)
    if (L) { L.sy = 1 + 0.03 * a * u; L.sx = 1 - 0.01 * a * u }
    if (R) { R.sy = 1 + 0.03 * a * u; R.sx = 1 - 0.01 * a * u }
  } else if (ev === "omen") {         // they part, hold open on the dark fissure, and close
    var o = x < 0.2 ? ez("decel", x / 0.2) : (x < 0.75 ? 1 : 1 - ez("soft", (x - 0.75) / 0.25))
    if (L) L.dx = -0.55 * a * o; if (R) R.dx = 0.55 * a * o
  }
}
var NROWS = ["A", "B", "C"]
function eachRow(pose, ctx, fn) {          // the pupils and the cells of each row: fn(row index, pupils or null, cells or null)
  for (var i = 0; i < 3; i++) fn(i, hasGroup(ctx, "pupils" + NROWS[i]) ? G(pose, ctx, "pupils" + NROWS[i]) : null, hasGroup(ctx, "cells" + NROWS[i]) ? G(pose, ctx, "cells" + NROWS[i]) : null)
}
KIND["ai:neurons"] = function(pose, ev, x, a, s, ctx) {
  var n = ctx.n || 0
  if (ev === "hover" || ev === "leave") {     // a signal runs down the net: each row glances to the pointer, a little after the one above
    eachRow(pose, ctx, function(i, p) {
      if (!p) return
      var d = i * 0.12 + hs(s, 90 + i, n, 0, 0.05), f = follow(ev, ev === "hover" ? clamp((x - d) / (1 - d), 0, 1) : x, a)
      p.dx = f * clamp(ctx.px || 0, -1, 1) * 0.5; p.dy = f * clamp(ctx.py || 0, -1, 1) * 0.25
    })
    pose.glintDx = follow(ev, x, a) * clamp(ctx.px || 0, -1, 1) * 0.6
  } else if (ev === "press") {                // the rows blink in cascade
    eachRow(pose, ctx, function(i, p, c) {
      var d = i * 0.1, b = blink(clamp((x - d) / (1 - d), 0, 1), 0.2, 0.15), sy = 1 - 0.9 * b
      if (p) p.sy = sy
      if (c) c.sy = sy
    })
  } else if (ev === "soak") {                 // the row the level crossed: its pupils dilate
    var w = clamp(ctx.which === undefined ? 2 : ctx.which, 0, 2)
    eachRow(pose, ctx, function(i, p) { if (p && i === w) p.sx = p.sy = 1 + 0.25 * a * pulse(x, 0.35) })
  } else if (ev === "full") {                 // all dilate together, then the last row constricts (shock)
    eachRow(pose, ctx, function(i, p) {
      if (!p) return
      var k = 1 + 0.3 * a * pulse(x, 0.3)
      if (i === 2 && x > 0.7) k -= 0.3 * Math.sin(Math.PI * (x - 0.7) / 0.3)
      p.sx = p.sy = k
    })
  } else if (ev === "drain") {                // all the rows blink once, together
    eachRow(pose, ctx, function(i, p, c) { var sy = 1 - 0.9 * blink(x, 0.2, 0.15); if (p) p.sy = sy; if (c) c.sy = sy })
  } else if (ev === "omen") {                 // every pupil turns to one side at once, holds, and returns row by row, last row first
    var side = hash(s, 91, n) < 0.5 ? -1 : 1
    eachRow(pose, ctx, function(i, p) {
      if (!p) return
      var t0 = [0.92, 0.86, 0.8][i], e = x < 0.15 ? ez("decel", x / 0.15) : (x < t0 ? 1 : 1 - ez("soft", (x - t0) / (1 - t0)))
      p.dx = side * 0.7 * a * e
    })
  }
}
KIND["ai:eye"] = function(pose, ev, x, a, s, ctx) {
  var n = ctx.n || 0, E = hasGroup(ctx, "eye") ? G(pose, ctx, "eye") : null, I = hasGroup(ctx, "iris") ? G(pose, ctx, "iris") : null
  if (ev === "hover" || ev === "leave") {     // the gaze finds the pointer, with a micro-saccade that stays
    var f = follow(ev, x, a), px = clamp(ctx.px || 0, -1, 1), py = clamp(ctx.py || 0, -1, 1)
    if (I) {
      I.dx = f * px * 1.0
      I.dy = f * py * 0.4
      if (ev === "hover" && x > 0.55) I.dx += (hash(s, 92, n) < 0.5 ? -1 : 1) * 0.15 * Math.abs(px) * ez("decel", (x - 0.55) / 0.05)
    }
    pose.glintDx = f * px * 0.6
  } else if (ev === "press") {                // a heavy blink
    var sy = 1 - 0.9 * blink(x, 0.2, 0.15)
    if (E) E.sy = sy; if (I) I.sy = sy
  } else if (ev === "soak") {                 // the pupil dilates
    if (I) I.sx = I.sy = 1 + 0.22 * a * pulse(x, 0.35)
  } else if (ev === "full") {                 // constrict, then stare wide, no blink
    if (I) I.sx = I.sy = x < 0.2 ? lerp(1, 0.75, ez("decel", x / 0.2)) : (x < 0.5 ? lerp(0.75, 1.15, ez("standard", (x - 0.2) / 0.3)) : lerp(1.15, 1, ez("soft", (x - 0.5) / 0.5)))
  } else if (ev === "drain") {                // one slow blink
    var sl = 1 - 0.9 * blink(x, 0.3, 0.25)
    if (E) E.sy = sl; if (I) I.sy = sl
  } else if (ev === "omen") {                 // one hard look to a corner, held with a tremor, then it blinks as it comes back
    var side = hash(s, 93, n) < 0.5 ? -1 : 1
    if (I) {
      var e = x < 0.12 ? ez("decel", x / 0.12) : (x < 0.7 ? 1 : 1 - ez("soft", (x - 0.7) / 0.3))
      I.dx = side * 1.3 * a * e + (Math.abs(x - 0.45) < 0.06 ? 0.1 * side : 0)
      I.dy = -0.5 * a * e
    }
    if (E && x > 0.7) { var bl = 1 - 0.9 * blink((x - 0.7) / 0.3, 0.3, 0.2); E.sy = bl; if (I) I.sy = bl }
  }
}
KIND["ai:spiral"] = function(pose, ev, x, a, s, ctx) {
  var n = ctx.n || 0, sp = hasGroup(ctx, "spiral") ? G(pose, ctx, "spiral") : null
  if (ev === "hover" || ev === "leave") {     // the flesh breathes and the spiral sucks inward
    if (ev === "hover") { pose.root.sx = pose.root.sy = 1 + 0.015 * a * pulse(x, 0.3); if (sp) sp.rot = -20 * a * twitch(x, 0.6, 0.3) }
    pose.glintDx = follow(ev, x, a) * clamp(ctx.px || 0, -1, 1) * 0.8
  } else if (ev === "press") {                // the flesh puckers
    pose.root.sx = pose.root.sy = 1 - 0.05 * a * pulse(x, 0.25)
    if (sp) sp.rot = 6 * a * pulse(x, 0.25)
  } else if (ev === "soak") {                 // the bead swells
    if (hasGroup(ctx, "bead")) { var b = G(pose, ctx, "bead"); b.sx = b.sy = 1 + 0.6 * a * pulse(x, 0.35) }
  } else if (ev === "full") {                 // the bead slides inward and a new one wells up behind it (the disk's press)
    if (hasGroup(ctx, "bead")) {
      var d = G(pose, ctx, "bead"), r = ctx.rig.bead, v = P2(r.tx - r.ox, r.ty - r.oy, 2 * a)
      var go = x < 0.75 ? ez("accel", x / 0.75) : 0
      d.dx = v.x * go; d.dy = v.y * go
      d.op = x < 0.75 ? 1 - 0.6 * go : ez("decel", (x - 0.75) / 0.25)
      d.sx = d.sy = x < 0.75 ? 1 - 0.3 * go : lerp(0.2, 1, ez("spring", (x - 0.75) / 0.25))
    }
  } else if (ev === "drain") {                // it unwinds what drained
    if (sp) sp.rot = 30 * a * (1 - ez("decel", x))
  } else if (ev === "omen") {                 // one notch the wrong way, a held breath, back
    if (sp) sp.rot = 14 * a * wrongNotch(x)
  }
}
function bellPivot(pose, ctx) { var r = ctx.rig && ctx.rig.bell; pose.root.ox = r ? r.ox : 24; pose.root.oy = r ? r.oy : 5.5 }
function eyeTo(pose, ctx, dx) { if (hasGroup(ctx, "iris")) G(pose, ctx, "iris").dx = dx }

// where a hover glances (the host cannot see the pointer: the widget's MouseArea owns the hover): a seeded side, never centred
function glance(seed, n) {
  var side = hash(seed | 0, 50, n) < 0.5 ? -1 : 1
  return { px: side * hs(seed | 0, 51, n, 0.55, 1), py: hs(seed | 0, 52, n, -0.5, 0.35) }
}
function P2(x, y, len) { var l = Math.hypot(x, y) || 1; return { x: x / l * len, y: y / l * len } }
// the pointer follow's envelope: rising over the hover, falling over the leave; held at 1 after a hover
function follow(ev, x, a) {
  if (!(a > 0)) return 0
  if (ev === "hover") return ez("decel", x >= 1 ? 1 : x * 1.6)
  if (ev === "leave") return x >= 1 ? 0 : 1 - ez("soft", x)
  return 0
}

function phase(kind, event, tMs, amp, seed, ctx) {
  var pose = rest(), c = ctx || {}
  var dur = duration(kind, event, amp)
  if (!(amp > 0) || !dur || !event) return pose
  var x = clamp(tMs / dur, 0, 1), a = Math.min(amp, 1.7), s = (seed | 0) || 1
  if (event === "draw") { if (x < 1) drawOn(pose, x, c); return pose }
  // at the end every event is the rest pose (hover holds the follow, which is zero with the pointer centred)
  if (x >= 1 && event !== "hover") return pose
  var f = KIND[kind] || KIND[baseOf(kind)]
  if (f) f(pose, event, x, a, s, c)
  return clean(pose, c)
}
// a group the event left exactly where it rests is dropped, so a pose at rest is the rest pose, whatever touched it
function clean(pose, ctx) {
  for (var g in pose.groups) {
    var q = pose.groups[g], r = ctx && ctx.rig ? ctx.rig[g] : null, op0 = r && r.hidden ? 0 : 1
    if (q.dx === 0 && q.dy === 0 && q.rot === 0 && q.sx === 1 && q.sy === 1 && q.op === op0) delete pose.groups[g]
  }
  var R = pose.root
  if (R.dx === 0 && R.dy === 0 && R.rot === 0 && R.sx === 1 && R.sy === 1) { R.ox = 24; R.oy = 24 }
  if (pose.glintDx === 0) pose.glintDx = 0
  return pose
}

if (typeof module !== "undefined") module.exports = { CURVES: CURVES, DUR: DUR, OMEN: OMEN, shared: shared, bezier: bezier, phase: phase,
  duration: duration, edge: edge, omenDue: omenDue, rest: rest, glance: glance }
