.pragma library
.import "ItoIconReal.js" as Real

// Manga icons v3, batch 2 (icons-v3.md section 9, V4): today's audio, display, bluetooth and tray icons drawn with the pilot's
// recipe (ItoIconReal.js: tone is luminance, a 2x bake, tonal steps from hatch density, thick-thin contours, one specular) and
// held to the bar's weight budget (section 11). Today's silhouette first; the horror in the rendering and the details. Pure and
// seeded; the same parts format and roles. Registered in ItoIconSet.js.

var K = Real.KIT, G = K.G
var P = G.P, flat = G.flat, clamp = G.clamp, lerp = G.lerp
var LIT = K.LIT, DARK = K.DARK, add = K.add, ground = K.ground, base = K.base, toneField = K.toneField, outline = K.outline
var dot = K.dot, drip = K.drip, rig = K.rig
// a flat [x, y, ...] polygon (a ribbon) back to points, for a clip
function pts(f) { var o = []; for (var i = 0; i < f.length; i += 2) o.push(P(f[i], f[i + 1])); return o }

var KINDS = ["audio", "display", "bluetooth", "chevron", "ai"]
var STATES = {
  audio: [{ level: 0 }, { level: 1 }, { level: 2 }, { level: 3 }, { mute: true }],
  display: [{ level: 0 }, { level: 1 }, { level: 2 }, { level: 3 }],
  bluetooth: [{ mode: "off" }, { mode: "on" }, { mode: "linked" }],
  chevron: [{}],
  ai: [{ form: "brain", value: 0 }, { form: "brain", value: 0.5 }, { form: "brain", value: 0.95 }, { form: "classic", value: 0 }, { form: "classic", value: 0.5 }, { form: "classic", value: 0.95 },
       { form: "hemispheres", value: 0.5 }, { form: "neurons", value: 0.5 }, { form: "eye", value: 0.5 }, { form: "spiral", value: 0.5 }]
}
var NOMINAL = { audio: { level: 2 }, display: { level: 2 }, bluetooth: { mode: "on" }, chevron: {}, ai: { form: "brain", value: 0.4 } }
var CURRENT = { audio: "instruments/vol-2.png", display: "instruments/display-2.png", bluetooth: "instruments/bt-on.png", chevron: "system/tray-chevron.png", ai: "system/brain.png" }
// the weight budget of this batch (scripts/qa/icons-calibrate.mjs), added to the shared table the kit reads
var WEIGHT = {
  audio: { gain: [1, 1], line: [1, 2.14], scale: 1, mass: [1, 1], ink: { gain: [1, 1], line: [1, 1], mass: [1, 1] }  },
  display: {  gain: [0.05, 1], line: [0.45, 2.2], mass: [0.3, 1.25], scale: 0.96, ink: { gain: [0.05, 1], line: [0.45, 1.36], mass: [0.3, 1.25] }  },
  bluetooth: {  gain: [0.05, 1], line: [0.45, 2.2], mass: [0.762, 2.158], scale: 1.1, ink: { gain: [0.05, 1], line: [0.45, 1.5], mass: [0.762, 0.98] }  },
  chevron: {  gain: [1, 1], line: [1.5, 2.2], mass: [1, 2.292], scale: 1.1, ink: { gain: [1, 1], line: [1.5, 1.5], mass: [1, 1.5] }  },
  ai: {  gain: [0.15, 1], line: [0.974, 1.034], scale: 0.928, ink: { gain: [0.15, 1], line: [0.974, 1.114] }  },
  "ai:classic": {  gain: [0.15, 1], line: [0.547, 1.245], scale: 0.928, ink: { gain: [0.15, 1], line: [0.68, 1.352] }  },
  "ai:hemispheres": {  gain: [0.15, 1], line: [0.602, 1.103], scale: 0.985, ink: { gain: [0.15, 1], line: [0.602, 1.176] }  },
  "ai:neurons": {  gain: [0.15, 1], line: [0.808, 2.2], mass: [1, 2.5], scale: 0.975, ink: { gain: [0.15, 1], line: [0.808, 1.5], mass: [1, 2.5] }  },
  "ai:eye": {  gain: [0.15, 1], line: [0.653, 1.571], scale: 0.99, ink: { gain: [0.15, 1], line: [0.653, 1.392] }  },
  "ai:spiral": {  gain: [0.15, 0.15], line: [0.698, 0.604], scale: 0.804, ink: { gain: [0.15, 0.15], line: [0.698, 0.714] }  }
}
for (var wk in WEIGHT) K.WEIGHT[wk] = WEIGHT[wk]

