// The maths of the system-panel diagrams: layout in polar space, tiers of rays, ticks, spirals, circle segments,
// strata, arcs, runes, IO speed and colour contrast.
//
// Pure functions: no I/O, no QML types, so the same file loads in the shell, in the offscreen lab and in
// `node --test` (scripts/qa/models.test.mjs). No `.pragma` and no JS-to-JS import (the shape of ItoProcs.js).
//
// Angles are in degrees, 0 at 12 o'clock and growing clockwise (the way the diagrams are read). Lengths are in
// pixels for the reference seal radius (92); a caller scales them by `R / 92`. Colours cross into this file as
// { r, g, b, a } numbers (0..1) and go back the same way, so no colour is written here and none is a hex string.

var REFERENCE_R = 92

function clamp(v, lo, hi) { return v < lo ? lo : (v > hi ? hi : v) }

// ---------------------------------------------------------------------------------------------------- polar

// Offset from the centre for an angle (degrees, 12 o'clock, clockwise) and a radius. y grows downward, as in QML.
function polar(angleDeg, r) {
  var a = angleDeg * Math.PI / 180
  return { x: r * Math.sin(a), y: -r * Math.cos(a) }
}

// ------------------------------------------------------------------------------------------------ core rays

// Width of a ray at its inner radius: 62 % of the arc pitch there, never thinner than 1.6 px nor wider than 8.
function rayWidth(count, rIn) {
  return clamp(0.62 * 2 * Math.PI * rIn / Math.max(1, count), 1.6, 8)
}

// How many rays and where. Up to 48 cores: one tier (30..76). 49..128: two tiers (first half 30..51, second half
// 55..76), each with the width its own count and radius give. Above 128 the rays are groups of `group` cores
// (see groupCores) and the layout is that of 128. `R` scales radii; widths keep their pixel limits.
// -> { rays, group, tiers: [{ first, count, rIn, rOut, width }] }   `first` indexes rays, not cores.
function coreTiers(n, R) {
  var k = (R === undefined ? REFERENCE_R : R) / REFERENCE_R
  var cores = Math.max(0, Math.floor(n))
  var group = Math.max(1, Math.ceil(cores / 128))
  var rays = Math.ceil(cores / group)
  var tiers = []
  function tier(first, count, rIn, rOut) {
    tiers.push({ first: first, count: count, rIn: rIn * k, rOut: rOut * k, width: rayWidth(count, rIn * k) })
  }
  if (rays <= 0) return { rays: 0, group: group, tiers: [] }
  if (rays <= 48) tier(0, rays, 30, 76)
  else {
    var h = Math.ceil(rays / 2)
    tier(0, h, 30, 51)
    tier(h, rays - h, 55, 76)
  }
  return { rays: rays, group: group, tiers: tiers }
}

// More than `max` cores: each ray shows the MAX of a run of ceil(n / max) cores, so the worst core stays visible.
function groupCores(loads, max) {
  var list = loads || []
  var g = Math.max(1, Math.ceil(list.length / Math.max(1, max)))
  if (g === 1) return list.slice()
  var out = []
  for (var i = 0; i < list.length; i += g) {
    var m = 0
    for (var j = i; j < Math.min(list.length, i + g); j++) m = Math.max(m, Number(list[j]) || 0)
    out.push(m)
  }
  return out
}

// One tick per ray around the rune band; every ceil(n / 4) rays a longer one.
// -> [{ index, angle, major }]
function tickLayout(count) {
  var n = Math.max(0, Math.floor(count))
  var every = Math.max(1, Math.ceil(n / 4))
  var out = []
  for (var i = 0; i < n; i++) out.push({ index: i, angle: i * 360 / n, major: i % every === 0 })
  return out
}

// ------------------------------------------------------------------------------------------------- spirals

// How tightly the run queue is wound: 1.25 turns idle, up to 4.0 at load 1.25 x the threads (or more).
function spiralTurns(ratio) {
  return 1.25 + 2.75 * clamp(Number(ratio) || 0, 0, 1.25) / 1.25
}

// An Archimedean spiral from the centre out to radius `r`: turns x stepsPerTurn + 1 points, the last exactly on r.
// -> [{ x, y }] offsets from the centre.
function spiralPoints(turns, r, stepsPerTurn) {
  var per = stepsPerTurn || 34
  var count = Math.max(1, Math.round(turns * per))
  var out = []
  for (var i = 0; i <= count; i++) {
    var t = i / count
    var p = polar(t * turns * 360, r * t)
    out.push({ x: p.x, y: p.y })
  }
  return out
}

// ---------------------------------------------------------------------------------------- circle segments

