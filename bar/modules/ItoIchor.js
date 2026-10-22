// The viscous liquid of the system-panel diagrams: how a level moves, how its surface sloshes, the polygons that are
// drawn (body, skin, wall highlight, film, platelets), and the drop that forms, stretches, snaps and falls.
//
// It is meant to read as thick blood, not as layered water: one depth ramp shared by every stratum, a luminous skin
// only under the surface, a film that clings and drains slowly, a drop with weight. Design: dev/openspec/changes/
// ito-system-panels/ichor-materiality.md.
//
// Pure functions, no I/O, no QML types: the same file loads in the shell, in the offscreen lab and in
// `node --test` (scripts/qa/models.test.mjs). No `.pragma`, no JS-to-JS import (the shape of ItoProcs.js).
//
// EVERY number that sets how the liquid FEELS or LOOKS is in the tables just below (SPRINGS, MODES, SURFACE, FILM,
// SKIN, DRIP, INK, PLATELETS). Tune there and nowhere else; the components read them through the functions here.
// The colour factors (INK) are read by ItoSealInk; no colour value is written anywhere.
//
// Lengths are pixels, times seconds, `level` a height in pixels from the bottom of the vessel. y grows downward.
// Every pixel constant of SKIN, SURFACE (crown, meniscus), FILM and DRIP is multiplied by the vessel's scale
// `s = scaleFor(rv)` (rv / 64, clamped 0.3..1), so the small swap seals get the same material at their size.

// Level springs: a QML SpringAnimation on the shown value. `velocity` caps the pour speed (fractions per second),
// `epsilon` is where the spring stops itself. STARTING VALUES from the design, judged live by the user.
var SPRINGS = {
  vessel: { spring: 0.9, damping: 0.26, mass: 2.6, velocity: 0.45, epsilon: 0.0015 },  // RAM vessel strata, swap seals
  ray:    { spring: 1.9, damping: 0.24, mass: 1.3, velocity: 1.4, epsilon: 0.002 },    // CPU rays
  arc:    { spring: 1.5, damping: 0.22, mass: 1.6, velocity: 0.8, epsilon: 0.0015 },   // Disk arcs
  row:    { spring: 2.2, damping: 0.28, mass: 1.1, velocity: 1.2, epsilon: 0.002 },    // rows, cells
  groove: { spring: 2.6, damping: 0.32, mass: 0.9, velocity: 1.5, epsilon: 0.003 }     // process grooves
}

// A target change below this is applied without waking anything (below half a pixel on every form).
var DEAD_BAND = 0.004

// Surface standing modes: frequency f (Hz), damping ratio z, coupling g to the level's acceleration, amplitude cap
// min(cap, capFrac x 2rv) in px. The gain G = min(amp, 1.6) is applied by the caller through slosh options.
var MODES = [
  { f: 0.62, z: 0.36, g: 1.00, cap: 12,  capFrac: 0.10 },    // tilt,   asymmetric, pivot off centre (design g 0.45; see the apply report)
  { f: 1.15, z: 0.40, g: 0.16, cap: 5,   capFrac: 0.05 },    // bulge,  cos(pi u)
  { f: 2.6,  z: 0.10, g: 0.02, cap: 1.2, capFrac: 0.012 }    // membrane ripple, cos(3 pi u)
]

// The top surface. pivot: where the tilt is zero (u, right of centre). up / down: the tilt lifts less than it sinks.
// crown: the static skin tension that domes the middle (px). meniscusRise / meniscusReach: the lip that climbs the
// wall (px, px). cling: a falling level clings (1 + cling x speed); lag: a rising one climbs late (1 - lag x speed).
var SURFACE = { pivot: 0.20, up: 0.85, down: 1.15, crown: 1.2, meniscusRise: 2.6, meniscusReach: 5.0, cling: 1.2, lag: 0.6 }

// The wall film a falling level leaves. thick / thin: tapered thickness at the surface / at the top (px). lobeAmp,
// lobeLen: the rivulets' extra thickness and length (px); lobesLeft / lobesRight: where they sit along the film,
// 0 at the surface .. 1 at the top, never mirrored; minLobeLen: no lobes on a shorter film. steps: at most that many
// steps per side. drainMin / drainGain / drainMax: px/s = min(drainMax, drainMin + drainGain x length).
var FILM = { thick: 3.2, thin: 0.9, lobeAmp: 2.4, lobeLen: 8, lobesLeft: [0.30, 0.72], lobesRight: [0.52], minLobeLen: 10,
  steps: 24, drainMin: 4, drainGain: 0.25, drainMax: 16 }