// ---------------------------------------------------------------------------------------------------- audio
// Today's row of upright bars (3 at the lowest volume, 5, then 7, the loudest red), each bar drawn as what makes a sound: a MOUTH,
// a slit in flesh standing on end. Lips shaded as flesh lit from the upper left (the lip's wrinkles are the hatch, across the
// slit), a black throat, teeth along its edges, a wet glint. Louder: the mouths open wider; at the top of the range blood stands
// in the throats of the middle three and runs from the centre one. Mute: today's three bars and red slash, as three mouths sewn
// shut with surgical thread and a wet cut across them.
var BARS = {
  0: [[6.2, 13.1, 17.6, 30.2], [20.4, 27.4, 13.7, 34.1], [34.7, 41.2, 17.1, 30.2]],
  1: [[6.2, 9.9, 18.6, 29.2], [14.2, 18.0, 14.1, 33.8], [21.9, 25.9, 9.0, 38.8], [29.8, 33.8, 14.1, 33.6], [37.7, 41.4, 18.6, 29.2]],
  2: [[6.9, 9.4, 19.9, 27.9], [12.2, 14.8, 16.1, 31.5], [17.4, 20.1, 11.1, 36.8], [22.7, 25.3, 6.4, 41.4], [27.9, 30.6, 11.1, 36.8], [33.4, 36.0, 16.1, 31.7], [38.4, 41.1, 19.9, 27.9]],
  3: [[9.0, 11.2, 20.1, 27.8], [13.9, 15.9, 15.9, 31.9], [18.4, 20.6, 11.2, 36.6], [23.1, 25.3, 6.4, 41.4], [27.6, 29.8, 11.2, 36.6], [32.2, 34.5, 15.9, 31.9], [36.8, 39.0, 20.1, 27.8]]
}
// a vertical lens from (cx, y0) to (cx, y1), `hw` its half width at the middle, `skew` a slight lean of its middle
function lens(cx, y0, y1, hw, n, skew) {
  var L = [], R = []
  for (var i = 0; i <= n; i++) {
    var t = i / n, y = lerp(y0, y1, t), w = hw * Math.pow(Math.sin(Math.PI * t), 0.72)
    var sk = (skew || 0) * Math.sin(Math.PI * t) * (t - 0.5)
    L.push(P(cx - w + sk, y)); R.push(P(cx + w + sk, y))
  }
  return L.concat(R.reverse())
}
function drawAudio(c) {
  var st = c.state, mute = !!st.mute, lvl = mute ? 0 : clamp(Math.round(Number(st.level) || 0), 0, 3)
  var bars = BARS[lvl]
  c.keyline = { x: 2, y: 2, w: 44, h: 44, shape: "square" }
  // ink on a light bar reads thinner than bone on a dark one (the weight budget): the mouths are fuller there
  var widen = (bars.length >= 7 ? 1.04 : (bars.length === 5 ? 1.0 : 0.92)) * (c.light ? 1 : 1.4)
  var open = mute ? 0.06 : [0.16, 0.24, 0.32, 0.42][lvl]
  var sil = [], mouths = []
  for (var i = 0; i < bars.length; i++) {
    var b = bars[i], cx = (b[0] + b[1]) / 2, hw = (b[1] - b[0]) / 2 * widen * Math.sqrt(c.massK), y0 = b[2], y1 = b[3]
    var jitter = (c.rand() - 0.5) * 0.5           // the outer mouths a little slack, the middle ones strain: not a ruler row
    var outer = G.wobble(lens(cx, y0 + jitter * 0.4, y1 - jitter * 0.3, hw, 16, 0.6), c.rand, 0.18, true)
    var mid = i - (bars.length - 1) / 2, centre = Math.abs(mid) < 1.6
    var o = open * (1 - Math.abs(mid) / bars.length * 0.5) * (0.92 + c.rand() * 0.16)
    var ih = (y1 - y0) * (0.82 - 0.1 * (1 - o)), iy0 = (y0 + y1) / 2 - ih / 2
    var inner = G.wobble(lens(cx + 0.15, iy0, iy0 + ih, Math.max(0.18, hw * o), 14, 0.4), c.rand, 0.1, true)
    sil.push(flat(outer))
    mouths.push({ cx: cx, cy: (y0 + y1) / 2, hw: hw, y0: y0, y1: y1, outer: outer, inner: inner, o: o, centre: centre, mid: mid })
  }
  c.silhouette = sil
  for (var m = 0; m < mouths.length; m++) {
    var M = mouths[m]
    // scratchboard, as a thin bar must be: the lips are the bar's solid mass in the line colour (as today's bar), and everything
    // drawn on them is CUT back to the ground: the slit of the mouth, the shadow on the right lip as lines across it (the lip's
    // wrinkles), the gaps between the teeth. At the loudest the centre mouth's lips are wet with blood.
    var bloody = !mute && lvl === 3 && Math.abs(M.mid) <= 1
    add(c, bloody ? "blood" : "line", "under", [flat(M.outer)], null, bloody ? "datum" : "mass:lips")
    var shade = (function(Q) { return function(p) {
      var u = (p.x - Q.cx) / Math.max(0.5, Q.hw), v = (p.y - Q.y0) / Math.max(1, Q.y1 - Q.y0)
      return clamp(0.18 + 0.5 * Math.max(0, u) + 0.35 * Math.max(0, v - 0.55), 0, 0.85) * (c.light ? 1 : 0.35)
    } })(M)
    if (c.tier >= 1) toneField(c, M.outer, shade, { role: "void", exc: [M.inner], dir: 0, cross: false, spacing: c.tier === 2 ? 1.6 : 2.2, w: 0.8, tag: "lip-wrinkles" })
    // the throat: the slit cut through, and (loud) blood standing in it; at L the teeth along its edges
    rig(c, "throat" + m, M.cx, M.cy)
    add(c, "void", "under", [flat(M.inner)], null, "mass:throat")
    if (c.tier >= 2 && M.hw * M.o > 0.45) {
      var teeth = [], n = Math.max(2, Math.round((M.y1 - M.y0) * 0.82 / 2.2))
      for (var k = 0; k < n; k++) {
        var ty = lerp(M.cy - (M.y1 - M.y0) * 0.3, M.cy + (M.y1 - M.y0) * 0.3, k / (n - 1))
        var w = M.hw * M.o * Math.pow(Math.sin(Math.PI * clamp((ty - M.y0) / (M.y1 - M.y0), 0, 1)), 0.72)
        teeth.push(flat(G.blob(M.cx + 0.15 - w + 0.3, ty, 0.36, c.rand, 6, 0.35)))
        if (!(M.centre && k === 1)) teeth.push(flat(G.blob(M.cx + 0.15 + w - 0.3, ty + 0.3, 0.32, c.rand, 6, 0.35)))
      }
      add(c, "line", "under", teeth, M.inner, "teeth")
    }
    rig(c, "")
    // blood stands in the throats: in the centre one at 2, in every throat at 3 (it stays when a mouth moves: it is the reading)
    if (!mute && (lvl === 3 || (lvl === 2 && M.mid === 0))) add(c, "blood", "level", [flat(G.clipBelow(M.inner, M.cy - (M.y1 - M.y0) * 0.22))], M.inner, "datum")
    // a hair of contour on the shadow side only (on a dark bar the lit edge needs none: the mass is the light)
    if (c.tier >= 1 && !c.light) add(c, "line", "over", outline(c, M.outer, 0.2, 0.45, { gaps: 1 }), null, "contour")
    // the wet glint on the lit lip, cut in (dark bar) or drawn as paper (light bar)
    if (c.tier >= 1 && M.y1 - M.y0 > 12) add(c, "void", "over", [G.ribbon([P(M.cx - M.hw * 0.42, M.cy - 2.6), P(M.cx - M.hw * 0.5, M.cy - 0.4)], 0.3 * c.k, { taperPow: 0.5 })], M.outer, "wet")
  }
  if (!mute && lvl === 3) {
    var cm = mouths[(mouths.length - 1) / 2]
    drip(c, P(cm.cx + 0.1, cm.y1 - 0.4), 3.4, c.tier === 0 ? 1.1 : 0.8, "blood")
    c.parts[c.parts.length - 1].tag = "datum"
  }
  if (mute) {
    // stitches: surgical thread across each mouth, a dark cross with a lit hole at each end
    rig(c, "stitches", 6, 24)
    for (var q = 0; q < mouths.length; q++) {
      var Mq = mouths[q], ns = c.tier === 0 ? 2 : 3, th = [], holes = []
      for (var z = 0; z < ns; z++) {
        var yy = lerp(Mq.cy - (Mq.y1 - Mq.y0) * 0.26, Mq.cy + (Mq.y1 - Mq.y0) * 0.26, z / (ns - 1))
        var a = P(Mq.cx - Mq.hw * 0.85, yy - 0.6), b2 = P(Mq.cx + Mq.hw * 0.85, yy + 0.6)
        th.push(G.ribbon([a, b2], (c.tier === 0 ? 0.9 : 0.55) * c.k, { taperPow: 0.2 }))
        holes.push(flat(G.ellipse(a.x, a.y, 0.35, 0.35, 6)), flat(G.ellipse(b2.x, b2.y, 0.35, 0.35, 6)))
      }
      add(c, DARK(c), "over", th, null, "stitch")
      if (c.tier >= 1) add(c, LIT(c), "over", holes, null, "stitch-holes")
    }
    rig(c, "")
    // the slash: a wet cut across the three mouths, dark-edged, beading at its lower end
    var cut = G.wobble(G.resample([P(7.2, 7.4), P(24, 24.6), P(41, 41.2)], 1.0, false), c.rand, 0.25, false)
    if (c.tier >= 1) add(c, DARK(c), "over", [G.ribbon(cut.map(function(p) { return P(p.x + 0.5, p.y + 0.6) }), 2.0 * c.k, { taperPow: 0.25 })], null, "cut-edge")
    add(c, "blood", "over", [G.ribbon(cut, (c.tier === 0 ? 2.0 : 1.6) * c.k * Math.min(1, c.lw + 0.2), { taperPow: 0.25 })], null, "datum")
    drip(c, P(39.5, 40.6), 3.0, 0.8, "blood")
    c.parts[c.parts.length - 1].tag = "datum"
  }
  if (c.tier === 2) for (var r = 0; r < mouths.length; r++) add(c, DARK(c), "over", G.stipple({ k: c.k, rand: c.rand }, mouths[r].outer, [mouths[r].inner], 3, 0.3, {}), null, "pores")
  // the one specular: a wet sliver on the centre mouth's lit lip, near its upper corner
  var C0 = mouths[Math.floor((mouths.length - 1) / 2)], hy = C0.y0 + (C0.y1 - C0.y0) * 0.26
  var hwx = C0.hw * Math.pow(Math.sin(Math.PI * 0.26), 0.72)
  c.highlight = { role: "paper", polys: [flat([P(C0.cx - hwx + 0.35, hy), P(C0.cx - hwx * 0.55, hy - 1.6), P(C0.cx - hwx * 0.35, hy - 1.1), P(C0.cx - hwx + 0.75, hy + 0.9)])] }
}