// Fraction of a disc's area below a line at height `h` (0..1 of the diameter, from the bottom).
function segmentAreaForHeight(h) {
  var x = clamp(h, 0, 1)
  var theta = Math.acos(clamp(1 - 2 * x, -1, 1))
  return clamp((theta - Math.sin(theta) * Math.cos(theta)) / Math.PI, 0, 1)
}

// The inverse: the height (0..1 of the diameter) of the line under which a disc holds fraction `f` of its area.
// Bisection, 24 iterations (error well under 1e-4). A vessel's level is area-true, not linear in the height.
function segmentHeightForArea(f) {
  var target = clamp(Number(f) || 0, 0, 1)
  if (target <= 0) return 0
  if (target >= 1) return 1
  var lo = 0, hi = 1
  for (var i = 0; i < 24; i++) {
    var mid = (lo + hi) / 2
    if (segmentAreaForHeight(mid) < target) lo = mid
    else hi = mid
  }
  return (lo + hi) / 2
}

// Strata bottom to top as parts of the whole (each 0..1). Boundaries are cumulative, clamped so the last never
// passes 1; a zero-size part gives a boundary equal to the one below. `heights` are area-true (0..1 of the diameter).
// -> { cum: [..], heights: [..] }
function strata(parts) {
  var cum = [], heights = []
  var at = 0
  for (var i = 0; i < parts.length; i++) {
    at = clamp(at + Math.max(0, Number(parts[i]) || 0), 0, 1)
    cum.push(at)
    heights.push(segmentHeightForArea(at))
  }
  return { cum: cum, heights: heights }
}

// ----------------------------------------------------------------------------------------------- arcs, runes

// Sweep of an arc for a fraction: from 12 o'clock, clockwise.
function arcSweep(fraction) { return 360 * clamp(Number(fraction) || 0, 0, 1) }

// Concentric mount rings between radii 26 and 76 (reference): `k` rings, pitch min(16, 50 / k), stroke pitch - 3,
// ring 0 outermost. -> { pitch, stroke, rings: [{ radius, stroke }] }
function ringLayout(k) {
  var n = Math.max(1, Math.floor(k))
  var pitch = Math.min(16, 50 / n)
  var rings = []
  for (var i = 0; i < n; i++) rings.push({ radius: 76 - pitch * (i + 0.5), stroke: pitch - 3 })
  return { pitch: pitch, stroke: pitch - 3, rings: rings }
}

// The pseudo-runic ring: `count` glyphs at even angles from a 4-glyph vector set in the pattern A B C D B C A D.
// -> [{ index, angle, glyph }]   glyph: 0 stroke, 1 chevron, 2 up-arrow, 3 algiz
function runeLayout(count) {
  var pattern = [0, 1, 2, 3, 1, 2, 0, 3]
  var n = Math.max(0, Math.floor(count === undefined ? 24 : count))
  var out = []
  for (var i = 0; i < n; i++) out.push({ index: i, angle: i * 360 / n, glyph: pattern[i % pattern.length] })
  return out
}

// The four runes as strokes in the glyph's own frame: u across (tangential, clockwise) and v along the radius (outward),
// both centred on 0 and `h` tall: 0 a stroke, 1 a double chevron, 2 an up-arrow, 3 algiz (the elk rune: a stem with two arms).
function runeStrokes(glyph, h) {
  var t = h / 2, w = h * 0.36
  function p(u, v) { return { x: u, y: v } }
  if (glyph === 0) return [[p(0, -t), p(0, t)]]
  if (glyph === 1) return [[p(-w, -t), p(0, -t * 0.1), p(w, -t)], [p(-w, t * 0.1), p(0, t), p(w, t * 0.1)]]
  if (glyph === 2) return [[p(0, -t), p(0, t)], [p(-w, t * 0.2), p(0, t), p(w, t * 0.2)]]
  return [[p(0, -t), p(0, t)], [p(0, -t * 0.1), p(-w, t)], [p(0, -t * 0.1), p(w, t)]]
}

// A band of `count` runes (runeLayout) at radius `rMid`, each `h` tall with its up pointing away from the centre, as
// polylines of { x, y } offsets from the centre of the seal. Static: a band is built once and then only rotated.
function runePolylines(count, rMid, h) {
  var out = []
  var layout = runeLayout(count)
  for (var i = 0; i < layout.length; i++) {
    var a = layout[i].angle * Math.PI / 180
    var sn = Math.sin(a), cs = Math.cos(a)
    var strokes = runeStrokes(layout[i].glyph, h)
    for (var j = 0; j < strokes.length; j++) {
      var line = []
      for (var m = 0; m < strokes[j].length; m++) {
        var u = strokes[j][m].x, v = strokes[j][m].y
        line.push({ x: (rMid + v) * sn + u * cs, y: -(rMid + v) * cs + u * sn })
      }
      out.push(line)
    }
  }
  return out
}