// The skin: a luminous band under the top surface (band), the meniscus highlight band (hiBand), and the arc of the
// wall highlight on the left wall (wallArc rad). thinDepth: the depth (px) under which a pool turns translucent.
// wallMinRv / wallMinDepth: no wall highlight on a smaller vessel or a shallower pool.
var SKIN = { band: 3.5, hiBand: 2.2, wallArc: 0.9, wallMinRv: 24, wallMinDepth: 8, thinDepth: 24 }

// The drop. Phase breakpoints: form -> stretch -> snap -> fall -> land. Lengths in px.
var DRIP = {
  form: 0.50, stretch: 0.64, snap: 0.68, land: 0.88,
  radius0: 1.8, radius1: 5.0, sag: 3.5, neck0: 5, neck1: 3, neckThin: 0.8, stretchY: 10.5,
  stretchYScale: 1.35, stretchXScale: 0.88, snapYScale: 0.90, snapXScale: 1.06,
  wobble: 0.12, ringOpacity: 0.7, ringWidth0: 1.2, ringWidth1: 0.6, ringReach: 3.2, ringYScale: 0.35,
  satDx: 6, satDy: 3, satR: 1.2, satOpacity: 0.8, landXScale: 2.4, landYScale: 0.30,
  dv2: 9, dv3: 12, fall: 16, durationMs: 2200
}

// Colour factors, read by ItoSealInk (every token a function of blood / lit / bone / ink / warn). glow: the skin's
// light (lighter, more saturated than the liquid, stepped until it separates from it). clot: the dense dark tone
// (darker than the liquid, reaching `target` against the panel). highlight: the specular, lit x litMix into the
// lighter of bone and paper, at `alpha` (raised to `target` over the liquid, at most `maxAlpha`). stain: the wet film.
var INK = {
  glow: { dl: 0.12, sMul: 1.12, target: 1.20, step: 0.04, maxSteps: 4 },
  clot: { dl: -0.20, sMul: 0.90, target: 2.0, vsFill: 1.20 },
  highlight: { litMix: 0.25, alpha: 0.60, target: 1.4, maxAlpha: 0.85 },
  stain: { alpha: 0.55, target: 1.8 },
  skinLine: { alpha: 0.50 }
}

// The specks of sediment in the used stratum: count is fixed by SPECKS below; r (px) range; the smallest pool depth
// and vessel radius that shows them; how far the surface's tilt / bulge move them.
var PLATELETS = { rMin: 0.8, rMax: 1.2, minDepth: 14, minRv: 24, dx: 0.45, dy: 0.3, inset: 3, under: 4 }

var SURFACE_SAMPLES = 14     // points along the top surface (chord ends included; the ripple needs at least 12)
var ARC_SAMPLES = 20         // points along the rest of the circle

function clamp(v, lo, hi) { return v < lo ? lo : (v > hi ? hi : v) }

// ---- the drowned eye's skin flap (master-queue section 2): the colour of the liquid at the eye, and of the piece of skin round it -------------
// FLAP.mix: how far the flap's fill is mixed from the liquid toward `bone` (a token); FLAP.bucket: the depth step (px) at which the flap is baked
// again; FLAP.pad: the px kept between the flap's top and the top surface (rank 0's centre is clamped to it).
var FLAP = { mix: 0.10, bucket: 8, pad: 4 }
// the stratum under height `y` (px from the vessel's top, a vessel of radius `radius`): levelsPx are the strata's tops in px of liquid height
function stratumAt(levelsPx, radius, y) {
  var h = 2 * (Number(radius) || 0) - (Number(y) || 0), n = levelsPx ? levelsPx.length : 0
  for (var i = 0; i < n - 1; i++) if (h <= levelsPx[i]) return i
  return Math.max(0, n - 1)
}
// The opaque colour of the liquid at the eye's centre: the ichor's own ramp stops of that stratum, `base` at the surface to `floor` at the bottom, at
// `depth` (0..1 of the pool). `ramp` is [{ base, floor }] as ItoIchor.ramp, `mix(a, b, t)` the caller's colour mix (ItoSealInk.mix), so this stays pure.
// -> the colour (whatever `mix` returns), or null when there is no ramp.
function bodyAt(ramp, levelsPx, radius, y, depth, mix) {
  var r = ramp ? ramp[stratumAt(levelsPx, radius, y)] : null
  if (!r || typeof mix !== "function") return null
  return mix(r.base, r.floor, clamp(Number(depth) || 0, 0, 1))
}
// the flap's fill: the liquid at the eye mixed a tenth toward `bone`
function flapFill(body, bone, mix) { return typeof mix === "function" && body ? mix(body, bone, FLAP.mix) : body }
// the depth bucket of a y (px): the flap is baked again when it changes
function flapBucket(y) { return Math.floor((Number(y) || 0) / FLAP.bucket) }