// ---------------------------------------------------------------------------------------------------- display
// Today's monitor (bezel, screen, neck and foot) with the brightness as a light on its screen that grows from a dot to a red sun.
// The light on the screen is an EYE looking out of it (Remina's eye in the sky): shut at 0, an iris at 1, an iris whose veins run
// out as the sun's rays at 2, and at 3 the iris is blood and so are its rays.
// T15 (S21, the user: "el del display se ve re mal"): the bar-size reading comes first. The earlier drawing thinned the bezel to a
// hatched hairline and put the eye at 1-2 px, so at 24-40 px it read as a muddy dashed box. Now: a solid bezel as thick as today's
// PNG, clean glass, a large eye and few bold rays; the old-set wear (shade hatch, scanlines, crack, palm, rust, contour) only at
// the popup's large tier (2), where it has room.
function drawDisplay(c) {
  var lvl = clamp(Math.round(Number(c.state.level) || 0), 0, 3)
  var X0 = 6.4, X1 = 41.4, Y0 = 10.1, Y1 = 31.9, r = 2.4
  c.keyline = { x: 2, y: 7, w: 44, h: 34, shape: "landscape" }
  var big = c.size >= 44           // the popup's large icon; every bar size (24-40 px) gets the clean drawing
  var bez = G.wobble(G.resample([P(X0 + r, Y0), P(X1 - r, Y0), P(X1, Y0 + r), P(X1, Y1 - r), P(X1 - r, Y1), P(X0 + r, Y1), P(X0, Y1 - r), P(X0, Y0 + r)], 1.0, true), c.rand, big ? 0.22 : 0.08, true)
  // the bezel's width: a whole device px at least (light bars: 1.4 px) so the frame never breaks into dashes; `mass` (the weight
  // budget) thins it on dark bars, where bone on black pulls the eye harder than today's grey PNG
  var B = Math.max((c.light ? 0.85 : 1.4) * c.k, (big ? 2.6 : 3.0) * c.massK)
  var glass = G.wobble(G.resample([P(X0 + B, Y0 + B), P(X1 - B, Y0 + B), P(X1 - B, Y1 - B), P(X0 + B, Y1 - B)], 1.0, true), c.rand, big ? 0.15 : 0.05, true)
  var nw = c.light ? Math.max(0.8 * c.k, 1.5) : Math.max(1.2 * c.k, 2.4)
  var neck = [P(24 - nw, Y1), P(24 + nw, Y1), P(24 + nw * 0.85, 36.4), P(24 - nw * 0.85, 36.4)]
  var fh = c.light ? Math.max(1.0 * c.k, 1.4) : Math.max(1.3 * c.k, 2.2)
  var foot = G.wobble(G.resample([P(15.5, 36.2), P(32.5, 36.2), P(33, 36.2 + fh), P(15, 36.2 + fh)], 0.9, true), c.rand, big ? 0.12 : 0.04, true)
  c.silhouette = [flat(bez), flat(neck), flat(foot)]
  add(c, "line", "under", [flat(bez), flat(neck), flat(foot)], null, "mass:bezel")
  if (big && B >= 1.6) toneField(c, bez, function(p) { return clamp(0.15 + 0.6 * Math.max(0, (p.x - 24) / 17.5) + 0.5 * Math.max(0, (p.y - 22) / 10), 0, 0.8) * (c.light ? 1 : 0.6) },
                             { role: "void", exc: [glass], dir: 45, cross: false, spacing: 2.0, w: 0.8, tag: "bezel-shade" })
  // the glass: a clean cut (the bar shows through in the theme tone, black glass in the ink tone)
  add(c, "void", "under", [flat(glass)], null, "mass:glass")
  if (big) toneField(c, glass, function(p) { return 0.06 + (0.05 + 0.07 * lvl) * Math.max(0, 1 - Math.hypot(p.x - 24, p.y - 21) / 15) }, { baseLit: false, role: "line", dir: 0, cross: false, spacing: 2.2, w: 0.6, tag: "scanlines" })
  // the eye on the screen, sized for the bar: its iris spans a third of the glass's height at full brightness
  var E = P(24, 21), rr = [2.2, 2.5, 3.4, 4.7][lvl]
  var lw = Math.max((c.light ? 0.8 : 1.0) * c.k, 1.2)
  rig(c, "eye", E.x, E.y)
  if (lvl === 0) {             // shut: one lid line across the glass, the light off
    add(c, "line", "level", [G.ribbon([P(E.x - rr * 0.9, E.y), P(E.x, E.y + rr * 0.35), P(E.x + rr * 0.9, E.y)], lw, { taperPow: 0.35 })], glass, "datum-dim")
  } else {
    if (lvl >= 2) {           // the veins run out as the sun's rays: six bold strokes, a little ragged
      var rays = [], nr = big ? 8 : 6
      for (var k = 0; k < nr; k++) {
        var a = k * 2 * Math.PI / nr + 0.26 + (c.rand() - 0.5) * (big ? 0.3 : 0.1), l0 = rr + 1.1, l1 = rr + (lvl === 3 ? 5.0 : 3.2) + c.rand() * (big ? 1.4 : 0.4)
        rays.push(G.ribbon([P(E.x + Math.cos(a) * l0, E.y + Math.sin(a) * l0 * 0.82), P(E.x + Math.cos(a) * l1, E.y + Math.sin(a) * l1 * 0.82)], lw * (lvl === 3 ? 1.15 : 1), { taperPow: 0.6 }))
      }
      add(c, lvl === 3 ? "blood" : "line", "level", rays, glass, lvl === 3 ? "datum" : "rays")
    }
    var iris = G.ellipse(E.x, E.y, rr, rr * 0.92, 18)
    add(c, lvl === 3 ? "blood" : "line", "level", [flat(iris)], null, lvl === 3 ? "datum" : "mass:iris")
    if (big) toneField(c, iris, function(p) { return 0.3 + 0.4 * Math.max(0, (p.x - E.x + p.y - E.y) / (2 * rr)) }, { role: "void", dir: 0, center: E, r0: rr * 0.45, cross: false, spacing: 1.7, w: 0.6, tag: "iris-fibres" })
    // the pupil; at full brightness the eye is all blood, a red sun with no pupil left
    if (lvl < 3) add(c, "void", "level", [flat(G.ellipse(E.x + 0.2, E.y + 0.1, Math.max(0.9 * c.k, rr * 0.4), Math.max(0.9 * c.k, rr * 0.44), 12))], null, "pupil")
  }
  rig(c, "")
  // wear, at the large tier only: a crack across the lower right of the glass, a palm smear, rust on the foot, the broken contour
  if (big) add(c, "line", "over", [G.crack({ k: c.k, rand: c.rand }, P(X1 - B - 0.3, Y1 - B - 0.4), P(X1 - 8, Y1 - 6.5), 3, 0.45, 0)], glass, "crack")
  if (big) add(c, "line", "over", G.stipple({ k: c.k, rand: c.rand }, G.ellipse(14, 25, 3.2, 2.6, 12), [], 9, 0.3, {}), glass, "palm")
  if (big) add(c, "void", "over", G.stipple({ k: c.k, rand: c.rand }, foot, [], 5, 0.35, {}), null, "rust")
  if (big && !c.light) add(c, "line", "over", outline(c, bez, 0.2, 0.45, { gaps: 1 }), null, "contour")
  // the one specular: a short streak in the glass's upper left corner
  c.highlight = { role: "paper", polys: [flat([P(X0 + B + 1.0, Y0 + B + 3.6), P(X0 + B + 3.6, Y0 + B + 0.8), P(X0 + B + 4.6, Y0 + B + 0.8), P(X0 + B + 1.0, Y0 + B + 4.8)])] }
}