// Degrees per second a rune band turns for a byte rate: still below 4 KiB/s, then logarithmic, 3..72.
function ioSpeed(bps) {
  var v = Number(bps) || 0
  if (v < 4096) return 0
  return clamp(18 * Math.log(1 + v / 65536) / Math.LN10, 3, 72)
}

// ------------------------------------------------------------------------------------------------- the crack

// The crack of a seal in alert: it enters at 200 degrees (lower left, continuing the frame's own crack) on the outer
// rule and runs in to r = 0.55 R, with two branches. Three polylines (the main line, then the branches) of { x, y }
// offsets from the centre, for a seal of radius `R` (92 when omitted). The rules open a gap of CRACK_GAP degrees there.
var CRACK_ANGLE = 200
var CRACK_GAP = 6
function crack(R) {
  var k = (R === undefined ? REFERENCE_R : R) / REFERENCE_R
  function at(a, r) { var p = polar(a, r * k); return { x: p.x, y: p.y } }
  return [
    [at(200, 91), at(197, 82), at(203, 74), at(198, 66), at(194, 58), at(199, 50.6)],
    [at(197, 82), at(188, 75), at(184, 68)],
    [at(198, 66), at(207, 60), at(211, 54)]
  ]
}

// ---------------------------------------------------------------------------------------------------- colour
// Every colour here is { r, g, b, a }, each 0..1.

function rgba(r, g, b, a) { return { r: r, g: g, b: b, a: a === undefined ? 1 : a } }

function mix(c1, c2, t) {
  var u = clamp(t, 0, 1)
  return rgba(c1.r + (c2.r - c1.r) * u, c1.g + (c2.g - c1.g) * u, c1.b + (c2.b - c1.b) * u, c1.a + (c2.a - c1.a) * u)
}

// `fg` laid over an opaque `bg`.
function over(fg, bg) {
  var a = fg.a === undefined ? 1 : fg.a
  return rgba(fg.r * a + bg.r * (1 - a), fg.g * a + bg.g * (1 - a), fg.b * a + bg.b * (1 - a), 1)
}

function withAlpha(c, a) { return rgba(c.r, c.g, c.b, a) }

function linear(v) { return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4) }

// WCAG relative luminance (sRGB).
function luminance(c) { return 0.2126 * linear(c.r) + 0.7152 * linear(c.g) + 0.0722 * linear(c.b) }

// WCAG contrast ratio of `fg` on `bg` (1..21); a translucent `fg` is composited over `bg` first.
function contrast(fg, bg) {
  var l1 = luminance(over(fg, bg)), l2 = luminance(over(bg, rgba(0, 0, 0, 1)))
  var hi = Math.max(l1, l2), lo = Math.min(l1, l2)
  return (hi + 0.05) / (lo + 0.05)
}

function toHsl(c) {
  var mx = Math.max(c.r, c.g, c.b), mn = Math.min(c.r, c.g, c.b)
  var l = (mx + mn) / 2, h = 0, s = 0
  var d = mx - mn
  if (d > 0) {
    s = l > 0.5 ? d / (2 - mx - mn) : d / (mx + mn)
    if (mx === c.r) h = (c.g - c.b) / d + (c.g < c.b ? 6 : 0)
    else if (mx === c.g) h = (c.b - c.r) / d + 2
    else h = (c.r - c.g) / d + 4
    h /= 6
  }
  return { h: h, s: s, l: l, a: c.a === undefined ? 1 : c.a }
}

function fromHsl(x) {
  function hue(p, q, t) {
    var u = t < 0 ? t + 1 : (t > 1 ? t - 1 : t)
    if (u < 1 / 6) return p + (q - p) * 6 * u
    if (u < 1 / 2) return q
    if (u < 2 / 3) return p + (q - p) * (2 / 3 - u) * 6
    return p
  }
  if (x.s === 0) return rgba(x.l, x.l, x.l, x.a)
  var q = x.l < 0.5 ? x.l * (1 + x.s) : x.l + x.s - x.l * x.s
  var p = 2 * x.l - q
  return rgba(hue(p, q, x.h + 1 / 3), hue(p, q, x.h), hue(p, q, x.h - 1 / 3), x.a)
}