// The scale of a vessel of radius `rv`: 1 from 64 up, 0.3 at the smallest.
function scaleFor(rv) { return clamp((Number(rv) || 0) / 64, 0.3, 1) }

// Spring settings for a use ("vessel", "ray", "arc", "row", "groove") at a motion amplitude (0 off, 1 calm, 1.7
// lively). Lively: damping x 0.8, mass x 1.2 (a thicker wobble, a longer tail). Off is the caller's business
// (`Behavior.enabled: false`).
function springFor(kind, amp) {
  var base = SPRINGS[kind] || SPRINGS.row
  var lively = Number(amp) > 1.2
  return {
    spring: base.spring,
    damping: lively ? base.damping * 0.8 : base.damping,
    mass: lively ? base.mass * 1.2 : base.mass,
    velocity: base.velocity,
    epsilon: base.epsilon
  }
}

// A shallow pool is translucent: 1 at no depth, 0 from `SKIN.thinDepth` px of depth.
function thinness(depthPx) { return clamp(1 - (Number(depthPx) || 0) / SKIN.thinDepth, 0, 1) }

// Where the meniscus highlight sits across the vessel (0..1 of the diameter): it slides toward the low side of a
// tilted surface (a positive tilt lifts the right, so it goes left). Light comes from the upper left.
function highlightX(a1) { return clamp(0.36 - 0.022 * (Number(a1) || 0), 0.18, 0.72) }

// ---------------------------------------------------------------------------------------------------- slosh

// State of the three surface modes (tilt, bulge, ripple): amplitudes a1..a3 (px, up positive) and their velocities.
function newSlosh() { return { a1: 0, v1: 0, a2: 0, v2: 0, a3: 0, v3: 0, quiet: 0 } }

// Advance the modes by `dt` seconds under the level's acceleration (px/s^2), by semi-implicit Euler:
//   a'' = -w^2 a - 2 z w a' + g * G * levelAccel
// dt is clamped to 1/30 and split in two above 1/90, so it is stable at any frame time. Amplitudes are clamped
// (|a_m| <= min(cap, capFrac x 2rv), see MODES). After 15 consecutive frames with |a1|+|a2|+|a3| < 0.05 px and
// |v1|+|v2|+|v3| < 0.2 px/s the modes are zeroed (`quiet`), and a caller can stop its clock. Returns a NEW state.
// opts: { rv: vessel radius px, gain: G }
function sloshStep(state, dt, levelAccel, opts) {
  var o = opts || {}
  var gain = o.gain === undefined ? 1 : o.gain
  var diameter = 2 * (o.rv === undefined ? 64 : o.rv)
  var step = Math.min(Math.max(Number(dt) || 0, 0), 1 / 30)
  var n = step > 1 / 90 ? 2 : 1
  var h = step / n
  var a = [state.a1, state.a2, state.a3], v = [state.v1, state.v2, state.v3]
  for (var s = 0; s < n; s++) {
    for (var m = 0; m < 3; m++) {
      var md = MODES[m]
      var w = 2 * Math.PI * md.f
      var lim = Math.min(md.cap, md.capFrac * diameter)
      var acc = -w * w * a[m] - 2 * md.z * w * v[m] + md.g * gain * levelAccel
      v[m] += acc * h
      a[m] += v[m] * h
      if (a[m] > lim) { a[m] = lim; if (v[m] > 0) v[m] = 0 }
      else if (a[m] < -lim) { a[m] = -lim; if (v[m] < 0) v[m] = 0 }
    }
  }
  var still = Math.abs(a[0]) + Math.abs(a[1]) + Math.abs(a[2]) < 0.05 && Math.abs(v[0]) + Math.abs(v[1]) + Math.abs(v[2]) < 0.2
  var quiet = still ? state.quiet + 1 : 0
  if (quiet >= 15) return { a1: 0, v1: 0, a2: 0, v2: 0, a3: 0, v3: 0, quiet: quiet }
  return { a1: a[0], v1: v[0], a2: a[1], v2: v[1], a3: a[2], v3: v[2], quiet: quiet }
}

function isQuiet(state) { return state.quiet >= 15 && state.a1 === 0 && state.a2 === 0 && state.a3 === 0 }

// A drop letting go kicks the surface: `dv2` / `dv3` px/s added to the bulge and ripple modes' velocities.
function kick(state, dv2, dv3) {
  return { a1: state.a1, v1: state.v1, a2: state.a2, v2: state.v2 + (dv2 || 0), a3: state.a3, v3: state.v3 + (dv3 || 0), quiet: 0 }
}