// ---------------------------------------------------------------------------------------------------- bluetooth
// Today's rune, drawn as an old INCISION in skin that healed badly: a raised scar (solid, scratchboard) with surgical stitches
// across it at intervals, its lit edge glossy. Linked: today's two side dots are nail heads driven in on either side, each
// weeping a bead of blood. Off: the scar faded to a dashed seam, and today's red slash as a fresh cut across it.
var RUNE = [P(15.2, 16.0), P(31.6, 31.2), P(23.4, 39.4), P(23.4, 8.6), P(31.6, 16.8), P(15.2, 32.0)]
function drawBluetooth(c) {
  var mode = String(c.state.mode || "on"), off = mode === "off", linked = mode === "linked"
  c.keyline = { x: 4, y: 4, w: 40, h: 40, shape: "square" }
  var path = G.wobble(G.resample(RUNE, 0.7, false), c.rand, 0.12, false)
  var W = (c.tier === 0 ? 3.6 : 3.0) * c.massK
  var scar = G.ribbon(path, W, { taperPow: 0.12 })
  var sil = [scar]
  if (off) {
    // faded: a dashed seam of the scar, then the fresh cut across (the datum)
    var dashes = []
    for (var i = 0; i + 4 < path.length; i += 6) dashes.push(G.ribbon(path.slice(i, i + 4), W * 0.55, { taperPow: 0.3 }))
    add(c, "line", "under", dashes, null, "seam")
    var cut = G.wobble(G.resample([P(8.6, 8.4), P(24, 24.2), P(39.6, 40)], 1.0, false), c.rand, 0.2, false)
    if (c.tier >= 1 && c.light) add(c, "void", "over", [G.ribbon(cut.map(function(p) { return P(p.x + 0.5, p.y + 0.6) }), 2.4 * c.k, { taperPow: 0.25 })], null, "cut-edge")
    add(c, "blood", "over", [G.ribbon(cut, (c.tier === 0 ? 2.2 : 1.7) * c.k, { taperPow: 0.25 })], null, "datum")
    drip(c, P(37.8, 38.4), 3.0, 0.8, "blood")
    c.parts[c.parts.length - 1].tag = "datum"
    sil.push(G.ribbon(cut, 2, { taper: false }))
  } else {
    add(c, "line", "under", [scar], null, "mass:scar")
    // the scar's shadow side and its puckered skin, cut in; the stitches across it
    if (c.tier >= 1) {
      add(c, "void", "under", [G.ribbon(path.map(function(p) { return P(p.x + W * 0.28, p.y + W * 0.2) }), W * 0.22, { taperPow: 0.3 })], pts(scar), "scar-shade")
      var st = []
      for (var j = 3; j < path.length - 2; j += c.tier === 2 ? 4 : 6) {
        var p0 = path[j - 1], p1 = path[j + 1], dx = p1.x - p0.x, dy = p1.y - p0.y, l = Math.hypot(dx, dy) || 1, nx = -dy / l, ny = dx / l, q = path[j]
        st.push(G.ribbon([P(q.x - nx * W * 0.95, q.y - ny * W * 0.95), P(q.x + nx * W * 0.95, q.y + ny * W * 0.95)], 0.5 * c.k * c.lw, { taperPow: 0.2 }))
      }
      add(c, "void", "over", st, pts(scar), "stitches")
      add(c, "line", "over", st.map(function(r) { return r }), null, "stitch-ends")
    }
  }
  if (linked) {           // the nails on either side, each weeping
    rig(c, "nails", 24, 24)
    var nails = [P(7.6, 24), P(40.4, 24)]
    for (var k = 0; k < 2; k++) {
      var N = nails[k], toward = k === 0 ? 1 : -1
      add(c, "line", "over", [G.ribbon([P(N.x + toward * 1.4, N.y), P(N.x + toward * 5.6, N.y + 0.2)], 1.1 * c.k * c.lw, { taperPow: 0.4 })], null, "wire")
      add(c, "line", "over", [flat(G.ellipse(N.x, N.y, 3.0, 3.0, 12))], null, "mass:nail")
      if (c.tier >= 1) add(c, "void", "over", [flat(G.ellipse(N.x + 0.5, N.y + 0.5, 0.9, 0.9, 8))], null, "nail-dent")
      dot(c, N.x + 0.3, N.y + 3.2, c.tier === 0 ? 1.7 : 1.5, "blood", "over", "datum")
      drip(c, P(N.x + 0.3, N.y + 3.2), 3.0, 0.7, "blood")
      c.parts[c.parts.length - 1].tag = "datum"
      sil.push(flat(G.ellipse(N.x, N.y, 2.4, 2.4, 12)))
    }
    rig(c, "")
  }
  c.silhouette = sil
  c.highlight = { role: "paper", polys: [flat([P(22.4, 11.2), P(23.0, 10.0), P(23.3, 13.8), P(22.6, 14.4)])] }
}

// ---------------------------------------------------------------------------------------------------- chevron
// Today's tray chevron "<", drawn as a CLAW: a curved talon of bone and horn, the two arms meeting in a knuckle at the point,
// the arm ends filed to a hook. Solid (scratchboard), the grain of the horn and its shadow cut in along the arms, a split at
// the knuckle. No accent: the chevron carries no state.
function drawChevron(c) {
  c.keyline = { x: 12, y: 6, w: 24, h: 36, shape: "portrait" }
  var V = P(14.4, 23.8), A = P(33.6, 7.2), B = P(33.6, 40.4)
  function arm(end, bend) {
    var pts = []
    for (var i = 0; i <= 14; i++) { var t = i / 14, m = Math.sin(Math.PI * t) * bend; pts.push(P(lerp(V.x, end.x, t) + m * 0.6, lerp(V.y, end.y, t) + m * (end.y < V.y ? -0.3 : 0.3))) }
    return G.wobble(pts, c.rand, 0.12, false)
  }
  var up = arm(A, 1.4), dn = arm(B, -1.4)
  // the arms' thickness carries the budget (a solid claw has no contour to thin): WEIGHT.line scales it
  var wfn = function(t) { return lerp(c.tier === 0 ? 6.4 : 6.2, 1.8, Math.pow(t, 1.3)) * c.massK }
  var ru = G.ribbon(up, wfn, { taper: false }), rd = G.ribbon(dn, wfn, { taper: false })
  var knuckle = G.wobble(G.ellipse(V.x + 0.8, V.y, 3.1, 3.4, 16), c.rand, 0.2, true)
  c.silhouette = [ru, rd, flat(knuckle)]
  add(c, "line", "under", [ru, rd, flat(knuckle)], null, "mass:claw")
  if (c.tier >= 1) {
    // the horn's grain along the arms and the shadow under them, cut back to the ground
    var grain = []
    for (var g = 0; g < 3; g++) {
      var off = (g - 1) * 1.0
      grain.push(G.ribbon(up.slice(3, 12).map(function(p) { return P(p.x + off * 0.7, p.y + off) }), 0.32 * c.k, { taperPow: 0.5 }))
      grain.push(G.ribbon(dn.slice(3, 12).map(function(p) { return P(p.x + off * 0.7, p.y - off) }), 0.32 * c.k, { taperPow: 0.5 }))
    }
    add(c, "void", "under", grain, null, "grain")
    add(c, "void", "under", [G.ribbon(dn.slice(1, 13).map(function(p) { return P(p.x + 1.0, p.y + 0.9) }), 0.9 * c.k, { taperPow: 0.4 })], pts(rd), "under-shade")
    add(c, "void", "over", [G.crack({ k: c.k, rand: c.rand }, P(V.x - 1.6, V.y - 0.6), P(V.x + 2.6, V.y + 0.4), 2, 0.4, 0)], null, "split")
  }
  if (c.tier >= 1 && !c.light) add(c, "line", "over", outline(c, knuckle, 0.2, 0.4, { gaps: 1 }), null, "contour")
  c.highlight = { role: "paper", polys: [flat([P(17.2, 19.6), P(25.6, 12.0), P(26.2, 12.6), P(17.8, 20.6)])] }
}