// `c` unchanged when it already reaches `target` against `bg`; otherwise its HSL lightness moves away from the
// background (lighter on a dark ground, darker on a light one) in steps of 0.04, at most 12, keeping hue and
// saturation. On a light theme the same rule darkens.
function ensureContrast(c, bg, target) {
  if (contrast(c, bg) >= target) return c
  var white = rgba(1, 1, 1, 1), black = rgba(0, 0, 0, 1)
  var dir = contrast(white, bg) >= contrast(black, bg) ? 1 : -1
  var hsl = toHsl(c)
  var out = c
  for (var i = 0; i < 12; i++) {
    hsl.l = clamp(hsl.l + dir * 0.04, 0, 1)
    out = fromHsl(hsl)
    if (contrast(out, bg) >= target) break
  }
  return out
}

// `ensureContrast` with the direction forced: `lightenTo` only ever raises lightness, `darkenTo` only lowers it (the
// automatic direction follows the background, which would lighten a pupil that must stay darker than its iris).
// Unchanged when it already reaches `target`; else 12 steps of 0.04 lightness, hue and saturation kept, and the
// last step is returned when the limit is hit first.
function forceContrast(c, bg, target, dir) {
  if (contrast(c, bg) >= target) return c
  var hsl = toHsl(c)
  var out = c
  for (var i = 0; i < 12; i++) {
    hsl.l = clamp(hsl.l + dir * 0.04, 0, 1)
    out = fromHsl(hsl)
    if (contrast(out, bg) >= target) break
  }
  return out
}
function lightenTo(c, bg, target) { return forceContrast(c, bg, target, 1) }
function darkenTo(c, bg, target) { return forceContrast(c, bg, target, -1) }

// The opacity for `c` over `bg`: `alpha` when that already reaches `target`, else raised in steps of 0.05 (at most
// to 1) until it does. Used for text-like tokens that are a translucent foreground (captions, labels) and must stay
// readable on any panel: the design's 0.6 where it passes, more where the palette's foreground is too close to the ground.
function ensureAlphaContrast(c, bg, alpha, target) {
  var a = clamp(alpha, 0, 1)
  while (a < 1 && contrast(withAlpha(c, a), bg) < target) a = Math.min(1, a + 0.05)
  return a
}

// HSL shift: lightness + `dl` (result clamped to 0..0.94), saturation x `sMul` (clamped to 0..1), hue kept. This is how the
// liquid's skin glow and its clotted (denser, darker) tone are derived from the one accent, so they stay the same hue.
function shade(c, dl, sMul) {
  var hsl = toHsl(c)
  hsl.l = clamp(hsl.l + dl, 0, 0.94)
  hsl.s = clamp(hsl.s * (sMul === undefined ? 1 : sMul), 0, 1)
  return fromHsl(hsl)
}

// The lighter (higher WCAG luminance) of two colours. On a dark panel it picks the foreground, on a light panel the
// paper, so a specular highlight is always lighter than the liquid, with no branch on the theme's mode.
function brightest(a, b) { return luminance(a) >= luminance(b) ? a : b }

// `c` unchanged when it already reaches `target` against `ref`; otherwise shade-stepped by `dl` (the sign is the
// direction, hue and saturation kept) until it does, at most `maxSteps` steps. Returns the last step when it never does.
function ensureSeparation(c, ref, target, dl, maxSteps) {
  if (contrast(c, ref) >= target) return c
  var out = c
  for (var i = 0; i < maxSteps; i++) {
    out = shade(out, dl, 1)
    if (contrast(out, ref) >= target) break
  }
  return out
}

if (typeof module !== "undefined") module.exports = {
  REFERENCE_R: REFERENCE_R, clamp: clamp, polar: polar, rayWidth: rayWidth, coreTiers: coreTiers, groupCores: groupCores,
  tickLayout: tickLayout, spiralTurns: spiralTurns, spiralPoints: spiralPoints,
  segmentAreaForHeight: segmentAreaForHeight, segmentHeightForArea: segmentHeightForArea, strata: strata,
  arcSweep: arcSweep, ringLayout: ringLayout, runeLayout: runeLayout, runeStrokes: runeStrokes, runePolylines: runePolylines, ioSpeed: ioSpeed,
  crack: crack, CRACK_ANGLE: CRACK_ANGLE, CRACK_GAP: CRACK_GAP,
  rgba: rgba, mix: mix, over: over, withAlpha: withAlpha, luminance: luminance, contrast: contrast,
  toHsl: toHsl, fromHsl: fromHsl, ensureContrast: ensureContrast, ensureAlphaContrast: ensureAlphaContrast,
  lightenTo: lightenTo, darkenTo: darkenTo,
  shade: shade, brightest: brightest, ensureSeparation: ensureSeparation
}