// Height offset (px, up positive) of the surface at chord position u (-1..1): the asymmetric tilt about the pivot
// (it sinks further than it lifts), the bulge, the ripple, and the static crown (scaled by `s`).
function surfaceOffset(a1, a2, a3, u, s) {
  var u0 = SURFACE.pivot
  var w = (u - u0) / (u >= u0 ? 1 - u0 : 1 + u0)
  var t = a1 * Math.sin(Math.PI * w / 2)
  var o1 = t * (t > 0 ? SURFACE.up : SURFACE.down)
  var crown = SURFACE.crown * (s === undefined ? 1 : s) * (1 + Math.cos(Math.PI * u)) / 2
  return o1 + a2 * Math.cos(Math.PI * u) + a3 * Math.cos(3 * Math.PI * u) + crown
}

// ------------------------------------------------------------------------------------------- meniscus, film

// Height (px) the surface rises at the wall. A rising level climbs the wall late (0.4 of it at full speed), a
// falling one clings (2.2). `velocity` is the level's velocity in px/s; `diameter` the vessel's; `s` its scale.
function meniscusHeight(velocity, diameter, s) {
  var speed = clamp(Math.abs(velocity) / (0.15 * Math.max(1, diameter)), 0, 1)
  var mf = velocity > 0 ? 1 - SURFACE.lag * speed : 1 + SURFACE.cling * speed
  return SURFACE.meniscusRise * (s === undefined ? 1 : s) * mf
}

// Rise of the surface at distance d (px) from the wall.
function meniscusAt(hM, d, s) { return hM * Math.exp(-d / (SURFACE.meniscusReach * (s === undefined ? 1 : s))) }

// The wall film's top (px): follows a rising level, drains when the level falls: long films drain faster, the last
// few px linger. An 80 px film is gone in about 8 s. `s` scales the px rates.
function filmStep(filmTop, level, dt, s) {
  var k = s === undefined ? 1 : s
  var len = filmTop - level
  var rate = Math.min(FILM.drainMax * k, FILM.drainMin * k + FILM.drainGain * Math.max(0, len))
  return Math.max(level, filmTop - rate * Math.max(0, dt))
}

// ------------------------------------------------------------------------------------------------- polygon

// Half width of the circle at height y (absolute), radius rv, centre (cx, cy).
function halfWidthAt(cy, rv, y) {
  var dy = y - cy
  return Math.sqrt(Math.max(0, rv * rv - dy * dy))
}

// The filled region under the surface, built analytically (no clipping, no mask): the two chord ends are the
// circle's intersections at the end heights (level + offset at u = -1, +1), 14 surface samples between them
// (offset + crown + meniscus), then 20 points along the circle, through the bottom, back to the first end. 34 points,
// all on or inside the circle by construction. `offsets` is { a1, a2, a3 } (px); `hM` the meniscus height (0 for
// none); `s` the vessel's scale. -> [{ x, y }]; the first SURFACE_SAMPLES points are the surface itself, left to right.
function surfacePolygon(cx, cy, rv, levelPx, offsets, hM, s) {
  var a1 = offsets ? offsets.a1 || 0 : 0, a2 = offsets ? offsets.a2 || 0 : 0, a3 = offsets ? offsets.a3 || 0 : 0
  var meniscus = hM || 0
  var k = s === undefined ? 1 : s
  var floorY = cy + rv, topY = cy - rv
  var yLevel = clamp(floorY - levelPx, topY, floorY)
  var halfW0 = halfWidthAt(cy, rv, yLevel)
  var pts = []

  function edgeY(u, d) {
    return clamp(yLevel - surfaceOffset(a1, a2, a3, u, k) - meniscusAt(meniscus, d, k), topY, floorY)
  }
  var yL = edgeY(-1, 0), yR = edgeY(1, 0)
  var xL = cx - halfWidthAt(cy, rv, yL), xR = cx + halfWidthAt(cy, rv, yR)

  pts.push({ x: xL, y: yL })
  for (var i = 1; i < SURFACE_SAMPLES - 1; i++) {
    var u = -1 + 2 * i / (SURFACE_SAMPLES - 1)
    var y = edgeY(u, halfW0 * (1 - Math.abs(u)))
    var limit = halfWidthAt(cy, rv, y)
    pts.push({ x: cx + clamp(u * halfW0, -limit, limit), y: y })
  }
  pts.push({ x: xR, y: yR })

  // from the right end, down through the bottom, up to the left end (angles with x = cos, y = sin, y downward)
  var thetaR = Math.atan2(yR - cy, xR - cx)
  var thetaL = Math.atan2(yL - cy, xL - cx)
  if (thetaL < Math.PI / 2) thetaL += 2 * Math.PI
  for (var j = 1; j <= ARC_SAMPLES; j++) {
    var t = thetaR + (thetaL - thetaR) * j / (ARC_SAMPLES + 1)
    pts.push({ x: cx + rv * Math.cos(t), y: cy + rv * Math.sin(t) })
  }
  return pts
}