// ---------------------------------------------------------------------------------------------------- ai
// Today's six AI forms (the user picks one: aiStyle), each a level icon whose quota fills like the disk. All five are drawn as
// scratchboard flesh (the form's solid mass in the line colour, its folds, fissures and shadow CUT back to the ground), and the
// quota is BLOOD SOAKING UP THROUGH THE CUTS from the bottom: below the level every fold runs red, with a wet band at the surface.
// So the accent is only in the folds (restraint), and the reading is where it was.
//   brain        today's lumpy brain: the left half's folds wound into today's spiral, the right half in gyri, a fissure between
//   classic      today's brain PNG redrawn as it looks: the scalloped blob, hatch in one family, the wound spiral, the fissure and the
//                two red cracks (cuts above the level, blood below), a heavy rim; calmer than `brain` (no gyri, ticks or pores)
//   hemispheres  the brain from above: two lobes, the deep fissure, gyri across
//   neurons      today's nodes and links: each node an eyeball on a nerve, its pupil filling with blood below the level
//   eye          today's eye: the sclera is the mass, iris and pupil, lashes; bloodshot veins rise in it with the level
//   spiral       today's spiral, as a groove cut in a disc of flesh, the blood run into it from the outer end
var AI_R = {
  brain: { c: [23.8, 23.1], r: [19.2, 19.5, 17.7, 17.4, 18.0, 16.8, 15.3, 15.3, 15.9, 15.9, 15.3, 14.7, 15.9, 17.1, 17.4, 16.5, 18.0, 19.2, 18.0, 17.7, 18.9, 17.7, 16.2, 15.9, 16.5, 15.9, 14.7, 14.4, 15.0, 16.2, 16.2, 15.6, 16.5, 18.3, 18.6, 17.7] },
  eye: { c: [24, 24], r: [19.1, 17.0, 14.9, 13.1, 11.7, 10.5, 9.8, 9.3, 8.9, 8.8, 8.9, 9.3, 9.8, 10.5, 11.6, 13.0, 14.9, 17.0, 19.0, 16.9, 14.8, 12.9, 11.5, 10.4, 9.7, 9.2, 8.8, 8.7, 8.8, 9.2, 9.7, 10.4, 11.5, 12.9, 14.9, 17.0] }
}
function radial(def, k) {
  var o = []
  for (var i = 0; i < def.r.length; i++) { var a = i / def.r.length * Math.PI * 2; o.push(P(def.c[0] + Math.cos(a) * def.r[i] * (k || 1), def.c[1] + Math.sin(a) * def.r[i] * (k || 1))) }
  return o
}
function hemiOutline(side) {     // one lobe of the brain from above (side -1 left, 1 right), fissure at x 24
  var o = []
  for (var i = 0; i <= 20; i++) { var t = i / 20, y = lerp(6.4, 41.6, t), w = 13.6 * Math.pow(Math.sin(Math.PI * t), 0.62) * (1 - 0.08 * Math.cos(Math.PI * 2 * t)); o.push(P(24 + side * (0.8 + w), y)) }
  o.push(P(24 + side * 0.8, 41.2)); o.push(P(24 + side * 0.8, 6.8))
  return o
}
var NEURONS = [[25.5, 8.6], [32.5, 13.6], [15.5, 12.6], [20.4, 16.6], [10.8, 18.2], [30.2, 22.1], [23.9, 23.9], [37.9, 24.0], [13.4, 28.4], [19.6, 31.0], [34.7, 34.7], [17.0, 38.3], [26.4, 40.3]]
var SYNAPSES = [[0, 1], [0, 3], [2, 3], [2, 4], [3, 6], [1, 5], [5, 6], [5, 7], [4, 8], [8, 9], [6, 9], [7, 10], [9, 11], [11, 12], [10, 12], [6, 10]]
// flesh as an engraving: the ground, and tone lines in the line colour following the form, lit from the upper left.
// `inc`: the dry part only (the datum REPLACES the marks it soaks: below the level the blood's lines stand in their place)
function fleshTone(cx, cy, rx, ry, kt) {
  return function(p) { var u = (p.x - cx) / rx, w = (p.y - cy) / ry; return clamp((0.82 - 0.38 * u - 0.32 * w - 0.25 * (u * u + w * w)) * (kt || 1), 0.08, 0.95) }
}
function flesh(c, region, cx, cy, rx, ry, dir, exc, kt, inc, wet) {
  ground(c, region, "under", "flesh")
  if (c.tier >= 1) {
    var fn = fleshTone(cx, cy, rx, ry, kt), d = dir === undefined ? 0 : dir
    toneField(c, region, fn, { exc: exc || [], inc: inc || [], dir: d, cross: false, spacing: 1.5, tag: "flesh-tone" })
    // on a light bar blood is the quieter mark: below the level the ink keeps every other line under it (wet = the soaked region)
    if (wet && !c.light) toneField(c, region, fn, { exc: exc || [], inc: wet, dir: d, cross: false, spacing: 2.2, phase: 0.29, tag: "flesh-wet" })
  }
  else add(c, LIT(c), "under", [flat(region)], null, "flesh-lit")
}
// the pen's second family (gekiga crosshatch): over the same flesh at another angle, only in the form's extremes (the lit side on a
// dark bar, the shadow side on a light one), so the engraving has the pen's layered hatch and not one flat family
function pen(c, region, fn, dir, inc, exc, tag) {
  if (c.tier < 1) return
  var f2 = function(p) { var t = fn(p); return c.light ? clamp((t - 0.6) * 3, 0, 1) : clamp(t / 0.4, 0, 1) }
  toneField(c, region, f2, { dir: dir, cross: false, spacing: 1.9, w: 0.8, phase: 0.61, inc: inc || [], exc: exc || [], tag: tag || "pen" })
}
// short sulcus ticks branching off a wave (the pen's flicks), alternating sides
function ticksOf(c, waves, len) {
  var out = []
  for (var w = 0; w < waves.length; w++) {
    var a = waves[w]
    for (var q = 2; q < a.length - 2; q += 3) {
      var s = ((w + q) % 2 ? 1 : -1), dx = a[q + 1].x - a[q - 1].x, dy = a[q + 1].y - a[q - 1].y, l = Math.hypot(dx, dy) || 1
      var nx = -dy / l * s, ny = dx / l * s, L = len * (0.8 + c.rand() * 0.5)
      out.push(G.resample([a[q], P(a[q].x + nx * L * 0.5 + dx / l * 0.3, a[q].y + ny * L * 0.5), P(a[q].x + nx * L, a[q].y + ny * L + 0.2)], 0.5, false))
    }
  }
  return out
}
function drawAi(c) {
  var st = c.state, form = String(st.form || "brain"), v = clamp(Number(st.value) || 0, 0, 1)
  c.keyline = { x: 4, y: 4, w: 40, h: 40, shape: "square" }
  var cuts = [], ticks = [], spiralCut = null, sil = [], body = null, Ytop = 6, Ybot = 42, lobes = null
  var cw = (c.tier === 0 ? 1.1 : 0.62) * c.k * Math.max(0.6, c.lineK) * (form === "brain" ? 1.6 : (form === "classic" ? 1.1 : 1))
  function wave(x0, x1, y, amp, n, ph) { var o = []; for (var i = 0; i <= n; i++) { var t = i / n; o.push(P(lerp(x0, x1, t), y + Math.sin(t * Math.PI * 3 + ph) * amp + (c.rand() - 0.5) * 0.4)) } return o }
  var waves = []
  if (form === "brain" || form === "hemispheres") {
    if (form === "brain") {
      body = G.wobble(G.resample(radial(AI_R.brain), 1.0, true), c.rand, 0.25, true); Ytop = 7.8; Ybot = 39.3
      sil.push(flat(body))
      // the fissure, then the left half's folds wound into a spiral, the right half in gyri
      cuts.push(G.wobble(G.resample([P(25.5, 9), P(23.6, 17), P(26, 25), P(24.2, 32), P(25.8, 38)], 0.8, false), c.rand, 0.3, false))
      var sp = [], turns = c.tier === 0 ? 1.5 : 2.4
      for (var q = 0; q <= 90; q++) { var t = q / 90, an = t * turns * Math.PI * 2 + 0.8, rr = lerp(9.4, 1.2, t); sp.push(P(14.6 + Math.cos(an) * rr, 23.5 + Math.sin(an) * rr * 0.95)) }
      spiralCut = G.wobble(sp, c.rand, 0.2, false)
      for (var g = 0; g < (c.tier === 0 ? 3 : 5); g++) { var wv = wave(28.5, 40 - Math.abs(g - 2) * 1.6, 12.5 + g * 5.4, 1.2, 10, g * 1.3); cuts.push(wv); waves.push(wv) }
    } else {
      var L = G.wobble(G.resample(hemiOutline(-1), 1.0, true), c.rand, 0.22, true)
      var R = G.wobble(G.resample(hemiOutline(1), 1.0, true), c.rand, 0.22, true)
      body = G.hull(L.concat(R)); Ytop = 6.4; Ybot = 41.6
      sil.push(flat(L), flat(R))
      lobes = [{ poly: L, cx: 17, name: "lobeL", cuts: [], waves: [] }, { poly: R, cx: 31, name: "lobeR", cuts: [], waves: [] }]
      for (var h = 0; h < (c.tier === 0 ? 4 : 7); h++) {
        var y = 9.5 + h * 4.6, wl = wave(12 + Math.abs(h - 3) * 0.8, 23, y, 1.0, 8, h * 0.9), wr = wave(25, 36 - Math.abs(h - 3) * 0.8, y + 1.2, 1.0, 8, h * 1.7 + 1)
        lobes[0].cuts.push(wl); lobes[0].waves.push(wl); lobes[1].cuts.push(wr); lobes[1].waves.push(wr)
      }
    }
    if (c.tier >= 1) {
      if (form === "brain") ticks = ticksOf(c, waves, 1.9)
      else for (var lb = 0; lb < 2; lb++) lobes[lb].ticks = ticksOf(c, lobes[lb].waves, 1.7)
    }
  } else if (form === "classic") {
    body = G.wobble(G.resample(radial(AI_R.brain), 1.0, true), c.rand, 0.15, true); Ytop = 7.8; Ybot = 39.3
    sil.push(flat(body))
    var wob = function(a, r) { return G.wobble(G.resample(a.map(function(q) { return P(q[0], q[1]) }), 0.8, false), c.rand, r, false) }
    cuts.push(wob([[24, 9.2], [25.2, 16.5], [23.3, 22.5], [24.3, 29.5], [22.7, 36]], 0.25))                        // the fissure
    cuts.push(wob([[35.3, 12.8], [32.4, 19.4], [28.6, 21.8], [25.5, 26.3], [24.4, 30.8], [22.1, 32.3]], 0.3))      // the long crack
    cuts.push(wob([[32.4, 19.4], [35.4, 20.1], [38.6, 21.4]], 0.2))                                                  // its branch
    cuts.push(wob([[9, 15], [12, 17.6], [14.6, 20.3]], 0.2))                                                         // the crack over the spiral
    if (c.tier >= 1) { var dr = radial(AI_R.brain, 0.84); for (var di = -6; di <= 6; di += 3) cuts.push(G.resample([dr[(di + 36) % 36], dr[(di + 37) % 36]], 0.6, false)) }   // the broken arc on the right
    var spc = [], turnsC = c.tier === 0 ? 1.3 : 1.9
    for (var qc = 0; qc <= 90; qc++) { var tc = qc / 90, anc = tc * turnsC * Math.PI * 2 + 0.8, rrc = lerp(7.4, 1.3, tc); spc.push(P(14.6 + Math.cos(anc) * rrc, 23.6 + Math.sin(anc) * rrc * 0.95)) }
    spiralCut = G.wobble(spc, c.rand, 0.15, false)
  } else if (form === "eye") {
    body = G.wobble(G.resample(radial(AI_R.eye), 1.0, true), c.rand, 0.15, true); Ytop = 15.2; Ybot = 32.8
    sil.push(flat(body))
  } else if (form === "spiral") {
    body = G.wobble(G.ellipse(24, 24, 20, 20, 48), c.rand, 0.2, true); Ytop = 4; Ybot = 44
    sil.push(flat(body))
  }
  // the level: everything below this y is soaked
  var yL = lerp(Ybot - 0.5, Ytop + 0.5, v)
  var above = [P(-2, -2), P(50, -2), P(50, yL), P(-2, yL)], below = [P(-2, yL), P(50, yL), P(50, 50), P(-2, 50)]
  function cutRibbons(list, w) { return list.map(function(pts) { return G.ribbon(pts, w, { taperPow: 0.35 }) }) }
  // the datum replaces: the dry folds (dark cut) above the level, the SAME folds as blood below it, at the same width
  function foldsDatum(cutList, tickList, grp, tg) {
    var rib = cutRibbons(cutList, cw), tk = cutRibbons(tickList || [], cw * 0.62)
    add(c, DARK(c), "under", rib.concat(tk), above, "folds")
    var bk = c.light ? 0.7 : 0.75      // the blood on a light bar is the louder: its folds a touch finer
    add(c, "blood", "level", cutRibbons(cutList, cw * bk).concat(cutRibbons(tickList || [], cw * 0.62 * bk)), below, "datum")
  }
  // the blood that soaks the flesh below the level: fine lines standing where the dry hatch is not
  function soak(region) {
    if (c.tier >= 1) toneField(c, region, function() { return 0.3 }, { role: "blood", layer: "level", inc: [below], dir: 0, cross: false, spacing: 8.0, w: 0.7, tag: "datum" })
  }
  if (form === "neurons") {
    var nerves = SYNAPSES.map(function(e) { var a = NEURONS[e[0]], b = NEURONS[e[1]]; return G.wobble(G.resample([P(a[0], a[1]), P((a[0] + b[0]) / 2 + 0.6, (a[1] + b[1]) / 2 - 0.5), P(b[0], b[1])], 0.9, false), c.rand, 0.25, false) })
    // light bars: nerves one pen line (1.0 px), cells an ink ring round a ground interior (not solid)
    var nr = cutRibbons(nerves, (c.tier === 0 ? 1.6 : (c.light ? 0.85 : 1.0)) * c.k * (c.light ? c.massK : Math.min(c.massK, 1.8)))
    add(c, "line", "under", nr, c.light ? above : null, "nerves")
    if (c.light) add(c, "blood", "under", nr, below, "datum")      // a light bar: the nerves stay ink, the blood is in the eyeballs
    var ROW = function(n) { return n[1] < 17 ? "A" : (n[1] <= 30 ? "B" : "C") }
    var rows = { A: [], B: [], C: [] }
    for (var i = 0; i < NEURONS.length; i++) rows[ROW(NEURONS[i])].push(i)
    var R0 = (c.tier === 0 ? 3.0 : 2.35) * Math.min(c.massK, c.light ? 1.8 : 1.2)
    var rk = ["A", "B", "C"]
    for (var s2 = 0; s2 < nr.length; s2++) sil.push(nr[s2])
    // pass 1: the eyeballs of each row (cell + its blood), pass 2: the pupils and glints of each row
    for (var ri = 0; ri < 3; ri++) {
      var idx = rows[rk[ri]], mx = 0, my = 0, cells = [], blood = []
      for (var j = 0; j < idx.length; j++) { mx += NEURONS[idx[j]][0] / idx.length; my += NEURONS[idx[j]][1] / idx.length }
      rig(c, "cells" + rk[ri], mx, my)
      for (j = 0; j < idx.length; j++) {
        var N = NEURONS[idx[j]], cell = G.wobble(G.ellipse(N[0], N[1], R0, R0, 14), c.rand, 0.15, true)
        cells.push(flat(cell)); sil.push(flat(cell))
        if (N[1] > yL) blood.push(flat(G.ellipse(N[0], N[1], R0 * (c.light ? 0.7 : 0.9), R0 * (c.light ? 0.7 : 0.9), 12)))
      }
      if (c.light && c.tier >= 1) {
        add(c, "void", "under", cells, null, "cells-ground")
        var ringW = 0.75 * c.k * Math.max(0.6, c.lineK)
        add(c, "line", "under", idx.map(function(k) { var N = NEURONS[k]; return G.ribbon(G.ellipse(N[0], N[1], R0 - ringW * 0.5, R0 - ringW * 0.5, 14).concat([P(N[0] + R0 - ringW * 0.5, N[1])]), ringW, { taper: false }) }), null, "mass:cells")
      } else add(c, "line", "under", cells, null, "mass:cells")
      add(c, "blood", "level", blood, null, "datum")
    }
    for (ri = 0; ri < 3; ri++) {
      idx = rows[rk[ri]]; mx = 0; my = 0
      for (j = 0; j < idx.length; j++) { mx += NEURONS[idx[j]][0] / idx.length; my += NEURONS[idx[j]][1] / idx.length }
      rig(c, "pupils" + rk[ri], mx, my)
      add(c, "void", "level", idx.map(function(k) { var N = NEURONS[k]; return flat(G.ellipse(N[0] + 0.4, N[1] + 0.3, R0 * 0.48, R0 * 0.48, 10)) }), null, "pupils")
      if (c.tier >= 1) add(c, "void", "over", idx.map(function(k) { var N = NEURONS[k]; return flat(G.ellipse(N[0] - 0.9, N[1] - 1.0, 0.45, 0.45, 6)) }), null, "glints")
    }
    rig(c, "")
  } else if (form === "eye") {
    var E = P(24.6, 24.2), ir = 6.0, iris = G.ellipse(E.x, E.y, ir, ir, 20)
    rig(c, "eye", 24, 24)
    flesh(c, body, 24, 24, 19, 9, 0)
    // lashes above (today's), as wet clumps
    var lashes = []
    for (var l = 0; l < 7; l++) { var lx = lerp(13, 35, l / 6), ly = 15.6 + Math.pow((lx - 24) / 11, 2) * 3.4; lashes.push(G.ribbon([P(lx, ly), P(lx + (lx - 24) * 0.12, ly - 3.6 - (l % 2) * 0.8)], 0.8 * c.k * c.lw, { taperPow: 0.6 })) }
    add(c, "line", "under", lashes, null, "lashes")
    for (var w2 = 0; w2 < lashes.length; w2++) sil.push(lashes[w2])
    // bloodshot: veins rise in the sclera with the level (the datum), cut in where they are above it; 0.8 px wide
    var veins = []
    for (var vv = 0; vv < (c.tier === 0 ? 4 : 8); vv++) {
      var side = vv % 2 ? 1 : -1, y0 = 18 + (vv >> 1) * 3.5, x0 = 24 + side * 18
      veins.push(G.wobble(G.resample([P(x0, y0), P(24 + side * 12, y0 + (c.rand() - 0.5) * 3), P(E.x + side * (ir + 0.4), E.y + (c.rand() - 0.5) * 4)], 0.8, false), c.rand, 0.35, false))
    }
    var vr = cutRibbons(veins, c.tier === 0 ? cw : 0.8 * c.k * Math.max(0.6, c.lineK))
    add(c, DARK(c), "under", vr, above, "veins")
    add(c, "blood", "level", vr, below, "datum")
    rig(c, "iris", E.x, E.y)
    add(c, "void", "under", [flat(iris)], null, "iris-ground")
    add(c, "line", "under", outline(c, iris, 0.4, 0.9, { gaps: 0 }), null, "iris-rim")
    if (c.tier >= 1) toneField(c, G.ellipse(E.x, E.y, ir - 0.6, ir - 0.6, 18), function(p) { return 0.55 - 0.3 * (p.x - E.x + p.y - E.y) / (2 * ir) }, { center: E, r0: 2.3, cross: false, spacing: 1.5, w: 0.7, tag: "iris-fibres" })
    base(c, G.ellipse(E.x + 0.3, E.y + 0.2, 2.4, 2.6, 14), 0.02, "under", "mass:pupil")
    rig(c, "eye", 24, 24)
    // the lids' crease and the lower lid's shadow, cut
    if (c.tier >= 1) add(c, DARK(c), "over", [G.ribbon(radial(AI_R.eye, 0.82).slice(20, 35), 0.5 * c.k, { taperPow: 0.4 })], null, "lid")
    // the bloodshot sclera below the level: the engraving there is blood, line for line (it replaces the dry marks)
    add(c, "void", "level", [flat(body)], below, "soak-ground")
    if (c.tier >= 1 && !c.light) toneField(c, body, function() { return 0.18 }, { layer: "level", inc: [below], exc: [iris], dir: 0, cross: false, spacing: 1.5, phase: 0.7, tag: "soak-ink" })
    if (c.tier >= 1) toneField(c, body, function(p) { return 0.88 - 0.2 * (p.x - 24) / 19 }, { role: "blood", layer: "level", inc: [below], exc: [iris], dir: 0, cross: false, spacing: 1.5, tag: "datum" })
    else add(c, "blood", "level", [flat(body)], below, "datum")
    var bandE = G.bandOf(body, yL, yL + 0.9)
    if (v > 0.02 && v < 0.98) add(c, "blood", "level", [flat(bandE)], null, "datum")
    add(c, "line", "over", outline(c, body, 0.5, c.tier === 0 ? 1.6 : 1.2, { gaps: 1 }), null, "contour")
    rig(c, "")
  } else if (form === "spiral") {
    // today's spiral as a groove cut in a disc of flesh, the blood run into it from the outer end; the pen puckers the skin round it
    var tr = c.tier === 0 ? 2.0 : 3.0, spr = []
    for (var z = 0; z <= 160; z++) { var tt = z / 160, a3 = -tt * tr * Math.PI * 2 - 1.6, r3 = lerp(18, 1.6, tt); spr.push(P(24 + Math.cos(a3) * r3, 24 + Math.sin(a3) * r3)) }
    spr = G.wobble(spr, c.rand, 0.15, false)
    var gw = (c.tier === 0 ? 1.8 : 2.2) * c.k * Math.max(0.7, c.lineK) * (c.light ? 1 : 1)
    if (c.tier >= 1) gw *= c.light ? 1.2 : 0.95
    flesh(c, body, 24, 24, 20, 20, 45, null, c.light ? 0.3 : 0.95)
    if (c.tier >= 1) {
      var fn = fleshTone(24, 24, 20, 20, c.light ? 0.3 : 0.95)
      pen(c, body, fn, 135, null, null, "pen")
      // pucker strokes: short thick-thin pen lines pointing at the centre round the rim, more on the shaded side
      var pk = []
      for (var pi = 0; pi < 24; pi++) {
        var pa = (pi + c.rand() * 0.6) / 24 * Math.PI * 2, shade = 0.5 + 0.5 * Math.cos(pa - Math.PI / 4), keep = c.light ? 0.2 + 0.7 * (1 - shade) : 0.4 + 0.6 * shade
        if (c.rand() > keep) continue
        var r0 = 18.2 + c.rand() * 0.6, r1 = r0 - (2.0 + c.rand() * 2.2)
        pk.push(G.ribbon(G.resample([P(24 + Math.cos(pa) * r0, 24 + Math.sin(pa) * r0), P(24 + Math.cos(pa + 0.05) * (r0 + r1) / 2, 24 + Math.sin(pa + 0.05) * (r0 + r1) / 2), P(24 + Math.cos(pa + 0.08) * r1, 24 + Math.sin(pa + 0.08) * r1)], 0.7, false), 0.7 * c.k * Math.max(0.5, c.lineK), { taperPow: 0.5, bias: 0.4 }))
      }
      add(c, "line", "under", pk, null, "pucker")
      add(c, "line", "under", G.stipple(c, G.ellipse(24, 24, 15, 15, 20), [], c.tier === 1 ? 7 : 14, 0.38, { lean: c.light ? 1 : -1 }), null, "pores")
    }
    var fillN = Math.max(0, Math.round(spr.length * v))
    rig(c, "spiral", 24, 24)
    add(c, DARK(c), "under", [G.ribbon(spr, gw, { taperPow: 0.1 })], null, "groove")
    // an empty datum still has a mark: the groove's lit lip (upper-left side), where the blood has not covered it
    if (c.tier >= 1 && v < 0.98) add(c, LIT(c), "under", [G.ribbon(spr.slice(Math.max(0, fillN - 1)).map(function(p) { return P(p.x - 0.35 * c.k, p.y - 0.35 * c.k) }), 0.5 * c.k * c.lw, { taperPow: 0.2 })], null, "groove-lip")
    if (v > 0.004) {
      var fill = spr.slice(0, Math.max(2, fillN))
      add(c, "blood", "level", [G.ribbon(fill, gw * (c.light ? 0.44 : 0.56), { taperPow: 0.08 })], null, "datum")
    }
    rig(c, "")
    if (v > 0.004) {
      var fl = spr.slice(0, Math.max(2, fillN)), fe = fl[fl.length - 1], nx2 = spr[Math.min(spr.length - 1, fl.length + 3)]
      rig(c, "bead", fe.x, fe.y, { tx: nx2.x, ty: nx2.y })
      dot(c, fe.x, fe.y, gw / c.k * 0.55, "blood", "level", "datum")
      rig(c, "")
    }
  }
  if (form === "brain") {
    flesh(c, body, 23.8, 23.1, 19, 16, 0, null, 1, [above], [below])
    if (c.tier >= 1) {
      var fnb = fleshTone(23.8, 23.1, 19, 16, 1)
      pen(c, body, fnb, 62, [above], null, "pen")
      // pores on the lit gyri
      add(c, "line", "under", G.stipple(c, body, [], c.tier === 1 ? 5 : 12, 0.36, { lean: c.light ? 1 : -1 }), above, "pores")
    }
    rig(c, "spiral", 14.6, 23.5)
    var sr = [G.ribbon(spiralCut, cw, { taperPow: 0.35 })]
    add(c, DARK(c), "under", sr, above, "folds")
    add(c, "blood", "level", [G.ribbon(spiralCut, cw * (c.light ? 0.75 : 0.8), { taperPow: 0.35 })], below, "datum")
    rig(c, "")
    foldsDatum(cuts, ticks)
    soak(body)
    var band = G.bandOf(body, yL, yL + 0.8)
    if (v > 0.02 && v < 0.98) add(c, "blood", "over", [flat(band)], body, "datum")
  } else if (form === "classic") {
    // one hatch family at the PNG's angle, open enough for the spiral and the cracks to stand out (the calm `brain` lacks)
    ground(c, body, "under", "flesh")
    if (c.tier >= 1) toneField(c, body, fleshTone(23.8, 23.1, 19, 16, 0.9), { inc: [above], dir: 55, cross: false, spacing: 3.0, w: 0.6, tag: "flesh-tone" })
    else add(c, LIT(c), "under", [flat(body)], null, "flesh-lit")
    // the datum is INK: below the level the body is soaked black, a dense hatch standing where the dry marks were
    if (c.tier >= 1) toneField(c, body, function() { return c.light ? 0.85 : 0.15 }, { layer: "level", inc: [below], dir: 55, cross: false, spacing: c.light ? 1.9 : 2.6, w: 0.75, tag: "datum-ink" })
    else add(c, "line", "level", [flat(body)], below, "datum-ink")
    rig(c, "spiral", 14.6, 23.6)
    // the spiral and the cracks are drawn marks (line) on both bars: the hatch is open, so a cut would not show on paper
    add(c, "line", "under", [G.ribbon(spiralCut, cw * 1.35, { taperPow: 0.25 })], above, "folds")
    add(c, "blood", "level", [G.ribbon(spiralCut, cw * 1.1, { taperPow: 0.25 })], below, "datum")
    rig(c, "")
    add(c, "line", "under", cutRibbons(cuts, cw), above, "folds")
    add(c, "blood", "level", cutRibbons(cuts, cw * 0.8), below, "datum")
    var bandC = G.bandOf(body, yL, yL + 0.9)
    if (v > 0.02 && v < 0.98) add(c, "blood", "over", [flat(bandC)], body, "datum")      // the meniscus
  } else if (form === "hemispheres") {
    for (var hl = 0; hl < 2; hl++) {
      var lo = lobes[hl]
      rig(c, lo.name, lo.cx, 24)
      flesh(c, lo.poly, lo.cx, 24, 8, 18, 90, null, 1.3, [above], [below])
      if (c.tier >= 1) pen(c, lo.poly, fleshTone(lo.cx, 24, 8, 18, 1.3), 20, [above], null, "pen")
      foldsDatum(lo.cuts, lo.ticks)
      soak(lo.poly)
      var bandH = G.bandOf(lo.poly, yL, yL + 0.8)
      if (v > 0.02 && v < 0.98) add(c, "blood", "level", [flat(bandH)], null, "datum")
      add(c, "line", "over", outline(c, lo.poly, 0.6, c.tier === 0 ? 1.6 : 1.3, { gaps: 1 }), null, "contour")
      rig(c, "")
    }
  }
  c.silhouette = sil
  if (form === "brain" || form === "spiral") add(c, "line", "over", outline(c, body, 0.5, c.tier === 0 ? 1.6 : 1.2, { gaps: 1 }), null, "contour")
  else if (form === "classic") add(c, "line", "over", outline(c, body, 0.5, c.tier === 0 ? 1.6 : 1.15, { gaps: 1, gapLen: 0.7 * c.k }), null, "contour")      // the PNG rim: heavy, one small break on the shadow side
  var hb = form === "eye" ? [P(16, 20.6), P(19.6, 18.6), P(20.2, 19.3), P(16.6, 21.4)] : [P(13.4, 13.6), P(17.4, 10.6), P(18, 11.4), P(14, 14.4)]
  if (form === "neurons") hb = [P(24.6, 7.4), P(26.2, 6.9), P(26.4, 7.6), P(24.8, 8.1)]
  c.highlight = { role: "paper", polys: [flat(hb)] }
}

var DRAW = { audio: drawAudio, display: drawDisplay, bluetooth: drawBluetooth, chevron: drawChevron, ai: drawAi }

function iconParts(kind, state, sizePx, seed, opts) {
  var draw = DRAW[kind]
  if (!draw) return null
  var c = K.kit(kind, state, Math.max(8, Number(sizePx) || 29), seed, opts)
  draw(c)
  return K.finish(c)
}

if (typeof module !== "undefined") module.exports = { KINDS: KINDS, STATES: STATES, NOMINAL: NOMINAL, CURRENT: CURRENT, WEIGHT: WEIGHT, iconParts: iconParts, DRAW: DRAW }