// A band of width `width` px under a surface polyline: the surface points, then the same points moved along the
// inward normal (down), reversed. `circle` ({ cx, cy, rv }) keeps every moved point inside the vessel. -> [{ x, y }]
function skinBand(surf, width, circle) {
  var n = surf ? surf.length : 0
  if (n < 2 || !(width > 0)) return []
  var inner = []
  for (var i = 0; i < n; i++) {
    var a = surf[Math.max(0, i - 1)], b = surf[Math.min(n - 1, i + 1)]
    var tx = b.x - a.x, ty = b.y - a.y
    var len = Math.sqrt(tx * tx + ty * ty) || 1
    var x = surf[i].x + (-ty / len) * width, y = surf[i].y + (tx / len) * width
    if (circle) {
      var dx = x - circle.cx, dy = y - circle.cy
      var d = Math.sqrt(dx * dx + dy * dy)
      if (d > circle.rv) { x = circle.cx + dx * circle.rv / d; y = circle.cy + dy * circle.rv / d }
    }
    inner.push({ x: x, y: y })
  }
  return surf.concat(inner.reverse())
}

// The axis of a band's gradient: from the surface's midpoint, along the inward normal, `width` px.
function bandAxis(surf, width) {
  var n = surf ? surf.length : 0
  if (n < 2) return { x1: 0, y1: 0, x2: 0, y2: 0 }
  var m = Math.floor(n / 2)
  var a = surf[Math.max(0, m - 1)], b = surf[Math.min(n - 1, m + 1)]
  var tx = b.x - a.x, ty = b.y - a.y
  var len = Math.sqrt(tx * tx + ty * ty) || 1
  return { x1: surf[m].x, y1: surf[m].y, x2: surf[m].x + (-ty / len) * width, y2: surf[m].y + (tx / len) * width }
}

// The wall highlight: a crescent inside the LEFT wall between r = rv - 1.2 s and rv - 3.4 s, from the surface's left end
// down an arc of SKIN.wallArc x (1 + 0.03 a1) rad (clamped 0.5..1.3, never below the bottom). Empty on a vessel under
// SKIN.wallMinRv or a pool under SKIN.wallMinDepth. -> [{ x, y }]
function wallHighlight(cx, cy, rv, surfLeft, a1, s) {
  var k = s === undefined ? 1 : s
  if (rv < SKIN.wallMinRv || !surfLeft || cy + rv - surfLeft.y < SKIN.wallMinDepth) return []
  var t0 = Math.atan2(surfLeft.y - cy, surfLeft.x - cx)
  if (t0 < Math.PI / 2) t0 += 2 * Math.PI
  var arc = clamp(SKIN.wallArc * (1 + 0.03 * (Number(a1) || 0)), 0.5, 1.3)
  var t1 = Math.max(Math.PI / 2 + 0.05, t0 - arc)
  var rOut = rv - 1.2 * k, rIn = rv - 3.4 * k
  var steps = 12, outer = [], inner = []
  for (var i = 0; i <= steps; i++) {
    var t = t0 + (t1 - t0) * i / steps
    outer.push({ x: cx + rOut * Math.cos(t), y: cy + rOut * Math.sin(t) })
    inner.push({ x: cx + rIn * Math.cos(t), y: cy + rIn * Math.sin(t) })
  }
  return outer.concat(inner.reverse())
}

// The film a falling level leaves on one wall (`side` "left" | "right"): a tapered crescent between the wall and an inner
// edge, thick at the surface and thin at `filmTop`, with rivulet lobes at fixed places along it (two on the left, one
// on the right, never mirrored) when it is long enough. At most FILM.steps steps per side. Empty when the film is under
// half a pixel. -> [{ x, y }] (the wall edge from the surface up, then the inner edge back down)
function filmCrescent(cx, cy, rv, levelPx, filmTop, side, s) {
  var k = s === undefined ? 1 : s
  var len = filmTop - levelPx
  if (len < 0.5) return []
  var floorY = cy + rv, topY = cy - rv
  var yA = clamp(floorY - levelPx, topY, floorY), yB = clamp(floorY - filmTop, topY, floorY)
  if (yA - yB < 0.5) return []
  var sign = side === "left" ? -1 : 1
  var lobes = side === "left" ? FILM.lobesLeft : FILM.lobesRight
  var withLobes = len >= FILM.minLobeLen * k
  var steps = clamp(Math.ceil((yA - yB) / 3), 2, FILM.steps)
  var r = rv - 0.5
  var outer = [], inner = []
  for (var i = 0; i <= steps; i++) {
    var t = i / steps
    var y = yA + (yB - yA) * t
    var hw = Math.sqrt(Math.max(0, r * r - (y - cy) * (y - cy)))
    var thick = (FILM.thin + (FILM.thick - FILM.thin) * Math.pow(1 - t, 0.6)) * k
    if (withLobes) {
      for (var l = 0; l < lobes.length; l++) {
        var dy = (y - (yA + (yB - yA) * lobes[l])) / (FILM.lobeLen * k)
        thick += FILM.lobeAmp * k * Math.exp(-dy * dy)
      }
    }
    thick = Math.min(thick, hw)
    outer.push({ x: cx + sign * hw, y: y })
    inner.push({ x: cx + sign * (hw - thick), y: y })
  }
  return outer.concat(inner.reverse())
}

// Where the five specks sit in the used stratum's box, as fractions (across the chord, down the depth), and their
// radius (0..1 between PLATELETS.rMin and rMax) and tone.
var SPECKS = [
  { fx: -0.55, fy: 0.30, r: 0.5, tone: "clot" }, { fx: 0.15, fy: 0.12, r: 0.9, tone: "clot" },
  { fx: 0.62, fy: 0.42, r: 0.2, tone: "glow" }, { fx: -0.20, fy: 0.62, r: 0.7, tone: "clot" },
  { fx: 0.40, fy: 0.80, r: 1.0, tone: "clot" }
]

// The specks of sediment: 5 x { x, y, r, tone } seeded at fixed fractions of the used stratum's box (from
// `usedTopY`, the top of its surface, to the vessel's floor), moved with the surface (0.45 a1 in x, 0.3 a2 in y),
// kept PLATELETS.inset px inside the circle and PLATELETS.under px under the surface. Empty on a vessel under
// PLATELETS.minRv or a used stratum under PLATELETS.minDepth deep.
function platelets(cx, cy, rv, usedTopY, a1, a2) {
  var floorY = cy + rv
  if (rv < PLATELETS.minRv || floorY - usedTopY < PLATELETS.minDepth) return []
  var yMin = Math.max(usedTopY + PLATELETS.under, cy - rv + PLATELETS.inset)
  var yMax = floorY - PLATELETS.inset
  var span = Math.max(0, floorY - 7 - (usedTopY + PLATELETS.under))
  var out = []
  for (var i = 0; i < SPECKS.length; i++) {
    var sp = SPECKS[i]
    var y = clamp(usedTopY + PLATELETS.under + sp.fy * span + PLATELETS.dy * (Number(a2) || 0), yMin, yMax)
    var hw = halfWidthAt(cy, rv - PLATELETS.inset, y)
    var x = clamp(cx + sp.fx * hw + PLATELETS.dx * (Number(a1) || 0), cx - hw, cx + hw)
    out.push({ x: x, y: y, r: PLATELETS.rMin + (PLATELETS.rMax - PLATELETS.rMin) * sp.r, tone: sp.tone })
  }
  return out
}

// A point list as an SVG path string ("M x y L x y ... [Z]"), 2 decimals: what QML's PathSvg takes. Much cheaper per frame
// than building a QML point for every vertex. Empty for an empty list.
function toSvg(pts, close) {
  var n = pts ? pts.length : 0
  if (n === 0) return ""
  var out = "M" + Math.round(pts[0].x * 100) / 100 + " " + Math.round(pts[0].y * 100) / 100
  for (var i = 1; i < n; i++) out += "L" + Math.round(pts[i].x * 100) / 100 + " " + Math.round(pts[i].y * 100) / 100
  return close ? out + "Z" : out
}

// Everything a vessel draws that is geometry, in one call (the one the QML component and the bench use).
//   rv: radius; levelsPx: the four strata's boundary heights (px, area-true); live: four booleans (stratum not empty);
//   off: { a1, a2, a3 } of the top surface (lower strata follow at 0.4 and 0.25); vel: the level's velocity px/s;
//   filmPx: the film's top (px).
// -> { s, polys[4], surf[4], top[4], topIdx (-1 when empty), surfTop, depth, skin, skinAxis, hi, hx, wall, filmL, filmR,
//      filmY [top y, surface y], platelets }
function buildGeometry(rv, levelsPx, live, off, vel, filmPx) {
  var cx = rv, cy = rv, s = scaleFor(rv)
  var a1 = off ? off.a1 || 0 : 0, a2 = off ? off.a2 || 0 : 0, a3 = off ? off.a3 || 0 : 0
  var polys = [[], [], [], []], surf = [[], [], [], []], top = [cy, cy, cy, cy]
  var used = [], i
  for (i = 0; i < 4; i++) if (live[i]) used.push(i)
  var hM = meniscusHeight(vel || 0, 2 * rv, s)
  for (var r = 0; r < used.length; r++) {
    i = used[used.length - 1 - r]
    var f = r === 0 ? 1 : (r === 1 ? 0.4 : 0.25)
    var poly = surfacePolygon(cx, cy, rv, levelsPx[i], { a1: a1 * f, a2: a2 * f, a3: a3 * f }, r === 0 ? hM : 0, s)
    polys[i] = poly
    surf[i] = poly.slice(0, SURFACE_SAMPLES)
    var ys = surf[i][0].y
    for (var k = 1; k < SURFACE_SAMPLES; k++) ys = Math.min(ys, surf[i][k].y)
    top[i] = ys
  }
  var g = { s: s, polys: polys, surf: surf, top: top, topIdx: -1, surfTop: 2 * rv, depth: 0, skin: [], skinAxis: { x1: 0, y1: 0, x2: 0, y2: 0 },
    hi: [], hx: highlightX(a1), wall: [], filmL: [], filmR: [], filmY: [0, 0], platelets: [] }
  if (used.length === 0) return g
  var ti = used[used.length - 1]
  var ts = surf[ti], circle = { cx: cx, cy: cy, rv: rv }
  g.topIdx = ti
  g.surfTop = top[ti]
  g.depth = 2 * rv - top[ti]
  g.skin = skinBand(ts, SKIN.band * s, circle)
  g.skinAxis = bandAxis(ts, SKIN.band * s)
  g.hi = skinBand(ts, SKIN.hiBand * s, circle)
  g.wall = wallHighlight(cx, cy, rv, ts[0], a1, s)
  g.platelets = platelets(cx, cy, rv, top[used[0]], a1, a2)
  var topPx = levelsPx[ti], film = Math.max(topPx, filmPx || 0)
  g.filmL = filmCrescent(cx, cy, rv, topPx, film, "left", s)
  g.filmR = filmCrescent(cx, cy, rv, topPx, film, "right", s)
  g.filmY = [clamp(2 * rv - film, 0, 2 * rv), clamp(2 * rv - topPx, 0, 2 * rv)]
  return g
}

// ------------------------------------------------------------------------------------------------- drips

// The drop, posed by a single phase 0..1 (breakpoints in DRIP). `fall` is how far it drops (px), `s` the scale.
//   0    .. 0.50  form:    radius 1.8 -> 5 (ease out), the bulb sags 0 -> 3.5, its neck 5 -> 3 wide
//   0.50 .. 0.64  stretch: y 3.5 -> 10.5, neck 3 -> 0.8, yScale 1 -> 1.35, xScale 1 -> 0.88
//   0.64 .. 0.68  snap:    the neck retracts up into the source, yScale -> 0.90, xScale -> 1.06 (the recoil)
//   0.68 .. 0.88  fall:    y 10.5 -> fall (quadratic), a wobble in yScale, xScale -> 1
//   0.88 .. 1.0   land:    the bulb flattens (xScale 2.4, yScale 0.30) and fades; a ring spreads (r 1 -> 3.2 x radius,
//                          border 1.2 -> 0.6), two satellites jump 6 px out and back down
// -> { neck, neckLen, radius, y, xScale, yScale, opacity, ringR, ringOpacity, ringWidth, satDx, satDy, satOpacity }
// The ring and satellite fields are 0 outside the landing. `neck` is the neck's width, `neckLen` its length from the source.
function dripPose(phase, fall, s) {
  var k = s === undefined ? 1 : s
  var p = clamp(Number(phase) || 0, 0, 1)
  var D = DRIP
  var yS = D.stretchY * k
  var yEnd = Math.max(fall === undefined ? D.fall * k : fall, yS)
  var pose = { neck: 0, neckLen: 0, radius: D.radius1 * k, y: 0, xScale: 1, yScale: 1, opacity: 1,
    ringR: 0, ringOpacity: 0, ringWidth: 0, satDx: 0, satDy: 0, satOpacity: 0 }
  var f, g, h, q, m
  if (p < D.form) {
    f = p / D.form
    pose.radius = (D.radius0 + (D.radius1 - D.radius0) * (1 - (1 - f) * (1 - f))) * k
    pose.y = D.sag * k * f * f
    pose.neck = (D.neck0 + (D.neck1 - D.neck0) * f) * k
    pose.neckLen = pose.y + pose.radius * 1.6
  } else if (p < D.stretch) {
    g = (p - D.form) / (D.stretch - D.form)
    pose.y = (D.sag + (D.stretchY - D.sag) * g) * k
    pose.neck = (D.neck1 + (D.neckThin - D.neck1) * g) * k
    pose.yScale = 1 + (D.stretchYScale - 1) * g
    pose.xScale = 1 + (D.stretchXScale - 1) * g
    pose.neckLen = pose.y + pose.radius * 1.6
  } else if (p < D.snap) {
    h = (p - D.stretch) / (D.snap - D.stretch)
    pose.y = yS
    pose.neck = D.neckThin * k * (1 - h)
    pose.neckLen = (yS + pose.radius * 1.6) * (1 - h)
    pose.yScale = D.stretchYScale + (D.snapYScale - D.stretchYScale) * h
    pose.xScale = D.stretchXScale + (D.snapXScale - D.stretchXScale) * h
  } else if (p < D.land) {
    q = (p - D.snap) / (D.land - D.snap)
    pose.y = yS + (yEnd - yS) * q * q
    pose.yScale = 1 - (1 - D.snapYScale) * (1 - q) + D.wobble * Math.sin(3 * Math.PI * q) * (1 - q)
    pose.xScale = 1 + (D.snapXScale - 1) * (1 - q)
  } else {
    m = (p - D.land) / (1 - D.land)
    pose.y = yEnd
    pose.xScale = 1 + (D.landXScale - 1) * m
    pose.yScale = 1 - (1 - D.landYScale) * m
    pose.opacity = 1 - m
    pose.ringR = k + (D.ringReach * pose.radius - k) * m
    pose.ringOpacity = D.ringOpacity * (1 - m)
    pose.ringWidth = (D.ringWidth0 + (D.ringWidth1 - D.ringWidth0) * m) * k
    pose.satDx = D.satDx * k * m
    pose.satDy = D.satDy * k * Math.sin(Math.PI * m)
    pose.satOpacity = D.satOpacity * (1 - m)
  }
  return pose
}

// px/s added to the source's bulge and ripple modes while the drop lets go (phase 0.64 .. 0.68); zeros otherwise.
function dripRecoil(phase) {
  var on = phase >= DRIP.stretch && phase < DRIP.snap
  return { dv2: on ? DRIP.dv2 : 0, dv3: on ? DRIP.dv3 : 0 }
}

// A teardrop of unit radius centred on (0, 0): a cusp at (0, -2.2) and the circle below. `n` points on the arc.
function teardropPoints(n) {
  var count = Math.max(6, n || 24)
  var beta = Math.acos(1 / 2.2)
  var pts = [{ x: 0, y: -2.2 }]
  for (var i = 0; i <= count; i++) {
    var a = beta + (2 * Math.PI - 2 * beta) * i / count
    pts.push({ x: Math.sin(a), y: -Math.cos(a) })
  }
  return pts
}

// Seconds between drops for pending writes (RAM): none below 1 MiB, else clamp(30 / log2(1 + MiB), 6, 30).
function dripInterval(dirtyKiB) {
  var mib = (Number(dirtyKiB) || 0) / 1024
  if (mib < 1) return null
  return clamp(30 / (Math.log(1 + mib) / Math.LN2), 6, 30)
}

// Seconds between drops for a write rate (Disk): none below 64 KiB/s, else clamp(40 / log2(1 + 8 x MiB/s), 6, 40).
function writeDripInterval(bps) {
  var v = Number(bps) || 0
  if (v < 65536) return null
  return clamp(40 / (Math.log(1 + 8 * v / 1048576) / Math.LN2), 6, 40)
}

// The wait before the next drop: base x (0.75 + 0.5 x random), a little shorter when lively, never under 6 s.
// `random` is a number 0..1 passed in, so this stays pure.
function dripDelay(base, random, amp) {
  return Math.max(6, base * (0.75 + 0.5 * clamp(random, 0, 1)) / (Number(amp) > 1.2 ? 1.4 : 1))
}

if (typeof module !== "undefined") module.exports = {
  FLAP: FLAP, stratumAt: stratumAt, bodyAt: bodyAt, flapFill: flapFill, flapBucket: flapBucket,
  SPRINGS: SPRINGS, MODES: MODES, SURFACE: SURFACE, FILM: FILM, SKIN: SKIN, DRIP: DRIP, INK: INK, PLATELETS: PLATELETS,
  DEAD_BAND: DEAD_BAND, SURFACE_SAMPLES: SURFACE_SAMPLES, ARC_SAMPLES: ARC_SAMPLES,
  scaleFor: scaleFor, springFor: springFor, thinness: thinness, highlightX: highlightX,
  newSlosh: newSlosh, sloshStep: sloshStep, isQuiet: isQuiet, kick: kick,
  surfaceOffset: surfaceOffset, meniscusHeight: meniscusHeight, meniscusAt: meniscusAt, filmStep: filmStep,
  surfacePolygon: surfacePolygon, skinBand: skinBand, bandAxis: bandAxis, wallHighlight: wallHighlight,
  filmCrescent: filmCrescent, platelets: platelets, buildGeometry: buildGeometry, toSvg: toSvg,
  dripPose: dripPose, dripRecoil: dripRecoil, teardropPoints: teardropPoints,
  dripInterval: dripInterval, writeDripInterval: writeDripInterval, dripDelay: dripDelay
}
